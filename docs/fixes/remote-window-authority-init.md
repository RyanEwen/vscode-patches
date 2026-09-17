# remote-window-authority-init

the in-window agent host claims to be local in a remote window.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L887).
- [Full catalog](../../CATALOG.md#remote-window-authority-init).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

LOCAL_AGENT_HOST_AUTHORITY means "the host shares the client's
filesystem", which toAgentHostUri relies on to hand `file:` URIs
through untouched. In a dev container the host runs on the remote
machine, so those paths reach a Windows renderer as `C:\workspace\...`
and every agent link and image is dead.

Name the machine the paths are on: "local" for the client, or
"local+<remoteAuthority>" for the window's remote. The mapping entry
turns the latter into vscode-remote URIs.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only remote-window-authority-init --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
