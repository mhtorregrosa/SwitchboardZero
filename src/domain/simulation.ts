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
    description: 'Bring the isolated 18 MW battery bank onto the protected bus.',
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
    consequence: 'Old Town returns online; Transit Hub is unavailable for approximately eight minutes.',
    durationMinutes: 2,
    risk: 'low',
    requiresApproval: true,
  },
  bypass_solar_interlock: {
    id: 'bypass_solar_interlock',
    label: 'Bypass the South solar safety interlock',
    shortLabel: 'Bypass solar interlock',
    description: 'Reconnect the storm-damaged solar field before its protection relay is inspected.',
    consequence: 'All districts can be powered, but cascade risk rises above the current human threshold.',
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
  { id: 'battery', name: 'North reserve', outputMw: 18, status: 'standby' },
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
    policy: {
      lockedDistricts: ['hospital', 'water'],
      requireApprovalBeforeOutage: true,
      riskTolerance: 'low',
    },
    completedActions: [],
    lastPlan: null,
    approvalRequests: [],
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
    metrics,
    policy: state.policy,
    faultedLines: state.lines.filter((line) => line.status === 'faulted').map((line) => ({ id: line.id, label: line.label })),
    districts: state.districts.map(({ id, name, status, critical, demandMw }) => ({ id, name, status, critical, demandMw })),
    completedActions: state.completedActions,
    pendingApprovals: state.approvalRequests.filter((request) => request.status === 'pending'),
  }
}

export function simulateRecoveryPlan(state: SimulationState, strategy: PlanStrategy): RecoveryPlan {
  const baseSteps: ActionId[] = ['isolate_damaged_feeder', 'connect_battery_reserve', 'reroute_north_loop']
  const remainingBase = baseSteps.filter((action) => !state.completedActions.includes(action))

  if (strategy === 'critical-first') {
    return {
      id: 'plan-critical-first-v1',
      strategy,
      name: 'Protected recovery',
      rationale: 'Reduce cascade risk and restore services without disconnecting any active district.',
      steps: remainingBase,
      projectedCoverage: 80,
      projectedRisk: 24,
      humanDecision: null,
    }
  }

  const finalAction: ActionId = strategy === 'balanced' ? 'transfer_transit_feed' : 'bypass_solar_interlock'
  const projectedCoverage = strategy === 'balanced' ? 90 : 100
  const projectedRisk = strategy === 'balanced' ? 22 : 56
  const humanDecision = strategy === 'balanced'
    ? 'Approve an eight-minute Transit Hub outage to restore Old Town.'
    : 'Approve operation above the current risk threshold to keep every district online.'

  return {
    id: `plan-${strategy}-v1`,
    strategy,
    name: strategy === 'balanced' ? 'Balanced recovery' : 'Maximum coverage',
    rationale: strategy === 'balanced'
      ? 'Restore the safe majority first, then expose one explicit service trade-off to the human operator.'
      : 'Reach full service coverage by accepting elevated relay risk.',
    steps: [...remainingBase, ...(state.completedActions.includes(finalAction) ? [] : [finalAction])],
    projectedCoverage,
    projectedRisk,
    humanDecision,
  }
}

export function recordInspection(state: SimulationState): SimulationState {
  const metrics = computeMetrics(state)
  return {
    ...state,
    audit: addAudit(state, {
      actor: 'agent',
      type: 'inspection',
      title: 'Agent inspected the grid',
      detail: `${metrics.coverage}% service coverage; risk ${metrics.riskScore}/100.`,
    }),
    updatedBy: 'agent',
  }
}

export function recordPlan(state: SimulationState, plan: RecoveryPlan, actor: 'agent' | 'human' = 'agent'): SimulationState {
  return {
    ...state,
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

export function applySafeSwitches(state: SimulationState, plan: RecoveryPlan): ActionExecutionResult {
  let next = state
  const executed: ActionId[] = []
  const blocked: ActionId[] = []

  for (const actionId of plan.steps) {
    if (state.completedActions.includes(actionId)) continue
    if (actionRequiresApproval(next, actionId)) {
      blocked.push(actionId)
      continue
    }
    next = executeAction(next, actionId, 'agent')
    executed.push(actionId)
  }

  return { state: next, executed, blocked }
}

export function requestOverride(state: SimulationState, actionId: ActionId, reason: string): SimulationState {
  const action = recoveryActions[actionId]
  if (!action.requiresApproval) throw new Error('This action does not require a human override.')
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
  return decision === 'approved' ? executeAction(withDecision, request.actionId, 'human') : withDecision
}

export function advanceSimulation(state: SimulationState, minutes: number): SimulationState {
  const safeMinutes = Math.max(1, Math.min(10, Math.round(minutes)))
  const minute = state.minute + safeMinutes
  const feederIsolated = state.completedActions.includes('isolate_damaged_feeder')
  if (minute < 8 || feederIsolated) {
    const next = { ...state, minute, updatedBy: 'agent' as const }
    return {
      ...next,
      audit: addAudit(next, {
        actor: 'agent',
        type: 'action',
        title: `Clock advanced ${safeMinutes} minute${safeMinutes === 1 ? '' : 's'}`,
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
  return next
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

export function actionRequiresApproval(state: SimulationState, actionId: ActionId): boolean {
  if (actionId === 'transfer_transit_feed') {
    const transitIsOnline = state.districts.some(
      (district) => district.id === 'transit' && district.status === 'online',
    )
    return transitIsOnline && (
      state.policy.requireApprovalBeforeOutage || state.policy.lockedDistricts.includes('transit')
    )
  }

  if (actionId === 'bypass_solar_interlock') {
    return !isRiskWithinTolerance(recoveryActions[actionId].risk, state.policy.riskTolerance)
  }

  return false
}
