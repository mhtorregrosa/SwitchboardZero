import { describe, expect, it } from 'vitest'
import {
  actionRequiresApproval,
  advanceSimulation,
  applySafeSwitches,
  computeMetrics,
  createInitialState,
  requestOverride,
  resolveOverride,
  simulateRecoveryPlan,
  updateHumanPolicy,
} from './simulation'

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
  })

  it('builds the same balanced plan from the same state', () => {
    const first = simulateRecoveryPlan(createInitialState(), 'balanced')
    const second = simulateRecoveryPlan(createInitialState(), 'balanced')
    expect(first).toEqual(second)
    expect(first.steps).toEqual([
      'isolate_damaged_feeder',
      'connect_battery_reserve',
      'reroute_north_loop',
      'transfer_transit_feed',
    ])
  })

  it('executes safe steps and pauses at an active-district outage', () => {
    const state = createInitialState()
    const plan = simulateRecoveryPlan(state, 'balanced')
    const result = applySafeSwitches(state, plan)

    expect(result.executed).toEqual([
      'isolate_damaged_feeder',
      'connect_battery_reserve',
      'reroute_north_loop',
    ])
    expect(result.blocked).toEqual(['transfer_transit_feed'])
    expect(computeMetrics(result.state)).toMatchObject({ coverage: 80, riskScore: 24 })
    expect(result.state.minute).toBe(6)
  })

  it('lets the human approve the balanced service trade-off', () => {
    const initial = createInitialState()
    const safe = applySafeSwitches(initial, simulateRecoveryPlan(initial, 'balanced')).state
    const requested = requestOverride(
      safe,
      'transfer_transit_feed',
      'Restore Old Town while Transit Hub pauses for approximately eight minutes.',
    )
    const resolved = resolveOverride(requested, 'approval-1', 'approved')

    expect(computeMetrics(resolved)).toMatchObject({ coverage: 90, riskScore: 22 })
    expect(resolved.minute).toBe(8)
    expect(resolved.districts.find(({ id }) => id === 'old-town')?.status).toBe('online')
    expect(resolved.districts.find(({ id }) => id === 'transit')?.status).toBe('offline')
    expect(resolved.audit.at(-1)?.actor).toBe('human')
  })

  it('keeps the sensitive action unapplied when the human rejects it', () => {
    const initial = createInitialState()
    const safe = applySafeSwitches(initial, simulateRecoveryPlan(initial, 'balanced')).state
    const requested = requestOverride(safe, 'transfer_transit_feed', 'Keep Transit online unless a human accepts the outage.')
    const resolved = resolveOverride(requested, 'approval-1', 'rejected')

    expect(computeMetrics(resolved).coverage).toBe(80)
    expect(resolved.completedActions).not.toContain('transfer_transit_feed')
  })

  it('honours a human decision to broaden the automatic boundary', () => {
    const initial = createInitialState()
    const maximumPlan = simulateRecoveryPlan(initial, 'maximum-coverage')
    expect(actionRequiresApproval(initial, 'bypass_solar_interlock')).toBe(true)

    const highTolerance = updateHumanPolicy(initial, { riskTolerance: 'high' })
    expect(actionRequiresApproval(highTolerance, 'bypass_solar_interlock')).toBe(false)
    const result = applySafeSwitches(highTolerance, maximumPlan)
    expect(result.blocked).toEqual([])
    expect(computeMetrics(result.state)).toMatchObject({ coverage: 100, riskScore: 56 })
  })

  it('honours a human decision to permit an automatic service transfer', () => {
    const initial = updateHumanPolicy(createInitialState(), { requireApprovalBeforeOutage: false })
    const result = applySafeSwitches(initial, simulateRecoveryPlan(initial, 'balanced'))
    expect(result.blocked).toEqual([])
    expect(computeMetrics(result.state).coverage).toBe(90)
  })

  it('cascades into the hospital feed at minute eight if the feeder remains live', () => {
    const state = advanceSimulation(createInitialState(), 8)
    expect(state.districts.find(({ id }) => id === 'hospital')?.status).toBe('brownout')
    expect(state.riskScore).toBe(96)
  })

  it('prevents the timed cascade after the feeder is isolated', () => {
    const initial = createInitialState()
    const protectedState = applySafeSwitches(initial, simulateRecoveryPlan(initial, 'critical-first')).state
    const advanced = advanceSimulation(protectedState, 8)
    expect(advanced.districts.find(({ id }) => id === 'hospital')?.status).toBe('online')
    expect(advanced.riskScore).toBe(24)
  })
})
