# codex-async-questions

Codex asynchronous questions display as text without answer controls.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3464).
- [Full catalog](../../CATALOG.md#codex-async-questions).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Upstream: #336512 fixes #336509.
Structured async agent messages need the existing interactive question carousel.
Native work continues; host completion waits until questions are answered or skipped.
Explicit answers use native start-or-steer with the thread's existing settings.
Stop waits for answer RPCs before interrupting their actual continuation turn.
Validated on Windows ARM64 and Ubuntu ARM64 VS Code 1.137.0 build 645f29cc31.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#336512](https://github.com/microsoft/vscode/pull/336512): Render Codex asynchronous questions with interactive answers
- [microsoft/vscode#336509](https://github.com/microsoft/vscode/issues/336509): Codex asynchronous questions render as Markdown without answer controls

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#336512](https://github.com/microsoft/vscode/pull/336512): Render Codex asynchronous questions with interactive answers: **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-336512.md).

Related issue reports:

- [microsoft/vscode#336509](https://github.com/microsoft/vscode/issues/336509): Codex asynchronous questions render as Markdown without answer controls

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only codex-async-questions --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).

## Verified build and installation

See [PR #336512 validation and deployment](../patches/vscode-336512.md) for the original-bundle regression reproduction, Windows/Ubuntu ARM64 1.137.0 restriction, lifecycle tests, exact rollback and activation requirements. No live UI result is claimed.
