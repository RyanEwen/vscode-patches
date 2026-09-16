# router-drop-is-loud

every SDK message with no resolvable turn id is discarded with no log at all.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1521).
- [Full catalog](../../CATALOG.md#router-drop-is-loud).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`ClaudeSdkMessageRouter.handle` returns early when `turnId === undefined`,
with no log, no counter and no trace. Every signal in that message is lost
and nothing anywhere records that it happened.

This is the single most expensive line in the system for debugging. It is the
mechanism behind `sdk-initiated-turn`, and it is why "no drops in the log" is
never evidence of anything: the code cannot report a drop at any log level. I
cited that non-evidence twice before finding this.

Logs at `warn` rather than `trace` deliberately. The condition means real
model output is being thrown away, which is not routine, and `trace` is not
enabled in practice.

The source's early `if (turnId === undefined) { return; }` does not survive
minification: it becomes a positive guard at the tail of a comma expression,
`..., t !== void 0) try { ... }`, with no `return` anywhere. So this extends

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only router-drop-is-loud --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`sdk-initiated-turn`](sdk-initiated-turn.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
