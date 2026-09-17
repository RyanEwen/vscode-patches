# peer-chat-unavailable-subagent

one unresolvable subagent chat rejects every turn the session will ever start.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2780).
- [Full catalog](../../CATALOG.md#peer-chat-unavailable-subagent).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A chat that can never resolve makes `_resolvePeerChatsForTurnValidation`
throw, and that rejection escapes to the dispatch queue, which rejects the
client action. Since the offending chat is rebuilt from the transcript on
every restore, EVERY `chat/turnStarted` is rejected from then on and the
session can never be used again. Observed with the rejection carrying the
user's own message text and reason `Subagent transcript is not available
yet`, on a session that had been stopped, closed and reopened.

This is upstream commit 7949faffc31 (microsoft/vscode#334312), which landed
on 2026-09-03, one day after this build was cut, so it is a backport rather
than a new fix. Chats whose transcript is unavailable are collected and
skipped instead of aborting validation for the whole session.

It masks a symptom: the phantom chat is still registered and still fails to
subscribe. `denied-subagent-no-phantom-chat` addresses why it exists.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334312](https://github.com/microsoft/vscode/issues/334312)

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only peer-chat-unavailable-subagent --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`denied-subagent-no-phantom-chat`](denied-subagent-no-phantom-chat.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
