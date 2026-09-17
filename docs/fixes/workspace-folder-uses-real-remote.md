# workspace-folder-uses-real-remote

opening a session folder yields a window that can resolve nothing.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L954).
- [Full catalog](../../CATALOG.md#workspace-folder-uses-real-remote).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`_buildWorkspaceFromUri` uses the agent host URI as the workspace folder
root, so "Open in editor" writes
`vscode-agent-host://hex-<connection>/path?_ah=...` into the generated
`agent-sessions.code-workspace` and opens it in a plain window. That
window registers its agent host under "local", never under the hex
authority, so every read fails with "No connection for authority" and
the explorer shows folder stubs with error badges.

Measured 2026-09-09: authority `hex-77736c3a5562756e7475` decodes to
`wsl:Ubuntu`, and the same generated workspace already carried a working
`vscode-remote://wsl+ubuntu/...` folder beside the broken one.

Only the folder root is rewritten, back to the remote authority the
client can address on its own. In-window file access still goes through
`vscode-agent-host:` exactly as before, so the Agents window, which has
the connection but no WSL remote, is unaffected.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only workspace-folder-uses-real-remote --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
