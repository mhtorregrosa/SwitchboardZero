import { computeMetrics } from '../domain/simulation'
import type { SimulationState } from '../domain/types'

function Metric({ label, value, suffix = '', tone = 'neutral' }: { label: string; value: number; suffix?: string; tone?: string }) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}<small>{suffix}</small></span>
    </div>
  )
}

export function Telemetry({ state, toolsAvailable }: { state: SimulationState; toolsAvailable: boolean | null }) {
  const metrics = computeMetrics(state)
  const riskTone = metrics.riskScore >= 60 ? 'danger' : metrics.riskScore >= 35 ? 'warning' : 'good'
  return (
    <section className="panel telemetry-panel" aria-labelledby="telemetry-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SYSTEM TELEMETRY</span>
          <h2 id="telemetry-title">Grid status</h2>
        </div>
        <span className={`tool-status ${toolsAvailable ? 'tool-status--ready' : ''}`}>
          <i />{toolsAvailable === null ? 'CHECKING' : toolsAvailable ? '5 SITE TOOLS' : 'HUMAN MODE'}
        </span>
      </div>
      <div className="metric-grid">
        <Metric label="Service coverage" value={metrics.coverage} suffix="%" tone={metrics.coverage >= 80 ? 'good' : 'warning'} />
        <Metric label="Critical availability" value={metrics.criticalAvailability} suffix="%" tone={metrics.criticalAvailability === 100 ? 'good' : 'danger'} />
        <Metric label="Cascade risk" value={metrics.riskScore} suffix="/100" tone={riskTone} />
        <Metric label="Power served" value={Math.round(metrics.servedMw)} suffix={`/${metrics.availableMw} MW`} />
      </div>
      <div className="coverage-track" aria-label={`${metrics.coverage}% service coverage`}>
        <span style={{ width: `${metrics.coverage}%` }} />
      </div>
      <div className="telemetry-footer">
        <span>{metrics.onlineDistricts}/{metrics.totalDistricts} districts fully online</span>
        <span>Updated by <b>{state.updatedBy}</b></span>
      </div>
    </section>
  )
}
