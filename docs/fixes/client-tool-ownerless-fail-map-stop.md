# client-tool-ownerless-fail-map-stop

a client tool call no window can run is never failed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2165).
- [Full catalog](../../CATALOG.md#client-tool-ownerless-fail-map-stop).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Second of five. Pairs with `-map-start`, which marks the active tool
block when the client-tool owner lookup came back empty. At
`content_block_stop` the mapper already emits ChatToolCallReady for the
call; this follows it with a ChatToolCallComplete carrying
`success:false` and the `toolUnavailable` error code the workbench
already uses for exactly this situation, so the call renders as failed
instead of running forever.

It has to come AFTER the ready rather than instead of it: the reducer
only accepts a completion for a call it has already seen readied, and
the tool-call tracker keys its bookkeeping off the same order.

The two message strings are emitted as plain concatenation. Upstream
runs them through `localize` with the tool name as a placeholder, but a
minified patch cannot add an nls id, and the English text is what the
non-localized build resolves to anyway. The error CODE is protocol

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334044](https://github.com/microsoft/vscode/pull/334044): Fail Claude client tool calls that no connected client provides — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334044.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-ownerless-fail-map-stop --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
