# slash-resolve-harness

a message containing a slash command never submits in a remote window.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L489).
- [Full catalog](../../CATALOG.md#slash-resolve-harness).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`resolvePromptSlashCommand` parses the command's uri unconditionally,
but a built-in skill's uri is a discovery-only identity on the
`agent-builtin` scheme with no content behind it ("the entries have no
openable content"). The read rejects, the rejection escapes the
resolver, and its caller is the input-decoration update that feeds
`parsedInput` -- so the message can never be sent and nothing is
reported. Reported as microsoft/vscode#331138, fixed by
microsoft/vscode#331145.

Mirrors the upstream change: the parse becomes best-effort and yields
`undefined`, cancellation still propagates, and the two consumers that
dereference `parsedPromptFile` are guarded (see `slash-consumer-*`).
`isCancellationError` is not reachable by name in the bundle, so the
cancellation test is inlined the way that helper defines it.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#331138](https://github.com/microsoft/vscode/issues/331138): Slash commands never submit when the resolved command has no readable content
- [microsoft/vscode#331145](https://github.com/microsoft/vscode/pull/331145): Resolve a slash command whose content cannot be read

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331145](https://github.com/microsoft/vscode/pull/331145): Resolve a slash command whose content cannot be read — **CLOSED** at the recorded snapshot. [Source/details](../patches/vscode-331145.md).

Related issue reports:

- [microsoft/vscode#331138](https://github.com/microsoft/vscode/issues/331138): Slash commands never submit when the resolved command has no readable content

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only slash-resolve-harness --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
