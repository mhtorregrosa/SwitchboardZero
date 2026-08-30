# Switchboard Zero

**A policy-governed human-agent crisis exercise built for the WebMCP Challenge.**

[Live demo](https://mhtorregrosa.github.io/SwitchboardZero/) · [Agent test script](docs/AGENT_TESTS.md)

Switchboard Zero is a deterministic training and evaluation sandbox for high-stakes delegation. A fictional municipal grid has eight minutes before a thermal fault reaches the Hospital feed. A browser agent can inspect the incident, forecast the cost of delay, simulate recovery strategies and perform actions inside the operator's policy. When the next dependent action would cross that boundary, the agent must stop and request a visible human decision.

> The agent can optimize. You decide what it may sacrifice.

This is a browser-only simulation. It does not connect to or control real infrastructure.

## Why WebMCP matters here

The agent and the operator work on the same deterministic state. Agent simulations and actions immediately update the visible grid, telemetry, plan, decision queue and audit trail. Human decisions are then returned to the same plan instead of disappearing into a separate workflow.

```text
Browser agent ── WebMCP tool ──┐
                               ├── deterministic exercise state ── visible control room
Human operator ── UI policy ───┘
```

WebMCP gives the agent structured capabilities without giving it the operator's authority. No Site Tool can alter policy, approve a request, advance the live clock or restart the exercise.

## WebMCP tools

| Tool | Purpose | State effect |
| --- | --- | --- |
| `inspect_grid` | Read faults, service, policy, phase and pending decisions | Read-only |
| `simulate_recovery_plan` | Compare protected, balanced and maximum-coverage strategies | Shows the proposed plan; applies nothing |
| `apply_authorized_actions` | Execute the latest plan in dependency order | Stops at the first policy boundary and updates the control room |
| `request_human_decision` | Stage the action that was actually withheld | Creates a visible request; never approves or executes it |
| `simulate_delay_impact` | Forecast the consequence of waiting 1–12 minutes | Read-only; never advances the exercise clock |

The read-only tools return objects directly and declare `readOnlyHint`. Mutating tools update the React state used by the visible interface.

## Complete demonstration path

1. Inspect the grid: coverage is 58%, critical availability is 83% and cascade risk is 74/100.
2. Forecast an eight-minute delay: the result predicts a Hospital brownout but does not change the live clock.
3. Simulate `balanced`: the plan projects 100% coverage, risk 18/100 and one explicit human decision.
4. Apply authorized actions: the agent isolates East Ring, connects the reserve and restores North Homes, then stops before the Transit transfer. Coverage reaches 80% and risk falls to 24/100.
5. Request the withheld decision. The operator sees the exact consequence and chooses **Authorize action** or **Reject**.
6. If authorized, Old Town returns while Transit pauses. Apply the plan once more to complete the protected cross-tie: Transit returns, coverage reaches 100% and the mission debrief appears at T+16.

See [the complete prompts and expected results](docs/AGENT_TESTS.md).

## Outcomes, not just an animation

| Route | Result |
| --- | --- |
| Protected recovery | 80% coverage, risk 24, no online district interrupted |
| Balanced restoration | 100% coverage, risk 18, one temporary interruption explicitly authorized |
| Maximum coverage | 100% coverage, risk 56, uninspected relay risk accepted |
| Missed deadline | Hospital brownout, risk 96, failed debrief |

Each ending records a mission score, authority decision, service metrics and chronological decision trace.

## Authority model

- **Dependency-aware:** execution never skips past a blocked step.
- **Policy-aware:** service locks, outage approval and low/medium/high risk ceilings change actual tool behavior.
- **Human-authorized:** a request is valid only after the latest plan has been applied and that exact action was withheld.
- **Counterfactual-safe:** the agent can forecast delay but cannot cause the live failure.
- **UI-only authority controls:** policy, live time advancement, approval/rejection and exercise restart are not exposed as Site Tools.
- **Auditable:** agent, human and system events share one chronological record.
- **Deterministic:** the same state, policy and strategy produce the same plan and outcome.
- **Original and fictional:** the scenario, data, interface and vector graphics do not represent a real operator or network.
- **Progressive enhancement:** the page remains usable when `document.modelContext` is unavailable.

## Local development

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Run the deterministic engine tests and production build:

```bash
npm run check
```

## Project structure

```text
src/
├── components/          control room, policy, human decisions and debrief
├── domain/              typed deterministic simulation and 11 tests
├── webmcp/              five Site Tool registrations and schemas
├── App.tsx              shared-state integration
└── styles.css           original responsive interface
```

## Technology

React 19, TypeScript, Vite, Vitest and `webmcp-types`. The deployed site is a static GitHub Pages build with no backend, analytics or external runtime API.

## Licence

[MIT](LICENSE)
