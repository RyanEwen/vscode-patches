# toolcall-progress-reduce

the client has nowhere to record tool call progress.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L806).
- [Full catalog](../../CATALOG.md#toolcall-progress-reduce).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Pairs with `toolcall-progress-emit`. The chat reducer has no case for
the action, so it would land nowhere, the state would never change, and
the render path would never be triggered. Mirrors the upstream reducer:
running only, replacing any previous report wholesale.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/agent-host-protocol#405](https://github.com/microsoft/agent-host-protocol/pull/405): chat: report progress for a running tool call — **OPEN** at the recorded snapshot. [Source/details](../patches/agent-host-protocol-405.md).
- [microsoft/vscode#334131](https://github.com/microsoft/vscode/pull/334131): Surface Copilot tool progress instead of discarding it — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334131.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only toolcall-progress-reduce --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`toolcall-progress-emit`](toolcall-progress-emit.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
