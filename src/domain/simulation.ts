import type {
  ActionExecutionResult,
  ActionId,
  ApprovalRequest,
  AuditEvent,
  District,
  DistrictId,
  EnergySource,
  GridLine,
  GridMetrics,
  HumanPolicy,
  MissionOutcome,
  PlanStrategy,
  RecoveryAction,
  RecoveryPlan,
  RiskTolerance,
  SimulationState,
} from './types'

export const planStrategies = ['critical-first', 'balanced', 'maximum-coverage'] as const satisfies readonly PlanStrategy[]
export const sensitiveActionIds = ['transfer_transit_feed', 'bypass_solar_interlock'] as const satisfies readonly ActionId[]

export const recoveryActions: Record<ActionId, RecoveryAction> = {
  isolate_damaged_feeder: {
    id: 'isolate_damaged_feeder',
    label: 'Isolate the damaged East Ring feeder',
    shortLabel: 'Isolate East Ring',
    description: 'Open both sides of the damaged feeder before the thermal fault propagates.',
    consequence: 'No active district is disconnected. Cascade probability falls sharply.',
    durationMinutes: 1,
    risk: 'low',
    requiresApproval: false,
  },
  connect_battery_reserve: {
    id: 'connect_battery_reserve',
    label: 'Connect the North battery reserve',
    shortLabel: 'Connect reserve',
    description: 'Bring the isolated 24 MW battery bank onto the protected bus.',
    consequence: 'Emergency Shelter leaves brownout without affecting an online district.',
    durationMinutes: 2,
    risk: 'low',
    requiresApproval: false,
  },
  reroute_north_loop: {
    id: 'reroute_north_loop',
    label: 'Reroute the North residential loop',
    shortLabel: 'Reroute North',
    description: 'Feed North Homes through the reserve bus instead of the failed East Ring.',
    consequence: 'North Homes returns online. All human-locked services remain protected.',
    durationMinutes: 3,
    risk: 'low',
    requiresApproval: false,
  },
  transfer_transit_feed: {
    id: 'transfer_transit_feed',
    label: 'Transfer the Transit feed to Old Town',
    shortLabel: 'Transfer Transit feed',
    description: 'Temporarily disconnect Transit Hub and use its stable feeder for Old Town.',
    consequence: 'Old Town returns online; Transit Hub pauses while an alternate protected feed is prepared.',
    durationMinutes: 2,
    risk: 'medium',
    requiresApproval: true,
  },
  restore_transit_service: {
    id: 'restore_transit_service',
    label: 'Restore Transit through the reserve bus',
    shortLabel: 'Restore Transit',
    description: 'Complete the protected cross-tie and return Transit Hub to service after the temporary transfer window.',
    consequence: 'Transit Hub returns online. Old Town remains supplied and every district is restored.',
    durationMinutes: 8,
    risk: 'low',
    requiresApproval: false,
  },
  bypass_solar_interlock: {
    id: 'bypass_solar_interlock',
    label: 'Bypass the South solar safety interlock',
    shortLabel: 'Bypass solar interlock',
    description: 'Reconnect the storm-damaged solar field before its protection relay is inspected.',
    consequence: 'All districts are powered immediately, but the uninspected relay exposes Water Treatment to a secondary fault.',
    durationMinutes: 2,
    risk: 'high',
    requiresApproval: true,
  },
}

const initialDistricts: District[] = [
  {
    id: 'hospital',
    name: 'Central Hospital',
    shortName: 'Hospital',
    description: 'Trauma, intensive care and emergency surgery.',
    demandMw: 18,
    serviceWeight: 22,
    critical: true,
    status: 'online',
    x: 557,
    y: 92,
  },
  {
    id: 'water',
    name: 'Water Treatment',
    shortName: 'Water',
    description: 'Pumping and treatment for the entire city.',
    demandMw: 14,
    serviceWeight: 20,
    critical: true,
    status: 'online',
    x: 702,
    y: 220,
  },
  {
    id: 'shelter',
    name: 'Emergency Shelter',
    shortName: 'Shelter',
    description: 'Heating, medical refrigeration and communications.',
    demandMw: 8,
    serviceWeight: 12,
    critical: true,
    status: 'brownout',
    x: 540,
    y: 275,
  },
  {
    id: 'north',
    name: 'North Homes',
    shortName: 'North',
    description: 'Residential loop serving 3,200 people.',
    demandMw: 12,
    serviceWeight: 16,
    critical: false,
    status: 'offline',
    x: 405,
    y: 105,
  },
  {
    id: 'old-town',
    name: 'Old Town',
    shortName: 'Old Town',
    description: 'Dense residential district serving 4,800 people.',
    demandMw: 10,
    serviceWeight: 20,
    critical: false,
    status: 'offline',
    x: 690,
    y: 415,
  },
  {
    id: 'transit',
    name: 'Transit Hub',
    shortName: 'Transit',
    description: 'Evacuation trains and city bus coordination.',
    demandMw: 10,
    serviceWeight: 10,
    critical: false,
    status: 'online',
    x: 430,
    y: 415,
  },
]

const initialLines: GridLine[] = [
  { id: 'turbine-core', label: 'Harbor trunk', from: 'turbine', to: 'core', status: 'online', path: 'M105 145 C155 155 205 205 260 255' },
  { id: 'core-hospital', label: 'Hospital protected feed', from: 'core', to: 'hospital', status: 'online', path: 'M260 255 C365 185 450 120 557 92' },
  { id: 'core-water', label: 'Water protected feed', from: 'core', to: 'water', status: 'online', path: 'M260 255 C405 215 555 215 702 220' },
  { id: 'core-shelter', label: 'Shelter feeder', from: 'core', to: 'shelter', status: 'online', path: 'M260 255 C355 260 445 270 540 275' },
  { id: 'core-transit', label: 'Transit feeder', from: 'core', to: 'transit', status: 'online', path: 'M260 255 C315 315 365 370 430 415' },
  { id: 'east-ring', label: 'East Ring', from: 'water', to: 'old-town', status: 'faulted', path: 'M702 220 C735 285 728 350 690 415' },
  { id: 'battery-link', label: 'Reserve bus', from: 'battery', to: 'core', status: 'standby', path: 'M112 407 C160 360 208 305 260 255' },
  { id: 'north-loop', label: 'North loop', from: 'core', to: 'north', status: 'standby', path: 'M260 255 C285 180 330 125 405 105' },
  { id: 'oldtown-spur', label: 'Old Town transfer', from: 'transit', to: 'old-town', status: 'standby', path: 'M430 415 C515 450 605 448 690 415' },
  { id: 'solar-relay', label: 'Solar relay', from: 'solar', to: 'old-town', status: 'faulted', path: 'M745 505 C730 470 712 442 690 415' },
]

const initialSources: EnergySource[] = [
  { id: 'turbine', name: 'Harbor turbine', outputMw: 52, status: 'online' },
  { id: 'battery', name: 'North reserve', outputMw: 24, status: 'standby' },
  { id: 'solar', name: 'South solar field', outputMw: 12, status: 'offline' },
]

function addAudit(
  state: SimulationState,
  event: Omit<AuditEvent, 'id' | 'minute'> & { minute?: number },
): AuditEvent[] {
  return [
    ...state.audit,
    {
      ...event,
      id: `event-${state.audit.length + 1}`,
      minute: event.minute ?? state.minute,
    },
  ]
}

function updateDistrict(state: SimulationState, id: DistrictId, status: District['status']): District[] {
  return state.districts.map((district) => (district.id === id ? { ...district, status } : district))
}

function updateLine(state: SimulationState, id: string, status: GridLine['status']): GridLine[] {
  return state.lines.map((line) => (line.id === id ? { ...line, status } : line))
}

function updateSource(state: SimulationState, id: EnergySource['id'], status: EnergySource['status']): EnergySource[] {
  return state.sources.map((source) => (source.id === id ? { ...source, status } : source))
}

export function createInitialState(): SimulationState {
  return {
    scenarioId: 'storm-echo',
    scenarioName: 'Storm Echo / East Ring failure',
    minute: 0,
    districts: initialDistricts.map((district) => ({ ...district })),
    lines: initialLines.map((line) => ({ ...line })),
    sources: initialSources.map((source) => ({ ...source })),
    riskScore: 74,
    phase: 'active',
    policy: {
      lockedDistricts: ['water', 'transit'],
      requireApprovalBeforeOutage: true,
      riskTolerance: 'low',
    },
    completedActions: [],
    withheldActions: [],
    lastPlan: null,
    approvalRequests: [],
    outcome: null,
    audit: [
      {
        id: 'event-1',
        minute: 0,
        actor: 'system',
        type: 'warning',
        title: 'Storm Echo detected',
        detail: 'East Ring thermal fault. Manual authority boundary loaded.',
      },
    ],
    updatedBy: 'system',
  }
}

export function computeMetrics(state: SimulationState): GridMetrics {
  const statusFactor = { online: 1, brownout: 0.5, offline: 0 } as const
  const coverage = Math.round(
    state.districts.reduce((total, district) => total + district.serviceWeight * statusFactor[district.status], 0),
  )
  const critical = state.districts.filter((district) => district.critical)
  const criticalAvailability = Math.round(
    (critical.reduce((total, district) => total + statusFactor[district.status], 0) / critical.length) * 100,
  )
  const availableMw = state.sources
    .filter((source) => source.status === 'online')
    .reduce((total, source) => total + source.outputMw, 0)
  const servedMw = state.districts.reduce(
    (total, district) => total + district.demandMw * statusFactor[district.status],
    0,
  )

  return {
    coverage,
    criticalAvailability,
    riskScore: state.riskScore,
    onlineDistricts: state.districts.filter((district) => district.status === 'online').length,
    totalDistricts: state.districts.length,
    availableMw,
    servedMw,
  }
}

export function inspectGrid(state: SimulationState) {
  const metrics = computeMetrics(state)
  return {
    scenario: state.scenarioName,
    minute: state.minute,
    phase: state.phase,
    metrics,
    policy: state.policy,
    faultedLines: state.lines.filter((line) => line.status === 'faulted').map((line) => ({ id: line.id, label: line.label })),
    districts: state.districts.map(({ id, name, status, critical, demandMw }) => ({ id, name, status, critical, demandMw })),
    completedActions: state.completedActions,
    withheldActions: state.withheldActions,
    pendingApprovals: state.approvalRequests.filter((request) => request.status === 'pending'),
    outcome: state.outcome,
  }
}

export function simulateRecoveryPlan(state: SimulationState, strategy: PlanStrategy): RecoveryPlan {
  if (state.phase === 'resolved' || state.phase === 'failed') {
    throw new Error('Restart the exercise before simulating another recovery plan.')
  }
  if (state.approvalRequests.some((request) => request.status === 'pending')) {
    throw new Error('Resolve the pending human decision before simulating another plan.')
  }
  const baseSteps: ActionId[] = ['isolate_damaged_feeder', 'connect_battery_reserve', 'reroute_north_loop']
  const remainingBase = baseSteps.filter((action) => !state.completedActions.includes(action))

  if (strategy === 'critical-first') {
    const steps = remainingBase
    return {
      id: 'plan-critical-first-v2',
      strategy,
      name: 'Protected recovery',
      rationale: 'Contain the cascade and restore critical services without interrupting any district that is currently online.',
      steps,
      projectedCoverage: 80,
      projectedRisk: 24,
      projectedDurationMinutes: steps.reduce((total, id) => total + recoveryActions[id].durationMinutes, 0),
      humanDecision: null,
    }
  }

  const finalActions: ActionId[] = strategy === 'balanced'
    ? ['transfer_transit_feed', 'restore_transit_service']
    : ['bypass_solar_interlock']
  const steps = [
    ...remainingBase,
    ...finalActions.filter((action) => !state.completedActions.includes(action)),
  ]
  const humanDecision = strategy === 'balanced'
    ? 'Authorize a temporary Transit Hub outage while Old Town is restored and an alternate feed is prepared.'
    : 'Accept operation above the risk ceiling and expose Water Treatment to an uninspected relay.'

  return {
    id: `plan-${strategy}-v2`,
    strategy,
    name: strategy === 'balanced' ? 'Balanced restoration' : 'Maximum coverage',
    rationale: strategy === 'balanced'
      ? 'Restore the safe majority, pause at one explicit service trade-off, then finish on a protected alternate feed.'
      : 'Reach full service faster by accepting elevated relay risk near a protected service.',
    steps,
    projectedCoverage: 100,
    projectedRisk: strategy === 'balanced' ? 18 : 56,
    projectedDurationMinutes: steps.reduce((total, id) => total + recoveryActions[id].durationMinutes, 0),
    humanDecision,
  }
}

export function recordPlan(state: SimulationState, plan: RecoveryPlan, actor: 'agent' | 'human' = 'agent'): SimulationState {
  return {
    ...state,
    phase: 'active',
    withheldActions: [],
    lastPlan: plan,
    audit: addAudit(state, {
      actor,
      type: 'simulation',
      title: `${plan.name} simulated`,
      detail: `${plan.projectedCoverage}% projected coverage; ${plan.projectedRisk}/100 projected risk.`,
    }),
    updatedBy: actor,
  }
}

function executeAction(state: SimulationState, actionId: ActionId, actor: 'agent' | 'human'): SimulationState {
  if (state.completedActions.includes(actionId)) return state
  const action = recoveryActions[actionId]
  let next = { ...state }

  if (actionId === 'isolate_damaged_feeder') {
    next = { ...next, lines: updateLine(next, 'east-ring', 'isolated'), riskScore: 39 }
  } else if (actionId === 'connect_battery_reserve') {
    next = {
      ...next,
      sources: updateSource(next, 'battery', 'online'),
      lines: updateLine(next, 'battery-link', 'online'),
      districts: updateDistrict(next, 'shelter', 'online'),
      riskScore: Math.max(0, next.riskScore - 8),
    }
  } else if (actionId === 'reroute_north_loop') {
    next = {
      ...next,
      lines: updateLine(next, 'north-loop', 'online'),
      districts: updateDistrict(next, 'north', 'online'),
      riskScore: Math.max(0, next.riskScore - 7),
    }
  } else if (actionId === 'transfer_transit_feed') {
    const lines = updateLine(next, 'core-transit', 'standby').map((line) =>
      line.id === 'oldtown-spur' ? { ...line, status: 'online' as const } : line,
    )
    const districts = updateDistrict(next, 'transit', 'offline').map((district) =>
      district.id === 'old-town' ? { ...district, status: 'online' as const } : district,
    )
    next = {
      ...next,
      lines,
      districts,
      riskScore: Math.max(0, next.riskScore - 2),
    }
  } else if (actionId === 'restore_transit_service') {
    next = {
      ...next,
      lines: updateLine(next, 'core-transit', 'online'),
      districts: updateDistrict(next, 'transit', 'online'),
      riskScore: Math.max(0, next.riskScore - 4),
    }
  } else if (actionId === 'bypass_solar_interlock') {
    next = {
      ...next,
      sources: updateSource(next, 'solar', 'online'),
      lines: updateLine(next, 'solar-relay', 'online'),
      districts: updateDistrict(next, 'old-town', 'online'),
      riskScore: Math.min(100, next.riskScore + 32),
    }
  }

  const minute = next.minute + action.durationMinutes
  const stateForAudit = { ...next, minute }
  return {
    ...stateForAudit,
    completedActions: [...state.completedActions, actionId],
    audit: addAudit(stateForAudit, {
      actor,
      type: 'action',
      title: action.shortLabel,
      detail: action.consequence,
    }),
    updatedBy: actor,
  }
}

function missionOutcome(state: SimulationState, id: MissionOutcome['id'], decision: string): MissionOutcome {
  const metrics = computeMetrics(state)
  const definitions: Record<MissionOutcome['id'], Omit<MissionOutcome, 'id' | 'decision' | 'completedAtMinute'>> = {
    'protected-recovery': {
      title: 'Cascade contained',
      verdict: 'contained',
      summary: 'Critical services are stable and the dangerous feeder is isolated. The operator preserved the existing Transit service instead of pursuing full coverage.',
      score: 82,
      highlights: ['Hospital feed protected before T+08', 'Emergency Shelter and North Homes restored', 'No online service was interrupted'],
    },
    'safe-restoration': {
      title: 'Full service, bounded authority',
      verdict: 'excellent',
      summary: 'Every district is online. The agent completed safe switching, paused for one service trade-off and finished only after the human decision.',
      score: 96,
      highlights: ['100% weighted service coverage', 'All protected services preserved', 'Temporary Transit interruption explicitly authorized'],
    },
    'risk-accepted': {
      title: 'Coverage restored at elevated risk',
      verdict: 'high-risk',
      summary: 'Every district is online, but the operator accepted an uninspected solar relay near Water Treatment to recover faster.',
      score: 68,
      highlights: ['100% weighted service coverage', 'Fastest restoration path', `Residual cascade risk ${metrics.riskScore}/100`],
    },
    'cascade-failure': {
      title: 'Thermal deadline missed',
      verdict: 'failed',
      summary: 'The damaged East Ring remained live past T+08 and the fault propagated into the Hospital feed.',
      score: 24,
      highlights: ['Hospital entered brownout', 'Critical availability degraded', 'A non-destructive delay forecast was available'],
    },
  }

  return {
    id,
    decision,
    completedAtMinute: state.minute,
    ...definitions[id],
  }
}

function completeMission(state: SimulationState, id: MissionOutcome['id'], decision: string): SimulationState {
  const outcome = missionOutcome(state, id, decision)
  const phase = id === 'cascade-failure' ? 'failed' as const : 'resolved' as const
  const next = { ...state, phase, outcome, withheldActions: [], updatedBy: 'system' as const }
  return {
    ...next,
    audit: addAudit(next, {
      actor: 'system',
      type: 'outcome',
      title: outcome.title,
      detail: `${outcome.summary} Exercise score: ${outcome.score}/100.`,
    }),
  }
}

function completePlanIfReady(state: SimulationState, plan: RecoveryPlan): SimulationState {
  if (!plan.steps.every((actionId) => state.completedActions.includes(actionId))) return state
  if (plan.strategy === 'critical-first') {
    return completeMission(state, 'protected-recovery', 'No interruption of an online district was authorized.')
  }
  if (plan.strategy === 'balanced') {
    return completeMission(state, 'safe-restoration', 'The temporary Transit transfer was authorized, then service was restored through the reserve bus.')
  }
  return completeMission(state, 'risk-accepted', 'The high-risk solar interlock bypass was accepted.')
}

export function applyAuthorizedActions(state: SimulationState, plan: RecoveryPlan): ActionExecutionResult {
  if (state.phase === 'resolved' || state.phase === 'failed') {
    throw new Error('This exercise is complete. Restart it before applying another plan.')
  }
  let next = state
  const executed: ActionId[] = []
  const blocked: ActionId[] = []

  for (const actionId of plan.steps) {
    if (next.completedActions.includes(actionId)) continue
    if (actionRequiresApproval(next, actionId)) {
      blocked.push(actionId)
      break
    }
    next = executeAction(next, actionId, 'agent')
    executed.push(actionId)
  }

  next = {
    ...next,
    withheldActions: blocked,
    phase: blocked.length ? 'awaiting-human' : 'active',
  }
  if (!blocked.length) next = completePlanIfReady(next, plan)
  return { state: next, executed, blocked }
}

export function requestHumanDecision(state: SimulationState, actionId: ActionId, reason: string): SimulationState {
  const action = recoveryActions[actionId]
  if (!state.lastPlan || !state.lastPlan.steps.includes(actionId)) {
    throw new Error('The action must belong to the most recently simulated plan.')
  }
  if (!state.withheldActions.includes(actionId)) {
    throw new Error('Apply the plan first. A human decision can be requested only for an action the policy actually withheld.')
  }
  if (!action.requiresApproval) throw new Error('This action does not require a human decision.')
  if (!actionRequiresApproval(state, actionId)) {
    throw new Error('This action is currently inside the human-defined automatic authority boundary.')
  }
  if (state.completedActions.includes(actionId)) throw new Error('This action has already been completed.')
  const existing = state.approvalRequests.find((request) => request.actionId === actionId && request.status === 'pending')
  if (existing) return state

  const request: ApprovalRequest = {
    id: `approval-${state.approvalRequests.length + 1}`,
    actionId,
    reason,
    status: 'pending',
    requestedAtMinute: state.minute,
  }
  return {
    ...state,
    approvalRequests: [...state.approvalRequests, request],
    audit: addAudit(state, {
      actor: 'agent',
      type: 'request',
      title: 'Human decision requested',
      detail: `${action.shortLabel}: ${reason}`,
    }),
    updatedBy: 'agent',
  }
}

export function resolveOverride(
  state: SimulationState,
  requestId: string,
  decision: 'approved' | 'rejected',
): SimulationState {
  const request = state.approvalRequests.find((item) => item.id === requestId)
  if (!request || request.status !== 'pending') return state
  const action = recoveryActions[request.actionId]
  const withDecision: SimulationState = {
    ...state,
    phase: 'active',
    withheldActions: state.withheldActions.filter((actionId) => actionId !== request.actionId),
    approvalRequests: state.approvalRequests.map((item) =>
      item.id === requestId ? { ...item, status: decision } : item,
    ),
    audit: addAudit(state, {
      actor: 'human',
      type: 'approval',
      title: decision === 'approved' ? 'Override approved' : 'Override rejected',
      detail: `${action.shortLabel} was ${decision} by the human operator.`,
    }),
    updatedBy: 'human',
  }
  if (decision === 'rejected') {
    return completeMission(
      withDecision,
      'protected-recovery',
      `${action.shortLabel} was rejected; the operator chose containment over additional coverage.`,
    )
  }
  const executed = executeAction(withDecision, request.actionId, 'human')
  return state.lastPlan ? completePlanIfReady(executed, state.lastPlan) : executed
}

export function simulateDelayImpact(state: SimulationState, minutes: number) {
  const safeMinutes = Math.max(1, Math.min(12, Math.round(minutes)))
  const minute = state.minute + safeMinutes
  const feederIsolated = state.completedActions.includes('isolate_damaged_feeder')
  const cascadeLikely = minute >= 8 && !feederIsolated
  const projectedState = cascadeLikely
    ? {
        ...state,
        minute,
        lines: updateLine(state, 'core-hospital', 'faulted'),
        districts: updateDistrict(state, 'hospital', 'brownout'),
        riskScore: 96,
      }
    : { ...state, minute }

  return {
    applied: false,
    fromMinute: state.minute,
    toMinute: minute,
    thermalDeadline: 8,
    feederIsolated,
    cascadeLikely,
    projectedMetrics: computeMetrics(projectedState),
    consequence: cascadeLikely
      ? 'The East Ring fault reaches the Hospital feed, causing a critical-service brownout.'
      : feederIsolated
        ? 'No cascade occurs because the East Ring is already isolated.'
        : `${8 - minute} minute${8 - minute === 1 ? '' : 's'} remain before the thermal deadline.`,
    recommendedNextAction: feederIsolated ? null : 'isolate_damaged_feeder',
  }
}

export function advanceSimulation(state: SimulationState, minutes: number): SimulationState {
  if (state.phase === 'resolved' || state.phase === 'failed') return state
  const safeMinutes = Math.max(1, Math.min(12, Math.round(minutes)))
  const minute = state.minute + safeMinutes
  const feederIsolated = state.completedActions.includes('isolate_damaged_feeder')
  if (minute < 8 || feederIsolated) {
    const next = { ...state, minute, updatedBy: 'human' as const }
    return {
      ...next,
      audit: addAudit(next, {
        actor: 'human',
        type: 'action',
        title: `Operator waited ${safeMinutes} minute${safeMinutes === 1 ? '' : 's'}`,
        detail: feederIsolated ? 'The East Ring remains safely isolated.' : 'Thermal propagation window is still open.',
      }),
    }
  }

  let next: SimulationState = {
    ...state,
    minute,
    lines: updateLine(state, 'core-hospital', 'faulted'),
    districts: updateDistrict(state, 'hospital', 'brownout'),
    riskScore: 96,
    updatedBy: 'system',
  }
  next = {
    ...next,
    audit: addAudit(next, {
      actor: 'system',
      type: 'warning',
      title: 'Cascade reached the hospital feed',
      detail: 'The damaged East Ring was not isolated before the thermal deadline.',
    }),
  }
  return completeMission(next, 'cascade-failure', 'The operator allowed the thermal deadline to expire before isolation.')
}

export function updateHumanPolicy(
  state: SimulationState,
  change: Partial<Pick<HumanPolicy, 'lockedDistricts' | 'requireApprovalBeforeOutage' | 'riskTolerance'>>,
): SimulationState {
  const next = { ...state, policy: { ...state.policy, ...change }, updatedBy: 'human' as const }
  return {
    ...next,
    audit: addAudit(next, {
      actor: 'human',
      type: 'policy',
      title: 'Authority boundary changed',
      detail: `Locked: ${next.policy.lockedDistricts.join(', ')}. Risk tolerance: ${next.policy.riskTolerance}.`,
    }),
  }
}

export function isRiskWithinTolerance(actionRisk: RiskTolerance, tolerance: RiskTolerance): boolean {
  const rank: Record<RiskTolerance, number> = { low: 1, medium: 2, high: 3 }
  return rank[actionRisk] <= rank[tolerance]
}

export function approvalReasons(state: SimulationState, actionId: ActionId): string[] {
  const reasons: string[] = []
  if (actionId === 'transfer_transit_feed') {
    const transitIsOnline = state.districts.some(
      (district) => district.id === 'transit' && district.status === 'online',
    )
    if (transitIsOnline && state.policy.lockedDistricts.includes('transit')) reasons.push('Transit Hub is protected by a human service lock.')
    if (transitIsOnline && state.policy.requireApprovalBeforeOutage) reasons.push('Human approval is required before disconnecting an online district.')
    if (!isRiskWithinTolerance(recoveryActions[actionId].risk, state.policy.riskTolerance)) {
      reasons.push(`The action is ${recoveryActions[actionId].risk} risk; the automatic ceiling is ${state.policy.riskTolerance}.`)
    }
  }

  if (actionId === 'bypass_solar_interlock') {
    if (state.policy.lockedDistricts.includes('water')) reasons.push('Water Treatment is protected from the uninspected relay path.')
    if (!isRiskWithinTolerance(recoveryActions[actionId].risk, state.policy.riskTolerance)) {
      reasons.push(`The action is ${recoveryActions[actionId].risk} risk; the automatic ceiling is ${state.policy.riskTolerance}.`)
    }
  }

  return reasons
}

export function actionRequiresApproval(state: SimulationState, actionId: ActionId): boolean {
  return approvalReasons(state, actionId).length > 0
}
