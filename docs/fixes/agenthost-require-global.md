# agenthost-require-global

the bundle is ESM, so later entries have no require for node builtins.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1213).
- [Full catalog](../../CATALOG.md#agenthost-require-global).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

`require` is not in scope at an arbitrary patch site in this bundle. One is
created at module level through `createRequire`, but that binding is minified
and renamed on every build, so no entry can reference it by name. This
captures it once and exposes it as `globalThis.__ahReq`.

Entries that use it must treat a missing `__ahReq` as a reason to fall back to
stock behaviour, so if this anchor ever drifts the dependent entries degrade
quietly instead of throwing at runtime.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only agenthost-require-global --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
