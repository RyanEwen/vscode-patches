# replay-seen

session records which tool calls actually streamed, and under which turn.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L266).
- [Full catalog](../../CATALOG.md#replay-seen).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Records `toolCallId -> turnId` rather than a bare set of ids. The turn id
is needed by `replay-drive`'s resync, and taking it from the signal makes
it authoritative: the session-level `__vsTurnId` is stashed only in
`send()`, so a turn synthesized elsewhere -- a promoted steering turn --
leaves it pointing at the preempted turn. Observed: every client tool
call readied inside a steering turn was stranded, because the resync
asked for a request under the wrong turn and silently matched nothing.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#330746](https://github.com/microsoft/vscode/pull/330746): Execute a client tool the SDK replays from the transcript — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-330746.md).

Related issue reports:

- [microsoft/vscode#331595](https://github.com/microsoft/vscode/issues/331595): Agent host: a replayed client tool from a subagent is handled on the parent chat after a restart
- [microsoft/vscode#331289](https://github.com/microsoft/vscode/issues/331289): Agent host: after a client reconnects, new client tool calls are still attributed to the disconnected client and fail immediately

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only replay-seen --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`replay-drive`](replay-drive.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
