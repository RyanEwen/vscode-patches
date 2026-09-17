import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { transformCodexAsyncQuestions, marker } from '../patchers/codex-async-questions.mjs';
import { createAsyncQuestionsController } from '../patchers/codex-async-questions-runtime.mjs';

const bundlePath = process.env.VSCODE_AGENTHOST_BUNDLE;
assert.ok(bundlePath, 'Set VSCODE_AGENTHOST_BUNDLE to the inspected agent-host bundle');
const original = fs.readFileSync(bundlePath, 'utf8');
const patched = transformCodexAsyncQuestions(original);

/** Extracts this inspected build's dispatcher, bounded by its adjacent method. */
function itemHandler(text) {
	const match = text.match(/_handleItemStarted\((\w+),(\w+)\)\{[\s\S]*?\}_handleSteeredUserMessage/);
	assert.ok(match);
	const method = match[0].slice(0, -'_handleSteeredUserMessage'.length);
	const mapper = method.match(/:(\w+)\(\w+\.mapState,this\._withHostTurnId/)?.[1];
	assert.ok(mapper);
	return vm.runInNewContext(`({${method}})._handleItemStarted`, { [mapper]: () => [{ kind: 'markdown' }] });
}

test('patched bundle parses and applying twice is an exact no-op', () => {
	execFileSync(process.execPath, ['--check', '--input-type=module'], { input: patched, maxBuffer: 32 * 1024 * 1024 });
	assert.equal(transformCodexAsyncQuestions(patched), patched);
});

test('strict guards reject missing anchors and duplicate patch markers', () => {
	assert.throws(() => transformCodexAsyncQuestions('unsupported build'));
	assert.throws(() => transformCodexAsyncQuestions(patched + `\nfunction ${marker}(){}`));
});

test('unpatched dispatcher reproduces the missing-controls regression', { skip: /__codexAsyncQuestionsV[123]/.test(original) }, () => {
	const result = itemHandler(original).call({ _withHostTurnId: (_s, p) => p }, {}, { item: { type: 'agentMessage', delivery: 'async', questions: [{ title: 'Format?', options: ['PDF', 'Text'] }] } });
	assert.equal(result[0].kind, 'markdown');
});

test('installed dispatcher routes structured questions and preserves ordinary messages', () => {
	const calls = [];
	const session = { sessionId: 'root' };
	const receiver = { _sessions: new Map([['root', session]]), _getAsyncQuestions: () => ({ ask: (...args) => calls.push(args) }), _withHostTurnId: (_s, p) => p };
	const handler = itemHandler(patched);
	const questions = [{ title: 'Format?', options: ['PDF', 'Text'] }];
	assert.equal(handler.call(receiver, session, { item: { id: 'call-1', type: 'agentMessage', delivery: 'async', questions } }).length, 0);
	assert.deepEqual(calls, [['call-1', questions]]);
	assert.equal(handler.call(receiver, session, { item: { type: 'agentMessage', text: 'Working' } })[0].kind, 'markdown');
	assert.equal(handler.call(receiver, session, { item: { type: 'agentMessage', delivery: 'async', questions: [] } })[0].kind, 'markdown');
});

/** Mirrors the already-tested adapter helpers while exercising the generated runtime verbatim. */
function setup(send = async () => {}) {
	let next = 0;
	const Controller = createAsyncQuestionsController({
		generateUuid: () => String(++next),
		buildUserInputRequest: (id, questions) => ({ id, questions }),
		answerStrings: (answer, response) => response === 'accept' && answer && answer.state !== 'skipped' ? [answer.value.value] : [],
	});
	const shown = [], sent = [], finished = [], cancelled = [], errors = [];
	const controller = new Controller({ show: q => shown.push(q), cancel: id => cancelled.push(id), send: async text => { sent.push(text); return await send(text) ?? 'one'; }, finish: c => finished.push(c), reportError: e => errors.push(e) });
	return { controller, shown, sent, finished, cancelled, errors };
}
const questions = [{ title: 'Format?', options: ['PDF', 'Text'] }];
const completion = id => ({ threadId: 'thread', turn: { id, status: 'completed' } });
const answers = { '0': { state: 'submitted', value: { kind: 'selected', value: 'PDF' } } };

test('question conversion and explicit-only submission', async () => {
	const h = setup();
	h.controller.ask('call', questions);
	h.controller.ask('call', questions);
	assert.equal(h.shown.length, 1);
	assert.equal(h.shown[0].questions[0].isOther, true);
	assert.deepEqual(h.sent, []);
	h.controller.respond(h.shown[0].id, 'accept', answers);
	await h.controller.whenIdle();
	assert.deepEqual(h.sent, ['> Format?\n\nPDF']);
});

test('completed native turn remains answerable, skip does not send a default', () => {
	const h = setup();
	h.controller.ask('call', questions);
	assert.equal(h.controller.holdCompletion(completion('one')), true);
	h.controller.respond(h.shown[0].id, 'cancel');
	assert.deepEqual([h.sent, h.finished], [[], [completion('one')]]);
});

test('late answer continuation supersedes old completion', async () => {
	const h = setup(async () => { h.controller.turnStarted('two'); return 'two'; });
	h.controller.ask('call', questions);
	h.controller.holdCompletion(completion('one'));
	h.controller.respond(h.shown[0].id, 'accept', answers);
	await h.controller.whenIdle();
	assert.deepEqual(h.finished, []);
	assert.equal(h.controller.holdCompletion(completion('two')), false);
});

test('failed answer delivery reopens controls without completing', async () => {
	const h = setup(async () => { throw new Error('offline'); });
	h.controller.ask('call', questions);
	h.controller.holdCompletion(completion('one'));
	h.controller.respond(h.shown[0].id, 'accept', answers);
	await h.controller.whenIdle();
	assert.deepEqual([h.shown.length, h.errors.length, h.finished.length], [2, 1, 0]);
});

test('Stop waits for a submitted RPC and prevents stale callbacks', async () => {
	let reject;
	const gate = new Promise((_resolve, r) => { reject = r; });
	const h = setup(() => gate);
	h.controller.ask('call', questions);
	h.controller.respond(h.shown[0].id, 'accept', answers);
	h.controller.clear();
	let idle = false;
	const waiting = h.controller.whenIdle().then(() => { idle = true; });
	await Promise.resolve();
	assert.equal(idle, false);
	reject(new Error('closed'));
	await waiting;
	assert.deepEqual([h.shown.length, h.errors.length], [1, 0]);
});


/** Executes source-generated reply routing and the installed Stop method with a controlled RPC. */
function adapter(text = patched, request) {
	const start = text.indexOf('_getAsyncQuestions(session)');
	const end = text.indexOf('_handleItemStarted(', start);
	assert.ok(start >= 0 && end > start);
	const getter = text.slice(start, end).trim();
	const names = getter.match(/generateUuid: (\w+), buildUserInputRequest: (\w+), answerStrings: (\w+)/);
	const runtime = getter.match(/(__codexAsyncQuestionsV\d)\(/)[1];
	assert.ok(names);
	let uuid = 0;
	const fn = vm.runInNewContext('({' + getter + '})._getAsyncQuestions', {
		[runtime]: createAsyncQuestionsController,
		[names[1]]: () => String(++uuid),
		[names[2]]: (id, questions) => ({ id, questions }),
		[names[3]]: (answer, response) => response === 'accept' ? [answer.value.value] : [],
	});
	const calls = [], events = [], finishes = [];
	const session = { sessionId: 'root', threadId: 'native-thread', sessionUri: 'session', currentTurnId: 'host', currentAppTurnId: 'original', hostTurnIdByAppTurnId: new Map() };
	const receiver = {
		_sessions: new Map([['root', session]]),
		_connection: { kind: 'ready', client: { request: async (...args) => { calls.push(args); return request ? request(...args) : { turn: { id: 'continuation' } }; } } },
		_traceContext: () => undefined,
		_fire: (_uri, event) => events.push(event),
		_handleTurnCompletedNotification: (_session, c) => { finishes.push(c); return []; },
		_logService: { warn() {} },
		_resolveConversationSession: () => 'session',
		_drainPendingSteering() {},
	};
	const stopMatch = text.match(/async _abort\([^)]*\)\{[\s\S]*?\}_removeActiveClientHandlesForChat/);
	assert.ok(stopMatch);
	const stopMethod = stopMatch[0].slice(0, -'_removeActiveClientHandlesForChat'.length);
	const contextHelper = stopMethod.match(/let \w+=(\w+)\(\w+,\w+\),\w+=this\._resolveConversationSession/)[1];
	const uriHelper = stopMethod.match(/let \w+=(\w+)\.id\(\w+\),\w+=this\._sessions/)[1];
	const abort = vm.runInNewContext('({' + stopMethod + '})._abort', { [contextHelper]: c => c, [uriHelper]: { id: () => 'root' } });
	const controller = fn.call(receiver, session);
	return { session, receiver, controller, calls, events, finishes, stop: () => abort.call(receiver, 'chat') };
}

test('native reply routing preserves settings and handles response before notification', async () => {
	const h = adapter();
	h.controller.ask('item', questions);
	h.controller.holdCompletion(completion('original'));
	h.controller.respond(h.events[0].request.id, 'accept', answers);
	await h.controller.whenIdle();
	assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['turn/start', { threadId: 'native-thread', input: [{ type: 'text', text: '> Format?\n\nPDF', text_elements: [] }] }, null]]);
	assert.equal(h.finishes.length, 0);
	assert.equal(h.session.currentAppTurnId, 'continuation');
	assert.equal(h.session.hostTurnIdByAppTurnId.get('continuation'), 'host');
});

test('late acknowledgements cannot modify replacement questions', async () => {
	let resolve;
	const gate = new Promise(r => { resolve = r; });
	const h = setup(() => gate);
	h.controller.ask('old', questions);
	h.controller.respond(h.shown[0].id, 'accept', answers);
	h.controller.clear();
	h.controller.ask('new', questions);
	h.controller.holdCompletion(completion('replacement'));
	resolve('old-turn');
	await h.controller.whenIdle();
	h.controller.respond(h.shown[1].id, 'cancel');
	assert.deepEqual(h.finished, [completion('replacement')]);
});

test('upgrades the archived first revision without losing other bundle edits', { skip: /__codexAsyncQuestionsV[123]/.test(original) }, async () => {
	const { transformCodexAsyncQuestions: legacy } = await import('../archive/patcher-snapshots/codex-async-questions-v1.mjs');
	const first = legacy(original);
	const upgraded = transformCodexAsyncQuestions(first);
	assert.ok(upgraded.includes(`function ${marker}(`));
	assert.ok(!upgraded.includes('__codexAsyncQuestionsV1'));
	assert.ok(upgraded.endsWith(first.slice(-10000)));
	assert.equal(transformCodexAsyncQuestions(upgraded), upgraded);
});

test('isolated subagent messages stay on the text path without unreachable controls', () => {
	const root = { sessionId: 'root' };
	const child = { sessionId: 'root' };
	const receiver = { _sessions: new Map([['root', root]]), _getAsyncQuestions: () => { throw new Error('Unanswerable control created'); }, _withHostTurnId: (_s, p) => p };
	const result = itemHandler(patched).call(receiver, child, { item: { type: 'agentMessage', delivery: 'async', questions } });
	assert.equal(result[0].kind, 'markdown');
});

test('Stop interrupts an acknowledged continuation before turn/started arrives', async () => {
	let resolve;
	const gate = new Promise(r => { resolve = r; });
	const h = adapter(patched, method => method === 'turn/start' ? gate : undefined);
	h.controller.ask('item', questions);
	h.controller.holdCompletion(completion('original'));
	h.controller.respond(h.events[0].request.id, 'accept', answers);
	const stopping = h.stop();
	resolve({ turn: { id: 'continuation' } });
	await stopping;
	assert.deepEqual(JSON.parse(JSON.stringify(h.calls[1])), ['turn/interrupt', { threadId: 'native-thread', turnId: 'continuation' }]);
	assert.equal(h.finishes.length, 0);
});

for (const scenario of ['newer notification', 'replacement host turn', 'disposed session', 'completed turn']) {
	test(`late acknowledgement preserves ${scenario}`, async () => {
		let resolve;
		const gate = new Promise(r => { resolve = r; });
		const h = adapter(patched, () => gate);
		h.controller.ask('item', questions);
		h.controller.respond(h.events[0].request.id, 'accept', answers);
		if (scenario === 'newer notification') { h.session.currentAppTurnId = 'newer'; }
		if (scenario === 'replacement host turn') { h.session.currentTurnId = 'replacement'; }
		if (scenario === 'disposed session') { h.receiver._sessions.delete('root'); }
		if (scenario === 'completed turn') { h.session.currentTurnId = undefined; }
		const expected = h.session.currentAppTurnId;
		resolve({ turn: { id: 'late' } });
		await h.controller.whenIdle();
		assert.equal(h.session.currentAppTurnId, expected);
		assert.equal(h.session.hostTurnIdByAppTurnId.has('late'), false);
	});
}

test('upgrades the second revision and reproduces its Stop regression', { skip: /__codexAsyncQuestionsV[123]/.test(original) }, async () => {
	const { transformCodexAsyncQuestions: legacy } = await import('../archive/patcher-snapshots/codex-async-questions-v2.mjs');
	const second = legacy(original);
	const h = adapter(second);
	h.controller.ask('item', questions);
	h.controller.holdCompletion(completion('original'));
	h.controller.respond(h.events[0].request.id, 'accept', answers);
	await h.controller.whenIdle();
	assert.equal(h.session.currentAppTurnId, 'original');
	const upgraded = transformCodexAsyncQuestions(second);
	const fixed = adapter(upgraded);
	fixed.controller.ask('item', questions);
	fixed.controller.respond(fixed.events[0].request.id, 'accept', answers);
	await fixed.controller.whenIdle();
	assert.equal(fixed.session.currentAppTurnId, 'continuation');
});
