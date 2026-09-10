# client-tool-handler-never-throws

a rejected client-tool wait escapes the MCP handler as a bare "Canceled".

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3043).
- [Full catalog](../../CATALOG.md#client-tool-handler-never-throws).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The in-process MCP server that surfaces workbench client tools to the
Claude SDK awaits the parked deferred with no try/catch, so a rejection
escapes into the SDK's tool path instead of being answered as a tool
result. Rejections are routine rather than theoretical: the pending
registry rejects every parked request on `rejectAll`, which runs when the
session rebinds a client and when it is disposed.

The MCP SDK turns a thrown handler error into a bare tool error, so what
reaches the model is "Canceled" with no tool name and no reason, and the
turn continues on a result that explains nothing. Catching here produces
the same `isError` shape the sibling branch a few characters earlier
already uses for a missing `tool_use_id`, and the same shape the
server-tool MCP server uses for its own failures.

The handler is rewritten from a ternary into statements because the
original body is a single `return <cond>?<errorResult>:awaitResult(id)`

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334038](https://github.com/microsoft/vscode/pull/334038): Answer client-tool handler rejections as tool errors — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334038.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-handler-never-throws --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`replay-args`](replay-args.md), [`client-tool-ownerless-fail-session`](client-tool-ownerless-fail-session.md), [`pending-register-shares-deferred`](pending-register-shares-deferred.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
