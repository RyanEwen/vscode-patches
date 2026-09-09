# VS Code patch collection

Public source patches, installed-bundle patchers, and regression scripts for RyanEwen's VS Code and agent-host-protocol work.

- **[Individual patch docs](docs/fixes/README.md)** · **[Epics, issues and PR relationships](docs/UPSTREAM.md)** · **[Maintenance workflow](MAINTAINING.md)**.
- **[Patcher catalog](CATALOG.md):** 102 current bundle-patcher entries, plus the model-host-label installer.
- **[Source patch index](SOURCE-PATCHES.md):** snapshots and upstream links for 61 PRs, including closed and merged proposals.
- **[Model host labels](model-host-labels/README.md):** Windows VS Code 1.136.1 workaround for duplicate-looking model groups.
- **[Historical revisions](archive/README.md):** 14 patcher snapshots.
- **[Standalone legacy patchers](legacy/README.md)** and **[live-bundle regression scripts](tests/live/README.md)**.

The tracking epic is [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174). Each source patch has a detail page suitable for linking from an issue or PR.

## Using the combined patcher

Use Node.js 24. Start by listing fixes and inspecting a specific bundle:

```sh
node patch-vscode-fixes.mjs --list
node patch-vscode-fixes.mjs --status --target "/path/to/bundle.js"
```

Apply the applicable fix set, or select IDs from the catalog:

```sh
node patch-vscode-fixes.mjs --apply --target "/path/to/bundle.js"
node patch-vscode-fixes.mjs --apply --only session-delete,replay-drive --target "/path/to/agentHostMain.js"
```

Without `--target`, the patcher discovers Windows/WSL/Linux installations and, when Docker is available, the `vscode` server volume. `--only` selects IDs; some fixes form coupled groups, documented alongside their entries. `site not found` means that an entry did not match the build; it does not establish that the bug is fixed upstream. The combined installer refuses ambiguous match sites and refuses to write a bundle that fails JavaScript syntax validation.

Revert a bundle using its saved `.vscodefix-orig` copy:

```sh
node patch-vscode-fixes.mjs --revert --target "/path/to/bundle.js"
```

Revert restores the entire saved bundle, not an individual fix. A saved copy may contain earlier local patches. Keep backups, and do not mix revert systems without recording their order. Fully restart the processes that load changed bundles; agent-host changes can require a server/container restart. Updates replace modified bundles. The combined patcher can trigger VS Code's modified-installation checksum notice. The separate model-host-label installer instead updates the corresponding integrity checksums and has its own guarded rollback.

## Verification

`node scripts/check-package.cjs` checks JavaScript syntax, catalog coverage, source patch files, and known secret formats without applying anything or connecting to Docker.

For a configured deployment:

```sh
node verify-vscode-patches.mjs --container YOUR_CONTAINER --workbench /path/to/workbench.desktop.main.js
```

This deployment verifier checks markers, syntax and selected behavioural fixtures; it is not a guarantee of compatibility for all 102 fixes. Additional tests and their required inputs are documented in [tests/live](tests/live/README.md). See [VALIDATION.md](VALIDATION.md) for what was run during publication.

## Scope and maintenance

This is a public snapshot of the maintained scripts and source proposals found on 2026-09-09. Source snapshots record each PR head and status at that date; follow the upstream PR for later changes. Archived snapshots can contain retired experiments. Do not apply all source patches as a single series.

Installed application bundles, credentials, runtime/session data, runtime backups, and private workspace audits are excluded. Local work-in-progress remains local until reviewed for publication. Portable copies take explicit deployment inputs; existing deployed script paths have been preserved locally.

When adding a fix, update its catalog/source details and include the public detail-page link in the associated issue or PR. [AGENTS.md](AGENTS.md) records this maintenance convention.
