# session-delete

deleting a Claude session does not delete the transcript.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L854).
- [Full catalog](../../CATALOG.md#session-delete).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Delete reaches the provider, and each implements it itself: Copilot has
`_deleteSdkSession`, Claude's `_disposeChat` is in-memory only, so the
transcript survives and the session is re-listed on reopen. Claude already
calls `_sdkService.deleteSession` in `truncateChat`, so the comment in
`_disposeChat` claiming the SDK has no delete RPC is simply stale.

Re-anchored for 1.133.x: the old `disposeSession`/`_teardownEntry` shape
this matched no longer exists in any build. A provisional chat is skipped,
since it never reached the SDK and asking would pull in the download that
provisional creation avoids. Both reads happen before the teardown that
clears them. Tracked upstream as microsoft/vscode#330698.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#330698](https://github.com/microsoft/vscode/pull/330698): Delete the Claude transcript when a chat is disposed

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330698](https://github.com/microsoft/vscode/pull/330698): Delete the Claude transcript when a chat is disposed — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-330698.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-delete --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
