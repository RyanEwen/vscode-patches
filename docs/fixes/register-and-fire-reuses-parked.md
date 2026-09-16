# register-and-fire-reuses-parked

a duplicate tool_use_id orphans the first request, which then never settles.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3139).
- [Full catalog](../../CATALOG.md#register-and-fire-reuses-parked).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`registerAndFire` replaces an entry that is still parked, unlike
`register`, which cancels the superseded deferred on purpose so its
awaiter unwinds. Only one response is ever produced for a tool call, so
the replaced promise is never settled and its SDK invocation hangs for
the life of the session.

Reuses rather than cancels: a duplicate awaits the parked request and
does not fire again, so the single response settles both callers.
Cancelling would fail an invocation whose tool then runs and succeeds.
Mirrors microsoft/vscode#334146.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334146](https://github.com/microsoft/vscode/pull/334146): Admit a client tool call once, instead of racing two triggers

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334146](https://github.com/microsoft/vscode/pull/334146): Admit a client tool call once, instead of racing two triggers — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334146.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only register-and-fire-reuses-parked --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
