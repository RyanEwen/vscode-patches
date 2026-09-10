# replay-keeps-local-command-output

a slash command's output is dropped on replay, so a restart empties the turn.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3346).
- [Full catalog](../../CATALOG.md#replay-keeps-local-command-output).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A forked slash command writes its result into the CLI transcript as a `system`
record of subtype `local_command`, wrapped in `<local-command-stdout>`. The
replay mapper's allowlist is `compact_boundary` and `notification` only, and
its own comment says anything else is dropped. So the turn renders live and is
empty after a restart.

The exclusion is reasonable for what the surrounding comment describes: an echo
of a local handler, "Set model to claude-opus-4.7". It is wrong for a forked
command, where that same record carries the entire product of the turn. Measured
2026-09-06: a `/code-review` result of 12,295 characters, present in the
transcript, discarded on replay, and gone from the chat after a full restart.

This is NOT the skill-subagent case, which genuinely leaves no assistant message
behind and cannot be repaired here. The record exists; it is being filtered.

Strips the wrapper tags with string operations rather than a regex, because

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only replay-keeps-local-command-output --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
