# remote-window-authority-map

agent host file paths are handed to the client unmapped.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L928).
- [Full catalog](../../CATALOG.md#remote-window-authority-map).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The fast path returns `file:` URIs untouched whenever the host is
"local", which is only safe when the host really is on the client's
machine. Rebase onto the window's own remote connection instead:
RemoteAuthorities.rewrite gives the browser a loadable URL, so images
render, and links open the same editor the explorer already uses.
Wrapping in vscode-agent-host: would fix links but not images, since
FileAccess.uriToBrowserUri only rewrites vscode-remote and file.

Re-anchored for 1.136.0: upstream (#332791) moved the body into a
three-parameter `wrapAgentHostUri(uri, authority, contentRef)`, with
`toAgentHostUri` and `toAgentHostContentUri` as two-argument wrappers.
The fast path is unchanged. The optional third parameter keeps older
bundles matching; when present it is re-emitted so the untouched
`...contentRef?{contentRef:!0}:{}` tail still names a declared variable.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332791](https://github.com/microsoft/vscode/issues/332791)

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only remote-window-authority-map --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
