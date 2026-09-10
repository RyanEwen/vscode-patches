# keyed-item-transient-empty

a momentarily empty collection tears down live keyed items.

## Implementation

- Target: **workbench** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L1667).
- [Full catalog](../../CATALOG.md#keyed-item-transient-empty).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

autorunPerKeyedItem disposes the store of every key missing from the
incoming collection. A derived collection that reads empty for a tick
during a state update therefore destroys every item at once.

For agent host client tools that disposal reaches the request
lifecycle, which cancels the shared execution token, so an in-flight
tool dies as "Canceled" or "Tool permission request aborted" while the
host still holds the request and waits forever for a completion.
Observed with a logpoint: the dropped key had zero siblings present.

Treat an empty read as "nothing new to reconcile" rather than
"everything went away". A key that returns reuses its existing item,
so the work continues, and the helper's outer cleanup still disposes
the stores when the autorun itself is torn down.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only keyed-item-transient-empty --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
