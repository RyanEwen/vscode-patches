# steering-list-reduce-set

a second steering message evicts the first from the sidebar.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3162).
- [Full catalog](../../CATALOG.md#steering-list-reduce-set).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`ChatState` stores steering as one slot (`steeringMessage`) next to a
`queuedMessages` list, and the reducer overwrites it with no id check,
three lines above a queued branch that correctly finds by id and appends.
A second steer therefore evicts the first from state, its bubble vanishes,
and it reappears later when the model consumes it. Nothing is lost: the
agent was handed the first before the second arrived.

Upstream fix is microsoft/vscode#334743, which renames the field to a list
across host, providers and workbench. That is too many sites to mirror in
minified code, so this keeps a parallel `steeringMessages` array ALONGSIDE
the singular field. Every existing consumer still reads the newest message
and behaves exactly as before; only the rendering path reads the array.

Client only, deliberately. The host's own state is left alone, so a full
state resync from the host simply drops the array and the projection falls
back to the singular field, which is today's behaviour. That degrades to

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334743](https://github.com/microsoft/vscode/pull/334743): Keep every pending steering message instead of only the last

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334743](https://github.com/microsoft/vscode/pull/334743): Keep every pending steering message instead of only the last — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334743.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only steering-list-reduce-set --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
