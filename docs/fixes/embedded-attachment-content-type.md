# embedded-attachment-content-type

a pasted image renders as a broken thumbnail.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L156).
- [Full catalog](../../CATALOG.md#embedded-attachment-content-type).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

An embedded attachment is persisted without a `contentType`, and the
restore path reads `.contentType.startsWith('image/')` straight off it,
so the read throws and the attachment never renders.

Measured in a real session: the stored record is
`{"type":"embeddedResource","label":"Pasted Image","displayKind":"image","data":"..."}`
with no `contentType` key anywhere in the database. The Windows-style
path in the hover was a red herring: that is just the label formatter
rendering a remote path on a Windows client.

`displayKind` already says it is an image, so the type is inferred from
it rather than guessed. A non-image with no content type falls through to
the generic branch instead of being treated as an image.

Current producers all default the field, so NEW pastes were never
affected; this repairs attachments already on disk. Mirrors

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331569](https://github.com/microsoft/vscode/pull/331569): Render an embedded attachment that has no content type

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331569](https://github.com/microsoft/vscode/pull/331569): Render an embedded attachment that has no content type — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331569.md).

Related issue reports:

- [microsoft/vscode#331568](https://github.com/microsoft/vscode/issues/331568): A pasted image renders as a broken thumbnail when its attachment has no contentType

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only embedded-attachment-content-type --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
