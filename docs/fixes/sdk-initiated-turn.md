# sdk-initiated-turn

the SDK starts a turn the host never queued, so everything in it is discarded.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1057).
- [Full catalog](../../CATALOG.md#sdk-initiated-turn).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`turnId` is derived from the host's own outbound prompt queue, but the SDK
can begin a turn the host never queued: when background subagents finish it
injects a `task-notification` prompt and answers it. With the queue drained,
`peekParent()` returns undefined and the router drops every message of that
turn, silently and at no log level.

Measured: after one such turn opened, three assistant text blocks, five
Bash calls, a Read and an AskUserQuestion were discarded over six minutes.
The AskUserQuestion was auto-denied without ever being shown, because
`hasActiveTurn` is `!queue.isEmpty` and the queue was empty.

Three gates read three different sources, so supplying a turn id alone is
not enough: the router reads the queue, `AgentSideEffects` re-derives from
the state manager, and `requestUserInput` reads the queue again. This opens
a real turn: an entry goes into the already-yielded list, so `peekParent`
and `hasActiveTurn` both see it and the next `result` settles it through

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

Related issue reports:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only sdk-initiated-turn --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
