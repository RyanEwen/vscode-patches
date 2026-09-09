# denied-subagent-no-phantom-chat

a denied Agent call is still recorded as a subagent, creating a chat that can never exist.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2809).
- [Full catalog](../../CATALOG.md#denied-subagent-no-phantom-chat).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Subagent-ness is taken from the tool NAME, not the outcome, so a denied
`Agent` call still gets a subagent marker attached to its result. On restore
that marker registers a subagent chat whose transcript will never exist,
because the subagent never ran.

Seen live when auto mode could not classify the call and denied it with
`toolDenialKind: automode-unavailable`. The SDK transcript for that session
has 47 lines and zero sidechain entries, confirming nothing was spawned.

The fix is one token: the result already computes `is_error` immediately
before the push and simply does not consult it. Still unfixed upstream as of
origin/main, so this is not a backport.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334549](https://github.com/microsoft/vscode/pull/334549): Do not mark a denied subagent tool call as a subagent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334549.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only denied-subagent-no-phantom-chat --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
