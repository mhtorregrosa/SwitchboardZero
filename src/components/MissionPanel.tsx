import { advanceSimulation, computeMetrics } from '../domain/simulation'
import type { SimulationState } from '../domain/types'

interface MissionPanelProps {
  state: SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

const phaseLabels = {
  active: 'IN PROGRESS',
  'awaiting-human': 'HUMAN DECISION',
  resolved: 'RESOLVED',
  failed: 'FAILED',
} as const

export function MissionPanel({ state, commit }: MissionPanelProps) {
  const metrics = computeMetrics(state)

  if (state.outcome) {
    return (
      <section className={`panel mission-panel mission-panel--${state.outcome.verdict}`} aria-labelledby="mission-title">
        <div className="panel-heading compact-heading">
          <div>
            <span className="eyebrow">MISSION DEBRIEF</span>
            <h2 id="mission-title">{state.outcome.title}</h2>
          </div>
          <span className={`phase-badge phase-badge--${state.phase}`}>{state.outcome.score}/100</span>
        </div>
        <p className="outcome-summary">{state.outcome.summary}</p>
        <div className="outcome-metrics">
          <div><b>{metrics.coverage}%</b><span>COVERAGE</span></div>
          <div><b>{metrics.criticalAvailability}%</b><span>CRITICAL</span></div>
          <div><b>{metrics.riskScore}</b><span>RISK</span></div>
          <div><b>T+{state.outcome.completedAtMinute}</b><span>FINISH</span></div>
        </div>
        <ul className="outcome-highlights">
          {state.outcome.highlights.map((highlight) => <li key={highlight}><span>✓</span>{highlight}</li>)}
        </ul>
        <div className="decision-summary"><b>Authority decision</b><p>{state.outcome.decision}</p></div>
        <p className="debrief-footnote">{state.audit.length} events captured in the shared decision trace.</p>
      </section>
    )
  }

  return (
    <section className="panel mission-panel" aria-labelledby="mission-title">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">EXERCISE BRIEF</span>
          <h2 id="mission-title">Contain before T+08</h2>
        </div>
        <span className={`phase-badge phase-badge--${state.phase}`}>{phaseLabels[state.phase]}</span>
      </div>
      <p className="panel-copy">Isolate the East Ring, restore critical service and recover as much coverage as policy permits. The Hospital feed fails if the thermal deadline is missed.</p>
      <ol className="mission-objectives">
        <li className={state.completedActions.includes('isolate_damaged_feeder') ? 'complete' : ''}><span>01</span><p><b>Contain</b> Isolate the fault before T+08</p></li>
        <li className={metrics.criticalAvailability === 100 ? 'complete' : ''}><span>02</span><p><b>Stabilize</b> Restore every critical service</p></li>
        <li className={metrics.coverage === 100 ? 'complete' : ''}><span>03</span><p><b>Recover</b> Reach the best policy-compliant outcome</p></li>
      </ol>
      <div className="deadline-control">
        <div><b>T+{String(state.minute).padStart(2, '0')} / T+08</b><span>THERMAL WINDOW</span></div>
        <button
          type="button"
          className="wait-button"
          onClick={() => commit((current) => advanceSimulation(current, 4))}
          disabled={state.completedActions.includes('isolate_damaged_feeder')}
          title="Operator-side scenario control"
        >
          Wait 4 min
        </button>
      </div>
      <small className="human-only-note">No Site Tool can advance or restart the live exercise. The agent can forecast delay without causing it.</small>
    </section>
  )
}
