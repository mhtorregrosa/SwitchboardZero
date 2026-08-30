import { recoveryActions, resolveOverride } from '../domain/simulation'
import type { SimulationState } from '../domain/types'

interface ApprovalPanelProps {
  state: SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

export function ApprovalPanel({ state, commit }: ApprovalPanelProps) {
  const pending = state.approvalRequests.filter((request) => request.status === 'pending')
  const latestResolved = [...state.approvalRequests].reverse().find((request) => request.status !== 'pending')

  return (
    <section className={`panel approval-panel ${pending.length ? 'approval-panel--active' : ''}`} aria-labelledby="approval-title">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">DECISION QUEUE</span>
          <h2 id="approval-title">Human decision</h2>
        </div>
        <span className={`queue-count ${pending.length ? 'queue-count--active' : ''}`}>{pending.length} PENDING</span>
      </div>
      {pending.map((request) => {
        const action = recoveryActions[request.actionId]
        return (
          <article className="approval-card" key={request.id}>
            <div className="approval-warning"><span>!</span>AGENT PAUSED AT AUTHORITY BOUNDARY</div>
            <h3>{action.label}</h3>
            <p className="agent-reason">“{request.reason}”</p>
            <div className="consequence-box"><b>Consequence</b><span>{action.consequence}</span></div>
            <div className="approval-actions">
              <button type="button" className="reject-button" onClick={() => commit((current) => resolveOverride(current, request.id, 'rejected'))}>Reject</button>
              <button type="button" className="approve-button" onClick={() => commit((current) => resolveOverride(current, request.id, 'approved'))}>Authorize action</button>
            </div>
          </article>
        )
      })}
      {!pending.length && (
        <div className="empty-state compact-empty">
          <span>{latestResolved?.status === 'approved' ? '✓' : '◇'}</span>
          <p>{latestResolved?.status === 'approved' && !state.outcome
            ? 'Decision applied. The agent may now continue the authorized plan.'
            : latestResolved
              ? `Last request ${latestResolved.status}.`
              : 'No agent action is waiting for human authority.'}</p>
        </div>
      )}
    </section>
  )
}
