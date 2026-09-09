# activity-clears-when-the-turn-results

the liveness row needs a real end signal, not an empty queue.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1461).
- [Full catalog](../../CATALOG.md#activity-clears-when-the-turn-results).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Pairs with `claude-turn-reports-activity`, which starts the row in `send`
and now runs until `__ahHbActive` is cleared. This is what clears it: the
turn's result, which is the only signal that actually means the turn is
over. Without this the row would linger past the end of a slow turn until
the tick ceiling, so the two entries must ship together.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334742](https://github.com/microsoft/vscode/pull/334742): Report chat activity from the Claude agent session — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334742.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only activity-clears-when-the-turn-results --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`claude-turn-reports-activity`](claude-turn-reports-activity.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
