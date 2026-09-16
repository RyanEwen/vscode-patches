# toolcall-progress-reduce-host

the agent host does not know the progress action either.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L820).
- [Full catalog](../../CATALOG.md#toolcall-progress-reduce-host).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The host bundles its own copy of the chat reducer, so without this it
logs `Unhandled action type` for every progress report it forwards.
Same edit as `toolcall-progress-reduce`, which patches the workbench copy;
upstream both come from one source file and need only the single case.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/agent-host-protocol#405](https://github.com/microsoft/agent-host-protocol/pull/405): chat: report progress for a running tool call — **OPEN** at the recorded snapshot. [Source/details](../patches/agent-host-protocol-405.md).
- [microsoft/vscode#334131](https://github.com/microsoft/vscode/pull/334131): Surface Copilot tool progress instead of discarding it — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334131.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only toolcall-progress-reduce-host --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`toolcall-progress-reduce`](toolcall-progress-reduce.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
