import { describe, expect, it } from 'vitest'
import {
  actionRequiresApproval,
  advanceSimulation,
  applyAuthorizedActions,
  approvalReasons,
  computeMetrics,
  createInitialState,
  recordPlan,
  requestHumanDecision,
  resolveOverride,
  simulateDelayImpact,
  simulateRecoveryPlan,
  updateHumanPolicy,
} from './simulation'
import type { PlanStrategy, SimulationState } from './types'

function plannedState(strategy: PlanStrategy = 'balanced'): SimulationState {
  const initial = createInitialState()
  const plan = simulateRecoveryPlan(initial, strategy)
  return recordPlan(initial, plan)
}

describe('Switchboard Zero deterministic engine', () => {
  it('starts from the documented crisis state', () => {
    const state = createInitialState()
    expect(computeMetrics(state)).toMatchObject({
      coverage: 58,
      criticalAvailability: 83,
      riskScore: 74,
      servedMw: 46,
      availableMw: 52,
    })
    expect(state.policy.lockedDistricts).toEqual(['water', 'transit'])
  })

  it('builds a complete balanced restoration from the same state', () => {
    const first = simulateRecoveryPlan(createInitialState(), 'balanced')
    const second = simulateRecoveryPlan(createInitialState(), 'balanced')
    expect(first).toEqual(second)
    expect(first.steps).toEqual([
      'isolate_damaged_feeder',
      'connect_battery_reserve',
      'reroute_north_loop',
      'transfer_transit_feed',
      'restore_transit_service',
    ])
    expect(first).toMatchObject({ projectedCoverage: 100, projectedRisk: 18, projectedDurationMinutes: 16 })
  })

  it('executes authorized steps in order and stops at the first policy boundary', () => {
    const planned = plannedState()
    const result = applyAuthorizedActions(planned, planned.lastPlan!)

    expect(result.executed).toEqual([
      'isolate_damaged_feeder',
      'connect_battery_reserve',
      'reroute_north_loop',
    ])
    expect(result.blocked).toEqual(['transfer_transit_feed'])
    expect(result.state.completedActions).not.toContain('restore_transit_service')
    expect(result.state.withheldActions).toEqual(['transfer_transit_feed'])
    expect(result.state.phase).toBe('awaiting-human')
    expect(computeMetrics(result.state)).toMatchObject({ coverage: 80, riskScore: 24 })
    expect(result.state.minute).toBe(6)
  })

  it('does not allow a human request before policy has actually withheld the action', () => {
    expect(() => requestHumanDecision(
      plannedState(),
      'transfer_transit_feed',
      'Restore Old Town through a temporary Transit interruption.',
    )).toThrow(/Apply the plan first/)
  })

  it('lets the human authorize the trade-off and the agent finish full restoration', () => {
    const planned = plannedState()
    const withheld = applyAuthorizedActions(planned, planned.lastPlan!).state
    const requested = requestHumanDecision(
      withheld,
      'transfer_transit_feed',
      'Restore Old Town while Transit pauses until the protected alternate feed is ready.',
    )
    const approved = resolveOverride(requested, 'approval-1', 'approved')

    expect(approved.phase).toBe('active')
    expect(approved.districts.find(({ id }) => id === 'old-town')?.status).toBe('online')
    expect(approved.districts.find(({ id }) => id === 'transit')?.status).toBe('offline')

    const completed = applyAuthorizedActions(approved, approved.lastPlan!).state
    expect(computeMetrics(completed)).toMatchObject({ coverage: 100, riskScore: 18, servedMw: 72, availableMw: 76 })
    expect(completed.minute).toBe(16)
    expect(completed.phase).toBe('resolved')
    expect(completed.outcome).toMatchObject({ id: 'safe-restoration', score: 96 })
    expect(completed.districts.find(({ id }) => id === 'transit')?.status).toBe('online')
  })

  it('records a coherent protected outcome when the human rejects the trade-off', () => {
    const planned = plannedState()
    const withheld = applyAuthorizedActions(planned, planned.lastPlan!).state
    const requested = requestHumanDecision(withheld, 'transfer_transit_feed', 'Keep Transit online and accept lower coverage.')
    const rejected = resolveOverride(requested, 'approval-1', 'rejected')

    expect(computeMetrics(rejected).coverage).toBe(80)
    expect(rejected.completedActions).not.toContain('transfer_transit_feed')
    expect(rejected.phase).toBe('resolved')
    expect(rejected.outcome?.id).toBe('protected-recovery')
  })

  it('gives low, medium and high risk ceilings distinct effects', () => {
    const initial = createInitialState()
    expect(actionRequiresApproval(initial, 'transfer_transit_feed')).toBe(true)
    expect(approvalReasons(initial, 'transfer_transit_feed')).toHaveLength(3)

    const mediumBoundary = updateHumanPolicy(initial, {
      lockedDistricts: ['water'],
      requireApprovalBeforeOutage: false,
      riskTolerance: 'medium',
    })
    expect(actionRequiresApproval(mediumBoundary, 'transfer_transit_feed')).toBe(false)
    expect(actionRequiresApproval(mediumBoundary, 'bypass_solar_interlock')).toBe(true)

    const highButLocked = updateHumanPolicy(mediumBoundary, { riskTolerance: 'high' })
    expect(actionRequiresApproval(highButLocked, 'bypass_solar_interlock')).toBe(true)
    const highUnlocked = updateHumanPolicy(highButLocked, { lockedDistricts: [] })
    expect(actionRequiresApproval(highUnlocked, 'bypass_solar_interlock')).toBe(false)
  })

  it('can complete maximum coverage only after the operator broadens both boundaries', () => {
    const boundary = updateHumanPolicy(createInitialState(), { lockedDistricts: [], riskTolerance: 'high' })
    const plan = simulateRecoveryPlan(boundary, 'maximum-coverage')
    const planned = recordPlan(boundary, plan)
    const completed = applyAuthorizedActions(planned, plan).state

    expect(computeMetrics(completed)).toMatchObject({ coverage: 100, riskScore: 56 })
    expect(completed.outcome).toMatchObject({ id: 'risk-accepted', score: 68 })
  })

  it('forecasts a missed deadline without mutating the live state', () => {
    const state = createInitialState()
    const forecast = simulateDelayImpact(state, 8)

    expect(forecast).toMatchObject({ applied: false, cascadeLikely: true, toMinute: 8 })
    expect(forecast.projectedMetrics).toMatchObject({ coverage: 47, riskScore: 96 })
    expect(state.minute).toBe(0)
    expect(state.phase).toBe('active')
  })

  it('lets only the human scenario control produce the timed failure outcome', () => {
    const failed = advanceSimulation(createInitialState(), 8)
    expect(failed.districts.find(({ id }) => id === 'hospital')?.status).toBe('brownout')
    expect(failed.riskScore).toBe(96)
    expect(failed.phase).toBe('failed')
    expect(failed.outcome?.id).toBe('cascade-failure')
  })

  it('finishes the protected plan as a valid contained outcome', () => {
    const planned = plannedState('critical-first')
    const completed = applyAuthorizedActions(planned, planned.lastPlan!).state
    expect(computeMetrics(completed)).toMatchObject({ coverage: 80, riskScore: 24 })
    expect(completed.outcome?.id).toBe('protected-recovery')
  })
})
