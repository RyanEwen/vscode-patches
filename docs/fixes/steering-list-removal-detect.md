# steering-list-removal-detect

the sidebar retires the previous steering bubble whenever the id changes.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3261).
- [Full catalog](../../CATALOG.md#steering-list-removal-detect).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

This is what actually removes the bubble: the watcher tracked ONE steering
id and called `removePendingRequest` whenever it changed, so a second steer
retired the first even though both were still pending. Tracks the set of
pending ids instead and retires only the ones that genuinely went away.

The captured variable holds nothing else after this statement (verified in
the shipped bundle), so widening it from an id to a Set is contained.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334743](https://github.com/microsoft/vscode/pull/334743): Keep every pending steering message instead of only the last — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334743.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steering-list-removal-detect --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
