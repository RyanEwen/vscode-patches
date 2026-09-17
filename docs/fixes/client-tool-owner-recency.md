# client-tool-owner-recency

a tool call is stamped with a client that has gone away.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L582).
- [Full catalog](../../CATALOG.md#client-tool-owner-recency).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`ownerOf` without a preference resolves to the first-inserted
contributor. A window reload connects with a new clientId and
re-pushes the same tools while the departed entry can still be
present, so every later call is stamped with a dead client and fails
on arrival — permanently, not for the grace window. Prefer the most
recent contributor: a reconnecting window is the one most recently
known to be alive. Mirrors microsoft/vscode#331300.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331300](https://github.com/microsoft/vscode/pull/331300): Resolve a client tool to the client that is still there

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331300](https://github.com/microsoft/vscode/pull/331300): Resolve a client tool to the client that is still there — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331300.md).

Related issue reports:

- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-owner-recency --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
