export type DistrictId = 'hospital' | 'water' | 'shelter' | 'north' | 'old-town' | 'transit'
export type DistrictStatus = 'online' | 'brownout' | 'offline'
export type LineStatus = 'online' | 'standby' | 'faulted' | 'isolated'
export type SourceStatus = 'online' | 'standby' | 'offline'
export type RiskTolerance = 'low' | 'medium' | 'high'
export type PlanStrategy = 'critical-first' | 'balanced' | 'maximum-coverage'
export type ScenarioPhase = 'active' | 'awaiting-human' | 'resolved' | 'failed'
export type OutcomeId = 'protected-recovery' | 'safe-restoration' | 'risk-accepted' | 'cascade-failure'
export type ActionId =
  | 'isolate_damaged_feeder'
  | 'connect_battery_reserve'
  | 'reroute_north_loop'
  | 'transfer_transit_feed'
  | 'restore_transit_service'
  | 'bypass_solar_interlock'

export interface District {
  id: DistrictId
  name: string
  shortName: string
  description: string
  demandMw: number
  serviceWeight: number
  critical: boolean
  status: DistrictStatus
  x: number
  y: number
}

export interface GridLine {
  id: string
  label: string
  from: string
  to: string
  status: LineStatus
  path: string
}

export interface EnergySource {
  id: 'turbine' | 'battery' | 'solar'
  name: string
  outputMw: number
  status: SourceStatus
}

export interface HumanPolicy {
  lockedDistricts: DistrictId[]
  requireApprovalBeforeOutage: boolean
  riskTolerance: RiskTolerance
}

export interface RecoveryAction {
  id: ActionId
  label: string
  shortLabel: string
  description: string
  consequence: string
  durationMinutes: number
  risk: RiskTolerance
  requiresApproval: boolean
}

export interface RecoveryPlan {
  id: string
  strategy: PlanStrategy
  name: string
  rationale: string
  steps: ActionId[]
  projectedCoverage: number
  projectedRisk: number
  projectedDurationMinutes: number
  humanDecision: string | null
}

export interface ApprovalRequest {
  id: string
  actionId: ActionId
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedAtMinute: number
}

export interface AuditEvent {
  id: string
  minute: number
  actor: 'agent' | 'human' | 'system'
  type: 'inspection' | 'simulation' | 'forecast' | 'action' | 'request' | 'approval' | 'policy' | 'warning' | 'outcome'
  title: string
  detail: string
}

export interface MissionOutcome {
  id: OutcomeId
  title: string
  verdict: 'excellent' | 'contained' | 'high-risk' | 'failed'
  summary: string
  score: number
  decision: string
  completedAtMinute: number
  highlights: string[]
}

export interface SimulationState {
  scenarioId: 'storm-echo'
  scenarioName: string
  minute: number
  districts: District[]
  lines: GridLine[]
  sources: EnergySource[]
  riskScore: number
  phase: ScenarioPhase
  policy: HumanPolicy
  completedActions: ActionId[]
  withheldActions: ActionId[]
  lastPlan: RecoveryPlan | null
  approvalRequests: ApprovalRequest[]
  outcome: MissionOutcome | null
  audit: AuditEvent[]
  updatedBy: 'human' | 'agent' | 'system'
}

export interface GridMetrics {
  coverage: number
  criticalAvailability: number
  riskScore: number
  onlineDistricts: number
  totalDistricts: number
  availableMw: number
  servedMw: number
}

export interface ActionExecutionResult {
  state: SimulationState
  executed: ActionId[]
  blocked: ActionId[]
}
