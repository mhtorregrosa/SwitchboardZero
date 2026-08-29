import type { SimulationState } from '../domain/types'

export function AuditTrail({ state }: { state: SimulationState }) {
  return (
    <section className="panel audit-panel" aria-labelledby="audit-title">
      <div className="panel-heading compact-heading">
        <div><span className="eyebrow">SHARED RECORD</span><h2 id="audit-title">Decision trace</h2></div>
        <span className="event-count">{state.audit.length} EVENTS</span>
      </div>
      <div className="audit-list" role="log" aria-live="polite">
        {[...state.audit].reverse().map((event) => (
          <article key={event.id} className={`audit-event audit-event--${event.actor}`}>
            <div className="audit-meta"><span>T+{String(event.minute).padStart(2, '0')}</span><b>{event.actor}</b></div>
            <div><h3>{event.title}</h3><p>{event.detail}</p></div>
          </article>
        ))}
      </div>
    </section>
  )
}
