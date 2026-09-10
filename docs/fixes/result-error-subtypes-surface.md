# result-error-subtypes-surface

hitting a turn, budget or retry cap renders as a successful empty turn.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1289).
- [Full catalog](../../CATALOG.md#result-error-subtypes-surface).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`getResultErrorText` extracts error text for exactly two result subtypes,
`success` (when `is_error`) and `error_during_execution`, and returns
undefined for everything else. The SDK (0.3.239) also declares
`error_max_turns`, `error_max_budget_usd` and
`error_max_structured_output_retries`.

So a turn that hits a cap produces no error text, therefore no chat/error,
and the pipeline still fires chat/turnComplete. The turn ticks over to
complete, looking successful, with no indication of why the agent stopped.
The tokens are already spent.

Also fixes the empty-bubble case: `errors?.join(...)` on an empty array
returns the empty string, which is not undefined, so the host raises a
chat/error carrying no message at all.

Emits `String.fromCharCode(10)` rather than an escape, because a `\n`

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only result-error-subtypes-surface --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`steer-preempt-not-error`](steer-preempt-not-error.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
