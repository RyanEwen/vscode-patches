# toolcall-hidden-respects-liveness

a tool card is hidden when its call completes, even when its work is still running.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1346).
- [Full catalog](../../CATALOG.md#toolcall-hidden-respects-liveness).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`isEffectivelyHidden` is `presentation === 'hidden' || (presentation ===
'hiddenAfterComplete' && isComplete(invocation))`. The second clause encodes
"this card stopped being useful when its call ended", which holds for a
synchronous tool and breaks for anything whose work outlives its own call.

A backgrounded subagent is the case that bites: its launch call completes in
about two seconds while the agent runs for minutes, so the card is hidden
almost immediately and real work proceeds with nothing on screen.

This is the root-cause fix for what `background-subagent-stays-visible`
treated at one call site, and it replaces that entry. It is better in two
ways: it covers every route to hiding rather than the single completion site,
and it re-hides the card once the subagent genuinely finishes, which the
retired entry never did.

Liveness is deliberately NOT `isActive` alone. `isActive` mirrors the child

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only toolcall-hidden-respects-liveness --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
