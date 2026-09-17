// Retired initial async-question revision; retained for reproducibility.
// Generated from the maintained VS Code source patch. Keep behavior and tests aligned.
export function createAsyncQuestionsController({ generateUuid, buildUserInputRequest, answerStrings }) {
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/** Keeps question controls alive until answered without blocking Codex's native turn. */
return class CodexAsyncQuestions {
    host;
    requests = new Map();
    seen = new Set();
    completion;
    sending = 0;
    deliveries = new Set();
    generation = 0;
    constructor(host) {
        this.host = host;
    }
    /** Publishes one carousel per item; replayed start events cannot ask twice. */
    ask(itemId, questions) {
        if (!questions.length || this.seen.has(itemId)) {
            return;
        }
        this.seen.add(itemId);
        this.show(questions);
    }
    show(questions) {
        const id = generateUuid();
        this.requests.set(id, questions);
        this.host.show(buildUserInputRequest(id, questions.map((question, index) => ({
            id: String(index), header: '', question: question.title, isOther: true, isSecret: false,
            options: question.options?.map(label => ({ label, description: '' })) ?? null,
        }))));
    }
    /** A new native turn supersedes a held completion, retaining outstanding questions. */
    turnStarted(turnId) {
        if (this.completion?.turn.id !== turnId) {
            this.completion = undefined;
        }
    }
    /** Hold only successful completion so the existing active-turn carousel stays usable. */
    holdCompletion(completion) {
        if (completion.turn.status === 'completed' && (this.requests.size > 0 || this.sending > 0)) {
            this.completion = completion;
            return true;
        }
        this.clear();
        return false;
    }
    /** Consumes explicit answers; skipping never submits a suggested option. */
    respond(id, response, answers) {
        const questions = this.requests.get(id);
        if (!questions) {
            return false;
        }
        this.requests.delete(id);
        const text = questions.flatMap((question, index) => {
            const values = answerStrings(answers?.[String(index)], response);
            if (!values.length) {
                return [];
            }
            const title = Array.from(question.title).slice(0, 512).join('').replace(/[\r\n]/g, ' ');
            return [`> ${title}\n\n${values.join('\n')}`];
        }).join('\n\n');
        if (text) {
            const delivery = this.deliver(questions, text);
            this.deliveries.add(delivery);
            void delivery.finally(() => this.deliveries.delete(delivery));
        }
        else {
            this.flush();
        }
        return true;
    }
    /** Failed delivery reopens the questions instead of silently losing an accepted answer. */
    async deliver(questions, text) {
        const generation = this.generation;
        this.sending++;
        try {
            await this.host.send(text);
        }
        catch (error) {
            if (generation === this.generation) {
                this.host.reportError(error);
                this.show(questions);
            }
        }
        finally {
            if (generation === this.generation) {
                this.sending--;
                this.flush();
            }
        }
    }
    flush() {
        if (this.requests.size === 0 && this.sending === 0 && this.completion) {
            const completion = this.completion;
            this.completion = undefined;
            this.host.finish(completion);
        }
    }
    /** Waits for already-sent RPCs so Stop can interrupt the actual continuation turn. */
    async whenIdle() {
        await Promise.all(this.deliveries);
    }
    /** Cancels stale controls and invalidates in-flight callbacks on stop, replacement or disposal. */
    clear() {
        const completion = this.completion;
        this.completion = undefined;
        this.generation++;
        this.sending = 0;
        const ids = [...this.requests.keys()];
        this.requests.clear();
        this.seen.clear();
        for (const id of ids) {
            this.host.cancel(id);
        }
        return completion;
    }
}

}


export const marker = '__codexAsyncQuestionsV1';

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

const GETTER = "\n    _getAsyncQuestions(session) {\n        return session.asyncQuestions ??= new (__codexAsyncQuestionsV1({ generateUuid: $uuid, buildUserInputRequest: $builder, answerStrings: $answers }))({\n            show: request => this._fire(session.sessionUri, { type: \"chat/inputRequested\", request }),\n            cancel: requestId => this._fire(session.sessionUri, { type: \"chat/inputCompleted\", requestId, response: \"cancel\" }),\n            send: async (text) => {\n                const connection = this._connection;\n                if (connection.kind !== 'ready' || !session.threadId) {\n                    throw new Error('Codex connection is unavailable');\n                }\n                // Native turn/start steers an active turn or starts a continuation with sticky thread settings.\n                const result = await connection.client.request('turn/start', {\n                    threadId: session.threadId,\n                    input: [{ type: 'text', text, text_elements: [] }],\n                }, this._traceContext(session));\n                // The RPC response may arrive before the turn/started notification.\n                session.asyncQuestions?.turnStarted(result.turn.id);\n            },\n            finish: completion => {\n                for (const action of this._handleTurnCompletedNotification(session, completion)) {\n                    this._fire(session.sessionUri, action);\n                }\n            },\n            reportError: error => this._logService.warn('[Codex] Failed to deliver asynchronous question answer; reopening questions', error),\n        });\n    }\n";
