import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../domain/simulation'
import type { SimulationState } from '../domain/types'
import { registerWebMCPTools } from './register'

interface ToolHarness {
  call: (name: string, input?: Record<string, unknown>) => Promise<unknown>
  cleanup: () => void
  registered: Map<string, WebMCP.ModelContextTool>
  availability: ReturnType<typeof vi.fn<(available: boolean) => void>>
  options: Map<string, WebMCP.ModelContextRegisterToolOptions | undefined>
}

function createController() {
  let state = createInitialState()
  return {
    controller: {
      getState: () => state,
      commit: (operation: (current: SimulationState) => SimulationState) => {
        state = operation(state)
        return state
      },
    },
    getState: () => state,
  }
}

async function createToolHarness(): Promise<ToolHarness> {
  const registered = new Map<string, WebMCP.ModelContextTool>()
  const options = new Map<string, WebMCP.ModelContextRegisterToolOptions | undefined>()
  const modelContext = {
    registerTool: vi.fn(async (
      tool: WebMCP.ModelContextTool,
      registrationOptions?: WebMCP.ModelContextRegisterToolOptions,
    ) => {
      registered.set(tool.name, tool)
      options.set(tool.name, registrationOptions)
    }),
  }
  vi.stubGlobal('document', { modelContext })

  const { controller } = createController()
  const availability = vi.fn<(available: boolean) => void>()
  const cleanup = await registerWebMCPTools(controller, availability)
  const executionOptions = { signal: new AbortController().signal }

  return {
    registered,
    options,
    availability,
    cleanup,
    call: async (name, input = {}) => {
      const tool = registered.get(name)
      if (!tool) throw new Error(`Tool ${name} was not registered.`)
      return tool.execute(input, executionOptions)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WebMCP tool contracts', () => {
  let harness: ToolHarness

  beforeEach(async () => {
    harness = await createToolHarness()
  })

  it('registers the complete surface with read-only annotations only where accurate', () => {
    expect([...harness.registered.keys()]).toEqual([
      'inspect_grid',
      'simulate_recovery_plan',
      'apply_authorized_actions',
      'request_human_decision',
      'simulate_delay_impact',
    ])
    expect(harness.registered.get('inspect_grid')?.annotations).toEqual({ readOnlyHint: true })
    expect(harness.registered.get('simulate_delay_impact')?.annotations).toEqual({ readOnlyHint: true })
    expect(harness.registered.get('simulate_recovery_plan')?.annotations).toBeUndefined()
    expect(harness.registered.get('apply_authorized_actions')?.annotations).toBeUndefined()
    expect(harness.registered.get('request_human_decision')?.annotations).toBeUndefined()
    expect(harness.availability).toHaveBeenLastCalledWith(true)

    for (const tool of harness.registered.values()) {
      expect(tool.name.length).toBeLessThanOrEqual(30)
      expect(tool.description.length).toBeLessThanOrEqual(500)
      expect(harness.options.get(tool.name)?.exposedTo).toBeUndefined()

      const schema = tool.inputSchema as {
        properties?: Record<string, { description?: string }>
      } | undefined
      for (const parameter of Object.values(schema?.properties ?? {})) {
        expect(parameter.description?.length ?? 0).toBeLessThanOrEqual(150)
      }
    }

    harness.cleanup()
    expect(harness.options.get('inspect_grid')?.signal?.aborted).toBe(true)
  })

  it('keeps forecasts read-only and synchronizes a simulated plan into shared state', async () => {
    const initial = await harness.call('inspect_grid') as { minute: number; metrics: { coverage: number } }
    const forecast = await harness.call('simulate_delay_impact', { minutes: 8 }) as {
      applied: boolean
      projectedMetrics: { coverage: number; riskScore: number }
    }
    const afterForecast = await harness.call('inspect_grid') as { minute: number; metrics: { coverage: number } }
    const simulation = await harness.call('simulate_recovery_plan', { strategy: 'balanced' }) as {
      plan: { id: string; projectedCoverage: number; projectedRisk: number }
      visibleStateUpdated: boolean
    }

    expect(initial).toMatchObject({ minute: 0, metrics: { coverage: 58 } })
    expect(forecast).toMatchObject({ applied: false, projectedMetrics: { coverage: 47, riskScore: 96 } })
    expect(afterForecast).toEqual(initial)
    expect(simulation).toMatchObject({
      plan: { id: 'plan-balanced-v2', projectedCoverage: 100, projectedRisk: 18 },
      visibleStateUpdated: true,
    })

    const inspected = await harness.call('inspect_grid') as { phase: string }
    expect(inspected.phase).toBe('active')
  })

  it('rejects an incorrect plan ID without changing the grid', async () => {
    await harness.call('simulate_recovery_plan', { strategy: 'balanced' })
    const before = await harness.call('inspect_grid')

    await expect(harness.call('apply_authorized_actions', { planId: 'plan-balanced-v1' }))
      .rejects.toThrow(/exact planId/)
    expect(await harness.call('inspect_grid')).toEqual(before)
  })

  it('validates sensitive action IDs and decision reasons at the tool boundary', async () => {
    await expect(harness.call('request_human_decision', {
      actionId: 'restore_transit_service',
      reason: 'This action is not exposed for approval.',
    })).rejects.toThrow(/valid sensitive actionId/)

    await expect(harness.call('request_human_decision', {
      actionId: 'transfer_transit_feed',
      reason: 'Too short',
    })).rejects.toThrow(/at least 12 characters/)
  })

  it('requires a real withheld action before creating a human request', async () => {
    await harness.call('simulate_recovery_plan', { strategy: 'balanced' })

    await expect(harness.call('request_human_decision', {
      actionId: 'transfer_transit_feed',
      reason: 'Temporarily pause Transit to restore Old Town.',
    })).rejects.toThrow(/Apply the plan first/)

    const application = await harness.call('apply_authorized_actions', { planId: 'plan-balanced-v2' }) as {
      blocked: Array<{ id: string }>
      phase: string
    }
    expect(application).toMatchObject({ blocked: [{ id: 'transfer_transit_feed' }], phase: 'awaiting-human' })

    const request = await harness.call('request_human_decision', {
      actionId: 'transfer_transit_feed',
      reason: 'Temporarily pause Transit to restore Old Town.',
    }) as { status: string; request: { actionId: string; status: string } }
    expect(request).toMatchObject({
      status: 'pending_human_authorization',
      request: { actionId: 'transfer_transit_feed', status: 'pending' },
    })
  })

  it('cannot hide the authority boundary by re-simulating a withheld plan', async () => {
    await harness.call('simulate_recovery_plan', { strategy: 'balanced' })
    await harness.call('apply_authorized_actions', { planId: 'plan-balanced-v2' })
    const withheld = await harness.call('inspect_grid')

    await expect(harness.call('simulate_recovery_plan', { strategy: 'critical-first' }))
      .rejects.toThrow(/withheld action workflow/)
    expect(await harness.call('inspect_grid')).toEqual(withheld)

    await harness.call('request_human_decision', {
      actionId: 'transfer_transit_feed',
      reason: 'Temporarily pause Transit to restore Old Town.',
    })
    const pending = await harness.call('inspect_grid')

    await expect(harness.call('simulate_recovery_plan', { strategy: 'critical-first' }))
      .rejects.toThrow(/pending human decision/)
    expect(await harness.call('inspect_grid')).toEqual(pending)
  })

  it('rejects simulation and execution after the exercise is resolved', async () => {
    const simulation = await harness.call('simulate_recovery_plan', { strategy: 'critical-first' }) as {
      plan: { id: string }
    }
    const completed = await harness.call('apply_authorized_actions', { planId: simulation.plan.id }) as {
      phase: string
      outcome: { id: string }
    }
    expect(completed).toMatchObject({ phase: 'resolved', outcome: { id: 'protected-recovery' } })

    await expect(harness.call('simulate_recovery_plan', { strategy: 'balanced' }))
      .rejects.toThrow(/Restart the exercise/)
    await expect(harness.call('apply_authorized_actions', { planId: simulation.plan.id }))
      .rejects.toThrow(/exercise is complete/)
  })
})

describe('WebMCP progressive enhancement', () => {
  it('reports human mode when modelContext is unavailable', async () => {
    vi.stubGlobal('document', {})
    const { controller } = createController()
    const availability = vi.fn<(available: boolean) => void>()

    const cleanup = await registerWebMCPTools(controller, availability)

    expect(availability).toHaveBeenCalledWith(false)
    expect(cleanup()).toBeUndefined()
  })
})
