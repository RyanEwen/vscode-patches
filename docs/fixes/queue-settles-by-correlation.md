# queue-settles-by-correlation

the queue drifts because one result settles one entry, however many it consumed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2658).
- [Full catalog](../../CATALOG.md#queue-settles-by-correlation).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`settleHead` pops one entry per `result`. The CLI merges several queued
messages into a single delivery and emits ONE result for it, so every merged
entry after the first is never settled. The queue then runs permanently
behind, and each later result settles a stale entry instead of its own.

Measured 2026-09-05: four steers sent between 18:36 and 18:47; the result at
19:02:57 carried `sdkUuid=request_d212008d`, an entry from 18:39, while the
18:47 entry was still unsettled. The model had already ended its turn, so no
further result was coming, and the session sat with a pending steering bubble
that could never clear. `queueDrainContribution` also refuses to drain queued
messages while a steering message is set, so the chat looked dead.

The SDK result carries `user_message_uuid` (sdk.d.ts:4645), the uuid of the
user message it consumed, and a merged delivery reports the LAST merged uuid.
Entries already carry `sdkUuid`. So the result can settle exactly the entries
it consumed: everything up to and including the correlated one.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only queue-settles-by-correlation --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`steering-promote`](steering-promote.md), [`steer-keeps-tool-attribution`](steer-keeps-tool-attribution.md), [`skill-subagent-result-visible`](skill-subagent-result-visible.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
