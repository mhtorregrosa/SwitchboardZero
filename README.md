# Switchboard Zero

**A deterministic human-agent crisis control room built for the WebMCP Challenge.**

[Live demo](https://mhtorregrosa.github.io/SwitchboardZero/) · [Agent test script](docs/AGENT_TESTS.md)

Switchboard Zero turns a fictional municipal grid failure into a visible negotiation between agent speed and human authority. A browser agent can inspect the network, simulate recovery strategies and execute actions that are inside the operator's policy. When a plan would interrupt an active district or exceed the selected risk ceiling, the agent must stop and place the decision in a human approval queue.

> The agent can optimize. You decide what it may sacrifice.

This is a browser-only simulation. It does not connect to or control real infrastructure.

## Why WebMCP matters here

The WebMCP tools and the human interface operate on the same React state. Tool calls are therefore not an invisible automation layer: every inspection, simulation, switch, request and human decision is reflected in the grid, telemetry and audit trail.

```text
Browser agent ── WebMCP tool ──┐
                               ├── deterministic simulation state ── visible control room
Human operator ── UI action ───┘
```

The authority boundary itself is controlled only by the person in the interface. No WebMCP tool can change protected services, raise the automatic risk ceiling or disable outage approval.

## WebMCP tools

| Tool | Purpose | State effect |
| --- | --- | --- |
| `inspect_grid` | Read faults, service, generation, policy and pending approvals | Adds an inspection to the audit trail |
| `simulate_recovery_plan` | Compare protected, balanced and maximum-coverage strategies | Shows the proposed plan; applies nothing |
| `apply_safe_switches` | Execute plan steps currently inside human policy | Updates grid, telemetry and audit trail |
| `request_critical_override` | Explain and stage one withheld action | Creates a visible pending decision; never executes it |
| `advance_simulation` | Move the deterministic crisis clock by 1–10 minutes | Can trigger the timed hospital-feed cascade |

## Demonstration path

1. Ask the agent to inspect the current grid.
2. Simulate the `balanced` recovery plan.
3. Apply actions inside policy. Coverage rises from 58% to 80% and cascade risk falls from 74 to 24.
4. Ask the agent to request the withheld Transit-feed transfer. The control room displays the exact trade-off and waits.
5. Approve or reject it as the human operator. Approval restores Old Town while taking Transit Hub offline, reaching 90% weighted coverage.

See [the complete prompt sequence](docs/AGENT_TESTS.md) for expected results and a failure-path test.

## Design guarantees

- **Deterministic:** the same state and strategy always produce the same plan and outcome.
- **Policy-aware:** changing outage approval or risk tolerance changes what the agent may execute automatically.
- **Human-authorized:** a request tool can stage a sensitive action but cannot approve it.
- **Auditable:** agent, human and system events share one chronological record.
- **Original and fictional:** the interface, scenario, data and vector graphics are original; no real operator or infrastructure is represented.
- **Progressive enhancement:** the page remains fully usable when `document.modelContext` is unavailable.

## Local development

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production check:

```bash
npm run check
```

That command runs the deterministic engine tests and the TypeScript/Vite production build.

## Project structure

```text
src/
├── components/          visible control room and human decisions
├── domain/              typed deterministic simulation and tests
├── webmcp/              five tool registrations and schemas
├── App.tsx              shared-state integration
└── styles.css           original responsive interface
```

## Technology

React 19, TypeScript, Vite, Vitest and the `webmcp-types` type definitions. The deployed site is a static GitHub Pages build and has no backend, analytics or external runtime API.

## Licence

[MIT](LICENSE)
