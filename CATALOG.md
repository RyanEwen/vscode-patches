# Patcher catalog

104 current bundle-patcher entries, plus the separate model-host-label installer. Entries are identified by their patcher ID; a matching upstream PR does not establish compatibility with a given installed build. Inspect `--status` before applying. Dependencies and tradeoffs remain documented alongside each entry in the script.

## agent-feedback-review-editor

[Maintenance details](docs/fixes/agent-feedback-review-editor.md). Target: **workbench**.

Backports [PR #336430](docs/patches/vscode-336430.md), including its cancellation-listener and accessibility review fixes. Registers the missing editor-window comment commands and distinguishes loading failures from an empty list. Validated on Windows ARM64 VS Code 1.137.0 build `645f29cc31`; the Windows client also renders Ubuntu WSL editor windows. No WSL agent-host bundle change is needed. The dedicated Agents window is excluded by the structural guard.

## client-tool-input-schema

[Maintenance details and upstream references](docs/fixes/client-tool-input-schema.md).

a client tool runs with empty input when its arguments never streamed.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L61). Upstream: No direct PR reference in patcher entry.

## session-list

[Maintenance details and upstream references](docs/fixes/session-list.md).

sessions never list in remote windows.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L81). Upstream: [#331349](https://github.com/microsoft/vscode/pull/331349).

## session-list-remote-project-root

[Maintenance details and upstream references](docs/fixes/session-list-remote-project-root.md).

a legacy session whose project root is on the remote is dropped from the list.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L133). Upstream: [#334145](https://github.com/microsoft/vscode/pull/334145).

## embedded-attachment-content-type

[Maintenance details and upstream references](docs/fixes/embedded-attachment-content-type.md).

a pasted image renders as a broken thumbnail.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L153). Upstream: [#331569](https://github.com/microsoft/vscode/pull/331569).

## client-tool-buffer

[Maintenance details and upstream references](docs/fixes/client-tool-buffer.md).

a client tool result is dropped when it arrives before the SDK asks for it.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L182). Upstream: No direct PR reference in patcher entry.

## client-tool-error

[Maintenance details and upstream references](docs/fixes/client-tool-error.md).

a client tool error reaches the model as an empty result.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L204). Upstream: No direct PR reference in patcher entry.

## replay-args

[Maintenance details and upstream references](docs/fixes/replay-args.md).

client tool MCP handler forwards tool name and args.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L229). Upstream: No direct PR reference in patcher entry.

## replay-route

[Maintenance details and upstream references](docs/fixes/replay-route.md).

client tool wiring routes through the replay-aware awaiter.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L247). Upstream: No direct PR reference in patcher entry.

## replay-turnid

[Maintenance details and upstream references](docs/fixes/replay-turnid.md).

session stashes the active turn id.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L256). Upstream: No direct PR reference in patcher entry.

## replay-seen

[Maintenance details and upstream references](docs/fixes/replay-seen.md).

session records which tool calls actually streamed, and under which turn.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L266). Upstream: No direct PR reference in patcher entry.

## replay-drive

[Maintenance details and upstream references](docs/fixes/replay-drive.md).

drive execution for a replayed (never-streamed) client tool call.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L282). Upstream: No direct PR reference in patcher entry.

## steering-pending

[Maintenance details and upstream references](docs/fixes/steering-pending.md).

the pipeline only receives the steering id, not the message.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L332). Upstream: No direct PR reference in patcher entry.

## steering-buffer

[Maintenance details and upstream references](docs/fixes/steering-buffer.md).

a steering message is forgotten once it is queued.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L341). Upstream: No direct PR reference in patcher entry.

## steering-hold

[Maintenance details and upstream references](docs/fixes/steering-hold.md).

the pending bubble is cleared when the queue hands the message over.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L362). Upstream: No direct PR reference in patcher entry.

## steering-promote

[Maintenance details and upstream references](docs/fixes/steering-promote.md).

a steering message never becomes its own turn.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L372). Upstream: No direct PR reference in patcher entry.

## steering-drain

[Maintenance details and upstream references](docs/fixes/steering-drain.md).

a steering message the SDK never echoes leaves its bubble behind on abort.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L415). Upstream: No direct PR reference in patcher entry.

## client-tool-single-trigger

[Maintenance details and upstream references](docs/fixes/client-tool-single-trigger.md).

a client tool executes off the streamed ready rather than the runtime invocation.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L431). Upstream: [#330933](https://github.com/microsoft/vscode/pull/330933).

## session-chip-list-scope

[Maintenance details and upstream references](docs/fixes/session-chip-list-scope.md).

the session list re-derives the chip from the branch for inactive sessions.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L449). Upstream: No direct PR reference in patcher entry.

## slash-resolve-harness

[Maintenance details and upstream references](docs/fixes/slash-resolve-harness.md).

a message containing a slash command never submits in a remote window.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L487). Upstream: [#331145](https://github.com/microsoft/vscode/pull/331145).

## slash-resolve-prompts

[Maintenance details and upstream references](docs/fixes/slash-resolve-prompts.md).

the prompts service resolver rejects on an unreadable slash command.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L516). Upstream: No direct PR reference in patcher entry.

## slash-consumer-sessions

[Maintenance details and upstream references](docs/fixes/slash-consumer-sessions.md).

the session send path dereferences a prompt file that may be absent.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L536). Upstream: No direct PR reference in patcher entry.

## slash-consumer-widget

[Maintenance details and upstream references](docs/fixes/slash-consumer-widget.md).

the chat widget dereferences a prompt file that may be absent.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L552). Upstream: No direct PR reference in patcher entry.

## slash-consumer-widget-header

[Maintenance details and upstream references](docs/fixes/slash-consumer-widget-header.md).

the chat widget applies header metadata from an absent prompt file.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L569). Upstream: No direct PR reference in patcher entry.

## client-tool-owner-recency

[Maintenance details and upstream references](docs/fixes/client-tool-owner-recency.md).

a tool call is stamped with a client that has gone away.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L579). Upstream: [#331300](https://github.com/microsoft/vscode/pull/331300).

## native-model-vision

[Maintenance details and upstream references](docs/fixes/native-model-vision.md).

a pasted image is labelled unsupported though the model receives it.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L603). Upstream: [#331396](https://github.com/microsoft/vscode/pull/331396).

## consumed-message-not-removed

[Maintenance details and upstream references](docs/fixes/consumed-message-not-removed.md).

a queued message the host consumed is retired as cancelled.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L618). Upstream: [#331408](https://github.com/microsoft/vscode/pull/331408).

## consumed-message-settles-sent

[Maintenance details and upstream references](docs/fixes/consumed-message-settles-sent.md).

a consumed queued message never resolves its send promise.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L644). Upstream: [#331408](https://github.com/microsoft/vscode/pull/331408).

## consumed-message-sync-reconcile

[Maintenance details and upstream references](docs/fixes/consumed-message-sync-reconcile.md).

reconciliation cancels the consumed message and settles nothing.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L685). Upstream: [#334002](https://github.com/microsoft/vscode/pull/334002), [#331408](https://github.com/microsoft/vscode/pull/331408).

## consumed-message-sync-arg

[Maintenance details and upstream references](docs/fixes/consumed-message-sync-arg.md).

reconciliation is not told which message the host consumed.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L720). Upstream: [#331408](https://github.com/microsoft/vscode/pull/331408).

## steer-preempt-not-error

[Maintenance details and upstream references](docs/fixes/steer-preempt-not-error.md).

a turn interrupted by a steer renders as failed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L739). Upstream: [#330785](https://github.com/microsoft/vscode/pull/330785).

## toolcall-progress-emit

[Maintenance details and upstream references](docs/fixes/toolcall-progress-emit.md).

a long tool call reports nothing while it runs.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L770). Upstream: No direct PR reference in patcher entry.

## toolcall-progress-reduce

[Maintenance details and upstream references](docs/fixes/toolcall-progress-reduce.md).

the client has nowhere to record tool call progress.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L804). Upstream: No direct PR reference in patcher entry.

## toolcall-progress-reduce-host

[Maintenance details and upstream references](docs/fixes/toolcall-progress-reduce-host.md).

the agent host does not know the progress action either.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L818). Upstream: No direct PR reference in patcher entry.

## toolcall-progress-render

[Maintenance details and upstream references](docs/fixes/toolcall-progress-render.md).

a running tool call renders no progress.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L832). Upstream: No direct PR reference in patcher entry.

## session-delete

[Maintenance details and upstream references](docs/fixes/session-delete.md).

deleting a Claude session does not delete the transcript.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L852). Upstream: [#330698](https://github.com/microsoft/vscode/pull/330698).

## remote-window-authority-init

[Maintenance details and upstream references](docs/fixes/remote-window-authority-init.md).

the in-window agent host claims to be local in a remote window.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L884). Upstream: No direct PR reference in patcher entry.

## remote-window-authority-fs

[Maintenance details and upstream references](docs/fixes/remote-window-authority-fs.md).

the agent host filesystem registers under the local authority.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L903). Upstream: No direct PR reference in patcher entry.

## remote-window-authority-session

[Maintenance details and upstream references](docs/fixes/remote-window-authority-session.md).

the session handler is told the host is local.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L914). Upstream: No direct PR reference in patcher entry.

## remote-window-authority-map

[Maintenance details and upstream references](docs/fixes/remote-window-authority-map.md).

agent host file paths are handed to the client unmapped.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L926). Upstream: No direct PR reference in patcher entry.

## workspace-folder-uses-real-remote

[Maintenance details and upstream references](docs/fixes/workspace-folder-uses-real-remote.md).

opening a session folder yields a window that can resolve nothing.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L951). Upstream: No direct PR reference in patcher entry.

## session-workspace-folder-real-remote

[Maintenance details and upstream references](docs/fixes/session-workspace-folder-real-remote.md).

a session workspace keeps the agent host authority its folders cannot resolve.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L993). Upstream: No direct PR reference in patcher entry.

## subagent-completion-when-idle

[Maintenance details and upstream references](docs/fixes/subagent-completion-when-idle.md).

a background subagent that finishes after its turn stays running.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1029). Upstream: No direct PR reference in patcher entry.

## sdk-initiated-turn

[Maintenance details and upstream references](docs/fixes/sdk-initiated-turn.md).

the SDK starts a turn the host never queued, so everything in it is discarded.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1055). Upstream: No direct PR reference in patcher entry.

## subagent-inactive-resume

[Maintenance details and upstream references](docs/fixes/subagent-inactive-resume.md).

a running subagent produces output that is discarded once its chat has no active turn.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1115). Upstream: No direct PR reference in patcher entry.

## replay-user-prompt-only

[Maintenance details and upstream references](docs/fixes/replay-user-prompt-only.md).

restored messages show context the user never typed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1152). Upstream: No direct PR reference in patcher entry.

## local-command-output-visible

[Maintenance details and upstream references](docs/fixes/local-command-output-visible.md).

a local slash command runs, produces output, and the turn renders empty.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1170). Upstream: No direct PR reference in patcher entry.

## agenthost-require-global

[Maintenance details and upstream references](docs/fixes/agenthost-require-global.md).

the bundle is ESM, so later entries have no require for node builtins.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1210). Upstream: No direct PR reference in patcher entry.

## resume-missing-conversation-starts-fresh

[Maintenance details and upstream references](docs/fixes/resume-missing-conversation-starts-fresh.md).

cancelling a skill-subagent turn bricks a new chat permanently.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1227). Upstream: No direct PR reference in patcher entry.

## result-error-subtypes-surface

[Maintenance details and upstream references](docs/fixes/result-error-subtypes-surface.md).

hitting a turn, budget or retry cap renders as a successful empty turn.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1288). Upstream: No direct PR reference in patcher entry.

## result-usage-any-subtype

[Maintenance details and upstream references](docs/fixes/result-usage-any-subtype.md).

a turn that stops at a cap reports none of the tokens it spent.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1328). Upstream: No direct PR reference in patcher entry.

## toolcall-hidden-respects-liveness

[Maintenance details and upstream references](docs/fixes/toolcall-hidden-respects-liveness.md).

a tool card is hidden when its call completes, even when its work is still running.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1344). Upstream: No direct PR reference in patcher entry.

## claude-turn-reports-activity

[Maintenance details and upstream references](docs/fixes/claude-turn-reports-activity.md).

the Claude provider never reports chat activity, so a silent turn looks dead.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1382). Upstream: No direct PR reference in patcher entry.

## activity-clears-when-the-turn-results

[Maintenance details and upstream references](docs/fixes/activity-clears-when-the-turn-results.md).

the liveness row needs a real end signal, not an empty queue.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1461). Upstream: No direct PR reference in patcher entry.

## turn-prune-anchor-missing-is-loud

[Maintenance details and upstream references](docs/fixes/turn-prune-anchor-missing-is-loud.md).

restoring a checkpoint at a turn with no database row silently prunes nothing.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1480). Upstream: No direct PR reference in patcher entry.

## router-drop-is-loud

[Maintenance details and upstream references](docs/fixes/router-drop-is-loud.md).

every SDK message with no resolvable turn id is discarded with no log at all.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1519). Upstream: No direct PR reference in patcher entry.

## slash-command-single-block

[Maintenance details and upstream references](docs/fixes/slash-command-single-block.md).

a slash command is never expanded because the host appends context as a second block.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1548). Upstream: No direct PR reference in patcher entry.

## session-chip-scope-v2

[Maintenance details and upstream references](docs/fixes/session-chip-scope-v2.md).

the session list chip counts the whole branch, not the session.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1587). Upstream: [#331345](https://github.com/microsoft/vscode/pull/331345).

## session-scope-counts-other-sessions-work

[Maintenance details and upstream references](docs/fixes/session-scope-counts-other-sessions-work.md).

a session is credited with every uncommitted change in the folder.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1613). Upstream: No direct PR reference in patcher entry.

## keyed-item-transient-empty

[Maintenance details and upstream references](docs/fixes/keyed-item-transient-empty.md).

a momentarily empty collection tears down live keyed items.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1666). Upstream: No direct PR reference in patcher entry.

## client-tool-stale-self-abort

[Maintenance details and upstream references](docs/fixes/client-tool-stale-self-abort.md).

a client tool abandons itself when only its label changes.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1689). Upstream: No direct PR reference in patcher entry.

## cold-chat-customizations

[Maintenance details and upstream references](docs/fixes/cold-chat-customizations.md).

a restored session has no slash commands until its next message.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1720). Upstream: No direct PR reference in patcher entry.

## subagent-spawn-turn

[Maintenance details and upstream references](docs/fixes/subagent-spawn-turn.md).

a spawned subagent does not record the turn that spawned it.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1765). Upstream: [#332075](https://github.com/microsoft/vscode/pull/332075).

## subagent-resume-anchor

[Maintenance details and upstream references](docs/fixes/subagent-resume-anchor.md).

nothing records the turn a parent will resume into after a subagent.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1784). Upstream: [#332075](https://github.com/microsoft/vscode/pull/332075).

## subagent-resumed-output

[Maintenance details and upstream references](docs/fixes/subagent-resumed-output.md).

everything the parent says after a background subagent finishes is dropped.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1799). Upstream: [#332075](https://github.com/microsoft/vscode/pull/332075).

## optimistic-turn-start-masks-streaming

[Maintenance details and upstream references](docs/fixes/optimistic-turn-start-masks-streaming.md).

responses appear only when the turn ends, never streaming.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1823). Upstream: No direct PR reference in patcher entry.

## chat-turnstarted-idempotent

[Maintenance details and upstream references](docs/fixes/chat-turnstarted-idempotent.md).

a replayed turn start keeps rebuilding the turn empty, so the response never streams.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1855). Upstream: No direct PR reference in patcher entry.

## truncation-retire-stranded

[Maintenance details and upstream references](docs/fixes/truncation-retire-stranded.md).

a stranded optimistic truncation is replayed forever and blanks the transcript.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L1903). Upstream: No direct PR reference in patcher entry.

## plugin-read-surface-errors

[Maintenance details and upstream references](docs/fixes/plugin-read-surface-errors.md).

a filesystem the host cannot address looks exactly like an absent file.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L1978). Upstream: No direct PR reference in patcher entry.

## client-tool-no-host-confirm

[Maintenance details and upstream references](docs/fixes/client-tool-no-host-confirm.md).

a client tool the workbench already confirmed is confirmed again by the host.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2045). Upstream: [#334037](https://github.com/microsoft/vscode/pull/334037), [#330683](https://github.com/microsoft/vscode/pull/330683).

## client-tool-ownerless-fail-map-start

[Maintenance details and upstream references](docs/fixes/client-tool-ownerless-fail-map-start.md).

the stream mapper does not record that a client tool call has no owner.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2097). Upstream: No direct PR reference in patcher entry.

## nested-subagent-spawn-recorded

[Maintenance details and upstream references](docs/fixes/nested-subagent-spawn-recorded.md).

a subagent spawned by another subagent never gets a chat, so its work never renders.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2138). Upstream: No direct PR reference in patcher entry.

## client-tool-ownerless-fail-map-stop

[Maintenance details and upstream references](docs/fixes/client-tool-ownerless-fail-map-stop.md).

a client tool call no window can run is never failed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2164). Upstream: No direct PR reference in patcher entry.

## client-tool-ownerless-fail-subagent

[Maintenance details and upstream references](docs/fixes/client-tool-ownerless-fail-subagent.md).

a subagent client tool call no window can run is never failed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2198). Upstream: No direct PR reference in patcher entry.

## client-tool-ownerless-fail-session

[Maintenance details and upstream references](docs/fixes/client-tool-ownerless-fail-session.md).

the SDK handler for a failed client tool call still parks forever.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2234). Upstream: No direct PR reference in patcher entry.

## client-tool-ownerless-fail-permission

[Maintenance details and upstream references](docs/fixes/client-tool-ownerless-fail-permission.md).

the SDK still asks permission for a client tool call already failed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2284). Upstream: [#334037](https://github.com/microsoft/vscode/pull/334037).

## remote-working-directory-actions

[Maintenance details and upstream references](docs/fixes/remote-working-directory-actions.md).

adding or removing a workspace folder from a container window is rejected by the host.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2320). Upstream: No direct PR reference in patcher entry.

## remote-folders-at-session-create

[Maintenance details and upstream references](docs/fixes/remote-folders-at-session-create.md).

a session created from the chat handler in a container window gets no working directories at all.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L2375). Upstream: No direct PR reference in patcher entry.

## subagent-observation-lifetime

[Maintenance details and upstream references](docs/fixes/subagent-observation-lifetime.md).

a subagent turn hangs forever when its chat outlives the turn that spawned it.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L2429). Upstream: No direct PR reference in patcher entry.

## steer-keeps-tool-attribution

[Maintenance details and upstream references](docs/fixes/steer-keeps-tool-attribution.md).

a tool still running when a steer lands never completes.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2513). Upstream: No direct PR reference in patcher entry.

## skill-subagent-result-visible

[Maintenance details and upstream references](docs/fixes/skill-subagent-result-visible.md).

a skill that runs in a subagent works for minutes and the turn renders empty.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2575). Upstream: No direct PR reference in patcher entry.

## queue-settles-by-correlation

[Maintenance details and upstream references](docs/fixes/queue-settles-by-correlation.md).

the queue drifts because one result settles one entry, however many it consumed.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2656). Upstream: No direct PR reference in patcher entry.

## clearpending-spares-background-subagent

[Maintenance details and upstream references](docs/fixes/clearpending-spares-background-subagent.md).

a background subagent loses its tool attribution at every parent turn end.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2710). Upstream: [#334559](https://github.com/microsoft/vscode/pull/334559).

## reap-orphaned-session-data

[Maintenance details and upstream references](docs/fixes/reap-orphaned-session-data.md).

a pruned external session leaves its data directory behind forever.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2738). Upstream: No direct PR reference in patcher entry.

## peer-chat-unavailable-subagent

[Maintenance details and upstream references](docs/fixes/peer-chat-unavailable-subagent.md).

one unresolvable subagent chat rejects every turn the session will ever start.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2777). Upstream: No direct PR reference in patcher entry.

## denied-subagent-no-phantom-chat

[Maintenance details and upstream references](docs/fixes/denied-subagent-no-phantom-chat.md).

a denied Agent call is still recorded as a subagent, creating a chat that can never exist.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2809). Upstream: No direct PR reference in patcher entry.

## codex-progress-not-output-host

[Maintenance details and upstream references](docs/fixes/codex-progress-not-output-host.md).

MCP progress narration is persisted as the tool result.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2830). Upstream: No direct PR reference in patcher entry.

## codex-progress-not-output-client

[Maintenance details and upstream references](docs/fixes/codex-progress-not-output-client.md).

a running MCP call shows no progress, and a stale one becomes its past-tense label.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L2888). Upstream: No direct PR reference in patcher entry.

## subscribe-cancelled-not-missing

[Maintenance details and upstream references](docs/fixes/subscribe-cancelled-not-missing.md).

a client cancelling a subscribe is reported as a missing resource, at error level.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L2970). Upstream: No direct PR reference in patcher entry.

## client-tool-handler-never-throws

[Maintenance details and upstream references](docs/fixes/client-tool-handler-never-throws.md).

a rejected client-tool wait escapes the MCP handler as a bare "Canceled".

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3042). Upstream: No direct PR reference in patcher entry.

## pending-register-shares-deferred

[Maintenance details and upstream references](docs/fixes/pending-register-shares-deferred.md).

a second wait on one pending request cancels the first waiter.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3095). Upstream: No direct PR reference in patcher entry.

## register-and-fire-reuses-parked

[Maintenance details and upstream references](docs/fixes/register-and-fire-reuses-parked.md).

a duplicate tool_use_id orphans the first request, which then never settles.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3137). Upstream: [#334146](https://github.com/microsoft/vscode/pull/334146).

## steering-list-reduce-set

[Maintenance details and upstream references](docs/fixes/steering-list-reduce-set.md).

a second steering message evicts the first from the sidebar.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3162). Upstream: [#334743](https://github.com/microsoft/vscode/pull/334743).

## steering-list-reduce-remove

[Maintenance details and upstream references](docs/fixes/steering-list-reduce-remove.md).

removing one steering message must not drop the others.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3193). Upstream: No direct PR reference in patcher entry.

## steering-list-turnstarted

[Maintenance details and upstream references](docs/fixes/steering-list-turnstarted.md).

a steering message auto-started as a turn must leave the list.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3212). Upstream: No direct PR reference in patcher entry.

## steering-list-merge

[Maintenance details and upstream references](docs/fixes/steering-list-merge.md).

the per-chat projection drops the steering list.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3232). Upstream: No direct PR reference in patcher entry.

## steering-list-projection

[Maintenance details and upstream references](docs/fixes/steering-list-projection.md).

only one steering bubble is projected into the chat model.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3246). Upstream: No direct PR reference in patcher entry.

## steering-list-removal-detect

[Maintenance details and upstream references](docs/fixes/steering-list-removal-detect.md).

the sidebar retires the previous steering bubble whenever the id changes.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3259). Upstream: No direct PR reference in patcher entry.

## activity-row-survives-content

[Maintenance details and upstream references](docs/fixes/activity-row-survives-content.md).

the liveness row disappears the moment a turn produces anything.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3277). Upstream: [#334742](https://github.com/microsoft/vscode/pull/334742).

## chat-input-default-permission-mode

[Maintenance details and upstream references](docs/fixes/chat-input-default-permission-mode.md).

every new chat-input session starts on Default approvals.

Target: **workbench**. [Patcher source](patch-vscode-fixes.mjs#L3307). Upstream: [#334814](https://github.com/microsoft/vscode/pull/334814), [#334087](https://github.com/microsoft/vscode/pull/334087).

## replay-keeps-local-command-output

[Maintenance details and upstream references](docs/fixes/replay-keeps-local-command-output.md).

a slash command's output is dropped on replay, so a restart empties the turn.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3345). Upstream: No direct PR reference in patcher entry.

## discovery-suppression-loud

[Maintenance details and upstream references](docs/fixes/discovery-suppression-loud.md).

discovery suppresses two thirds of sessions and never says which are which.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3382). Upstream: No direct PR reference in patcher entry.

## stale-peer-chat-backing-ignored

[Maintenance details and upstream references](docs/fixes/stale-peer-chat-backing-ignored.md).

a session that once had a peer chat is hidden from the list forever.

Target: **agenthost**. [Patcher source](patch-vscode-fixes.mjs#L3411). Upstream: No direct PR reference in patcher entry.

## model-host-labels

Distinguish local and remote model registrations and provider error groups in Manage Language Models. Status-only groups retain host labels and session identity. [Build-specific installer, revision upgrade, and rollback](model-host-labels/README.md). [PR #335363](https://github.com/microsoft/vscode/pull/335363).

## codex-steering-resolved-input

[Maintenance details](docs/fixes/codex-steering-resolved-input.md).

Steering with attached context remains pending after Codex consumes it. Match acknowledgements against the resolved input actually sent while preserving the original displayed message.

Target: **agenthost**. Tested on VS Code 1.137.0 build `645f29cc31`; this does not establish compatibility of the other entries with that build. See [validation](VALIDATION.md).
