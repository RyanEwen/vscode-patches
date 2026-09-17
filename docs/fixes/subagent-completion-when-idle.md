# subagent-completion-when-idle

a background subagent that finishes after its turn stays running.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1032).
- [Full catalog](../../CATALOG.md#subagent-completion-when-idle).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The router derives the turn id from the prompt queue head and drops
every SDK message once the queue drains. A background subagent settles
after the turn that spawned it has ended, so its `task_notification`
lands with no turn and is discarded. The chip then spins forever and
the spawn record leaks, which contradicts the registry's own contract:
"Background spawns survive across turns by design (their completion
arrives later via `system.task_notification`)".

The completion path is inlined rather than calling the mapper, so the
patch cannot bind to the wrong function if minified names shift.
`task_started` always arrives mid-turn, so it needs no handling here.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331872](https://github.com/microsoft/vscode/pull/331872): Complete a background subagent that settles after its turn — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331872.md).

Related issue reports:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only subagent-completion-when-idle --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
