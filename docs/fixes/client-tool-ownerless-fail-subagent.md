# client-tool-ownerless-fail-subagent

a subagent client tool call no window can run is never failed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2199).
- [Full catalog](../../CATALOG.md#client-tool-ownerless-fail-subagent).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Third of five. The same defect on the other producer: inner tool uses
arrive pre-parsed on a synthesized `assistant` message rather than as
streamed content blocks, so they never pass through
`content_block_start` / `content_block_stop` and `-map-start` /
`-map-stop` cannot see them. This site owns the whole start/ready pair
for an inner call, and the owner is already resolved here, so the
completion is emitted inline rather than through the active-block record.

Nothing tags the parent here on purpose: the caller runs every signal
this function returns through `tagWithParent`, so the completion picks
up the same `parentToolCallId` as the start and ready beside it. Tagging
it here as well would set the field twice with the same value and hide
that the routing is the caller's job.

Anchored across BOTH pushes rather than the ready alone, because the
clientId this branches on is only named in the start push

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334044](https://github.com/microsoft/vscode/pull/334044): Fail Claude client tool calls that no connected client provides — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334044.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-ownerless-fail-subagent --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
