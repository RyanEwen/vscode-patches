# nested-subagent-spawn-recorded

a subagent spawned by another subagent never gets a chat, so its work never renders.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2139).
- [Full catalog](../../CATALOG.md#nested-subagent-spawn-recorded).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

A spawning tool call is recorded in the spawn registry only when it is
top level. When one subagent spawns another the call is merely noted as
an inner tool, so `getSpawn` misses it, no `subagent_started` is emitted,
the host never creates the subagent chat, and the client's subscribe to
that chat fails with `Resource not found`. The nested subagent runs to
completion with nothing it produces ever reaching the UI.

Measured in one session: 11 spawns at depth 1 all started a turn and
rendered; all 4 at depth 2 failed their subscribe and started no turn.
The correlation with `spawnDepth` in the on-disk subagent metadata was
exact, and the host log carries only two lines for each depth-2 call, a
forwarded client tool completion and the failed subscribe.

The inner-tool edge is still recorded, because `oI` reads it back through
`getParentSpawn` to fill `parentToolCallId` on the emitted signal, which
is what nests the chat under its parent rather than the session root.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only nested-subagent-spawn-recorded --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
