# plugin-read-surface-errors

a filesystem the host cannot address looks exactly like an absent file.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1979).
- [Full catalog](../../CATALOG.md#plugin-read-surface-errors).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`readJsonFile` and `pathExists` in `pluginParsers` are the two reads all
of plugin discovery goes through, and both swallow every error and
report absent. A missing `plugin.json` and a filesystem the host cannot
address at all are therefore indistinguishable, at every log level.

That is why a whole cluster of remote-window defects was invisible. A
remote window hands the host `vscode-agent-host://`-wrapped URIs, and
inside the container `FileService` has no provider for them, so every
probe throws `ENOPRO: No file system provider found for resource ...`
and discovery reports an empty, entirely plausible-looking result.
Permission errors vanish the same way.

Keep the read absent, but say so. A missing file (`FILE_NOT_FOUND`) or
a path that runs through a file (`FILE_NOT_DIRECTORY`) stays silent
because those are the ordinary answers; everything else is warned with
the resource and the message.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

Related proposals (topic mappings are not claims of exact patch equivalence):

- [microsoft/vscode#334034](https://github.com/microsoft/vscode/pull/334034): Surface unreadable files in plugin discovery instead of treating them as absent — **OPEN** at the recorded snapshot. [Source/details](../patches/vscode-334034.md).

Related issue reports:



## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only plugin-read-surface-errors --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
