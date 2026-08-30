import { updateHumanPolicy } from '../domain/simulation'
import type { DistrictId, RiskTolerance, SimulationState } from '../domain/types'

interface PolicyPanelProps {
  state: SimulationState
  commit: (operation: (state: SimulationState) => SimulationState) => SimulationState
}

const riskLevels: RiskTolerance[] = ['low', 'medium', 'high']
const lockableDistricts: DistrictId[] = ['water', 'transit']

export function PolicyPanel({ state, commit }: PolicyPanelProps) {
  const exerciseComplete = state.phase === 'resolved' || state.phase === 'failed'
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
          <h2 id="policy-title">Operator authority boundary</h2>
        </div>
        <span className="human-badge">HUMAN CONTROLLED</span>
      </div>
      <p className="panel-copy">These controls affect real plan decisions. The agent can act inside the boundary, but only the operator can move it.</p>
      <div className="policy-row">
        <span className="policy-label">Protected services</span>
        <div className="chip-row">
          {state.districts.filter((district) => lockableDistricts.includes(district.id)).map((district) => {
            const locked = state.policy.lockedDistricts.includes(district.id)
            return (
              <button
                type="button"
                key={district.id}
                className={`policy-chip ${locked ? 'policy-chip--active' : ''}`}
                onClick={() => toggleLock(district.id)}
                aria-pressed={locked}
                disabled={exerciseComplete}
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
              disabled={exerciseComplete}
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
          disabled={exerciseComplete}
        />
        <span className="switch"><i /></span>
        Require approval before disconnecting any online district
      </label>
    </section>
  )
}
