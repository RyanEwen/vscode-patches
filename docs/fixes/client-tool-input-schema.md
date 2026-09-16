# client-tool-input-schema

a client tool runs with empty input when its arguments never streamed.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L63).
- [Full catalog](../../CATALOG.md#client-tool-input-schema).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A call whose arguments never streamed arrives with no `toolInput`, which
`resolveToolInput` turns into `{}`, indistinguishable from a genuine empty
argument set. The browser tools then prepare with `pageId` undefined and
throw, though all nine declare it required. Check the parsed parameters
against the tool's own schema at the single invocation point instead.
Re-anchored for 1.133.x: upstream inserted an `invocationFailed` branch and
made the tool input an awaited read, which widened the gap. Upstream still
does not check required properties, so this entry is still doing work.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330684](https://github.com/microsoft/vscode/pull/330684): Validate client tool input against the tool's schema — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-330684.md).

Related issue reports:

- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately
- [microsoft/vscode#330899](https://github.com/microsoft/vscode/issues/330899): Agent host: client tools execute off the stream-mapper ready rather than the SDK invocation

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-input-schema --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
