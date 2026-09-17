# activity-row-survives-content

the liveness row disappears the moment a turn produces anything.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3280).
- [Full catalog](../../CATALOG.md#activity-row-survives-content).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The activity row is only emitted while the turn has produced NO response
parts: `!activity || responseParts.length > 0 || sink([...])`. Upstream that
is deliberate ("from then on its own parts tell the story"), and for a chatty
turn it is fine. For this workload it is exactly backwards: a `/code-review`
or a multi-agent mapping turn emits one tool call early, the row vanishes,
and the next several minutes render as a dead panel. Measured 2026-09-06: a
2m33s turn across four subagents showed no liveness at all after its first
step, while 1.7 MB of subagent transcript was written out of sight.

Dropping the response-part term keeps the row up for the whole turn. It stays
tidy rather than noisy because `chatProgressContentPart` hides a progress row
only when NON-progress content follows it, and this row is appended last on
every tick, so nothing ever follows it. The stable id means each update
replaces the previous row instead of stacking, and clearing the activity at
turn end removes it.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334742](https://github.com/microsoft/vscode/pull/334742): Report chat activity from the Claude agent session

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334742](https://github.com/microsoft/vscode/pull/334742): Report chat activity from the Claude agent session — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334742.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only activity-row-survives-content --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`claude-turn-reports-activity`](claude-turn-reports-activity.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
