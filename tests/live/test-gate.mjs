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

check(s.includes('__ahKeepRow'), 'marker __ahKeepRow present');
try {
	execFileSync('node', ['--check', F], { stdio: 'pipe' });
	check(true, 'workbench bundle parses');
} catch (e) {
	check(false, 'workbench bundle parses', String(e.stderr).slice(0, 200));
}

// Pull the patched autorun body out of the bundle and run it, rather than trusting
// that dropping the gate term did what it looks like it does.
const i = s.indexOf('__ahKeepRow');
const start = s.lastIndexOf('(', s.lastIndexOf('=>', i));
const bodyStart = s.indexOf('{', s.indexOf('=>', start));
const bodyEnd = s.indexOf('})', bodyStart);
const body = s.slice(bodyStart + 1, bodyEnd);
console.log('\nextracted autorun body:\n  ' + body.slice(0, 220));

const m = body.match(/let (\w+)=(\w+)\.read\((\w+)\)\?\.activity;/);
if (!m) { console.log('  [FAIL] could not identify the autorun shape'); process.exit(1); }
const [, , chatVar, readerVar] = m;
const sinkVar = body.match(/\|\|(\w+)\.sink\(/)?.[1];
console.log(`  params: chatState=${chatVar} reader=${readerVar} opts=${sinkVar}`);

// The row's stable id is a module-level constant in the bundle; stub it by name.
const idVar = body.match(/id:(\w+),/)?.[1];
console.log(`  progress id constant: ${idVar}`);
const makeFn = () => new Function(chatVar, sinkVar, 'MarkdownStub', idVar,
	`return function(${readerVar}){${body.replace(/new \w+\(\)\.appendText/, 'new MarkdownStub().appendText')}}`);

class MarkdownStub { appendText(t) { this.value = t; return this; } }

// Case 1: activity set, response parts NON-EMPTY. This is the case that used to bail.
let sunk = [];
let fn = makeFn()({ read: () => ({ activity: 'Working, 45s elapsed' }) },
	{ sink: (p) => sunk.push(p) }, MarkdownStub, 'agentHost.chatActivity');
fn({ read: () => [{ kind: 'markdown' }, { kind: 'toolCall' }] });
check(sunk.length === 1, 'emits while the turn already has response parts', JSON.stringify(sunk.length));
check(sunk[0]?.[0]?.kind === 'progressMessage', 'emits a progressMessage part', sunk[0]?.[0]?.kind);
check(sunk[0]?.[0]?.shimmer === true, 'keeps the shimmer');
check(sunk[0]?.[0]?.content?.value === 'Working, 45s elapsed', 'carries the label',
	sunk[0]?.[0]?.content?.value);

// Case 2: no activity. Must stay silent, or a cleared row would re-render forever.
sunk = [];
fn = makeFn()({ read: () => ({ activity: undefined }) }, { sink: (p) => sunk.push(p) }, MarkdownStub, 'agentHost.chatActivity');
fn({ read: () => [] });
check(sunk.length === 0, 'stays silent when activity is cleared');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
