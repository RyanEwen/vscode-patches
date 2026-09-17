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

test('unpatched dispatcher reproduces the missing-controls regression', { skip: original.includes(marker) }, () => {
	const result = itemHandler(original).call({ _withHostTurnId: (_s, p) => p }, {}, { item: { type: 'agentMessage', delivery: 'async', questions: [{ title: 'Format?', options: ['PDF', 'Text'] }] } });
	assert.equal(result[0].kind, 'markdown');
});

test('installed dispatcher routes structured questions and preserves ordinary messages', () => {
	const calls = [];
	const receiver = { _getAsyncQuestions: () => ({ ask: (...args) => calls.push(args) }), _withHostTurnId: (_s, p) => p };
	const handler = itemHandler(patched);
	const questions = [{ title: 'Format?', options: ['PDF', 'Text'] }];
	assert.equal(handler.call(receiver, {}, { item: { id: 'call-1', type: 'agentMessage', delivery: 'async', questions } }).length, 0);
	assert.deepEqual(calls, [['call-1', questions]]);
	assert.equal(handler.call(receiver, {}, { item: { type: 'agentMessage', text: 'Working' } })[0].kind, 'markdown');
	assert.equal(handler.call(receiver, {}, { item: { type: 'agentMessage', delivery: 'async', questions: [] } })[0].kind, 'markdown');
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
	const controller = new Controller({ show: q => shown.push(q), cancel: id => cancelled.push(id), send: async text => { sent.push(text); await send(text); }, finish: c => finished.push(c), reportError: e => errors.push(e) });
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
	const h = setup(async () => h.controller.turnStarted('two'));
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


test('native reply routing preserves settings and handles response before notification', async () => {
	const start = patched.indexOf('_getAsyncQuestions(session)');
	const end = patched.indexOf('_handleItemStarted(', start);
	assert.ok(start >= 0 && end > start);
	const getter = patched.slice(start, end).trim();
	const names = getter.match(/generateUuid: (\w+), buildUserInputRequest: (\w+), answerStrings: (\w+)/);
	assert.ok(names);
	let uuid = 0;
	const fn = vm.runInNewContext(`({${getter}})._getAsyncQuestions`, {
		[marker]: createAsyncQuestionsController,
		[names[1]]: () => String(++uuid),
		[names[2]]: (id, questions) => ({ id, questions }),
		[names[3]]: (answer, response) => response === 'accept' ? [answer.value.value] : [],
	});
	const calls = [], events = [], finishes = [];
	const receiver = {
		_connection: { kind: 'ready', client: { request: async (...args) => { calls.push(args); return { turn: { id: 'continuation' } }; } } },
		_traceContext: () => undefined,
		_fire: (_uri, event) => events.push(event),
		_handleTurnCompletedNotification: (_session, c) => { finishes.push(c); return []; },
		_logService: { warn() {} },
	};
	const session = { threadId: 'native-thread', sessionUri: 'session' };
	const controller = fn.call(receiver, session);
	controller.ask('item', questions);
	controller.holdCompletion(completion('original'));
	controller.respond(events[0].request.id, 'accept', answers);
	await controller.whenIdle();
	assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['turn/start', { threadId: 'native-thread', input: [{ type: 'text', text: '> Format?\n\nPDF', text_elements: [] }] }, null]]);
	assert.equal(finishes.length, 0);
});
