# Source patches

Snapshots of 63 RyanEwen PRs found in microsoft/vscode and microsoft/agent-host-protocol through 2026-09-16. Closed and merged proposals are retained for reference. These are separate proposals, **not a series to apply together**. Follow the upstream PR for current status and revisions.

PR #335363 was refreshed after review to include host identity for provider error groups. Its detail page records the updated head.

| PR | State at snapshot | Patch and installer mapping |
|---|---|---|
| [microsoft/vscode#336430: Fix agent feedback review commands in editor windows](https://github.com/microsoft/vscode/pull/336430) | OPEN | [Details](docs/patches/vscode-336430.md) |
| [microsoft/vscode#336162: Fall back when the IPC runtime directory is unavailable](https://github.com/microsoft/vscode/pull/336162) | OPEN | [Details](docs/patches/vscode-336162.md) |
| [microsoft/vscode#335547: Fix Codex steering acknowledgement with attached context](https://github.com/microsoft/vscode/pull/335547) | OPEN | [Details](docs/patches/vscode-335547.md) |
| [microsoft/vscode#335363: Preserve agent host identity in Manage Language Models](https://github.com/microsoft/vscode/pull/335363) | OPEN | [Details](docs/patches/vscode-335363.md) |
| [microsoft/vscode#334814: Seed new chat-input sessions from the remembered session-config picks](https://github.com/microsoft/vscode/pull/334814) | OPEN | [Details](docs/patches/vscode-334814.md) |
| [microsoft/vscode#334743: Keep every pending steering message instead of only the last](https://github.com/microsoft/vscode/pull/334743) | OPEN | [Details](docs/patches/vscode-334743.md) |
| [microsoft/vscode#334742: Report chat activity from the Claude agent session](https://github.com/microsoft/vscode/pull/334742) | OPEN | [Details](docs/patches/vscode-334742.md) |
| [microsoft/vscode#334559: Spare a background subagent's in-flight tool call from the turn-end wipe](https://github.com/microsoft/vscode/pull/334559) | OPEN | [Details](docs/patches/vscode-334559.md) |
| [microsoft/vscode#334549: Do not mark a denied subagent tool call as a subagent](https://github.com/microsoft/vscode/pull/334549) | OPEN | [Details](docs/patches/vscode-334549.md) |
| [microsoft/vscode#334311: Report a browser tool failure with an empty message as a failure](https://github.com/microsoft/vscode/pull/334311) | MERGED | [Details](docs/patches/vscode-334311.md) |
| [microsoft/vscode#334146: Admit a client tool call once, instead of racing two triggers](https://github.com/microsoft/vscode/pull/334146) | OPEN | [Details](docs/patches/vscode-334146.md) |
| [microsoft/vscode#334145: Brand the agent host URI namespaces and convert the project root at the boundary](https://github.com/microsoft/vscode/pull/334145) | OPEN | [Details](docs/patches/vscode-334145.md) |
| [microsoft/vscode#334136: Hydrate replay attribution into a resumed session](https://github.com/microsoft/vscode/pull/334136) | OPEN | [Details](docs/patches/vscode-334136.md) |
| [microsoft/vscode#334132: Keep a primed subagent spawn alive past the next turn](https://github.com/microsoft/vscode/pull/334132) | OPEN | [Details](docs/patches/vscode-334132.md) |
| [microsoft/vscode#334131: Surface Copilot tool progress instead of discarding it](https://github.com/microsoft/vscode/pull/334131) | OPEN | [Details](docs/patches/vscode-334131.md) |
| [microsoft/vscode#334127: Close abandoned turns deterministically](https://github.com/microsoft/vscode/pull/334127) | OPEN | [Details](docs/patches/vscode-334127.md) |
| [microsoft/vscode#334087: Add a setting for the permission mode new Claude sessions start in](https://github.com/microsoft/vscode/pull/334087) | OPEN | [Details](docs/patches/vscode-334087.md) |
| [microsoft/vscode#334072: Keep observing a subagent whose chat outlives its spawning turn](https://github.com/microsoft/vscode/pull/334072) | OPEN | [Details](docs/patches/vscode-334072.md) |
| [microsoft/vscode#334066: Report a cancelled subscribe as cancelled, not as a missing resource](https://github.com/microsoft/vscode/pull/334066) | OPEN | [Details](docs/patches/vscode-334066.md) |
| [microsoft/vscode#334053: Keep Codex MCP tool progress out of the tool result](https://github.com/microsoft/vscode/pull/334053) | MERGED | [Details](docs/patches/vscode-334053.md) |
| [microsoft/vscode#334049: Mark a turn interrupted by a host crash on restore](https://github.com/microsoft/vscode/pull/334049) | OPEN | [Details](docs/patches/vscode-334049.md) |
| [microsoft/vscode#334048: Keep remote workspace folders when creating a session through the handler](https://github.com/microsoft/vscode/pull/334048) | OPEN | [Details](docs/patches/vscode-334048.md) |
| [microsoft/vscode#334047: Expose the Claude replay attribution index](https://github.com/microsoft/vscode/pull/334047) | OPEN | [Details](docs/patches/vscode-334047.md) |
| [microsoft/vscode#334044: Fail Claude client tool calls that no connected client provides](https://github.com/microsoft/vscode/pull/334044) | OPEN | [Details](docs/patches/vscode-334044.md) |
| [microsoft/vscode#334040: Retire a stranded optimistic chat truncation once the host has applied it](https://github.com/microsoft/vscode/pull/334040) | OPEN | [Details](docs/patches/vscode-334040.md) |
| [microsoft/vscode#334038: Answer client-tool handler rejections as tool errors](https://github.com/microsoft/vscode/pull/334038) | OPEN | [Details](docs/patches/vscode-334038.md) |
| [microsoft/vscode#334037: Let the workbench own confirmation for Claude client tools](https://github.com/microsoft/vscode/pull/334037) | OPEN | [Details](docs/patches/vscode-334037.md) |
| [microsoft/vscode#334034: Surface unreadable files in plugin discovery instead of treating them as absent](https://github.com/microsoft/vscode/pull/334034) | OPEN | [Details](docs/patches/vscode-334034.md) |
| [microsoft/vscode#334011: Make the chat/turnStarted reducer idempotent](https://github.com/microsoft/vscode/pull/334011) | OPEN | [Details](docs/patches/vscode-334011.md) |
| [microsoft/vscode#334010: Reclaim orphaned agent session data directories](https://github.com/microsoft/vscode/pull/334010) | OPEN | [Details](docs/patches/vscode-334010.md) |
| [microsoft/vscode#334008: Keep tool attribution across a steering preempt](https://github.com/microsoft/vscode/pull/334008) | OPEN | [Details](docs/patches/vscode-334008.md) |
| [microsoft/vscode#334005: Accept remote workspace folders in working-directory actions](https://github.com/microsoft/vscode/pull/334005) | OPEN | [Details](docs/patches/vscode-334005.md) |
| [microsoft/vscode#334002: Settle the promise of a pending request the remote reconcile dropped](https://github.com/microsoft/vscode/pull/334002) | OPEN | [Details](docs/patches/vscode-334002.md) |
| [microsoft/vscode#333919: Ignore a steering message that is re-delivered while still in flight](https://github.com/microsoft/vscode/pull/333919) | OPEN | [Details](docs/patches/vscode-333919.md) |
| [microsoft/vscode#333683: agentHost: watch customizations on the host's own filesystem](https://github.com/microsoft/vscode/pull/333683) | CLOSED | [Details](docs/patches/vscode-333683.md) |
| [microsoft/vscode#332122: agentHost: retire the optimistic turn start on the first backend action](https://github.com/microsoft/vscode/pull/332122) | OPEN | [Details](docs/patches/vscode-332122.md) |
| [microsoft/vscode#332075: agentHost: keep the parent output after a background subagent settles](https://github.com/microsoft/vscode/pull/332075) | OPEN | [Details](docs/patches/vscode-332075.md) |
| [microsoft/vscode#332055: agentHost: resolve Claude customizations for a chat that is not resident](https://github.com/microsoft/vscode/pull/332055) | OPEN | [Details](docs/patches/vscode-332055.md) |
| [microsoft/vscode#331885: Replay the user's prompt without the host's added context](https://github.com/microsoft/vscode/pull/331885) | OPEN | [Details](docs/patches/vscode-331885.md) |
| [microsoft/vscode#331872: Complete a background subagent that settles after its turn](https://github.com/microsoft/vscode/pull/331872) | OPEN | [Details](docs/patches/vscode-331872.md) |
| [microsoft/vscode#331871: Resolve agent host file paths against the window's remote](https://github.com/microsoft/vscode/pull/331871) | OPEN | [Details](docs/patches/vscode-331871.md) |
| [microsoft/vscode#331569: Render an embedded attachment that has no content type](https://github.com/microsoft/vscode/pull/331569) | OPEN | [Details](docs/patches/vscode-331569.md) |
| [microsoft/vscode#331527: Read project customizations on the host's own filesystem](https://github.com/microsoft/vscode/pull/331527) | CLOSED | [Details](docs/patches/vscode-331527.md) |
| [microsoft/vscode#331408: Tell the caller a consumed queued message was sent](https://github.com/microsoft/vscode/pull/331408) | OPEN | [Details](docs/patches/vscode-331408.md) |
| [microsoft/vscode#331396: Report vision support for natively served Claude models](https://github.com/microsoft/vscode/pull/331396) | OPEN | [Details](docs/patches/vscode-331396.md) |
| [microsoft/vscode#331349: Match a remote host's working directories against the window's folder](https://github.com/microsoft/vscode/pull/331349) | OPEN | [Details](docs/patches/vscode-331349.md) |
| [microsoft/vscode#331345: Count the session's changes, not the branch's divergence](https://github.com/microsoft/vscode/pull/331345) | OPEN | [Details](docs/patches/vscode-331345.md) |
| [microsoft/vscode#331310: Complete the response for the turn that ended](https://github.com/microsoft/vscode/pull/331310) | CLOSED | [Details](docs/patches/vscode-331310.md) |
| [microsoft/vscode#331300: Resolve a client tool to the client that is still there](https://github.com/microsoft/vscode/pull/331300) | OPEN | [Details](docs/patches/vscode-331300.md) |
| [microsoft/vscode#331145: Resolve a slash command whose content cannot be read](https://github.com/microsoft/vscode/pull/331145) | CLOSED | [Details](docs/patches/vscode-331145.md) |
| [microsoft/vscode#330942: Anchor branch changes on the session baseline checkpoint](https://github.com/microsoft/vscode/pull/330942) | CLOSED | [Details](docs/patches/vscode-330942.md) |
| [microsoft/vscode#330933: Proposal: execute a client tool on the runtime's invocation](https://github.com/microsoft/vscode/pull/330933) | CLOSED | [Details](docs/patches/vscode-330933.md) |
| [microsoft/vscode#330785: Surface a Claude steering message as its own turn](https://github.com/microsoft/vscode/pull/330785) | OPEN | [Details](docs/patches/vscode-330785.md) |
| [microsoft/vscode#330781: Keep a Claude steering message on screen](https://github.com/microsoft/vscode/pull/330781) | CLOSED | [Details](docs/patches/vscode-330781.md) |
| [microsoft/vscode#330775: Register a subscription before awaiting its snapshot](https://github.com/microsoft/vscode/pull/330775) | CLOSED | [Details](docs/patches/vscode-330775.md) |
| [microsoft/vscode#330746: Execute a client tool the SDK replays from the transcript](https://github.com/microsoft/vscode/pull/330746) | CLOSED | [Details](docs/patches/vscode-330746.md) |
| [microsoft/vscode#330730: Buffer a client tool result that arrives before the SDK asks for it](https://github.com/microsoft/vscode/pull/330730) | OPEN | [Details](docs/patches/vscode-330730.md) |
| [microsoft/vscode#330709: Surface a client tool's error when it returns no content](https://github.com/microsoft/vscode/pull/330709) | OPEN | [Details](docs/patches/vscode-330709.md) |
| [microsoft/vscode#330707: Do not present a failed tool call as a successful one](https://github.com/microsoft/vscode/pull/330707) | MERGED | [Details](docs/patches/vscode-330707.md) |
| [microsoft/vscode#330698: Delete the Claude transcript when a chat is disposed](https://github.com/microsoft/vscode/pull/330698) | OPEN | [Details](docs/patches/vscode-330698.md) |
| [microsoft/vscode#330684: Validate client tool input against the tool's schema](https://github.com/microsoft/vscode/pull/330684) | OPEN | [Details](docs/patches/vscode-330684.md) |
| [microsoft/vscode#330683: Do not run a client tool twice when a tool call is readied twice](https://github.com/microsoft/vscode/pull/330683) | CLOSED | [Details](docs/patches/vscode-330683.md) |
| [microsoft/agent-host-protocol#433: chat: make the turnStarted reducer case idempotent](https://github.com/microsoft/agent-host-protocol/pull/433) | OPEN | [Details](docs/patches/agent-host-protocol-433.md) |
| [microsoft/agent-host-protocol#405: chat: report progress for a running tool call](https://github.com/microsoft/agent-host-protocol/pull/405) | OPEN | [Details](docs/patches/agent-host-protocol-405.md) |

## Codex steering input proposal

The [source proposal](source-patches/vscode/335547.patch) targets VS Code base `1efa8b317e0d479d189913feb2cd84e6f5d52cf6`. [Bundle maintenance details](docs/fixes/codex-steering-resolved-input.md) describe the independently guarded backport. Published as [microsoft/vscode#335547](https://github.com/microsoft/vscode/pull/335547), fixing [#335546](https://github.com/microsoft/vscode/issues/335546). [Source and validation details](docs/patches/vscode-335547.md).
