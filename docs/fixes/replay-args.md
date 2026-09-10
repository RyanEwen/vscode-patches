# replay-args

client tool MCP handler forwards tool name and args.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L230).
- [Full catalog](../../CATALOG.md#replay-args).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The handler only forwards the tool_use_id, so the replay path cannot tell
which tool was invoked or with what. Forward the name and arguments too.

Every identifier is captured, never hardcoded. The 1.133.x minifier
swapped the roles of the two names this previously assumed, so the patch
silently passed `args.name` (undefined) as the tool name and the tool
definition as the arguments. `[REPLAYFIX] await <id> (undefined)` in the
agent host log is the signature of that regression.
Also matches the try/catch form `client-tool-handler-never-throws` rewrites this into.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330746](https://github.com/microsoft/vscode/pull/330746): Execute a client tool the SDK replays from the transcript — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-330746.md).

Related issue reports:

- [microsoft/vscode#331595](https://github.com/microsoft/vscode/issues/331595): Agent host: a replayed client tool from a subagent is handled on the parent chat after a restart
- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only replay-args --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`client-tool-handler-never-throws`](client-tool-handler-never-throws.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
