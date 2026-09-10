# replay-user-prompt-only

restored messages show context the user never typed.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1153).
- [Full catalog](../../CATALOG.md#replay-user-prompt-only).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

resolvePromptToContentBlocks sends the prompt as the first text block
and appends host-composed context after it: attachment representations
(shared browser pages, repo and branch details) and the reference
reminder. The replay mapper joins every text block back together, so a
rehydrated turn shows that context as words the user typed. Live turns
are unaffected, which is why it only appears on returning to a session.

It also leaks into session titles, which are seeded from the first
turn's text, producing sessions named after the browser-context blurb.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#331885](https://github.com/microsoft/vscode/pull/331885): Replay the user's prompt without the host's added context — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-331885.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only replay-user-prompt-only --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
