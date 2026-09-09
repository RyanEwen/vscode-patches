# Model host labels workaround

Targets Windows VS Code **1.136.1**, build **a44adf7f53**. Gives model groups distinct local/remote agent labels and separates visibility controls. [Upstream PR #335363](https://github.com/microsoft/vscode/pull/335363).

From this folder, using Node 24:

```powershell
node patch.cjs --check
node patch.cjs --apply
# Undo when needed:
node patch.cjs --undo
```

Run **Developer: Reload Window** after apply or undo. The installer saves exact backups under this folder and updates the two changed bundle checksums in product.json. Keep the installer folder and its backup together. It refuses changed files or another build. An update may replace the patch.

`test-bundles.cjs` tests original and patched management methods. The upstream source suite passed 47 tests. A live UI reload was not performed during packaging.
