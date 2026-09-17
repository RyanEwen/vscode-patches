# truncation-retire-stranded

a stranded optimistic truncation is replayed forever and blanks the transcript.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1906).
- [Full catalog](../../CATALOG.md#truncation-retire-stranded).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Same optimistic-overlay mechanism as `chat-turnstarted-idempotent`, but
the action here is not idempotent by nature, so making the reducer
tolerant is not the fix: the pending entry has to be retired.

A client-dispatched `chat/truncated` is applied optimistically and stays
in `_pendingActions` until the host echoes its clientSeq. The agent host
applies it without echoing, so the pending truncation is replayed over
confirmed state on every later envelope, clearing `activeTurn` and, when
it carries no turnId, every turn with it. The workbench dispatches the
truncation immediately before `chat/turnStarted`, so this blanks the
transcript of the turn that follows, for as long as the entry lives.

Retire it once the host has evidently applied it, folding it into
confirmed state on the way out. Two observations count as evidence:
  - a confirmed `chat/truncated` for the same turnId that carries NO
    origin. Our own echo is already dropped by clientSeq, and a foreign

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334040](https://github.com/microsoft/vscode/pull/334040): Retire a stranded optimistic chat truncation once the host has applied it — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334040.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only truncation-retire-stranded --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`optimistic-turn-start-masks-streaming`](optimistic-turn-start-masks-streaming.md), [`chat-turnstarted-idempotent`](chat-turnstarted-idempotent.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
