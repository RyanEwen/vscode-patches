# codex-progress-not-output-host

MCP progress narration is persisted as the tool result.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2830).
- [Full catalog](../../CATALOG.md#codex-progress-not-output-host).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`mapMcpToolCallProgress` appended every `mcpToolCall/progress` message to
`entry.output`, the same field real streamed output uses, and re-sent the
whole growing accumulation as the tool call's content. Three consequences,
all of them user-visible:

  * `mapItemCompleted` falls back to `entry.output` when the MCP tool
    returned nothing, so a tool that legitimately produces no output has
    the progress narration persisted as its result.
  * an interrupted turn gives the orphaned completion the same narration.
  * each notification resent the entire accumulation, so a long call's
    content grew quadratically.

Progress is a status line, not output, so it now rides on
`_meta.progressMessage` and the content carries only real output.
Identical consecutive messages are coalesced, and the completion path
drops its `|| entry.output` fallback: nothing writes `output` for an

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334053](https://github.com/microsoft/vscode/pull/334053): Keep Codex MCP tool progress out of the tool result — **MERGED** at the recorded snapshot. [Source/details](../patches/vscode-334053.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only codex-progress-not-output-host --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`codex-progress-not-output-client`](codex-progress-not-output-client.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
