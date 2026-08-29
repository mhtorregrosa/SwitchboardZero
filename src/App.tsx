import { useCallback, useEffect, useRef, useState } from 'react'
import { ApprovalPanel } from './components/ApprovalPanel'
import { AuditTrail } from './components/AuditTrail'
import { GridMap } from './components/GridMap'
import { PlanPanel } from './components/PlanPanel'
import { PolicyPanel } from './components/PolicyPanel'
import { Telemetry } from './components/Telemetry'
import { createInitialState } from './domain/simulation'
import type { SimulationState } from './domain/types'
import { registerWebMCPTools } from './webmcp/register'

export default function App() {
  const [state, setState] = useState<SimulationState>(() => createInitialState())
  const [toolsAvailable, setToolsAvailable] = useState<boolean | null>(null)
  const stateRef = useRef(state)

  const commit = useCallback((operation: (current: SimulationState) => SimulationState) => {
    const next = operation(stateRef.current)
    stateRef.current = next
    setState(next)
    return next
  }, [])

  useEffect(() => {
    let unregister: (() => void) | undefined
    let cancelled = false
    registerWebMCPTools(
      { getState: () => stateRef.current, commit },
      (available) => !cancelled && setToolsAvailable(available),
    ).then((cleanup) => {
      if (cancelled) cleanup()
      else unregister = cleanup
    }).catch(() => !cancelled && setToolsAvailable(false))

    return () => {
      cancelled = true
      unregister?.()
    }
  }, [commit])

  const reset = () => commit(() => createInitialState())

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Switchboard Zero home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>SWITCHBOARD</b><em>ZERO</em></span>
        </a>
        <div className="scenario-title">
          <span className="eyebrow">ACTIVE SCENARIO</span>
          <strong>{state.scenarioName}</strong>
        </div>
        <div className="header-actions">
          <span className="simulation-pill"><i />SIMULATION — NO REAL INFRASTRUCTURE</span>
          <button type="button" className="reset-button" onClick={reset}>Reset scenario</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <span className="eyebrow hero-kicker">HUMAN AUTHORITY × AGENT SPEED</span>
          <h1>The agent can optimize.<br /><em>You decide what it may sacrifice.</em></h1>
        </div>
        <p>A deterministic crisis control room where WebMCP tools stop at a visible human boundary. Every simulation, switch and override shares one auditable state.</p>
      </section>

      <div className="command-layout">
        <div className="command-main">
          <GridMap state={state} />
          <Telemetry state={state} toolsAvailable={toolsAvailable} />
          <PolicyPanel state={state} commit={commit} />
        </div>
        <aside className="command-sidebar">
          <ApprovalPanel state={state} commit={commit} />
          <PlanPanel state={state} commit={commit} />
          <AuditTrail state={state} />
        </aside>
      </div>

      <section className="tool-manifest" aria-labelledby="tools-title">
        <div>
          <span className="eyebrow">WEBMCP SURFACE</span>
          <h2 id="tools-title">Five tools. One authority boundary.</h2>
          <p>The page stays fully usable by a person. A browser agent receives structured capabilities—not permission to bypass the operator.</p>
        </div>
        <div className="tool-list">
          {[
            ['inspect_grid', 'READ'],
            ['simulate_recovery_plan', 'SIMULATE'],
            ['apply_safe_switches', 'ACT / SAFE'],
            ['request_critical_override', 'REQUEST'],
            ['advance_simulation', 'TIME'],
          ].map(([name, kind], index) => (
            <div className="tool-row" key={name}><span>0{index + 1}</span><code>{name}</code><b>{kind}</b></div>
          ))}
        </div>
      </section>

      <footer>
        <span>SWITCHBOARD ZERO / WEBMCP CHALLENGE</span>
        <span>FICTIONAL SYSTEM · DETERMINISTIC ENGINE · ORIGINAL ASSETS</span>
      </footer>
    </main>
  )
}
