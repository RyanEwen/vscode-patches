# resume-missing-conversation-starts-fresh

cancelling a skill-subagent turn bricks a new chat permanently.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1227).
- [Full catalog](../../CATALOG.md#resume-missing-conversation-starts-fresh).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A skill that runs in a subagent consumes the whole turn without the parent
model ever running, so the CLI writes no user or assistant message and never
persists the conversation. Cancel before it finishes and the transcript is
left holding only a file snapshot and a couple of queue records. Every later
prompt then resumes an id the CLI does not know, fails with `No conversation
found with session ID`, and the chat is dead for good.

Observed 2026-09-04: chat 7a65fd1f was bound to session 11d51889, whose
transcript was 551 bytes with zero user or assistant entries. A session that
already has history is unaffected, so this only bites a brand new chat.

Resumes only when the transcript on disk actually holds a conversation, and
otherwise starts a fresh one under the same id, which leaves the host's
existing binding intact. Any doubt at all (no `__ahReq`, an unreadable
directory, no transcript found) keeps the stock resume, so this can only act
where a conversation is positively known to be absent. That matters because

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only resume-missing-conversation-starts-fresh --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
