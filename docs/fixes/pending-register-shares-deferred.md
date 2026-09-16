# pending-register-shares-deferred

a second wait on one pending request cancels the first waiter.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3097).
- [Full catalog](../../CATALOG.md#pending-register-shares-deferred).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`PendingRequestRegistry.register` parks a deferred under a key and hands
back its promise. Registering a key that is already parked rejects the
PREVIOUS deferred with a cancellation and replaces it, so the first
waiter unwinds with "Canceled" even though the request it was waiting on
is still live and will still be responded to. Only the last registrant
can ever see the answer; every earlier one is failed on its behalf.

Sharing the parked deferred instead means both waiters settle on the one
`respond`, which is what a duplicated `tool_use_id` (an SDK retry, a
replay, or a host bug) actually deserves. Nothing relied on the reject:
every caller registers one key per request, and the `rejectAll` /
`denyAll` sweeps used for abort and dispose are untouched by this entry.

Deliberately narrow. The early-result branch above it is re-emitted
verbatim and still wins, so `respondOrBuffer` keeps resolving a later
`register` immediately; only the already-parked branch changes. That

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334146](https://github.com/microsoft/vscode/pull/334146): Admit a client tool call once, instead of racing two triggers — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334146.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only pending-register-shares-deferred --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`client-tool-ownerless-fail-session`](client-tool-ownerless-fail-session.md), [`client-tool-handler-never-throws`](client-tool-handler-never-throws.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
