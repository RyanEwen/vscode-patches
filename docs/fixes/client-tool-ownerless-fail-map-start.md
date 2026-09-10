# client-tool-ownerless-fail-map-start

the stream mapper does not record that a client tool call has no owner.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2098).
- [Full catalog](../../CATALOG.md#client-tool-ownerless-fail-map-start).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

First of five edits implementing the ownerless-client-tool failure. A
client tool (`mcp__client__<name>`) runs on whichever connected window
contributed it. When no connected client provides it, the Claude session
stamps no contributor on ChatToolCallStart, so nothing publishes a
ToolClientExecution request, the disconnect grace timer never arms, and
the in-process MCP handler parks on the pending registry forever: the
turn hangs with no error and no way out. The Copilot session already
fails such calls immediately (`No client was connected to run ...`);
this brings Claude in line.

Each edit is inert without the others. Without this one the flag is never
set, so `-map-stop` emits nothing; without `-session` the completion is
rendered but the handler still parks. Partial application after a VS Code
update therefore degrades to the unpatched hang rather than to a
half-failed call.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334044](https://github.com/microsoft/vscode/pull/334044): Fail Claude client tool calls that no connected client provides — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334044.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-ownerless-fail-map-start --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
