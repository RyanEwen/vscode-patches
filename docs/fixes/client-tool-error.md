# client-tool-error

a client tool error reaches the model as an empty result.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L207).
- [Full catalog](../../CATALOG.md#client-tool-error).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A client tool that throws is reported as an `error` with no content, and
only `content` was read, so the model got `{content: [], isError: true}`:
told that something failed but never what.
The next five edits together implement the replayed-client-tool guard
(upstream: the client_tool_invoked signal PR). An SDK resume can replay a
transcript-dangling tool_use without streaming anything, so no client
execution is ever requested and the turn heartbeats forever. Each edit is
inert without the others (the router falls back to register), so partial
application after a VS Code update degrades to the unpatched behavior.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330709](https://github.com/microsoft/vscode/pull/330709): Surface a client tool's error when it returns no content — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-330709.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-error --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
