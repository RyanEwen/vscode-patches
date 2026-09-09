# slash-command-single-block

a slash command is never expanded because the host appends context as a second block.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1548).
- [Full catalog](../../CATALOG.md#slash-command-single-block).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

The composer returns the user's text as the first block and then appends
host-composed context: attachment representations, read-only snapshot
notes, and the reference reminder. The Claude CLI only treats a message
as a slash command when its content is a single text block, so any turn
carrying context silently stops being a command. The model then receives
`/code-review ...` as ordinary prose and answers from its own head, which
reads as the command being missing even though completion offered it.

Measured against the SDK in this container, same command and session,
varying only the content shape:
  string bare .................. expands
  string with context inline .... expands
  one text block, context inline  expands
  two text blocks ............... DOES NOT expand

So the discriminator is the block count, not the context, and merging the

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only slash-command-single-block --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
