# steering-promote

a steering message never becomes its own turn.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L373).
- [Full catalog](../../CATALOG.md#steering-promote).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The SDK emits one result per turn it ran, so the result that ends the
preempted turn is where the steer has demonstrably reached the model.
It does not echo steering messages on the stream, so there is no
earlier signal to use.
REVERTED 2026-09-05. A drain here retired every yielded non-head steer on
the merged result, which removed the SECOND bubble at the same moment the
first was rendered. That is worse than the behaviour it replaced, where
the second stayed put and the first reappeared once read. `steering_consumed`
is evidently not "the model has seen it", it is "this bubble has been
superseded by something the user can now see", and only the promotion path
knows that. Do not re-add a drain here without a rendering signal.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steering-promote --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
