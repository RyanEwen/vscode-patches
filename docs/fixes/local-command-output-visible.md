# local-command-output-visible

a local slash command runs, produces output, and the turn renders empty.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1172).
- [Full catalog](../../CATALOG.md#local-command-output-visible).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The CLI records a local command's result as a `system` message with
`subtype: local_command`, wrapping the payload in `<local-command-stdout>`,
and separately injects a `<local-command-caveat>` telling the model not to
respond to it. The live mapper only recognises subagent task subtypes, so
the message maps to no signal, the model correctly stays silent, and the
turn ends with an empty bubble.

Observed with `/code-review`: it ran for 11 minutes, produced 13.6 KB of
findings, and rendered nothing. The output was recovered from the SDK
transcript afterwards. Every local slash command behaves this way, and the
same command prints normally in the terminal CLI.

Emits the stdout as a markdown response part on the active turn. The
caveat entry is what keeps the model from replying, so surfacing this
changes only what the user sees. Reported as microsoft/vscode#334575.
The SDK stream's subtype is `local_command_output` (sdk.d.ts:4286). The

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

References explicitly recorded in the implementation:

- [microsoft/vscode#334575](https://github.com/microsoft/vscode/issues/334575): Agent host: a local slash command's output is never shown, leaving an empty turn

Related issue reports:

- [microsoft/vscode#334575](https://github.com/microsoft/vscode/issues/334575): Agent host: a local slash command's output is never shown, leaving an empty turn

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only local-command-output-visible --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`skill-subagent-result-visible`](skill-subagent-result-visible.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
