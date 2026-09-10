# Individual patch documentation

One page per maintained patcher entry. The tracker is [microsoft/vscode#333174](https://github.com/microsoft/vscode/issues/333174). [Issue and PR relationship index](../UPSTREAM.md).

| Patch | Target | Purpose |
|---|---|---|
| [`client-tool-input-schema`](client-tool-input-schema.md) | workbench | a client tool runs with empty input when its arguments never streamed |
| [`session-list`](session-list.md) | workbench | sessions never list in remote windows |
| [`session-list-remote-project-root`](session-list-remote-project-root.md) | workbench | a legacy session whose project root is on the remote is dropped from the list |
| [`embedded-attachment-content-type`](embedded-attachment-content-type.md) | workbench | a pasted image renders as a broken thumbnail |
| [`client-tool-buffer`](client-tool-buffer.md) | agenthost | a client tool result is dropped when it arrives before the SDK asks for it |
| [`client-tool-error`](client-tool-error.md) | agenthost | a client tool error reaches the model as an empty result |
| [`replay-args`](replay-args.md) | agenthost | client tool MCP handler forwards tool name and args |
| [`replay-route`](replay-route.md) | agenthost | client tool wiring routes through the replay-aware awaiter |
| [`replay-turnid`](replay-turnid.md) | agenthost | session stashes the active turn id |
| [`replay-seen`](replay-seen.md) | agenthost | session records which tool calls actually streamed, and under which turn |
| [`replay-drive`](replay-drive.md) | agenthost | drive execution for a replayed (never-streamed) client tool call |
| [`steering-pending`](steering-pending.md) | agenthost | the pipeline only receives the steering id, not the message |
| [`steering-buffer`](steering-buffer.md) | agenthost | a steering message is forgotten once it is queued |
| [`steering-hold`](steering-hold.md) | agenthost | the pending bubble is cleared when the queue hands the message over |
| [`steering-promote`](steering-promote.md) | agenthost | a steering message never becomes its own turn |
| [`steering-drain`](steering-drain.md) | agenthost | a steering message the SDK never echoes leaves its bubble behind on abort |
| [`client-tool-single-trigger`](client-tool-single-trigger.md) | agenthost | a client tool executes off the streamed ready rather than the runtime invocation |
| [`session-chip-list-scope`](session-chip-list-scope.md) | agenthost | the session list re-derives the chip from the branch for inactive sessions |
| [`slash-resolve-harness`](slash-resolve-harness.md) | workbench | a message containing a slash command never submits in a remote window |
| [`slash-resolve-prompts`](slash-resolve-prompts.md) | workbench | the prompts service resolver rejects on an unreadable slash command |
| [`slash-consumer-sessions`](slash-consumer-sessions.md) | workbench | the session send path dereferences a prompt file that may be absent |
| [`slash-consumer-widget`](slash-consumer-widget.md) | workbench | the chat widget dereferences a prompt file that may be absent |
| [`slash-consumer-widget-header`](slash-consumer-widget-header.md) | workbench | the chat widget applies header metadata from an absent prompt file |
| [`client-tool-owner-recency`](client-tool-owner-recency.md) | agenthost | a tool call is stamped with a client that has gone away |
| [`native-model-vision`](native-model-vision.md) | agenthost | a pasted image is labelled unsupported though the model receives it |
| [`consumed-message-not-removed`](consumed-message-not-removed.md) | workbench | a queued message the host consumed is retired as cancelled |
| [`consumed-message-settles-sent`](consumed-message-settles-sent.md) | workbench | a consumed queued message never resolves its send promise |
| [`consumed-message-sync-reconcile`](consumed-message-sync-reconcile.md) | workbench | reconciliation cancels the consumed message and settles nothing |
| [`consumed-message-sync-arg`](consumed-message-sync-arg.md) | workbench | reconciliation is not told which message the host consumed |
| [`steer-preempt-not-error`](steer-preempt-not-error.md) | agenthost | a turn interrupted by a steer renders as failed |
| [`toolcall-progress-emit`](toolcall-progress-emit.md) | agenthost | a long tool call reports nothing while it runs |
| [`toolcall-progress-reduce`](toolcall-progress-reduce.md) | workbench | the client has nowhere to record tool call progress |
| [`toolcall-progress-reduce-host`](toolcall-progress-reduce-host.md) | agenthost | the agent host does not know the progress action either |
| [`toolcall-progress-render`](toolcall-progress-render.md) | workbench | a running tool call renders no progress |
| [`session-delete`](session-delete.md) | agenthost | deleting a Claude session does not delete the transcript |
| [`remote-window-authority-init`](remote-window-authority-init.md) | workbench | the in-window agent host claims to be local in a remote window |
| [`remote-window-authority-fs`](remote-window-authority-fs.md) | workbench | the agent host filesystem registers under the local authority |
| [`remote-window-authority-session`](remote-window-authority-session.md) | workbench | the session handler is told the host is local |
| [`remote-window-authority-map`](remote-window-authority-map.md) | workbench | agent host file paths are handed to the client unmapped |
| [`workspace-folder-uses-real-remote`](workspace-folder-uses-real-remote.md) | workbench | opening a session folder yields a window that can resolve nothing |
| [`session-workspace-folder-real-remote`](session-workspace-folder-real-remote.md) | workbench | a session workspace keeps the agent host authority its folders cannot resolve |
| [`subagent-completion-when-idle`](subagent-completion-when-idle.md) | agenthost | a background subagent that finishes after its turn stays running |
| [`sdk-initiated-turn`](sdk-initiated-turn.md) | agenthost | the SDK starts a turn the host never queued, so everything in it is discarded |
| [`subagent-inactive-resume`](subagent-inactive-resume.md) | agenthost | a running subagent produces output that is discarded once its chat has no active turn |
| [`replay-user-prompt-only`](replay-user-prompt-only.md) | agenthost | restored messages show context the user never typed |
| [`local-command-output-visible`](local-command-output-visible.md) | agenthost | a local slash command runs, produces output, and the turn renders empty |
| [`agenthost-require-global`](agenthost-require-global.md) | agenthost | the bundle is ESM, so later entries have no require for node builtins |
| [`resume-missing-conversation-starts-fresh`](resume-missing-conversation-starts-fresh.md) | agenthost | cancelling a skill-subagent turn bricks a new chat permanently |
| [`result-error-subtypes-surface`](result-error-subtypes-surface.md) | agenthost | hitting a turn, budget or retry cap renders as a successful empty turn |
| [`result-usage-any-subtype`](result-usage-any-subtype.md) | agenthost | a turn that stops at a cap reports none of the tokens it spent |
| [`toolcall-hidden-respects-liveness`](toolcall-hidden-respects-liveness.md) | workbench | a tool card is hidden when its call completes, even when its work is still running |
| [`claude-turn-reports-activity`](claude-turn-reports-activity.md) | agenthost | the Claude provider never reports chat activity, so a silent turn looks dead |
| [`activity-clears-when-the-turn-results`](activity-clears-when-the-turn-results.md) | agenthost | the liveness row needs a real end signal, not an empty queue |
| [`turn-prune-anchor-missing-is-loud`](turn-prune-anchor-missing-is-loud.md) | agenthost | restoring a checkpoint at a turn with no database row silently prunes nothing |
| [`router-drop-is-loud`](router-drop-is-loud.md) | agenthost | every SDK message with no resolvable turn id is discarded with no log at all |
| [`slash-command-single-block`](slash-command-single-block.md) | agenthost | a slash command is never expanded because the host appends context as a second block |
| [`session-chip-scope-v2`](session-chip-scope-v2.md) | agenthost | the session list chip counts the whole branch, not the session |
| [`session-scope-counts-other-sessions-work`](session-scope-counts-other-sessions-work.md) | agenthost | a session is credited with every uncommitted change in the folder |
| [`keyed-item-transient-empty`](keyed-item-transient-empty.md) | workbench | a momentarily empty collection tears down live keyed items |
| [`client-tool-stale-self-abort`](client-tool-stale-self-abort.md) | workbench | a client tool abandons itself when only its label changes |
| [`cold-chat-customizations`](cold-chat-customizations.md) | agenthost | a restored session has no slash commands until its next message |
| [`subagent-spawn-turn`](subagent-spawn-turn.md) | agenthost | a spawned subagent does not record the turn that spawned it |
| [`subagent-resume-anchor`](subagent-resume-anchor.md) | agenthost | nothing records the turn a parent will resume into after a subagent |
| [`subagent-resumed-output`](subagent-resumed-output.md) | agenthost | everything the parent says after a background subagent finishes is dropped |
| [`optimistic-turn-start-masks-streaming`](optimistic-turn-start-masks-streaming.md) | workbench | responses appear only when the turn ends, never streaming |
| [`chat-turnstarted-idempotent`](chat-turnstarted-idempotent.md) | workbench | a replayed turn start keeps rebuilding the turn empty, so the response never streams |
| [`truncation-retire-stranded`](truncation-retire-stranded.md) | workbench | a stranded optimistic truncation is replayed forever and blanks the transcript |
| [`plugin-read-surface-errors`](plugin-read-surface-errors.md) | agenthost | a filesystem the host cannot address looks exactly like an absent file |
| [`client-tool-no-host-confirm`](client-tool-no-host-confirm.md) | agenthost | a client tool the workbench already confirmed is confirmed again by the host |
| [`client-tool-ownerless-fail-map-start`](client-tool-ownerless-fail-map-start.md) | agenthost | the stream mapper does not record that a client tool call has no owner |
| [`nested-subagent-spawn-recorded`](nested-subagent-spawn-recorded.md) | agenthost | a subagent spawned by another subagent never gets a chat, so its work never renders |
| [`client-tool-ownerless-fail-map-stop`](client-tool-ownerless-fail-map-stop.md) | agenthost | a client tool call no window can run is never failed |
| [`client-tool-ownerless-fail-subagent`](client-tool-ownerless-fail-subagent.md) | agenthost | a subagent client tool call no window can run is never failed |
| [`client-tool-ownerless-fail-session`](client-tool-ownerless-fail-session.md) | agenthost | the SDK handler for a failed client tool call still parks forever |
| [`client-tool-ownerless-fail-permission`](client-tool-ownerless-fail-permission.md) | agenthost | the SDK still asks permission for a client tool call already failed |
| [`remote-working-directory-actions`](remote-working-directory-actions.md) | agenthost | adding or removing a workspace folder from a container window is rejected by the host |
| [`remote-folders-at-session-create`](remote-folders-at-session-create.md) | workbench | a session created from the chat handler in a container window gets no working directories at all |
| [`subagent-observation-lifetime`](subagent-observation-lifetime.md) | workbench | a subagent turn hangs forever when its chat outlives the turn that spawned it |
| [`steer-keeps-tool-attribution`](steer-keeps-tool-attribution.md) | agenthost | a tool still running when a steer lands never completes |
| [`skill-subagent-result-visible`](skill-subagent-result-visible.md) | agenthost | a skill that runs in a subagent works for minutes and the turn renders empty |
| [`queue-settles-by-correlation`](queue-settles-by-correlation.md) | agenthost | the queue drifts because one result settles one entry, however many it consumed |
| [`clearpending-spares-background-subagent`](clearpending-spares-background-subagent.md) | agenthost | a background subagent loses its tool attribution at every parent turn end |
| [`reap-orphaned-session-data`](reap-orphaned-session-data.md) | agenthost | a pruned external session leaves its data directory behind forever |
| [`peer-chat-unavailable-subagent`](peer-chat-unavailable-subagent.md) | agenthost | one unresolvable subagent chat rejects every turn the session will ever start |
| [`denied-subagent-no-phantom-chat`](denied-subagent-no-phantom-chat.md) | agenthost | a denied Agent call is still recorded as a subagent, creating a chat that can never exist |
| [`codex-progress-not-output-host`](codex-progress-not-output-host.md) | agenthost | MCP progress narration is persisted as the tool result |
| [`codex-progress-not-output-client`](codex-progress-not-output-client.md) | workbench | a running MCP call shows no progress, and a stale one becomes its past-tense label |
| [`subscribe-cancelled-not-missing`](subscribe-cancelled-not-missing.md) | agenthost | a client cancelling a subscribe is reported as a missing resource, at error level |
| [`client-tool-handler-never-throws`](client-tool-handler-never-throws.md) | agenthost | a rejected client-tool wait escapes the MCP handler as a bare "Canceled" |
| [`pending-register-shares-deferred`](pending-register-shares-deferred.md) | agenthost | a second wait on one pending request cancels the first waiter |
| [`register-and-fire-reuses-parked`](register-and-fire-reuses-parked.md) | agenthost | a duplicate tool_use_id orphans the first request, which then never settles |
| [`steering-list-reduce-set`](steering-list-reduce-set.md) | workbench | a second steering message evicts the first from the sidebar |
| [`steering-list-reduce-remove`](steering-list-reduce-remove.md) | workbench | removing one steering message must not drop the others |
| [`steering-list-turnstarted`](steering-list-turnstarted.md) | workbench | a steering message auto-started as a turn must leave the list |
| [`steering-list-merge`](steering-list-merge.md) | workbench | the per-chat projection drops the steering list |
| [`steering-list-projection`](steering-list-projection.md) | workbench | only one steering bubble is projected into the chat model |
| [`steering-list-removal-detect`](steering-list-removal-detect.md) | workbench | the sidebar retires the previous steering bubble whenever the id changes |
| [`activity-row-survives-content`](activity-row-survives-content.md) | workbench | the liveness row disappears the moment a turn produces anything |
| [`chat-input-default-permission-mode`](chat-input-default-permission-mode.md) | workbench | every new chat-input session starts on Default approvals |
| [`replay-keeps-local-command-output`](replay-keeps-local-command-output.md) | agenthost | a slash command's output is dropped on replay, so a restart empties the turn |
| [`discovery-suppression-loud`](discovery-suppression-loud.md) | agenthost | discovery suppresses two thirds of sessions and never says which are which |
| [`stale-peer-chat-backing-ignored`](stale-peer-chat-backing-ignored.md) | agenthost | a session that once had a peer chat is hidden from the list forever |
| [`codex-steering-resolved-input`](codex-steering-resolved-input.md) | agenthost | steering with attached context stays pending after Codex consumes it |
