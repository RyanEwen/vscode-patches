# session-scope-counts-other-sessions-work

a session is credited with every uncommitted change in the folder.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1616).
- [Full catalog](../../CATALOG.md#session-scope-counts-other-sessions-work).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Session scope answers "what did THIS session change". It is computed as
a git diff from the session baseline checkpoint to the latest turn
checkpoint. The baseline, `refs/agents/<id>/checkpoints/turn/0`, is cut
with HEAD's tree, so it holds none of the work that was already
uncommitted when the session started, while the latest turn checkpoint
snapshots the dirty tree. The difference is the whole folder's
uncommitted state, so every session opened in that folder reports the
same numbers, and they climb as the shared tree gets dirtier.

Measured 2026-09-08 in one repo: five sessions started within eleven
minutes all reported 3679/76/46, one of them a single turn that wrote
only two files under /tmp while posting a GitHub issue. Minutes later
the same figure had become 3874/117/48. That repo held 51 dirty paths
and checkpoint refs for 232 sessions.

The session's own footprint is already recorded, in the `file_edits`

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-scope-counts-other-sessions-work --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
