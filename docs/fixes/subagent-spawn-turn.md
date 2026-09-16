# subagent-spawn-turn

a spawned subagent does not record the turn that spawned it.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1767).
- [Full catalog](../../CATALOG.md#subagent-spawn-turn).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Pairs with subagent-resumed-output: that fix needs to know which turn
a still-running subagent belongs to, and the spawn record does not
carry it. Stamped first-writer-wins, matching the record's other
fields. Upstream as microsoft/vscode#332075.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#332075](https://github.com/microsoft/vscode/pull/332075): agentHost: keep the parent output after a background subagent settles

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#332075](https://github.com/microsoft/vscode/pull/332075): agentHost: keep the parent output after a background subagent settles — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-332075.md).

Related issue reports:

- [microsoft/vscode#332073](https://github.com/microsoft/vscode/issues/332073): Agent host: a Claude session shows nothing more once the parent resumes after a background subagent

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only subagent-spawn-turn --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`subagent-resumed-output`](subagent-resumed-output.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
