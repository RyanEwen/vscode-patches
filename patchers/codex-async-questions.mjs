import { createAsyncQuestionsController } from './codex-async-questions-runtime.mjs';

export const marker = '__codexAsyncQuestionsV2';

/** Requires each build-specific anchor exactly once before modifying any bytes. */
function unique(text, expression, label) {
	const matches = [...text.matchAll(new RegExp(expression.source, 'g'))];
	if (matches.length !== 1) {
		throw new Error(`Async questions: expected one ${label}, found ${matches.length}`);
	}
	return matches[0];
}

/** Backports the source controller to inspected VS Code 1.137.0 agent-host bundles. */
export function transformCodexAsyncQuestions(text) {
	if (text.includes('__codexAsyncQuestionsV1')) {
		if (text.includes(marker)) {
			throw new Error('Async questions: mixed revision markers');
		}
		unique(text, /function __codexAsyncQuestionsV1\(/, 'previous revision');
		unique(text, /await this\.host\.send\(text\);/, 'previous delivery');
		unique(text, /session\.asyncQuestions\?\.turnStarted\(result\.turn\.id\);/, 'previous acknowledgement');
		text = text.replace('await this.host.send(text);', 'const turnId = await this.host.send(text); if (generation === this.generation) { this.turnStarted(turnId); }');
		text = text.replace('session.asyncQuestions?.turnStarted(result.turn.id);', 'return result.turn.id;');
		return transformCodexAsyncQuestions(text.replaceAll('__codexAsyncQuestionsV1', marker));
	}
	if (text.includes(marker)) {
		if (text.split(`function ${marker}(`).length !== 2 || !text.includes('_getAsyncQuestions(session)') || !text.includes('asyncQuestions?.whenIdle()')) {
			throw new Error('Async questions: incomplete or duplicate patch marker');
		}
		return text;
	}
	const started = unique(text, /_handleItemStarted\((\w+),(\w+)\)\{return \2\.item\.type==="userMessage"\?this\._handleSteeredUserMessage\(\1,\2\.item\.content\):/, 'item handler');
	const turnStarted = unique(text, /_handleTurnStartedNotification\((\w+),(\w+)\)\{/, 'turn start');
	const completed = unique(text, /_handleTurnCompletedNotification\((\w+),(\w+)\)\{/, 'turn completion');
	const rpc = unique(text, /let (\w+)=(\w+)\(\),(\w+)=(\w+)\(\1,(\w+)\.questions\);try\{let \w+=await \w+\.pendingUserInputs\.registerAndFire/, 'question builder');
	const flatten = unique(text, /function (\w+)\(\w+,\w+\)\{if\(\w+!=="accept"\|\|!\w+\|\|\w+\.state==="skipped"\)return\[\];/, 'answer mapper');
	const respond = unique(text, /respondToUserInputRequest\((\w+),(\w+),(\w+)\)\{for\(let (\w+) of this\._sessions\.values\(\)\)if\(\4\.pendingUserInputs\.respond/, 'answer routing');
	const stop = unique(text, /if\(!(\w+)\|\|\(this\._drainPendingSteering\(\1\),!\1\.currentAppTurnId\|\|\1\.threadId===void 0\)\)return;/, 'stop routing');
	const send = unique(text, /throw new Error\(`Codex session not found:[^`]+`\);\}?(let \w+=\w+\?\.configurationResource\?\?\w+;)/, 'new user prompt');
	const sendSession = /sessionIdByChatUri\.get\([^)]*\)[\s\S]*?sessions=\$\{\[\.\.\.this\._sessions\.keys\(\)\]/.test(send[0]);
	if (!sendSession) {
		throw new Error('Async questions: unsupported session lookup');
	}
	const sendPrefix = text.slice(Math.max(0, send.index - 180), send.index);
	const session = sendPrefix.match(/,(\w+)=this\._sessions\.get\(\w+\);if\(!\1\)$/)?.[1];
	if (!session) {
		throw new Error('Async questions: cannot identify prompt session');
	}
	const steering = unique(text, /return (\w+)\?this\._beginSteeringTurn\((\w+),\1\):\[\]/, 'manual steering');
	const cleanup = [...text.matchAll(/([\w.]+)\.pendingUserInputs\.rejectAll\(new \w+(?:\(\))?\)/g)];
	if (cleanup.length !== 5) {
		throw new Error(`Async questions: expected five disposal paths, found ${cleanup.length}`);
	}
	let getter = GETTER.replaceAll('$uuid', rpc[2]).replaceAll('$builder', rpc[4]).replaceAll('$answers', flatten[1]);
	text = text.replace(started[0], `${getter}${started[0].replace('{return ', `{if(${started[2]}.item.type==="agentMessage"&&${started[2]}.item.delivery==="async"&&${started[2]}.item.questions?.length){this._getAsyncQuestions(${started[1]}).ask(${started[2]}.item.id,${started[2]}.item.questions);return []}return `)}`);
	text = text.replace(turnStarted[0], `${turnStarted[0]}${turnStarted[1]}.asyncQuestions?.turnStarted(${turnStarted[2]}.turn.id);`);
	text = text.replace(completed[0], `${completed[0]}if(${completed[1]}.asyncQuestions?.holdCompletion(${completed[2]}))return [];`);
	text = text.replace(respond[0], respond[0].replace(`if(${respond[4]}.pendingUserInputs`, `if(${respond[4]}.asyncQuestions?.respond(${respond[1]},${respond[2]},${respond[3]})||${respond[4]}.pendingUserInputs`));
	const owner = stop[1];
	text = text.replace(stop[0], `if(!${owner})return;const asyncCompletion=${owner}.asyncQuestions?.clear();await ${owner}.asyncQuestions?.whenIdle();${owner}.asyncQuestions?.clear();if(asyncCompletion&&${owner}.currentAppTurnId===asyncCompletion.turn.id){for(const action of this._handleTurnCompletedNotification(${owner},{...asyncCompletion,turn:{...asyncCompletion.turn,status:"interrupted"}}))this._fire(${owner}.sessionUri,action);return}this._drainPendingSteering(${owner});if(!${owner}.currentAppTurnId||${owner}.threadId===void 0)return;`);
	text = text.replace(send[0], send[0].replace(send[1], `${session}.asyncQuestions?.clear();${send[1]}`));
	text = text.replace(steering[0], `return ${steering[1]}?(${steering[2]}.asyncQuestions?.clear(),this._beginSteeringTurn(${steering[2]},${steering[1]})):[]`);
	text = text.replace(/([\w.]+)\.pendingUserInputs\.rejectAll\(new \w+(?:\(\))?\)/g, (match, owner) => `(${owner}.asyncQuestions?.clear(),${match})`);
	return `${createAsyncQuestionsController.toString().replace('createAsyncQuestionsController', marker)}\n${text}`;
}

const GETTER = "\n    _getAsyncQuestions(session) {\n        return session.asyncQuestions ??= new (__codexAsyncQuestionsV2({ generateUuid: $uuid, buildUserInputRequest: $builder, answerStrings: $answers }))({\n            show: request => this._fire(session.sessionUri, { type: \"chat/inputRequested\", request }),\n            cancel: requestId => this._fire(session.sessionUri, { type: \"chat/inputCompleted\", requestId, response: \"cancel\" }),\n            send: async (text) => {\n                const connection = this._connection;\n                if (connection.kind !== 'ready' || !session.threadId) {\n                    throw new Error('Codex connection is unavailable');\n                }\n                // Native turn/start steers an active turn or starts a continuation with sticky thread settings.\n                const result = await connection.client.request('turn/start', {\n                    threadId: session.threadId,\n                    input: [{ type: 'text', text, text_elements: [] }],\n                }, this._traceContext(session));\n                // The RPC response may arrive before the turn/started notification.\n                return result.turn.id;\n            },\n            finish: completion => {\n                for (const action of this._handleTurnCompletedNotification(session, completion)) {\n                    this._fire(session.sessionUri, action);\n                }\n            },\n            reportError: error => this._logService.warn('[Codex] Failed to deliver asynchronous question answer; reopening questions', error),\n        });\n    }\n";
