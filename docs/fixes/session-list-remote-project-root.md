# session-list-remote-project-root

a legacy session whose project root is on the remote is dropped from the list.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L136).
- [Full catalog](../../CATALOG.md#session-list-remote-project-root).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`_containmentCandidates` admits a legacy session's project root only when
it is `file:`. In a dev container that root arrives as `vscode-remote://`,
so it is silently excluded and the session matches no workspace folder.

The scheme test widens to accept the window's own remote namespace, which
is still a directory a workspace folder can contain. The exclusion this
test exists for, an `https://` repository URL whose `fsPath` is not a
location on disk, is unaffected. Mirrors microsoft/vscode#334145.

Distinct from `session-list`, which unwraps `vscode-agent-host://`
working directories. This is the project-root candidate beside them.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334145](https://github.com/microsoft/vscode/pull/334145): Brand the agent host URI namespaces and convert the project root at the boundary

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334145](https://github.com/microsoft/vscode/pull/334145): Brand the agent host URI namespaces and convert the project root at the boundary — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334145.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-list-remote-project-root --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`session-list`](session-list.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
