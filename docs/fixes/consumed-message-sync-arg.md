# consumed-message-sync-arg

reconciliation is not told which message the host consumed.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L721).
- [Full catalog](../../CATALOG.md#consumed-message-sync-arg).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The projection knows which turn the host started, so it can name the
message that left the queue by being run rather than withdrawn. Feeds
`consumed-message-sync-reconcile`, which is inert without it.

Anchored on the enclosing method rather than on the nearest preceding
`_getSessionState` call: a lazy match from that alone starts at an
earlier method and captures ITS state variable, emitting a name that is
not in scope here. Caught before install, by reading what was emitted.
Mirrors microsoft/vscode#331408.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331408.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only consumed-message-sync-arg --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`consumed-message-sync-reconcile`](consumed-message-sync-reconcile.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
