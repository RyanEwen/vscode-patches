# client-tool-single-trigger

a client tool executes off the streamed ready rather than the runtime invocation.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L433).
- [Full catalog](../../CATALOG.md#client-tool-single-trigger).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Upstream proposal: microsoft/vscode#330933. Admits a Claude client tool
to execution only once its runtime invocation is announced, so the call
cannot run twice, run with no arguments, or finish before anything
awaits it. Other providers announce nothing and are left on the
streamed ready, matching the PR.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#330933](https://github.com/microsoft/vscode/pull/330933): Proposal: execute a client tool on the runtime's invocation

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330933](https://github.com/microsoft/vscode/pull/330933): Proposal: execute a client tool on the runtime's invocation — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-330933.md).
- [microsoft/vscode#334146](https://github.com/microsoft/vscode/pull/334146): Admit a client tool call once, instead of racing two triggers — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334146.md).

Related issue reports:

- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately
- [microsoft/vscode#330899](https://github.com/microsoft/vscode/issues/330899): Agent host: client tools execute off the stream-mapper ready rather than the SDK invocation

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-single-trigger --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
