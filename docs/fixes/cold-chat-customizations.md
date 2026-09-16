# cold-chat-customizations

a restored session has no slash commands until its next message.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1722).
- [Full catalog](../../CATALOG.md#cold-chat-customizations).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`getChatCustomizations` resolves the chat through its LIVE runtime, so
a chat that has a backing but no resident runtime reports no
customizations at all: no project commands, no skills, no agents, no
rules, not even the read-only built-ins. That is every session
restored into a fresh host process, and every session idle eviction
released. Typing `/` then offers only the host's own commands
(`/rename`), and sending any message puts them all back.

The provider already supports the cold read. The provisional session
`_createProvisionalChatSession` builds recovers its working
directories from the SDK transcript cwd or the persisted overlay and
starts no SDK Query, and `getSessionCustomizations` documents the
pre-materialize path as showing the full disk set. This entry point
is simply the one that never reaches it.

The runtime is torn down again before returning. Leaving it resident

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332047](https://github.com/microsoft/vscode/issues/332047): Agent host: restored Claude sessions lose their slash commands, skills and agents until the next message

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#332055](https://github.com/microsoft/vscode/pull/332055): agentHost: resolve Claude customizations for a chat that is not resident — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-332055.md).

Related issue reports:

- [microsoft/vscode#332047](https://github.com/microsoft/vscode/issues/332047): Agent host: restored Claude sessions lose their slash commands, skills and agents until the next message

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only cold-chat-customizations --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
