# client-tool-ownerless-fail-session

the SDK handler for a failed client tool call still parks forever.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2234).
- [Full catalog](../../CATALOG.md#client-tool-ownerless-fail-session).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Fourth of five, and the one that actually ends the hang. `-map-stop` and
`-subagent` render the call as failed, but the SDK's in-process MCP
handler is a separate round trip: it parks a deferred on the pending
client-tool registry and waits for a completion that, with no window to
run the tool, is never going to arrive. Buffering the failure through
`respondOrBuffer` means the handler's later `register` finds a result
waiting and resolves immediately, whichever order the two arrive in.

The tool call ids are recorded because `-permission` needs them, and the
buffers are swept at `chat/turnComplete`: a permission mode that denies
before execution never runs the MCP handler at all, so an unswept buffer
would sit in the registry until the session was disposed and grow with
every ownerless call. The sweep deletes straight out of `_earlyResults`
rather than through the `discardBufferedResult` accessor upstream adds,
so this entry stays self-contained: a separate accessor entry that
failed to apply would turn this sweep into a TypeError on every turn.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334044](https://github.com/microsoft/vscode/pull/334044): Fail Claude client tool calls that no connected client provides — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334044.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only client-tool-ownerless-fail-session --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`replay-seen`](replay-seen.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
