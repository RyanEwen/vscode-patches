# agent-feedback-review-editor

review confirmations cannot load comments in regular editor windows.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3463).
- [Full catalog](../../CATALOG.md#agent-feedback-review-editor).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Backport of #336430, fixing #336428, including cancellation and ARIA review fixes.
Editor-only commands read the owning host's annotations after hydration.
Explicit selection precedes approval; failed loads are not empty results.
Validated on Windows ARM64 1.137.0 build 645f29cc31; this same client
renders Windows and WSL editor windows. No server bundle changes are needed.
Strict structural guards exclude the dedicated Agents-window bundle.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#336430](https://github.com/microsoft/vscode/pull/336430): Fix agent feedback review commands in editor windows
- [microsoft/vscode#336428](https://github.com/microsoft/vscode/issues/336428): Agent host: review confirmation cannot load comments in editor windows

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#336430](https://github.com/microsoft/vscode/pull/336430): Fix agent feedback review commands in editor windows, **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-336430.md).

Related issue reports:

- [microsoft/vscode#336428](https://github.com/microsoft/vscode/issues/336428): Agent host: review confirmation cannot load comments in editor windows

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only agent-feedback-review-editor --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).

## Validated deployment

Installed on Windows ARM64 VS Code 1.137.0 (`645f29cc31`) for both Windows and Ubuntu WSL editor windows. Ten bundle tests passed, including extracted installed code; staged reapply and exact rollback passed. The model-label layer and product checksums remain valid. No server bundle or other host was modified. Reload the affected editor windows to activate. Live UI and screen-reader verification remain outstanding. See [source review and deployment details](../patches/vscode-336430.md). New backport messages are English.
