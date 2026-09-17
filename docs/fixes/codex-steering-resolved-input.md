# codex-steering-resolved-input

steering with attached context stays pending after Codex consumes it.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3451).
- [Full catalog](../../CATALOG.md#codex-steering-resolved-input).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Match the consumed echo against the exact resolved text sent to Codex.
Browser context, selected files and embedded text extend the raw prompt.
Preserve the original PendingMessage for the visible turn, and wait for
the actual userMessage echo rather than treating turn/steer success as ingestion.
Upstream: #335547 fixes #335546. Source: [PR snapshot](../../source-patches/vscode/335547.patch).

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#335547](https://github.com/microsoft/vscode/pull/335547): Fix Codex steering acknowledgement with attached context
- [microsoft/vscode#335546](https://github.com/microsoft/vscode/issues/335546): Agent Host: Codex steering with attached context stays pending after consumption

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#335547](https://github.com/microsoft/vscode/pull/335547): Fix Codex steering acknowledgement with attached context — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-335547.md).

Related issue reports:

- [microsoft/vscode#335546](https://github.com/microsoft/vscode/issues/335546): Agent Host: Codex steering with attached context stays pending after consumption

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only codex-steering-resolved-input --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
