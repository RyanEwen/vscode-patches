# native-model-vision

a pasted image is labelled unsupported though the model receives it.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L603).
- [Full catalog](../../CATALOG.md#native-model-vision).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The native (SDK) projection hardcodes supportsVision to false while the
CAPI one reads the real capability. The SDK's ModelInfo carries no vision
field, so false stood in for "unknown" -- but nothing downstream treats it
that way: the provider collapses it to a boolean and the attachment widget
renders a warning plus "{model} does not support images" over an image the
model does receive and describe. Every row this transport offers is a
Claude model with image input. Mirrors microsoft/vscode#331396.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331396](https://github.com/microsoft/vscode/pull/331396): Report vision support for natively served Claude models

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331396](https://github.com/microsoft/vscode/pull/331396): Report vision support for natively served Claude models — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331396.md).

Related issue reports:

- [microsoft/vscode#331347](https://github.com/microsoft/vscode/issues/331347): Pasted images are labelled unsupported in Claude sessions even though the model receives them

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only native-model-vision --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
