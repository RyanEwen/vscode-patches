# chat-input-default-permission-mode

every new chat-input session starts on Default approvals.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3308).
- [Full catalog](../../CATALOG.md#chat-input-default-permission-mode).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`AgentHostUntitledProvisionalSessionService._getInitialConfig` seeds a new
session from `chat.defaultConfiguration`, which writes only the `autoApprove`
and `mode` axes. Claude's Approvals chip reads `permissionMode`, which that
setting never writes, so every new chat in the panel opens on Default no
matter how many times the user changes it. The Agents window does not have
this problem because it replays the user's last picks from profile storage.

Upstream fix is microsoft/vscode#334814, which shares that store with this
path. It cannot be mirrored here: the remembered-picks key does not appear in
`workbench.desktop.main.js` at all (the Agents window is a separate bundle),
and reading profile storage needs an `IStorageService` this class does not
have, which minified DI cannot be extended with safely.

So this reads a plain configuration value instead. `getValue` returns whatever
is in settings.json even for a key VS Code never registered, so no schema
contribution is needed. The result is a configured default rather than a

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334814](https://github.com/microsoft/vscode/pull/334814): Seed new chat-input sessions from the remembered session-config picks
- [microsoft/vscode#334087](https://github.com/microsoft/vscode/pull/334087): Add a setting for the permission mode new Claude sessions start in

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334814](https://github.com/microsoft/vscode/pull/334814): Seed new chat-input sessions from the remembered session-config picks — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334814.md).
- [microsoft/vscode#334087](https://github.com/microsoft/vscode/pull/334087): Add a setting for the permission mode new Claude sessions start in — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334087.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only chat-input-default-permission-mode --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
