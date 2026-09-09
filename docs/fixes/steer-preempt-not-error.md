# steer-preempt-not-error

a turn interrupted by a steer renders as failed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L739).
- [Full catalog](../../CATALOG.md#steer-preempt-not-error).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Interrupting a turn makes the SDK emit a result of subtype
`error_during_execution`, and the mapper turns any such result into a
ChatError. Without `steering-promote` the preempted turn has no bubble
so this is invisible; promoting the steer gives it somewhere to land,
and every steered message renders an error above its own correct answer.

The SDK always makes an internal diagnostic the FIRST entry of `errors`
and appends the real errors, if any, after it. On its own it is not a
failure: an interrupted turn carries nothing else. So the fix belongs
where the error text is extracted, not in the signal fan-out. Dropping
the diagnostic leaves a genuine error intact (minus a prefix never meant
for users) and leaves an interrupted turn with no error text at all, so
no ChatError is built for it.

Two earlier attempts were wrong and are recorded so they are not retried:
keying the fan-out on the pending steer raced (the promotion clears the

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#330785](https://github.com/microsoft/vscode/pull/330785): Surface a Claude steering message as its own turn

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330785](https://github.com/microsoft/vscode/pull/330785): Surface a Claude steering message as its own turn — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-330785.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steer-preempt-not-error --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`steering-promote`](steering-promote.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
