# session-chip-list-scope

the session list re-derives the chip from the branch for inactive sessions.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L450).
- [Full catalog](../../CATALOG.md#session-chip-list-scope).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`session-chip-scope` fixes only the WRITE path, which runs on turn
completion. The list has its own READ path: `computeListEntryChanges`
returns the persisted summary first, and failing that derives one from
the BRANCH changeset and persists it. Two consequences, both observed
here: a session that has not completed a turn since the patch keeps its
branch-derived number forever, and a session that never ran a turn at
all still gets one written for it (sessions with zero turns and zero
file edits showing +16070 -634, i.e. the entire `dev` vs `origin/main`
divergence).

Source the read path from the session changeset as well, and stop
deriving from the branch at all: with no session-scoped evidence the
honest answer is no chip, not the branch's number. The persisted
summary is kept as the last resort rather than the first, because in a
multi-folder session it holds the all-folder aggregate that must never
be clobbered by a primary-only re-derivation (the worked example in

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331345](https://github.com/microsoft/vscode/pull/331345): Count the session's changes, not the branch's divergence — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331345.md).

Related issue reports:

- [microsoft/vscode#330941](https://github.com/microsoft/vscode/issues/330941): Session list change counts show the whole branch divergence, not the session's changes

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only session-chip-list-scope --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
