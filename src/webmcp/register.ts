import {
  advanceSimulation,
  applySafeSwitches,
  computeMetrics,
  inspectGrid,
  planStrategies,
  recordInspection,
  recordPlan,
  recoveryActions,
  requestOverride,
  sensitiveActionIds,
  simulateRecoveryPlan,
} from '../domain/simulation'
import type { ActionId, PlanStrategy, SimulationState } from '../domain/types'

interface StateController {
  getState: () => SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

function isPlanStrategy(value: unknown): value is PlanStrategy {
  return typeof value === 'string' && planStrategies.includes(value as PlanStrategy)
}

function isSensitiveAction(value: unknown): value is ActionId {
  return typeof value === 'string' && sensitiveActionIds.includes(value as (typeof sensitiveActionIds)[number])
}

function response(value: unknown) {
  return JSON.stringify(value)
}

export async function registerWebMCPTools(
  controller: StateController,
  onAvailability?: (available: boolean) => void,
) {
  if (!('modelContext' in document) || !document.modelContext) {
    onAvailability?.(false)
    return () => undefined
  }

  const abortController = new AbortController()
  const options = { signal: abortController.signal }

  await document.modelContext.registerTool({
    name: 'inspect_grid',
    title: 'Inspect the crisis grid',
    description: 'Read the complete current Switchboard Zero simulation state, including damaged lines, district service, available generation, human-locked districts, risk tolerance and pending approvals. Use this before proposing or applying a recovery plan.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const next = controller.commit(recordInspection)
      return response(inspectGrid(next))
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'simulate_recovery_plan',
    title: 'Simulate a recovery plan',
    description: 'Build a deterministic recovery sequence without applying grid switches. Critical-first avoids all service trade-offs, balanced maximizes useful recovery with one explicit human decision, and maximum-coverage accepts elevated relay risk. The visible control room updates to show the proposed plan.',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: [...planStrategies],
          description: 'Recovery objective to simulate.',
          default: 'balanced',
        },
      },
      required: ['strategy'],
    },
    annotations: { readOnlyHint: true },
    execute: async (raw) => {
      const strategy = isPlanStrategy(raw.strategy) ? raw.strategy : 'balanced'
      const plan = simulateRecoveryPlan(controller.getState(), strategy)
      const next = controller.commit((state) => recordPlan(state, plan, 'agent'))
      return response({ plan, currentMetrics: computeMetrics(next), applied: false })
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'apply_safe_switches',
    title: 'Apply the safe part of a recovery plan',
    description: 'Execute only low-risk recovery steps from the most recently simulated plan. Any step that disconnects an active district or exceeds the human risk boundary is withheld and returned as blocked instead of being executed.',
    inputSchema: {
      type: 'object',
      properties: {
        planId: {
          type: 'string',
          description: 'The exact plan ID returned by simulate_recovery_plan.',
        },
      },
      required: ['planId'],
    },
    execute: async (raw) => {
      const planId = typeof raw.planId === 'string' ? raw.planId : ''
      const current = controller.getState()
      if (!current.lastPlan || current.lastPlan.id !== planId) {
        throw new Error('Simulate a recovery plan first, then pass its exact planId.')
      }
      const result = applySafeSwitches(current, current.lastPlan)
      const next = controller.commit(() => result.state)
      return response({
        executed: result.executed.map((id) => ({ id, label: recoveryActions[id].label })),
        blocked: result.blocked.map((id) => ({
          id,
          label: recoveryActions[id].label,
          consequence: recoveryActions[id].consequence,
          reason: 'human_authorization_required',
        })),
        metrics: computeMetrics(next),
      })
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'request_critical_override',
    title: 'Request a human decision',
    description: 'Place one withheld recovery action in the visible human approval queue. This tool never performs the sensitive action. It explains the trade-off and waits for the person to approve or reject it in the control room.',
    inputSchema: {
      type: 'object',
      properties: {
        actionId: {
          type: 'string',
          enum: [...sensitiveActionIds],
          description: 'Sensitive action returned as blocked by apply_safe_switches.',
        },
        reason: {
          type: 'string',
          minLength: 12,
          maxLength: 280,
          description: 'Plain-language reason that states who gains, who loses and for how long or at what risk.',
        },
      },
      required: ['actionId', 'reason'],
    },
    execute: async (raw) => {
      if (!isSensitiveAction(raw.actionId)) throw new Error('A valid sensitive actionId is required.')
      const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
      if (reason.length < 12) throw new Error('Explain the human trade-off in at least 12 characters.')
      const next = controller.commit((state) => requestOverride(state, raw.actionId as ActionId, reason))
      const pending = next.approvalRequests.find(
        (request) => request.actionId === raw.actionId && request.status === 'pending',
      )
      return response({
        status: 'pending_human_authorization',
        request: pending,
        action: recoveryActions[raw.actionId as ActionId],
        instruction: 'Wait for the human operator to approve or reject the visible request.',
      })
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'advance_simulation',
    title: 'Advance the crisis clock',
    description: 'Advance the deterministic crisis clock by one to ten minutes. If the damaged East Ring has not been isolated before minute eight, the fault cascades into the hospital feed. Use only when the user asks to wait, test consequences or advance the scenario.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['minutes'],
    },
    execute: async (raw) => {
      const minutes = typeof raw.minutes === 'number' && Number.isFinite(raw.minutes) ? raw.minutes : 1
      const next = controller.commit((state) => advanceSimulation(state, minutes))
      return response({ minute: next.minute, metrics: computeMetrics(next), state: inspectGrid(next) })
    },
  }, options)

  onAvailability?.(true)
  return () => abortController.abort()
}
