# claude-turn-reports-activity

the Claude provider never reports chat activity, so a silent turn looks dead.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1385).
- [Full catalog](../../CATALOG.md#claude-turn-reports-activity).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

AHP already has a progress channel and the workbench already renders it well.
`chat/activityChanged` carries a human-readable string, and the client turns it
into a shimmering row with a stable id, so each update REPLACES the previous one
and the row hides itself the moment real content follows.

The gap is in the middle: the only producer of that action anywhere in the host
is worktree creation, which is why "Creating isolated worktree (42%)" is the only
activity anyone ever sees. The Claude pipeline never emits it, so every turn that
is quiet for a while (a skill subagent, MCP startup, a long tool call) renders
nothing at all and reads as a hung session.

This supersedes three earlier local hacks, all of which were rebuilding this
facility badly: polling subagent transcripts on disk to infer liveness, injecting
fake markdown response parts as a status line, and two reducer patches trying to
make those parts update in place.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334742](https://github.com/microsoft/vscode/pull/334742): Report chat activity from the Claude agent session — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334742.md).

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only claude-turn-reports-activity --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
