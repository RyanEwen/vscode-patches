# toolcall-progress-emit

a long tool call reports nothing while it runs.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L770).
- [Full catalog](../../CATALOG.md#toolcall-progress-emit).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The SDK already says a tool call is still working. Every foreground
tool call over ~30s produces a `tool_progress` heartbeat, and a running
subagent produces `system/task_progress` naming its current step. The
mapper switch handles stream_event/result/assistant/user and delegates
only `system` to the subagent handler, so both fall through `default`
and are dropped. A turn that spends minutes inside one call sends the
client nothing but keepalives.

Heartbeat frames carry a SYNTHETIC tool_use_id of the form
`<real>-heartbeat-<n>`, which matches no tool call; the real id is in
`parent_tool_use_id`. Keying on tool_use_id compiles, runs, and never
matches. Verified live: a 95s Bash call produced heartbeats at 29s, 58s
and 87s, each carrying the synthetic id.

Upstream this is `chat/toolCallProgress`, submitted to the
agent-host-protocol repo which owns these types. VS Code cannot carry

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/agent-host-protocol#405](https://github.com/microsoft/agent-host-protocol/pull/405): chat: report progress for a running tool call — **OPEN** at the recorded snapshot. [Source/details](../patches/agent-host-protocol-405.md).
- [microsoft/vscode#334131](https://github.com/microsoft/vscode/pull/334131): Surface Copilot tool progress instead of discarding it — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334131.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only toolcall-progress-emit --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
