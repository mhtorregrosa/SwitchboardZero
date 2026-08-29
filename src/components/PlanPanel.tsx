import {
  actionRequiresApproval,
  applySafeSwitches,
  computeMetrics,
  recordPlan,
  recoveryActions,
  simulateRecoveryPlan,
} from '../domain/simulation'
import type { PlanStrategy, SimulationState } from '../domain/types'

interface PlanPanelProps {
  state: SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

const strategyLabels: Record<PlanStrategy, string> = {
  'critical-first': 'Protected',
  balanced: 'Balanced',
  'maximum-coverage': 'Maximum',
}

export function PlanPanel({ state, commit }: PlanPanelProps) {
  const simulate = (strategy: PlanStrategy) => {
    const plan = simulateRecoveryPlan(state, strategy)
    commit((current) => recordPlan(current, plan, 'human'))
  }

  const applySafe = () => {
    if (!state.lastPlan) return
    commit((current) => applySafeSwitches(current, state.lastPlan!).state)
  }

  const metrics = computeMetrics(state)
  return (
    <section className="panel plan-panel" aria-labelledby="plan-title">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">RECOVERY MODEL</span>
          <h2 id="plan-title">Plan before acting</h2>
        </div>
      </div>
      <div className="strategy-row" aria-label="Recovery strategy">
        {(Object.keys(strategyLabels) as PlanStrategy[]).map((strategy) => (
          <button type="button" key={strategy} onClick={() => simulate(strategy)}>{strategyLabels[strategy]}</button>
        ))}
      </div>
      {state.lastPlan ? (
        <div className="plan-card">
          <div className="plan-card-heading">
            <div><span className="plan-id">{state.lastPlan.id}</span><h3>{state.lastPlan.name}</h3></div>
            <div className="projection"><b>{state.lastPlan.projectedCoverage}%</b><span>PROJECTED</span></div>
          </div>
          <p>{state.lastPlan.rationale}</p>
          <ol className="plan-steps">
            {state.lastPlan.steps.map((actionId) => {
              const action = recoveryActions[actionId]
              const done = state.completedActions.includes(actionId)
              const needsHuman = actionRequiresApproval(state, actionId)
              return (
                <li key={actionId} className={done ? 'done' : needsHuman ? 'requires-human' : ''}>
                  <span>{done ? '✓' : needsHuman ? '!' : '→'}</span>
                  <div><b>{action.shortLabel}</b><small>{needsHuman ? 'Human decision required' : `${action.durationMinutes} min · inside policy`}</small></div>
                </li>
              )
            })}
          </ol>
          <button type="button" className="primary-button" onClick={applySafe} disabled={metrics.coverage >= 80 && state.lastPlan.steps.every((id) => state.completedActions.includes(id) || actionRequiresApproval(state, id))}>
            Apply actions inside policy
          </button>
        </div>
      ) : (
        <div className="empty-state"><span>◇</span><p>Simulate a plan here or ask the browser agent to create one through WebMCP.</p></div>
      )}
    </section>
  )
}
