# consumed-message-sync-reconcile

reconciliation cancels the consumed message and settles nothing.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L685).
- [Full catalog](../../CATALOG.md#consumed-message-sync-reconcile).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Two defects in one function, both on the path the host's own turn takes.

`getPendingRequests` hands back the model's live array, and
`replacePendingRequests` empties it in place before the settlement loop
runs, so the loop iterates nothing and every message that really did
leave the provider queue is left waiting forever. Copying it first is
what makes the loop, and therefore the guard below, do anything at all.

The loop then rejects the message the host just consumed, racing the
`sent` settlement from `consumed-message-settles-sent`: both follow the
same state change. Skipping the consumed id leaves that settlement to
the request path, which reports what actually happened.

The read is matched in both its copied and uncopied forms, so this entry
keeps applying if microsoft/vscode#334002 lands on its own. Without that
the entry would drop while its three siblings kept applying, leaving the

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334002](https://github.com/microsoft/vscode/pull/334002): Settle the promise of a pending request the remote reconcile dropped
- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334002](https://github.com/microsoft/vscode/pull/334002): Settle the promise of a pending request the remote reconcile dropped — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334002.md).
- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331408.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only consumed-message-sync-reconcile --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`consumed-message-settles-sent`](consumed-message-settles-sent.md), [`consumed-message-sync-arg`](consumed-message-sync-arg.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
