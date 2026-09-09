# Patch maintenance

This is the public home for the VS Code and agent-host-protocol patch collection.

- Keep the patcher, source patch snapshots, CATALOG.md, SOURCE-PATCHES.md and catalog.json aligned when changing a workaround.
- Include the public per-PR documentation link in relevant issues and PR descriptions when publishing a fix. Prefer updating an existing link section over duplicate comments.
- Record build restrictions and actual validation; do not imply that all patches apply to every build.
- Never commit installed bundles, credentials, session transcripts, runtime backups, private diagnostics, or local worktree audit data.
- Keep retired patcher revisions in archive; preserve rollback support for maintained installers.
- Source worktrees belong under the local VS Code worktree directory with PR-number names. Preserve dirty worktrees and local-only commits.
