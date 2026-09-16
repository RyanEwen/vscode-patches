# turn-prune-anchor-missing-is-loud

restoring a checkpoint at a turn with no database row silently prunes nothing.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1482).
- [Full catalog](../../CATALOG.md#turn-prune-anchor-missing-is-loud).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`truncateFromTurn` and `deleteTurnsAfter` both bound the delete with
`rowid >= (SELECT rowid FROM turns WHERE id = ?)`. When the subquery matches
nothing it yields NULL, and `rowid >= NULL` is NULL, so **zero rows are
deleted and no error is raised**. The callers pass a rendered turn id, and a
rendered turn does not always have a row: `turns` is populated by live turns
and the checkpoint service, while the rendered list comes from the CLI
transcript.

Measured 2026-09-04 across 21 chat databases on this machine: 13 of them have
at least one rendered turn with no `turns` row. Worst cases were 195 rendered
against 180 rows (17 missing), 133 against 125, and one small session with 4
rendered against 2 rows. So restoring a checkpoint at one of those turns
leaves `file_edits`, `turn_usage`, `turn_delegation` and `checkpoint_ref` for
every later turn behind, and the next turn's diff is taken against a tree the
user discarded.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only turn-prune-anchor-missing-is-loud --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
