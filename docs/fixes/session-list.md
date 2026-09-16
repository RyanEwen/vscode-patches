# session-list

sessions never list in remote windows.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L83).
- [Full catalog](../../CATALOG.md#session-list).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A dev-container window listed no sessions at all. The host reports each
session's working directories wrapped for the agent-host filesystem
(`vscode-agent-host://b64-<host address>/workspace/printstream`), while
the window's folder is `vscode-remote://dev-container+<hex>/...`.
`isEqualOrParent` gates on the scheme before anything else, so the two
never match and the whole list is filtered out. Reported as #330979.

The wrapper carries the original URI in its `_ah` query, and unwrapping
it here yields the very `vscode-remote:` URI the window uses for that
folder, so the comparison is exact rather than assumed. Measured in a
live window: the unwrapped authority equals the folder's, byte for byte.

Two earlier revisions are recorded so they are not retried. Normalising
both sides to `file:` with an empty authority lists the sessions, but
compares paths alone, so two different remotes exposing the same path
would match. Lifting a `file:` directory into the folder's namespace

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#330979](https://github.com/microsoft/vscode/issues/330979): Sessions are filtered out of the list in a remote window: working directories are compared without unwrapping their agent-host URIs
- [microsoft/vscode#331349](https://github.com/microsoft/vscode/pull/331349): Match a remote host's working directories against the window's folder

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331349](https://github.com/microsoft/vscode/pull/331349): Match a remote host's working directories against the window's folder — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331349.md).

Related issue reports:

- [microsoft/vscode#330979](https://github.com/microsoft/vscode/issues/330979): Sessions are filtered out of the list in a remote window: working directories are compared without unwrapping their agent-host URIs

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-list --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
