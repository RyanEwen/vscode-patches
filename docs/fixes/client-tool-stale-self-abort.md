# client-tool-stale-self-abort

a client tool abandons itself when only its label changes.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1691).
- [Full catalog](../../CATALOG.md#client-tool-stale-self-abort).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A client tool call is readied twice: once with a placeholder label
("Run MCP tool client__issue_fetch") and once with the real one
("issue_fetch"), same toolInput both times. The in-flight attempt asks
whether it is still current by comparing the whole request, so the
label change makes it judge itself superseded and abandon, leaving the
execution request outstanding and the agent waiting forever.

Measured in one turn that issued two identical calls at the same
instant: the call readied once completed, the call readied twice
stalled with its execution request never removed.

Accept the attempt as current when the tool name and input still
match. The original equality stays as the first test, so this only
widens what counts as current and never narrows it.

Pairs with keyed-item-transient-empty. That one stops a mass teardown

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-stale-self-abort --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`keyed-item-transient-empty`](keyed-item-transient-empty.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
