import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { createFeedbackReviewContribution, transformAgentFeedbackReview, marker } from '../patchers/agent-feedback-review.mjs';

/** Small observable/event doubles expose retained listeners and remote writes. */
function event() {
	const listeners = new Set();
	return {
		listeners,
		on(listener, receiver) {
			const callback = receiver ? value => listener.call(receiver, value) : listener;
			listeners.add(callback);
			return { dispose: () => listeners.delete(callback) };
		},
		fire(value) { for (const callback of [...listeners]) { callback(value); } },
	};
}

class Disposable {
	constructor() { this.disposables = []; }
	_register(value) { this.disposables.push(value); return value; }
	dispose() { for (const value of this.disposables.splice(0)) { value.dispose(); } }
}

class CancellationTokenSource {
	constructor(parent) {
		this.changed = event();
		this.token = { isCancellationRequested: false, onCancellationRequested: this.changed.on };
		this.parent = parent?.onCancellationRequested(() => this.cancel());
		if (parent?.isCancellationRequested) { this.cancel(); }
	}
	cancel() { this.token.isCancellationRequested = true; this.changed.fire(); }
	dispose(cancel) {
		if (cancel) { this.cancel(); }
		this.parent?.dispose();
		this.changed.listeners.clear();
	}
}

const uri = value => ({ toString: () => value });
const URI = { parse: uri, revive: value => value };
const metaKey = 'vscode.agentFeedback';
const comment = (id, overrides = {}) => ({
	id, resource: 'file:///workspace/example.ts', resolved: false,
	range: { start: { line: 2, character: 1 }, end: { line: 4, character: 3 } },
	entries: [{ id: id + ':0', text: 'Review ' + id }, { id: id + ':1', text: { markdown: 'Reply' } }],
	_meta: { other: 'retained', [metaKey]: { kind: 'codeReview', state: 'created', sessionResource: 'codex:/session', ...overrides } },
});

/** Runs the same factory embedded in the bundle, with an explicit owning-host resolver. */
function setup(initial = { annotations: [] }, factory = createFeedbackReviewContribution) {
	const changes = event(), errors = event(), handlers = new Map(), writes = [], opened = [];
	let value = initial, references = 0, serviceRequests = 0;
	const subscription = { get value() { return value; }, onDidChange: changes.on, onDidError: errors.on };
	const connection = {
		resourceUris: { fromAgentHost: resource => uri(resource.toString().replace('file://', 'vscode-remote://wsl+Ubuntu')) },
		getSubscription(kind, channel) {
			assert.equal(kind, 'annotations');
			assert.equal(channel.toString(), 'codex:/session/annotations');
			references++;
			return { object: subscription, dispose: () => references-- };
		},
		dispatch: (channel, action) => writes.push({ channel, action }),
	};
	const connections = { resolveSessionResource: resource => {
		assert.equal(resource.toString(), 'agent-host-codex:/session#peer');
		return { connection, backendSession: uri('codex:/session') };
	} };
	const commands = { getCommand: id => handlers.get(id), registerCommand: (id, handler) => {
		handlers.set(id, handler);
		return { dispose: () => handlers.delete(id) };
	} };
	const dependencies = { Disposable, CancellationTokenSource, commands, connectionsId: 'connections', editorId: 'editor', URI };
	const Contribution = factory(dependencies);
	const contribution = new Contribution();
	const accessor = { get: id => { serviceRequests++; return id === 'connections' ? connections : { openEditor: input => opened.push(input) }; } };
	return {
		contribution, handlers, writes, opened, dependencies,
		get requests() { return serviceRequests; },
		run: (command, selection) => handlers.get('_agentFeedbackReview.' + command)(accessor, uri('agent-host-codex:/session#peer'), selection),
		set: next => { value = next; changes.fire(next); },
		fail: error => { value = error; errors.fire(error); },
		assertReleased() {
			assert.deepEqual([references, changes.listeners.size, errors.listeners.size, contribution.cancellation.changed.listeners.size], [0, 0, 0, 0]);
		},
	};
}

test('registration is lazy and disposed with its contribution', () => {
	const fixture = setup();
	assert.equal(fixture.requests, 0);
	assert.equal(fixture.handlers.size, 4);
	fixture.contribution.dispose();
	assert.equal(fixture.handlers.size, 0);
});

test('loads reviewable comments, replies and mapped WSL resources', async () => {
	const fixture = setup({ annotations: [comment('new'), comment('user', { kind: 'user' }), comment('accepted', { state: 'accepted' }), comment('pending', { state: 'accepted', pendingAgentReveal: true })] });
	const result = await fixture.run('getComments');
	assert.deepEqual(result.map(item => item.id), ['new', 'pending']);
	assert.equal(result[0].text, 'Review new\n\nReply');
	assert.equal(result[0].fileUri.toString(), 'vscode-remote://wsl+Ubuntu/workspace/example.ts');
	fixture.assertReleased();
	fixture.contribution.dispose();
});

test('hydration waits rather than reporting an empty list', async () => {
	const fixture = setup(); fixture.set(undefined);
	let settled = false;
	const pending = fixture.run('getComments').then(value => { settled = true; return value; });
	await Promise.resolve(); assert.equal(settled, false);
	fixture.set({ annotations: [comment('loaded')] });
	assert.equal((await pending)[0].id, 'loaded');
	fixture.assertReleased(); fixture.contribution.dispose();
});

test('empty reads and repeated operations release every listener', async () => {
	const fixture = setup();
	for (let i = 0; i < 8; i++) {
		assert.deepEqual(await fixture.run('getComments'), []);
		fixture.assertReleased();
	}
	fixture.contribution.dispose();
});

test('initial and later subscription failures remain errors', async () => {
	const fixture = setup(new Error('initial'));
	await assert.rejects(fixture.run('getComments'), /initial/); fixture.assertReleased();
	fixture.set(undefined);
	const pending = fixture.run('getComments'); fixture.fail(new Error('later'));
	await assert.rejects(pending, /later/); fixture.assertReleased(); fixture.contribution.dispose();
});

test('disposal cancels hydration and releases subscription references', async () => {
	const fixture = setup(); fixture.set(undefined);
	const pending = fixture.run('getComments'); fixture.contribution.dispose();
	await assert.rejects(pending, /Canceled/); fixture.assertReleased();
});

test('selection preserves metadata and clears unchecked interrupted reveals', async () => {
	const fixture = setup({ annotations: [comment('selected'), comment('hidden'), comment('pending', { state: 'accepted', pendingAgentReveal: true })] });
	await fixture.run('accept', ['selected', 'selected']);
	assert.deepEqual(fixture.writes.map(({ action }) => [action.annotation.id, action.annotation._meta[metaKey].pendingAgentReveal]), [['selected', true], ['pending', false]]);
	assert.equal(fixture.writes[0].action.annotation._meta.other, 'retained');
	assert.equal(fixture.writes[0].action.annotation.entries.length, 2);
	fixture.assertReleased(); fixture.contribution.dispose();
});

test('empty and stale selections perform no writes', async () => {
	const fixture = setup({ annotations: [comment('exists')] });
	await assert.rejects(fixture.run('accept', []), /no longer available/);
	await assert.rejects(fixture.run('accept', ['exists', 'missing']), /no longer available/);
	assert.deepEqual(fixture.writes, []); fixture.assertReleased(); fixture.contribution.dispose();
});

test('opens a mapped file at its range and deletes only review feedback', async () => {
	const fixture = setup({ annotations: [comment('review'), comment('user', { kind: 'user' })] });
	await fixture.run('reveal', 'review');
	assert.equal(fixture.opened[0].resource.toString(), 'vscode-remote://wsl+Ubuntu/workspace/example.ts');
	assert.deepEqual(fixture.opened[0].options.selection, { startLineNumber: 3, startColumn: 2, endLineNumber: 5, endColumn: 4 });
	await fixture.run('delete', 'user'); await fixture.run('delete', 'review');
	assert.deepEqual(fixture.writes, [{ channel: 'codex:/session/annotations', action: { type: 'annotations/removed', annotationId: 'review' } }]);
	fixture.assertReleased(); fixture.contribution.dispose();
});

const bundlePath = process.env.VSCODE_WORKBENCH_BUNDLE;
test('real bundle transformation, embedded runtime, error announcements and strict guards', { skip: !bundlePath }, async () => {
	const source = fs.readFileSync(bundlePath, 'utf8');
	const patched = transformAgentFeedbackReview(source);
	execFileSync(process.execPath, ['--input-type=module', '--check'], { input: patched, maxBuffer: 1024 * 1024 });
	assert.equal(transformAgentFeedbackReview(patched), patched);
	assert.throws(() => transformAgentFeedbackReview('unsupported'), /expected one/);
	assert.throws(() => transformAgentFeedbackReview(source + source), /expected one/);
	assert.throws(() => transformAgentFeedbackReview(marker), /Incomplete/);
	const embedded = patched.slice(patched.indexOf('/*' + marker + '*/'), patched.indexOf('/*completed-feedback-review-backport*/'));
	const factoryStart = embedded.indexOf('(function createFeedbackReviewContribution');
	const factoryEnd = embedded.indexOf(')({Disposable:');
	const factory = vm.runInThisContext(embedded.slice(factoryStart + 1, factoryEnd));
	const fixture = setup({ annotations: [comment('actual')] }, factory);
	assert.equal((await fixture.run('getComments'))[0].id, 'actual');
	fixture.assertReleased(); fixture.contribution.dispose();
	const start = patched.lastIndexOf('async _populate(', patched.indexOf('\"_agentFeedbackReview.getComments\"'));
	const end = patched.indexOf('_renderRow(', start);
	const next = patched.indexOf('_renderRow(', end + 1);
	const method = patched.slice(start, next);
	const builder = method.match(/\.append\(([\w$]+)\("\.chat-agent-feedback-review-empty"/)[1];
	const alert = method.match(/([\w$]+)\(message\)/)[1];
	const announcements = [], content = [];
	const context = vm.createContext({ [builder]: (_selector, _attributes, text) => text, [alert]: value => announcements.push(value) });
	const populate = vm.runInContext('({' + method + '})._populate', context);
	const instance = { _store: { isDisposed: false }, commandService: { executeCommand: async () => { throw Error('offline'); } }, logService: { warn() {} } };
	await populate.call(instance, { append: value => content.push(value) });
	assert.equal(content[0], 'Could not load review comments. Cancel this request and try again.');
	assert.deepEqual(announcements, content);
	instance._store.isDisposed = true;
	await populate.call(instance, { append: () => assert.fail('disposed render') });
	assert.equal(announcements.length, 1);
});
