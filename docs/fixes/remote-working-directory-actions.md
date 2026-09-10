# remote-working-directory-actions

adding or removing a workspace folder from a container window is rejected by the host.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2321).
- [Full catalog](../../CATALOG.md#remote-working-directory-actions).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`resolveSessionWorkingDirectoryAction` is the validator every dynamic
working-directory action goes through, and it threw `Working directory
must be a file URI` for anything that was not `file:`. The client
dispatches the raw workspace-folder URIs, which in a dev-container
window are `vscode-remote://dev-container+<hex>/...`, so every add,
remove and replace after the session exists was rejected.

`createSession` meanwhile accepted and stored those same URIs with no
scheme check at all, which is why sessions come up with the right
folders and only later edits fail. The two paths disagreeing is the
actual defect; the create path is the one that matches how the rest of
the system reads this state.

Normalising to `file:` at ingress was considered and rejected. Host
state is echoed back unmodified (the protocol client only unwraps
agent-host URIs inbound and only wraps `file:` outbound), and the

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334005](https://github.com/microsoft/vscode/pull/334005): Accept remote workspace folders in working-directory actions — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334005.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only remote-working-directory-actions --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
