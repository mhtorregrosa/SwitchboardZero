import {
  actionRequiresApproval,
  applyAuthorizedActions,
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
    commit((current) => recordPlan(current, simulateRecoveryPlan(current, strategy), 'human'))
  }

  const applySafe = () => {
    commit((current) => current.lastPlan ? applyAuthorizedActions(current, current.lastPlan).state : current)
  }

  const metrics = computeMetrics(state)
  const exerciseComplete = state.phase === 'resolved' || state.phase === 'failed'
  const pendingDecision = state.approvalRequests.some((request) => request.status === 'pending')
  const planReplacementBlocked = pendingDecision || state.phase === 'awaiting-human' || state.withheldActions.length > 0
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
          <button type="button" key={strategy} onClick={() => simulate(strategy)} disabled={exerciseComplete || planReplacementBlocked}>{strategyLabels[strategy]}</button>
        ))}
      </div>
      {state.lastPlan ? (
        <div className="plan-card">
          <div className="plan-card-heading">
            <div><span className="plan-id">{state.lastPlan.id}</span><h3>{state.lastPlan.name}</h3></div>
            <div className="projection"><b>{state.lastPlan.projectedCoverage}%</b><span>{state.lastPlan.projectedDurationMinutes} MIN · RISK {state.lastPlan.projectedRisk}</span></div>
          </div>
          <p>{state.lastPlan.rationale}</p>
          <ol className="plan-steps">
            {state.lastPlan.steps.map((actionId, index) => {
              const action = recoveryActions[actionId]
              const done = state.completedActions.includes(actionId)
              const needsHuman = actionRequiresApproval(state, actionId)
              const waitsForDependency = state.lastPlan!.steps
                .slice(0, index)
                .some((previousId) => !state.completedActions.includes(previousId) && actionRequiresApproval(state, previousId))
              return (
                <li key={actionId} className={done ? 'done' : needsHuman ? 'requires-human' : waitsForDependency ? 'waiting' : ''}>
                  <span>{done ? '✓' : needsHuman ? '!' : waitsForDependency ? '·' : '→'}</span>
                  <div><b>{action.shortLabel}</b><small>{needsHuman
                    ? 'Human decision required'
                    : waitsForDependency
                      ? 'Waits for the prior decision'
                      : `${action.durationMinutes} min · inside policy`}</small></div>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            className="primary-button"
            onClick={applySafe}
            disabled={exerciseComplete || pendingDecision || state.withheldActions.length > 0 || state.lastPlan.steps.every((id) => state.completedActions.includes(id))}
          >
            {metrics.coverage >= 80 ? 'Continue authorized actions' : 'Apply authorized actions'}
          </button>
        </div>
      ) : (
        <div className="empty-state"><span>◇</span><p>Simulate a plan here or ask the browser agent to create one through WebMCP.</p></div>
      )}
    </section>
  )
}
