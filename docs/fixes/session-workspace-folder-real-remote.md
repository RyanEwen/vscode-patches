# session-workspace-folder-real-remote

a session workspace keeps the agent host authority its folders cannot resolve.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L996).
- [Full catalog](../../CATALOG.md#session-workspace-folder-real-remote).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Companion to `workspace-folder-uses-real-remote`. That one covers
`_buildWorkspaceFromUri`, which serves folder browsing. A session opened
from the list goes through this builder instead, which takes the stored
working directories and uses them as folder roots directly, so the
`vscode-agent-host://hex-<connection>/...` form reaches a plain window
that has no connection registered for that authority.

Same narrow scope: only the folder roots are rebased, onto the remote
authority the client can address by itself. Every other URI is returned
untouched, so this is inert for local, remote and GitHub workspaces.

The `[AHWS]` line names the producer that actually ran. Opening a session
folder has now had two plausible producers and only one of them is on the
path, so the log settles it rather than another round of inference.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-workspace-folder-real-remote --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`workspace-folder-uses-real-remote`](workspace-folder-uses-real-remote.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
