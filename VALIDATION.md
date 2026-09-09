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
