# Agent test script

Use these prompts in ChatGPT's in-app browser, or in Google Chrome after enabling `chrome://flags/#enable-webmcp-testing` and relaunching Chrome. Both test surfaces are listed in the [official challenge resources](https://webmcp.devpost.com/resources).

Open the [live demo](https://mhtorregrosa.github.io/SwitchboardZero/) and confirm that the telemetry header says **5 SITE TOOLS**. If it says **HUMAN MODE**, `document.modelContext` is unavailable in that browser session and the WebMCP checks below cannot run there.

Start with **Restart exercise** so the values are deterministic. The restart confirmation, policy controls and decision buttons are deliberately not exposed as Site Tools.

## Primary human-authority demonstration

### 1. Inspect without mutation

Prompt:

> Inspect the current crisis grid. Summarize the fault, service coverage, cascade risk, deadline and human authority boundary. Do not change anything.

Expected tool: `inspect_grid`

Expected result: 58% weighted coverage, 83% critical availability, risk 74/100, East Ring faulted, Water and Transit service locks active. The live clock remains T+00.

### 2. Forecast delay safely

Prompt:

> Forecast what happens if we wait eight minutes. Do not advance the live exercise or apply any action.

Expected tool: `simulate_delay_impact` with `minutes: 8`

Expected result: `applied: false`, a projected Hospital brownout, 47% projected coverage and risk 96/100. The visible live exercise remains unchanged at T+00.

### 3. Simulate a complete plan

Prompt:

> Simulate a balanced recovery plan. Do not execute it yet.

Expected tool: `simulate_recovery_plan` with `strategy: "balanced"`

Expected visible result: the **Balanced restoration** card appears with 100% projected coverage, risk 18/100, a 16-minute duration and one human decision.

### 4. Apply only authorized actions

Prompt:

> Apply the authorized actions from that plan in order. Stop at the first action outside human policy.

Expected tool: `apply_authorized_actions` with `planId: "plan-balanced-v2"`

Expected visible result: East Ring is isolated, the battery reserve and North loop are online, coverage is 80%, critical availability is 100%, risk is 24/100 and the clock is T+06. `transfer_transit_feed` is withheld; the dependent Transit-restoration step has not executed.

### 5. Stage the real blocked decision

Prompt:

> Request the human decision for the withheld Transit-feed transfer. Explain that Old Town gains service while Transit pauses until the protected alternate feed is ready. Do not authorize it yourself.

Expected tool: `request_human_decision` with `actionId: "transfer_transit_feed"`

Expected visible result: one pending decision card appears with the agent's reason and the fixed consequence. Grid service remains at 80%.

### 6. Human decision and completion

The person—not the agent—clicks **Authorize action**.

Expected immediate result: Old Town becomes online, Transit becomes offline, coverage reaches 90%, risk reaches 22/100 and the plan remains active.

Final prompt:

> The human decision has been made. Continue the latest plan using only actions now inside policy.

Expected tool: `apply_authorized_actions` again with `planId: "plan-balanced-v2"`

Expected final result: Transit returns through the reserve bus, all six districts are online, coverage reaches 100%, risk reaches 18/100 and a **Full service, bounded authority** debrief appears at T+16 with a score of 96/100.

## Rejection route

Repeat steps 1, 3, 4 and 5, then click **Reject**.

Expected result: the transfer is not performed. The exercise ends as **Cascade contained** with 80% coverage, risk 24/100 and a debrief recording that the operator chose containment over additional coverage.

## Policy-boundary verification

These controls must be changed manually in the page; no Site Tool can alter them.

- Default `low`: the medium-risk Transit transfer is withheld by the Transit lock, outage rule and risk ceiling.
- Unlock Transit, disable outage approval and select `medium`: Balanced can complete automatically because the temporary transfer is now inside all three boundaries.
- Select `high` but keep Water locked: Maximum remains blocked because the uninspected relay exposes a protected service.
- Unlock Water and select `high`: Maximum can complete automatically at 100% coverage and risk 56/100.

All three risk settings therefore have distinct behavior; service locks are connected to actual plan impacts.

## Operator-side failure path

Restart the exercise and click **Wait 4 min** twice without isolating East Ring.

Expected result: at T+08 the fault reaches the Hospital feed, risk rises to 96/100 and a failed **Thermal deadline missed** debrief appears. This failure cannot be triggered by a Site Tool; the agent can only forecast it with `simulate_delay_impact`.

## Invalid sequence checks

- Calling `request_human_decision` before applying a plan must fail.
- Requesting an action other than the one withheld by the latest plan must fail.
- Supplying an incorrect `planId` to `apply_authorized_actions` must fail without changing the grid.
- Supplying an invalid sensitive `actionId` or a reason shorter than 12 characters must fail at the tool boundary.
- Re-simulating while an action is withheld or a human request is pending must fail without hiding the authority boundary.
- Execution must stop at the first blocked step and never skip to a dependent action.
- After a resolved or failed debrief, simulation and execution must require a human restart.

## Strategy-change regression

Repeat the balanced path through the human authorization, stopping when Old Town is online and Transit is temporarily offline at T+08. Before continuing, simulate `critical-first`.

Expected result: the new plan contains exactly `restore_transit_service`, projects 100% coverage, risk 18/100 and eight remaining minutes. Applying it restores Transit and produces **Full service, bounded authority**. A strategy label can never override the actual grid state or strand a service that an earlier authorized action disconnected.

## Automated contract coverage

Run `npm ci && npm run check`. The suite covers 14 deterministic domain cases and 8 WebMCP registration/contract cases, including the annotations, progressive enhancement, read-only forecast, shared-state synchronization and every invalid sequence above.
