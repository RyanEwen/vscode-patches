import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const F = process.env.VSCODE_WORKBENCH_BUNDLE;
if (!F) throw new Error('Set VSCODE_WORKBENCH_BUNDLE to the bundle to test.');
const s = fs.readFileSync(F, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`);
};

console.log('markers');
for (const m of ['__ahSL', '__ahSR', '__ahSTC', '__ahSP', '__ahSD', 'steeringMessages:']) {
	check(s.includes(m), 'present ' + m);
}

console.log('\nbundle integrity');
try {
	execFileSync('node', ['--check', F], { stdio: 'pipe' });
	check(true, 'workbench bundle parses');
} catch (e) {
	check(false, 'workbench bundle parses', String(e.stderr).slice(0, 200));
}

// Exercise the SHIPPED reducer rather than a reimplementation of it.
console.log('\nreducer behaviour (extracted from the patched bundle)');
const start = s.indexOf('case"chat/pendingMessageSet":');
const end = s.indexOf('case"chat/queuedMessagesReordered"', start);
const block = s.slice(start, end);

const setStart = block.indexOf('{', block.indexOf('case"chat/pendingMessageSet":')) ;
const setBody = block.slice(setStart + 1, block.indexOf('case"chat/pendingMessageRemoved":')).replace(/\}$/, '');
const remBody = block.slice(block.indexOf('{', block.indexOf('case"chat/pendingMessageRemoved":')) + 1).replace(/\}\s*$/, '');

const m = setBody.match(/let (\w+)=\{id:(\w+)\.id,message:\2\.message\}/);
if (!m) { console.log('  [FAIL] could not identify reducer params'); process.exit(1); }
const [, , actVar] = m;
const stateVar = setBody.match(/return\{\.\.\.(\w+),steeringMessage/)?.[1];
console.log(`  params: state=${stateVar} action=${actVar}`);

const setFn = new Function(stateVar, actVar, setBody);
const remFn = new Function(stateVar, actVar, remBody);

const msg = (id) => ({ id, message: { text: id } });
let st = {};
st = setFn(st, { kind: 'steering', ...msg('s1') });
st = setFn(st, { kind: 'steering', ...msg('s2') });
check(JSON.stringify(st.steeringMessages?.map(x => x.id)) === '["s1","s2"]',
	'two steers both retained', JSON.stringify(st.steeringMessages?.map(x => x.id)));
check(st.steeringMessage?.id === 's2', 'singular field tracks the newest', st.steeringMessage?.id);

st = setFn(st, { kind: 'steering', ...msg('s1') });
check(JSON.stringify(st.steeringMessages?.map(x => x.id)) === '["s1","s2"]',
	'resending an id updates in place', JSON.stringify(st.steeringMessages?.map(x => x.id)));

st = remFn(st, { kind: 'steering', id: 's1' });
check(JSON.stringify(st.steeringMessages?.map(x => x.id)) === '["s2"]',
	'consuming the first leaves the second', JSON.stringify(st.steeringMessages?.map(x => x.id)));
check(st.steeringMessage?.id === 's2', 'singular follows the tail', st.steeringMessage?.id);

st = remFn(st, { kind: 'steering', id: 's2' });
check(st.steeringMessages === undefined && st.steeringMessage === undefined,
	'emptying clears both fields');

check(remFn({}, { kind: 'steering', id: 'nope' }).steeringMessages === undefined,
	'removing from empty state is inert');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
