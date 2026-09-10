# reap-orphaned-session-data

a pruned external session leaves its data directory behind forever.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2739).
- [Full catalog](../../CATALOG.md#reap-orphaned-session-data).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Discovery creates a data directory for every external session it lists,
because seeding the read state writes through the session database and
opening that database makes the directory. The 30-day startup prune then
unregisters the stale row and stops there, so the directory outlives the
only record that could ever name it: with the registry row gone nothing
can match a directory back to a session again, and `cleanupOrphanedData`
(which would) has no callers. Measured on this machine: 503 of 528
session data directories were such empty shells.

Deleting the pruned row's data as the row goes stops the leak growing.
It does NOT reclaim the ones already there. That is the startup sweep
half of the upstream change, and it is deliberately not backported here:
it is a signature change on the data service plus a rewritten ownership
test (base64url session fragment for peer chats, a derived subagent
prefix, a per-directory database read for the chat-backing marker) plus
a new startup hook, so it is several sites rather than one, and what it

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334010](https://github.com/microsoft/vscode/pull/334010): Reclaim orphaned agent session data directories — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334010.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only reap-orphaned-session-data --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`session-delete`](session-delete.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
