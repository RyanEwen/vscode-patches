import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { transformCodexSteeringInput, marker } from '../../patchers/codex-steering-input.mjs';

const file = process.argv[2] || process.env.CODEX_STEERING_TEST_BUNDLE;
if (!file) { throw new Error('Pass a pre-patch agentHostMain.js bundle'); }
const original = fs.readFileSync(file, 'utf8');
const patched = transformCodexSteeringInput(original);
const extractorName = patched.match(/_handleSteeredUserMessage\([\w$]+,[\w$]+\)\{let [\w$]+=([\w$]+)\(/)[1];
const extractor = patched.match(new RegExp(`function ${extractorName}\\([^)]*\\)\\{[^}]+\\}`))[0];
const method = patched.match(/_takeMatchingPendingSteering\(([\w$]+),([\w$]+)\)\{for\(let\[([\w$]+),([\w$]+)\]of \1\.pendingSteeringFlips\)if\(\4\.inputText===\2\)return \1\.pendingSteeringFlips\.delete\(\3\),\4\.pendingMessage\}/)[0];
const take = new Function(`return ({${method}})._takeMatchingPendingSteering`)();
const stored = patched.match(/\/\*__ahSteeringInputText\*\/([\w$]+)\.pendingSteeringFlips\.set\(([\w$]+)\.id,\{pendingMessage:\2,inputText:([\w$]+)\(([\w$]+)\)\}\)/);
assert.ok(stored);
const store = new Function(stored[1], stored[2], stored[4], `${extractor};${stored[0]};`);
const state = () => ({ pendingSteeringFlips: new Map() });
const message = (id, text) => ({ id, message: { text } });
const textInput = text => [{ type: 'text', text }];

test('transformation is complete, idempotent and syntactically valid', () => {
	assert.equal(transformCodexSteeringInput(patched), patched);
	assert.throws(() => transformCodexSteeringInput(original + original), /identify|anchor/);
	assert.throws(() => transformCodexSteeringInput(marker), /Incomplete/);
	execFileSync(process.execPath, ['--input-type=module', '--check'], { input: patched, stdio: ['pipe', 'pipe', 'pipe'] });
});

test('browser context reproduces the old mismatch and consumes the original message', () => {
	const s = state(), m = message('browser', 'Show upload progress');
	const sent = m.message.text + '\n\nNo browser pages are currently shared with you.';
	assert.notEqual(m.message.text, sent);
	store(s, m, textInput(sent));
	assert.equal(take(s, m.message.text), undefined);
	assert.equal(take(s, sent), m);
	assert.equal(s.pendingSteeringFlips.size, 0);
});

test('plain input still matches exactly', () => {
	const s = state(), m = message('plain', 'Continue');
	store(s, m, textInput(m.message.text));
	assert.equal(take(s, 'Continue'), m);
});

test('same prompt with different context matches out of order without consuming its neighbour', () => {
	const s = state(), a = message('a', 'Review'), b = message('b', 'Review');
	store(s, a, textInput('Review\n\n@/workspace/a.ts'));
	store(s, b, textInput('Review\n\n@/workspace/b.ts'));
	assert.equal(take(s, 'Review\n\n@/workspace/b.ts'), b);
	assert.equal(s.pendingSteeringFlips.size, 1);
	assert.equal(take(s, 'Review\n\n@/workspace/a.ts'), a);
});

test('duplicate or unrelated echoes do not consume another pending message', () => {
	const s = state(), a = message('a', 'One'), b = message('b', 'Two');
	store(s, a, textInput('One')); store(s, b, textInput('Two'));
	assert.equal(take(s, 'Other'), undefined);
	assert.equal(take(s, 'One'), a);
	assert.equal(take(s, 'One'), undefined);
	assert.equal(s.pendingSteeringFlips.size, 1);
});

test('matching uses the sent snapshot even if attachment context later changes', () => {
	const s = state(), m = message('snapshot', 'Review');
	m.message.attachments = [{ type: 'simple', modelRepresentation: 'old context' }];
	store(s, m, textInput('Review\n\nold context'));
	m.message.attachments[0].modelRepresentation = 'new context';
	assert.equal(take(s, 'Review\n\nold context'), m);
});

test('non-text input is ignored using the existing echo extractor', () => {
	const s = state(), m = message('image', 'Describe');
	store(s, m, [...textInput('Describe'), { type: 'localImage', path: '/tmp/image.png' }]);
	assert.equal(take(s, 'Describe'), m);
});
