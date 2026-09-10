# subagent-inactive-resume

a running subagent produces output that is discarded once its chat has no active turn.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1116).
- [Full catalog](../../CATALOG.md#subagent-inactive-resume).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`AgentSideEffects` resolves a signal's subagent chat, then gates on that
chat's active turn. With no turn it logs `Dropping <signal> for inactive
subagent` and returns, so the signal is neither dispatched nor buffered:
the subagent keeps working and nothing it produces reaches the client.

Measured in one session: the parent turn ended, and from that point 92
signals were dropped across model_call_completed, chat/responsePart and
the three toolCall actions, while the subagent went on running for a
further four minutes. 8 subagent turns started, 0 subagent_completed.
It cannot self-heal, because `subagent_completed` is dropped by the same
gate, so the chip never resolves either.

Buffering into `_pendingSubagentSignals` would not work here: that buffer
is drained only from `subagent_started`, which has long since fired. The
host's own `_resumeSubagentSession` is the right lever. It is synchronous,
and returns early when a turn already exists, so the first late signal

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

Related issue reports:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only subagent-inactive-resume --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
