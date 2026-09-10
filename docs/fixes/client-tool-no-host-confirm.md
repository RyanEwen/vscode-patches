# client-tool-no-host-confirm

a client tool the workbench already confirmed is confirmed again by the host.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2046).
- [Full catalog](../../CATALOG.md#client-tool-no-host-confirm).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The Claude SDK gates in-process MCP tools through `canUseTool`, so a
workbench client tool (`mcp__client__*`) took the generic
pending_confirmation path even though the stream mapper had already
readied it as a running client execution. The extra host-side prompt
regresses the call from Running back to PendingConfirmation, and the
workbench rewrites that into a SECOND ToolClientExecution request with
no pre-approval, which is how a client tool gets run twice
(microsoft/vscode#330683).

The allow sits after the interactive built-ins (`AskUserQuestion`,
`ExitPlanMode`) and before the server-tool auto-allow, because the
interactive pair is exempt from auto-approval by design: their
"permission" IS the user-facing question, and allowing them early would
swallow it. `allowedTools` is deliberately left alone; its semantics for
in-process MCP tools under the plan and dontAsk modes are unverified.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#330683](https://github.com/microsoft/vscode/pull/330683): Do not run a client tool twice when a tool call is readied twice
- [microsoft/vscode#334037](https://github.com/microsoft/vscode/pull/334037): Let the workbench own confirmation for Claude client tools

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334037](https://github.com/microsoft/vscode/pull/334037): Let the workbench own confirmation for Claude client tools — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334037.md).
- [microsoft/vscode#330683](https://github.com/microsoft/vscode/pull/330683): Do not run a client tool twice when a tool call is readied twice — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-330683.md).

Related issue reports:

- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately
- [microsoft/vscode#330899](https://github.com/microsoft/vscode/issues/330899): Agent host: client tools execute off the stream-mapper ready rather than the SDK invocation

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-no-host-confirm --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
