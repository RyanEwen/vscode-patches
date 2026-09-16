# subscribe-cancelled-not-missing

a client cancelling a subscribe is reported as a missing resource, at error level.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2972).
- [Full catalog](../../CATALOG.md#subscribe-cancelled-not-missing).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`agentService.subscribe` throws `Subscription cancelled: <uri>` when its
subscription is released while it waits for a pending subagent chat, and
the protocol server's subscribe handler rewraps ANY non-ProtocolError as
`Resource not found: <uri>`. `shouldLogFailedRequest` then lets that
through at error level, because it only stays quiet for a NotFound on a
file resource read.

So a routine client cancellation is reported as a missing resource that
exists and was registered correctly, and it points at a host registration
bug when the observation lifetime on the client is what actually ended.
That cost a real debugging session on this machine.

Upstream adds `SubscriptionCancelledError extends ProtocolError`, throws
it at all five sites that already signalled this concept, keys the
handler on `instanceof`, and excludes it from `shouldLogFailedRequest`.
A class cannot carry across the five throw sites here: they sit in two

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334066](https://github.com/microsoft/vscode/pull/334066): Report a cancelled subscribe as cancelled, not as a missing resource — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334066.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only subscribe-cancelled-not-missing --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
