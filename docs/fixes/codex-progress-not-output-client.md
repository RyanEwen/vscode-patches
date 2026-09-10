# codex-progress-not-output-client

a running MCP call shows no progress, and a stale one becomes its past-tense label.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L2889).
- [Full catalog](../../CATALOG.md#codex-progress-not-output-client).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Pairs with `codex-progress-not-output-host`, which moves codex MCP tool
progress off `entry.output` and onto `_meta.progressMessage`. Nothing on
the client reads that key, so on its own the host half is silent: the
narration correctly stops being persisted as the result, and correctly
stops being rendered, but nothing takes its place.

The chat UI already has the channel for it. `ChatToolInvocation` keeps a
`_progress` observable whose only writer is `acceptProgress`, and the
running row renders its message. This feeds it from the tool call's
`_meta` at the three points upstream does:

  A  toolCallStateToInvocation   a client attaching mid-turn builds the
                                 invocation from current state, so the
                                 message has to be seeded there too.
  B  updateRunningToolSpecificData   every subsequent Running update.
  C  finalizeToolInvocation      clears the progress before the state

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334053](https://github.com/microsoft/vscode/pull/334053): Keep Codex MCP tool progress out of the tool result — **MERGED** at the recorded snapshot. [Source/details](../patches/vscode-334053.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only codex-progress-not-output-client --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Other entries mentioned in this implementation (review for dependencies): [`toolcall-progress-render`](toolcall-progress-render.md), [`codex-progress-not-output-host`](codex-progress-not-output-host.md).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
