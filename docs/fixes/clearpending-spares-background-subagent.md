# clearpending-spares-background-subagent

a background subagent loses its tool attribution at every parent turn end.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2712).
- [Full catalog](../../CATALOG.md#clearpending-spares-background-subagent).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`clearPending` drops all cross-message tool attribution on every `result`
envelope. A background subagent outlives the turn that spawned it, so its
inner tool call is still in flight and its result is still coming, but its
entry is wiped with the genuinely orphaned ones. The late result then
renders with the generic past-tense message instead of the real command,
and live diverges from replay.

`drainForegroundSpawns`, called on the same envelope one statement later,
already spares background spawns by design. Rather than reach into the
registry class, this lifts the background entries out around the wipe and
puts them back, which is a single site and leaves the class untouched.
Mirrors microsoft/vscode#334559.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334559](https://github.com/microsoft/vscode/pull/334559): Spare a background subagent's in-flight tool call from the turn-end wipe

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334559](https://github.com/microsoft/vscode/pull/334559): Spare a background subagent's in-flight tool call from the turn-end wipe — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334559.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only clearpending-spares-background-subagent --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
