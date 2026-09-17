# chat-turnstarted-idempotent

a replayed turn start keeps rebuilding the turn empty, so the response never streams.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1858).
- [Full catalog](../../CATALOG.md#chat-turnstarted-idempotent).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Root cause of the same defect `optimistic-turn-start-masks-streaming`
works around from the other end, and both are wanted.

The chat subscription keeps an optimistic overlay: every action the
client dispatches is applied locally, held in `_pendingActions`, and
replayed on top of confirmed state each time a confirmed action
arrives. A pending entry is retired only when the backend echoes it
with the client's own clientSeq, and the agent host does not echo the
clientSeq for `chat/turnStarted`, so that start stays pending for the
whole turn.

The reducer case then rebuilt `activeTurn` unconditionally, with an
empty `responseParts`, on every replay. Once the start was confirmed by
some other path each recompute wiped the streamed content again, so
`activeTurn.responseParts` read as empty for the entire turn no matter
how many deltas had been applied, and the whole response landed in one

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332087](https://github.com/microsoft/vscode/issues/332087): Agent host: responses render only at turn end because the optimistic turn start is never retired

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/agent-host-protocol#433](https://github.com/microsoft/agent-host-protocol/pull/433): chat: make the turnStarted reducer case idempotent — **OPEN** at the recorded snapshot. [Source/details](../patches/agent-host-protocol-433.md).
- [microsoft/vscode#334011](https://github.com/microsoft/vscode/pull/334011): Make the chat/turnStarted reducer idempotent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334011.md).

Related issue reports:

- [microsoft/vscode#332087](https://github.com/microsoft/vscode/issues/332087): Agent host: responses render only at turn end because the optimistic turn start is never retired

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only chat-turnstarted-idempotent --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`optimistic-turn-start-masks-streaming`](optimistic-turn-start-masks-streaming.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
