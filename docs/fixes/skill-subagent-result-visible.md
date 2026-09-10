# skill-subagent-result-visible

a skill that runs in a subagent works for minutes and the turn renders empty.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2576).
- [Full catalog](../../CATALOG.md#skill-subagent-result-visible).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A skill invoked as a subagent (the built-in `/code-review`, for one) is
spawned by the skill runner rather than by a `Task` tool call, so its
sidechain agent carries no tool-use id. `SubagentRegistry` is keyed
entirely on that id, so the host never learns the agent exists, opens no
subagent chat, and receives nothing on the stream while it runs.

Measured on 2026-09-04: a `/code-review` ran for 10 minutes 8 seconds and
made 40 tool calls. Over that window the workbench received exactly one
`chat/turnStarted`, one `chat/usage` reporting zero tokens, and one
`chat/turnComplete`. No response part, no tool call. The 13.6 KB of
findings it produced were recovered from the SDK transcript afterwards.

The parent model never runs in this shape, which is why the turn reports
zero tokens, and the whole product of the turn is the `result` message's
own text. The stock branch settles the head, logs the uuid, and discards
`result` unconditionally. This surfaces it as a markdown response part

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only skill-subagent-result-visible --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`steer-keeps-tool-attribution`](steer-keeps-tool-attribution.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
