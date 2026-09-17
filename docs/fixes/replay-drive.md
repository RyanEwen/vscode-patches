# replay-drive

drive execution for a replayed (never-streamed) client tool call.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L285).
- [Full catalog](../../CATALOG.md#replay-drive).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The turn the call actually streamed under. `__vsTurnId` is only set in
`send()`, so it is stale for a promoted steering turn and the resync
then matches no pending request, stranding the call for good.
The next four edits together surface a steering message as its own turn,
which is what upstream did for Copilot (PR #318456) and what CONTEXT.md M10
already specified: the ack belongs at model visibility, not queue
acceptance. Without them a steer is acked the moment the queue hands it to
the SDK, the pending bubble is removed, and the message is left with no
representation while the model visibly acts on it.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#318456](https://github.com/microsoft/vscode/issues/318456)

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330746](https://github.com/microsoft/vscode/pull/330746): Execute a client tool the SDK replays from the transcript — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-330746.md).

Related issue reports:

- [microsoft/vscode#331595](https://github.com/microsoft/vscode/issues/331595): Agent host: a replayed client tool from a subagent is handled on the parent chat after a restart
- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only replay-drive --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
