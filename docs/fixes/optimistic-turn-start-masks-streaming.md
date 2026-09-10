# optimistic-turn-start-masks-streaming

responses appear only when the turn ends, never streaming.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1824).
- [Full catalog](../../CATALOG.md#optimistic-turn-start-masks-streaming).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The client applies its own `chat/turnStarted` optimistically and keeps it
in `_pendingActions` until the backend echoes it with the originating
clientSeq. The agent host does not echo that clientSeq, so the pending
start survives the whole turn, and `_recomputeOptimistic` replays it over
the confirmed state on every single action. Replaying a turn start resets
`activeTurn` to a fresh empty turn, so `activeTurn.responseParts` reads as
empty for the entire stream no matter how many deltas have been applied.

Measured in a live window: 17 `chat/delta` envelopes arrived between 8.0s
and 19.4s and every one passed the channel filter, yet the confirmed part
count of 1 was rewritten to 0 on all 19 recomputes. The renderer set up
its markdown observer at 19.4s and emitted the whole 2,432 characters in
one go. With the fix the same prompt set the observer up at 7.8s and
emitted 16 times across 12 seconds.

The existing code already knows the echo lacks the clientSeq: it promotes

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332087](https://github.com/microsoft/vscode/issues/332087): Agent host: responses render only at turn end because the optimistic turn start is never retired

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#332122](https://github.com/microsoft/vscode/pull/332122): agentHost: retire the optimistic turn start on the first backend action — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-332122.md).

Related issue reports:

- [microsoft/vscode#332087](https://github.com/microsoft/vscode/issues/332087): Agent host: responses render only at turn end because the optimistic turn start is never retired

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only optimistic-turn-start-masks-streaming --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
