// Editor-window backport of microsoft/vscode#336430 for inspected 1.137.0 bundles.
export const marker = '__ahFeedbackReviewV1';

/** Builds the contribution without starting the host until a command is invoked. */
export function createFeedbackReviewContribution({ Disposable, CancellationTokenSource, commands, connectionsId, editorId, URI }) {
	const key = 'vscode.agentFeedback';
	const prefix = '_agentFeedbackReview.';

	/** Validates feedback metadata before displaying or mutating an annotation. */
	function metadata(annotation) {
		const value = annotation._meta?.[key];
		if (!value || typeof value !== 'object' || Array.isArray(value)
			|| !['user', 'codeReview', 'prReview'].includes(value.kind)
			|| !['created', 'accepted', 'submitted', 'resolved'].includes(value.state)
			|| typeof value.sessionResource !== 'string') {
			return undefined;
		}
		return value;
	}

	function reviewable(annotation) {
		const meta = metadata(annotation);
		return !!meta && annotation.entries.length > 0
			&& ['codeReview', 'prReview'].includes(meta.kind)
			&& ((!annotation.resolved && meta.state === 'created') || meta.pendingAgentReveal === true);
	}

	/** Waits for a snapshot, releasing every listener on success, error or cancellation. */
	async function hydrate(subscription, token) {
		const listeners = [];
		try {
			return await new Promise((resolve, reject) => {
				const check = () => {
					if (token.isCancellationRequested) {
						reject(new Error('Canceled'));
					} else if (subscription.value instanceof Error) {
						reject(subscription.value);
					} else if (subscription.value !== undefined) {
						resolve(subscription.value);
					}
				};
				listeners.push(subscription.onDidChange(check));
				if (subscription.onDidError) {
					listeners.push(subscription.onDidError(check));
				}
				listeners.push(token.onCancellationRequested(check));
				check();
			});
		} finally {
			for (const listener of listeners) {
				listener.dispose();
			}
		}
	}

	return class extends Disposable {
		static ID = 'workbench.contrib.agentHostFeedbackReviewCommands';
		constructor() {
			super();
			this.cancellation = new CancellationTokenSource();
			this._register({ dispose: () => this.cancellation.dispose(true) });
			for (const command of ['getComments', 'reveal', 'delete', 'accept']) {
				if (commands.getCommand(prefix + command)) {
					throw new Error('Feedback review command already registered: ' + command);
				}
				this._register(commands.registerCommand(prefix + command, (accessor, resource, selection) =>
					this.run(accessor, resource, command, selection)));
			}
		}

		/** Resolves the owning host and holds its annotation reference through the command. */
		async run(accessor, resource, command, selection) {
			const resolved = accessor.get(connectionsId).resolveSessionResource(URI.revive(resource));
			if (!resolved) {
				throw new Error('The review comment host is not connected');
			}
			const connection = resolved.connection;
			const channel = resolved.backendSession.toString() + '/annotations';
			const ref = connection.getSubscription('annotations', URI.parse(channel), this.constructor.ID);
			const cancellation = new CancellationTokenSource(this.cancellation.token);
			try {
				const state = await hydrate(ref.object, cancellation.token);
				if (cancellation.token.isCancellationRequested) {
					throw new Error('Canceled');
				}
				return await this.execute(accessor, state, connection, channel, command, selection);
			} finally {
				cancellation.dispose(true);
				ref.dispose();
			}
		}

		/** Performs only the selected feedback operation against hydrated state. */
		async execute(accessor, state, connection, channel, command, selection) {
			const annotations = state.annotations.filter(reviewable);
			if (command === 'getComments') {
				return annotations.map(annotation => ({
					id: annotation.id,
					text: annotation.entries.map(entry => typeof entry.text === 'string' ? entry.text : entry.text.markdown).join('\n\n'),
					fileUri: connection.resourceUris.fromAgentHost(URI.parse(annotation.resource)),
					kindLabel: metadata(annotation).kind === 'prReview' ? 'PR Review' : 'Agent Review',
				}));
			}
			if (command === 'accept') {
				const selected = new Set(selection);
				if (!selected.size || [...selected].some(id => !annotations.some(item => item.id === id))) {
					throw new Error('Selected review comments are no longer available');
				}
				for (const annotation of annotations) {
					const meta = metadata(annotation);
					const reveal = selected.has(annotation.id);
					if (reveal || meta.pendingAgentReveal) {
						connection.dispatch(channel, {
							type: 'annotations/set',
							annotation: { ...annotation, _meta: { ...annotation._meta, [key]: { ...meta, state: reveal ? 'accepted' : meta.state, pendingAgentReveal: reveal } } },
						});
					}
				}
				return;
			}
			const annotation = annotations.find(item => item.id === selection);
			if (command === 'delete') {
				if (annotation) {
					connection.dispatch(channel, { type: 'annotations/removed', annotationId: selection });
				}
				return;
			}
			if (!annotation) {
				throw new Error('Review comment is no longer available');
			}
			const range = annotation.range;
			await accessor.get(editorId).openEditor({
				resource: connection.resourceUris.fromAgentHost(URI.parse(annotation.resource)),
				options: { selection: range ? {
					startLineNumber: range.start.line + 1, startColumn: range.start.character + 1,
					endLineNumber: range.end.line + 1, endColumn: range.end.character + 1,
				} : undefined },
			});
		}
	};
}

/** Refuses missing or ambiguous structural anchors rather than guessing minified names. */
function unique(text, expression, label) {
	const matches = [...text.matchAll(new RegExp(expression.source, 'g'))];
	if (matches.length !== 1) {
		throw new Error(`Feedback review: expected one ${label}, found ${matches.length}`);
	}
	return matches[0];
}

/** Returns a guarded, idempotent editor-bundle transformation; the caller owns backups and writes. */
export function transformAgentFeedbackReview(text) {
	if (text.includes(marker)) {
		if (text.split(marker).length !== 2) { throw new Error('Feedback review: expected one backport marker'); }
		if (!text.includes('completed-feedback-review-backport') || !text.includes('Could not load review comments. Cancel this request and try again.')) {
			throw new Error('Incomplete feedback review backport');
		}
		return text;
	}
	const gate = unique(text, /var ([\w$]+)=class extends ([\w$]+)\{static\{this.ID="workbench.contrib.chat.agentHostLegacyMigrationGate"\}/, 'editor contribution');
	const registration = unique(text, new RegExp(`([\\w$]+)\\(${gate[1]}\\.ID,${gate[1]},([\\w$]+)\\.BlockStartup\\);`), 'startup registration');
	const connections = unique(text, /([\w$]+)=[\w$]+\("agentHostConnectionsService"\)/, 'connections service');
	const editor = unique(text, /([\w$]+)=[\w$]+\("editorService"\)/, 'editor service');
	const commands = unique(text, /([\w$]+)\.registerCommand\("noop"/, 'command registry');
	const cancellation = unique(text, /([\w$]+)=class\{constructor\([\w$]+\)\{this\._token=void 0;this\._parentListener=void 0;/, 'cancellation source');
	const row = unique(text, /_renderRow\(([\w$]+),([\w$]+)\)\{let [\s\S]*?let ([\w$]+)=([\w$]+)\.revive\(\2\.fileUri\)/, 'comment URI mapping');
	const ariaStart = text.indexOf('className="monaco-aria-container"');
	if (ariaStart < 0) { throw new Error('Feedback review: missing ARIA infrastructure'); }
	const aria = unique(text.slice(ariaStart, ariaStart + 1800), /\.appendChild\([\w$]+\)\}function ([\w$]+)\(([\w$]+)\)\{[\w$]+&&\([\w$]+\.textContent!==\2\?/, 'ARIA alert');
	const populate = unique(text, /async _populate\(([\w$]+)\)\{let ([\w$]+)=\[\];try\{\2=await this\.commandService\.executeCommand\("_agentFeedbackReview.getComments",this\._sessionResource\)\?\?\[\]\}catch\(([\w$]+)\)\{this\.logService\.warn\("\[AgentFeedbackReview\] Failed to fetch unreviewed comments",\3\)\}/, 'loading error handler');
	const dom = unique(text.slice(populate.index + populate[0].length, populate.index + populate[0].length + 300), /\.append\(([\w$]+)\("\.chat-agent-feedback-review-empty"/, 'empty state builder');
	const factory = `(${createFeedbackReviewContribution.toString()})({Disposable:${gate[2]},CancellationTokenSource:${cancellation[1]},commands:${commands[1]},connectionsId:${connections[1]},editorId:${editor[1]},URI:${row[4]}})`;
	const injection = `/*${marker}*/{const contribution=${factory};${registration[1]}(contribution.ID,contribution,${registration[2]}.BlockStartup);}/*completed-feedback-review-backport*/`;
	const error = `if(!this._store.isDisposed){const message="Could not load review comments. Cancel this request and try again.";${populate[1]}.append(${dom[1]}(".chat-agent-feedback-review-empty",void 0,message));${aria[1]}(message);}return;`;
	return text.replace(populate[0], populate[0].slice(0, -1) + ';' + error + '}').replace(registration[0], injection + registration[0]);
}
