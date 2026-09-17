# session-chip-scope-v2

the session list chip counts the whole branch, not the session.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1590).
- [Full catalog](../../CATALOG.md#session-chip-scope-v2).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Re-anchored for the current bundle: upstream added a multi-root
branch ahead of the summary write, so the previous entry no longer
matched and silently stopped applying to the live server.

The chip must count the session's own footprint. Keep the multi-folder
aggregate under the branch changeset, and move the legacy diffs key
and the summary write to the session changeset.
Mirrors microsoft/vscode#331345.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331345](https://github.com/microsoft/vscode/pull/331345): Count the session's changes, not the branch's divergence

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331345](https://github.com/microsoft/vscode/pull/331345): Count the session's changes, not the branch's divergence — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331345.md).

Related issue reports:

- [microsoft/vscode#330941](https://github.com/microsoft/vscode/issues/330941): Session list change counts show the whole branch divergence, not the session's changes

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-chip-scope-v2 --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
