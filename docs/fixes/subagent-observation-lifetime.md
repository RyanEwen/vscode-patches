# subagent-observation-lifetime

a subagent turn hangs forever when its chat outlives the turn that spawned it.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2429).
- [Full catalog](../../CATALOG.md#subagent-observation-lifetime).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The client starts observing a subagent's chat as soon as it sees the
spawning tool call, but the observation is owned by the disposable
store of the PARENT TURN. `onTurnEnded` disposes that store, which
releases the child chat subscription while the client's `subscribe`
is still in flight; the server's post-await liveness check fails it
and the protocol handler reports `Resource not found`. Nothing
re-subscribes, so the subagent's chat is never observed again.

That is the normal ordering for a background subagent, whose chat is
created after its parent turn completes (measured at ~2s later on a
real one). Client tool execution is gated on a claimant that only the
chat observer sets (`_markToolCallRendered`), so the subagent's tool
is never executed and its turn never closes: the visible symptom is a
subagent turn that heartbeats forever. Mirrors microsoft/vscode#333931.

The fix moves subagent observations off the parent turn's store. At

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#333931](https://github.com/microsoft/vscode/issues/333931): Agent host: a subagent's tool call is never executed and its turn is never closed, so the chat spins forever

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334072](https://github.com/microsoft/vscode/pull/334072): Keep observing a subagent whose chat outlives its spawning turn — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334072.md).

Related issue reports:

- [microsoft/vscode#333931](https://github.com/microsoft/vscode/issues/333931): Agent host: a subagent's tool call is never executed and its turn is never closed, so the chat spins forever
- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only subagent-observation-lifetime --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
