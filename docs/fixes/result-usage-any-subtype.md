# result-usage-any-subtype

a turn that stops at a cap reports none of the tokens it spent.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1328).
- [Full catalog](../../CATALOG.md#result-usage-any-subtype).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`mapResult` emits chat/usage only when the subtype is `success`, so a turn
ending at a cap reports nothing, even though the tokens were spent. That is
the same turn this patcher's `result-error-subtypes-surface` entry gives an
error message to, and the two together make a capped turn legible.

Gated on the fields existing rather than on the subtype, so a result that
carries no usage behaves exactly as before instead of throwing.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only result-usage-any-subtype --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`result-error-subtypes-surface`](result-error-subtypes-surface.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
