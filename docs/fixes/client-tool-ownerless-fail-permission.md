# client-tool-ownerless-fail-permission

the SDK still asks permission for a client tool call already failed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2284).
- [Full catalog](../../CATALOG.md#client-tool-ownerless-fail-permission).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Fifth of five. `-session` answers the MCP handler, but the SDK asks
permission through a different channel, and the host drops a permission
ask for a call it has already failed without replying to it, so the ask
itself becomes the new place the turn hangs. Short-circuit the ids
`-session` recorded: allow, so the SDK proceeds and reads the buffered
failure, and do it before `registerAndFire` so nothing is parked and no
pending_confirmation reaches the client for a call that is already dead.

Keyed off the tool call id rather than the permission mode. Gating on
the mode was considered and rejected: the SDK documents `acceptEdits` as
auto-accepting file edit operations only, so a client tool still reaches
`canUseTool` in that mode, and skipping the answer there would restore
the hang. The id test needs no such enumeration and is mode-independent.

Nothing is written to the permission registry, deliberately. Buffering
the approval there instead (the first shape this took) leaks in every

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334037](https://github.com/microsoft/vscode/pull/334037): Let the workbench own confirmation for Claude client tools

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334037](https://github.com/microsoft/vscode/pull/334037): Let the workbench own confirmation for Claude client tools — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334037.md).
- [microsoft/vscode#334044](https://github.com/microsoft/vscode/pull/334044): Fail Claude client tool calls that no connected client provides — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334044.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-ownerless-fail-permission --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`client-tool-no-host-confirm`](client-tool-no-host-confirm.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
