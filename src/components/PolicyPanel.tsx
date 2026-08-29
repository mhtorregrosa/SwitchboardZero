import { updateHumanPolicy } from '../domain/simulation'
import type { DistrictId, RiskTolerance, SimulationState } from '../domain/types'

interface PolicyPanelProps {
  state: SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

const riskLevels: RiskTolerance[] = ['low', 'medium', 'high']

export function PolicyPanel({ state, commit }: PolicyPanelProps) {
  const toggleLock = (districtId: DistrictId) => {
    const locked = state.policy.lockedDistricts.includes(districtId)
    const next = locked
      ? state.policy.lockedDistricts.filter((id) => id !== districtId)
      : [...state.policy.lockedDistricts, districtId]
    commit((current) => updateHumanPolicy(current, { lockedDistricts: next }))
  }

  return (
    <section className="panel policy-panel" aria-labelledby="policy-title">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">HUMAN AUTHORITY</span>
          <h2 id="policy-title">Non-negotiable boundary</h2>
        </div>
        <span className="human-badge">HUMAN CONTROLLED</span>
      </div>
      <p className="panel-copy">The agent may optimize inside this boundary. It cannot silently move it.</p>
      <div className="policy-row">
        <span className="policy-label">Protected services</span>
        <div className="chip-row">
          {state.districts.filter((district) => district.critical).map((district) => {
            const locked = state.policy.lockedDistricts.includes(district.id)
            return (
              <button
                type="button"
                key={district.id}
                className={`policy-chip ${locked ? 'policy-chip--active' : ''}`}
                onClick={() => toggleLock(district.id)}
                aria-pressed={locked}
              >
                <span>{locked ? '◆' : '◇'}</span>{district.shortName}
              </button>
            )
          })}
        </div>
      </div>
      <div className="policy-row">
        <span className="policy-label">Automatic risk ceiling</span>
        <div className="segmented-control">
          {riskLevels.map((level) => (
            <button
              type="button"
              key={level}
              className={state.policy.riskTolerance === level ? 'active' : ''}
              onClick={() => commit((current) => updateHumanPolicy(current, { riskTolerance: level }))}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={state.policy.requireApprovalBeforeOutage}
          onChange={(event) => commit((current) => updateHumanPolicy(current, { requireApprovalBeforeOutage: event.target.checked }))}
        />
        <span className="switch"><i /></span>
        Require approval before disconnecting any online district
      </label>
    </section>
  )
}
