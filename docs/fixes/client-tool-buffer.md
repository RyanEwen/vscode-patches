# client-tool-buffer

a client tool result is dropped when it arrives before the SDK asks for it.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L184).
- [Full catalog](../../CATALOG.md#client-tool-buffer).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The workbench runs a client tool off the stream-mapper ready and completes
it in milliseconds, before the SDK has invoked the tool and registered its
handler. `respond` discards a result nothing is waiting for, so when the
SDK registers moments later it waits forever and the turn never finishes.
Copilot already uses `respondOrBuffer` here; this brings Claude in line.
Verified live: the buffered result is collected ~1.5s later and the turn
continues, in auto mode, which never once completed before.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330730](https://github.com/microsoft/vscode/pull/330730): Buffer a client tool result that arrives before the SDK asks for it — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-330730.md).

Related issue reports:

- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately
- [microsoft/vscode#330899](https://github.com/microsoft/vscode/issues/330899): Agent host: client tools execute off the stream-mapper ready rather than the SDK invocation

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-buffer --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
