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
