# consumed-message-settles-sent

a consumed queued message never resolves its send promise.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L646).
- [Full catalog](../../CATALOG.md#consumed-message-settles-sent).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The other half: with the cancel path skipped, the caller is still
waiting. The request the host's turn creates arrives under the very id
the message was queued with, so settle the deferred there, as sent.

Every path settles exactly once, because nothing else will now that
reconciliation leaves a consumed message alone. Reporting it as sent
means handing back an agent and a response to await, so when there is
neither the caller is told the send failed rather than left waiting.
The completion promise is settled by the session's store as well as by
the response, so a session closed mid-turn cannot leave it pending;
the ordinary send path makes the same guarantee.

Mirrors microsoft/vscode#331408, including its review round.

Re-anchored for 1.136.0: upstream (#332461) put a `resume` branch at
the top of the handler, which reopens an existing request and returns

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent
- [microsoft/vscode#332461](https://github.com/microsoft/vscode/issues/332461)

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331408](https://github.com/microsoft/vscode/pull/331408): Tell the caller a consumed queued message was sent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331408.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only consumed-message-settles-sent --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
