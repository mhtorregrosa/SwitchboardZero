import {
  applyAuthorizedActions,
  approvalReasons,
  computeMetrics,
  inspectGrid,
  planStrategies,
  recordPlan,
  recoveryActions,
  requestHumanDecision,
  sensitiveActionIds,
  simulateDelayImpact,
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
    execute: async () => inspectGrid(controller.getState()),
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
        },
      },
      required: ['strategy'],
    },
    execute: async (raw) => {
      const strategy = isPlanStrategy(raw.strategy) ? raw.strategy : 'balanced'
      const plan = simulateRecoveryPlan(controller.getState(), strategy)
      const next = controller.commit((state) => recordPlan(state, plan, 'agent'))
      return { plan, currentMetrics: computeMetrics(next), applied: false, visibleStateUpdated: true }
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'apply_authorized_actions',
    title: 'Apply authorized recovery actions',
    description: 'Execute recovery steps from the most recently simulated plan in order. Stop at the first step outside the current human-defined authority boundary. A later step is never executed past a withheld dependency.',
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
      const result = applyAuthorizedActions(current, current.lastPlan)
      const next = controller.commit(() => result.state)
      return {
        executed: result.executed.map((id) => ({ id, label: recoveryActions[id].label })),
        blocked: result.blocked.map((id) => ({
          id,
          label: recoveryActions[id].label,
          consequence: recoveryActions[id].consequence,
          reasons: approvalReasons(next, id),
        })),
        metrics: computeMetrics(next),
        phase: next.phase,
        outcome: next.outcome,
        visibleStateUpdated: true,
      }
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'request_human_decision',
    title: 'Request a human decision',
    description: 'Place the action that was actually withheld by apply_authorized_actions into the visible human decision queue. The action must belong to the latest plan. This tool explains the trade-off but never approves or performs it.',
    inputSchema: {
      type: 'object',
      properties: {
        actionId: {
          type: 'string',
          enum: [...sensitiveActionIds],
          description: 'Sensitive action returned as blocked by apply_authorized_actions.',
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
      const next = controller.commit((state) => requestHumanDecision(state, raw.actionId as ActionId, reason))
      const pending = next.approvalRequests.find(
        (request) => request.actionId === raw.actionId && request.status === 'pending',
      )
      return {
        status: 'pending_human_authorization',
        request: pending,
        action: recoveryActions[raw.actionId as ActionId],
        policyReasons: approvalReasons(next, raw.actionId as ActionId),
        instruction: 'Wait for the human operator to approve or reject the visible request.',
        visibleStateUpdated: true,
      }
    },
  }, options)

  await document.modelContext.registerTool({
    name: 'simulate_delay_impact',
    title: 'Forecast the cost of waiting',
    description: 'Run a non-destructive counterfactual showing what would happen if the operator waited between one and twelve minutes. This never advances the live exercise clock or changes the grid.',
    inputSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'integer', minimum: 1, maximum: 12 },
      },
      required: ['minutes'],
    },
    annotations: { readOnlyHint: true },
    execute: async (raw) => {
      const minutes = typeof raw.minutes === 'number' && Number.isFinite(raw.minutes) ? raw.minutes : 1
      return simulateDelayImpact(controller.getState(), minutes)
    },
  }, options)

  onAvailability?.(true)
  return () => abortController.abort()
}
