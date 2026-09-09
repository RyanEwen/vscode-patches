# Maintaining the patch collection

## Where things belong

- `patch-vscode-fixes.mjs`: canonical combined installed-bundle patcher.
- `model-host-labels/`: the build-specific model-label installer and rollback.
- `catalog.json`: patch IDs, source references, and separately identified topic mappings.
- `upstream.json`: tracking epics, issue metadata and explicit PR relationships.
- `docs/fixes/`: generated documentation for every patcher entry.
- `docs/patches/` and `source-patches/`: one detail page and source snapshot per PR.
- `archive/`: historical patcher code, retained as history rather than recommended installers.
- `.local/`: ignored private deployment backups and audit files, if present. Never publish it.

The tracking epic and relationships are in [docs/UPSTREAM.md](docs/UPSTREAM.md). Distinguish an exact implementation reference from a related proposal; do not silently promote a topic match into a claim that a patch implements the full PR.

## Adding or changing a fix

1. Add or update the uniquely named entry in the patcher. Document its structural match, target, coupled entries, rollback implications and verified issue/PR references beside the code.
2. Update `catalog.json` metadata and `upstream.json` relationships. Mark missing upstream references as local-only instead of inventing a mapping.
3. Regenerate individual pages with `node scripts/generate-docs.cjs`. Update `CATALOG.md` and the corresponding PR detail page if its installer mapping changed.
4. Refresh the PR source snapshot from GitHub and record its head commit and status. Retain superseded proposals as history; never present all source patches as one applyable series.
5. Run `node scripts/check-package.cjs`, the relevant behavioural tests, and an installed-bundle status check on the intended build. Record what actually ran in `VALIDATION.md`, including any missing live UI checks.
6. Publish the repository update, then add or update the `public-patch-collection` section in the associated issue/PR description. Link the per-PR page and the relevant per-fix page; avoid duplicate comments.

## After a VS Code update

Check patch status against the actual bundles in use. A missing structural match may mean that code changed, a patch is obsolete, or the bundle is wrong. It is not proof of an upstream fix. Verify before retiring an entry. Keep a rollback copy of each modified bundle outside Git, and avoid mixing revert mechanisms without recording which snapshot each one restores.

## Local workspace organization

The local VS Code workspace hub has `source`, `patches`, `active`, `archive`, and private `local` areas. Worktrees are named `pr-NUMBER-branch-description`; merged checkouts and redundant clean copies belong in the archive area. Keep uncommitted work explicit (`-wip`) and preserve staged changes, untracked files, ignored build files and local-only commits.

Before moving a worktree, inspect Git status and running processes, use `git worktree move`, and verify HEAD and status afterward. Keep compatibility links when saved tasks or tools still refer to old paths. Do not delete a worktree merely because its PR merged: first account for local files and dependencies.

## Publication boundary

Publish source, patcher scripts, synthetic fixtures, documentation and upstream links. Do not publish installed bundles, authentication data, transcripts, runtime backups, private diagnostics, or unreviewed local work-in-progress. The local workspace has a move ledger and private snapshots for recovery.
