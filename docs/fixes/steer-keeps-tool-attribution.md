# steer-keeps-tool-attribution

a tool still running when a steer lands never completes.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2515).
- [Full catalog](../../CATALOG.md#steer-keeps-tool-attribution).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A steering message is injected with priority `now`, so the SDK emits a
`result` for the preempted turn even though the protocol turn is not
over. The pipeline already treats that result as intermediate and defers
`ChatTurnComplete` to the final one. The mapper did not: `mapResult`
cleared the tool_use attribution map and drained foreground subagent
spawns on EVERY result, intermediate ones included. A tool still in
flight when the steer landed therefore lost its attribution, its later
`tool_result` hit the unknown-id path, no completion was emitted, and
the tool showed Running for the rest of the session. A foreground
subagent that call had spawned vanished from the registry the same way,
so `subagent_started` was never announced and its inner signals stayed
buffered.

Upstream takes the cleanup out of `mapResult` and gives the router a
`clearPendingTurnState` method the pipeline calls in the branch that
fires `ChatTurnComplete`. That is two files; a regex patch gets one

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334008](https://github.com/microsoft/vscode/pull/334008): Keep tool attribution across a steering preempt — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334008.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steer-keeps-tool-attribution --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`steering-promote`](steering-promote.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
