# stale-peer-chat-backing-ignored

a session that once had a peer chat is hidden from the list forever.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3414).
- [Full catalog](../../CATALOG.md#stale-peer-chat-backing-ignored).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Opening a peer chat for a session writes `peerChatBacking` into that session's
own database. Discovery then suppresses the session, on the reasonable basis
that its chat represents it. The marker is durable and nothing ever clears it,
so the session stays suppressed long after the chat is gone, and is never
titled either, because `_scheduleExternalSessionTitles` only sees sessions that
reach registration.

Measured 2026-09-07: 553 of 1262 session databases carried the marker, every
one a pure shell with a single row and zero turns. Discovery reported 83
suppressed, and instrumenting the branch showed 83 of 83 were `isChatBacking`
and none were subagents. Three fresh markers appeared within minutes of
clearing them by hand, so it accumulates continuously.

`_readSessionRegistrationFacts` has two sources for this fact. The in-memory
`_unpersistedChatBackings` set is checked first and is the live one: it holds
the chats that actually exist right now, and it is left alone, so a session

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only stale-peer-chat-backing-ignored --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
