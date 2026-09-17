# discovery-suppression-loud

discovery suppresses two thirds of sessions and never says which are which.

## Implementation

- Target: **agenthost** bundle.
- [Current implementation](../../patch-vscode-fixes.mjs#L3385).
- [Full catalog](../../CATALOG.md#discovery-suppression-loud).
- Status: local installed-bundle workaround; upstream proposal status is tracked separately.

## Rationale recorded with the patch

Diagnostic, not a fix. Measured 2026-09-07: discovery reported 122 candidates,
39 registered and 83 "suppressed as subagent/chat backing", and the Sessions
view showed only 3-week-old archived entries. The recent sessions are somewhere
in that 83, but the summary counts the two causes together so there is no way
to tell a real subagent from a chat backing from the log.

The shipped code collapses both tests into one branch, so this splits them and
names the one that fired, per session. `isSubagentSession` is evaluated first
and short-circuits, exactly as the original `||` does, so the chat-backing
check still runs only when the first is false and no extra work is added.

Logs through `_logService`, which is the sink every other agent-host marker
uses and is known to reach `agenthost.log`. Three earlier probes went through
renderer-side loggers and produced silence that could not be distinguished
from the code not running.

## Upstream references

Tracking epic: [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174).

No specific upstream issue or PR is recorded for this entry yet. Keep it marked local-only until that mapping has been verified.

## Applying and maintaining

Inspect the target build before applying:

```sh
node patch-vscode-fixes.mjs --status --only discovery-suppression-loud --target "/path/to/bundle.js"
```

An exact structural match is required. A missing site is not proof of an upstream fix. Read adjacent implementation comments for coupled entries before selecting a partial fix set. The combined patcher backs up and restores entire bundles; see the [usage and rollback instructions](../../README.md#using-the-combined-patcher).

Validation: [publication checks and limits](../../VALIDATION.md), [live-bundle test inputs](../../tests/live/README.md). A per-entry live regression result was not newly established by this documentation pass.

When changing this fix, record the tested build, update related references, run the applicable regression checks, regenerate this page, and update the public-link section in its issue/PR. See [MAINTAINING.md](../../MAINTAINING.md).
