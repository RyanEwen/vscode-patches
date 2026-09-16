# Publication validation — 2026-09-09

- 29 maintained JavaScript files and historical snapshots passed Node syntax checks.
- The legacy shell patcher passed `bash -n`.
- All 102 exported patcher IDs match the generated catalog; no duplicate IDs.
- All 61 upstream PR source snapshots and per-PR detail pages are present.
- Known GitHub/OpenAI/Anthropic credential formats and private-key headers were checked across the package; none found.
- Combined patcher `--list` runs on Windows without touching installed bundles or Docker. The direct-invocation guard now uses `fileURLToPath` for Windows paths.
- Model-host-label source suite: 47 passing from the earlier fix. Its actual installed bundle methods were tested, including visibility isolation. Installed undo/reapply and final hashes were verified.
- Older deployment-specific behavioural tests are preserved with documented inputs. They were syntax-checked during publication, not rerun against all historical builds.

This validates the package and the stated model-label fix; it is not a claim that every historical workaround is compatible with the current build.

Documentation follow-up:

- All 102 patcher entries have individual maintenance pages.
- Local Markdown links were checked for valid destinations.
- Synthetic empty/healthy/missing conversation fixtures passed without reading real session transcripts.
- Public repository links were written and verified on 61 PR descriptions and 21 issue bodies.
- The model-label installer and bundle regression checks passed again after consolidating its local path and backups.

PR #335363 review follow-up:

- Source revision `4f5b23ed9924f76e95f6eb772e5a5f3736456efc`: Node 24.18.0 transpilation succeeded and the focused `chatModelsViewModel` suite passed all 49 tests.
- Both original Windows VS Code 1.136.1 build a44adf7f53 bundles reproduce the missing status-only host label. Revised transformations pass status-only and status-with-model identity, ordinary provider, immutability, and existing visibility checks. Source tests also verify collapse isolation.
- Both transformed bundles passed syntax validation. Package checks cover the refreshed source snapshot and archived installer revision.
- The earlier installer is retained in `archive/patcher-snapshots/model-host-labels-before-status-identity.cjs`. Existing installations require undo/apply as documented. No live installed bundle was changed or reloaded in this follow-up.

## Codex steering input (2026-09-10)

- Five production source tests passed; the independent source snapshot passed reverse-apply validation against its source worktree.
- Seven extracted-bundle cases passed on Windows ARM64, Linux ARM64 and Linux x64 VS Code 1.137.0 build `645f29cc31`.
- The backport is installed on Windows Stable, both WSL Stable layouts and a Linux x64 SSH server with verified hashes and exact backups. Installed Windows and WSL bundles passed all seven extracted tests. The SSH write preserved ownership and passed syntax and marker checks.
- No application restart, full source build or live UI verification of this fix has been performed. This addition does not claim that the older catalog entries apply to 1.137.0.

## Editor-window review confirmation source patch, 2026-09-16

[PR #336430](docs/patches/vscode-336430.md): 15 focused Chromium tests passed; targeted diagnostics for all five changed TypeScript files were zero; targeted ESLint and Git whitespace checks passed. The GitHub source snapshot passed reverse-apply validation against the fixed worktree. Pre-submission review covered lazy host startup, layer separation, hydration and disposal, explicit selection, stale IDs, and interrupted reveals.

The tests used freshly transpiled changed modules with existing compiled dependencies. Full transpilation was unavailable because the existing dependency installation lacked esbuild. The broader layer check was interrupted after WSL became unresponsive. No full build, installed-bundle deployment or live WSL UI verification is claimed. The combined installer is unchanged.

### PR #336430 automated review follow-up

Head `cc59706b4b6349329f7af86d159e654eb1864093` addresses cancellation-listener retention and asynchronous screen-reader error announcements. Sixteen focused Chromium tests passed, targeted TypeScript diagnostics were zero, and lint plus whitespace checks passed. The refreshed source snapshot passed reverse-apply validation. No installed-bundle, live screen-reader or WSL UI validation is claimed.

## Review confirmation installed-bundle deployment, 2026-09-16

The `agent-feedback-review-editor` entry backports [PR #336430](docs/patches/vscode-336430.md), including both automated review fixes. Ten bundle tests passed against the candidate and installed Windows ARM64 1.137.0 workbench (`645f29cc31`). Staged apply/reapply, exact rollback, existing model-label preservation and checksum/manifest verification passed. The workbench hash is `750a7570d6ec2b269d2308e5efc2fa9d0a326f998d6359b44ce2981d60bbb5a3`. Exact installation and model-label rollback backups were retained privately.

The shared Windows editor client also handles Ubuntu WSL windows, so no WSL server file changed. The dedicated Agents window and all other hosts were untouched. No window reload, full restart, live UI or live screen-reader verification was performed. New backport messages are English.
