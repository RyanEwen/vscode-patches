# steering-list-turnstarted

a steering message auto-started as a turn must leave the list.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3215).
- [Full catalog](../../CATALOG.md#steering-list-turnstarted).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`chat/turnStarted` carries `queuedMessageId` when the turn was started from
a pending message, and clears the singular slot. The array has to follow or
the bubble outlives the turn it became.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334743](https://github.com/microsoft/vscode/pull/334743): Keep every pending steering message instead of only the last — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334743.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steering-list-turnstarted --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
