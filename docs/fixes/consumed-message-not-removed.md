# consumed-message-not-removed

a queued message the host consumed is retired as cancelled.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L618).
- [Full catalog](../../CATALOG.md#consumed-message-not-removed).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`removePendingRequest` settles the caller's `sendRequest` promise as
`{kind:"rejected",reasonCode:"cancelled"}`, which is right for a message
the user withdrew. The server-initiated turn path calls it for the
message the host just STARTED RUNNING, so a delivered message reports
cancellation. Skip the id that is becoming this turn; the queue entry
still clears via the reconciliation that follows the same state change.
Mirrors microsoft/vscode#331408.

Re-anchored for 1.136.0: upstream (#332461) inserted a second
assignment, `previousTurnIds = currentTurnIds`, between the queue
assignment and `startServerRequest`. The optional group keeps older
bundles matching, and the build re-emits that assignment when it is
present. The removal loop itself is unchanged, so this entry still
does work.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent
- [microsoft/vscode#332461](https://github.com/microsoft/vscode/issues/332461)

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331408.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only consumed-message-not-removed --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
