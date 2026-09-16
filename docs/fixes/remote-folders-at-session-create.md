# remote-folders-at-session-create

a session created from the chat handler in a container window gets no working directories at all.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2377).
- [Full catalog](../../CATALOG.md#remote-folders-at-session-create).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`_hostAddressableWorkingDirectories` drops any folder whose scheme, as
the host will receive it, is not the scheme of the host's own
`defaultDirectory`. Every host reports that as `file:`. A dev-container
window's folders are `vscode-remote:` and the remote client's mapper
only unwraps `vscode-agent-host:` URIs, so they arrive here still
spelled `vscode-remote:` and every one of them is filtered out.

The filter then falls back to `undefined`, so the session is created
with no working directories and the host picks its own. Nothing
recovers from that: the host treats the session as workspace-less, the
working-directory synchronizer refuses to touch a session it did not
see folders for, the session list's containment check matches nothing
so the session never lists, and the same filtered set seeds the
customization scope roots, which come up empty too.

The comparison is wrong for this window specifically because

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334048](https://github.com/microsoft/vscode/pull/334048): Keep remote workspace folders when creating a session through the handler — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334048.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only remote-folders-at-session-create --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`remote-working-directory-actions`](remote-working-directory-actions.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
