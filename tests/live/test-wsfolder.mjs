/**
 * Exercise `workspace-folder-uses-real-remote` against the shipped Agents window
 * bundle: the folder root must come back on an authority the client can resolve.
 */
import fs from 'node:fs';
import { FIXES } from '../../patch-vscode-fixes.mjs';

const F = process.env.VSCODE_SESSIONS_BUNDLE;
if (!F) throw new Error('Set VSCODE_SESSIONS_BUNDLE to the bundle to test.');
let src = fs.readFileSync(F, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

const entry = FIXES.find(p => p.id === 'workspace-folder-uses-real-remote');
check(!!entry, 'entry present in the patcher');

if (entry.patched.test(src)) {
	console.log('  [note] bundle already patched; testing the shipped code as-is');
} else {
	const hits = src.match(new RegExp(entry.unpatched.source, 'g')) ?? [];
	check(hits.length >= 1, 'anchor matches the shipped bundle', 'matches=' + hits.length);
	src = src.replace(entry.unpatched, (...a) => entry.build(...a));
}
check(entry.patched.test(src), 'marker present in the source under test');

// Extract the patched method and make it callable.
const at = src.indexOf('_buildWorkspaceFromUri(');
const open = src.indexOf('{', src.indexOf(')', at));
let depth = 0, end = open;
for (let k = open; k < src.length; k++) {
	if (src[k] === '{') { depth++; }
	else if (src[k] === '}') { depth--; if (depth === 0) { end = k; break; } }
}
const method = src.slice(at, end + 1);
const fnText = 'function __f' + method.slice(method.indexOf('('));

// Free variables the body closes over: basename, dirname, group, icons.
const names = [...new Set([...method.matchAll(/[^.\w$]([A-Za-z_$][\w$]*)\(/g)].map(m => m[1]))]
	.filter(n => !['function', 'if', 'return', 'catch', 'parseInt', 'String'].includes(n));
const free = names.filter(n => !/^__ah/.test(n));
console.log('  free names supplied: ' + free.join(', '));

/** Minimal URI stand-in with the `with` semantics the code relies on. */
const makeUri = (o) => ({
	...o,
	with(patch) { return makeUri({ ...o, ...patch }); },
	toString() {
		return `${this.scheme}://${this.authority}${this.path}` + (this.query ? '?' + this.query : '');
	},
});

const fn = new Function(...free, 'T', 'jM', `return ${fnText};`)(
	...free.map(() => (u) => (u && u.path ? u.path.split('/').filter(Boolean).pop() : undefined)),
	{ remote: 'remote-icon' },
	'group',
);

const host = {
	_workspaceHostLabel: undefined,
	_labelService: { getUriLabel: () => 'label' },
};

const run = (uri) => fn.call(host, uri);

// The real failing case.
{
	const out = run(makeUri({
		scheme: 'vscode-agent-host',
		authority: 'hex-77736c3a5562756e7475',
		path: '/home/example/project',
		query: '_ah=eyJzY2hlbWUiOiJmaWxlIn0',
	}));
	const root = out.folders[0].root;
	check(root.scheme === 'vscode-remote', 'agent-host folder root becomes vscode-remote', root.scheme);
	check(root.authority === 'wsl+ubuntu', 'hex authority decodes to the client-addressable remote', root.authority);
	check(root.path === '/home/example/project', 'path is preserved', root.path);
	check(!root.query, 'the _ah query is dropped', JSON.stringify(root.query));
	check(out.folders[0].workingDirectory.authority === 'wsl+ubuntu', 'workingDirectory follows the root');
}

// A dev container authority carries a case-sensitive payload and already uses `+`.
{
	const hex = Buffer.from('dev-container+7B22AbC', 'utf8').toString('hex');
	const out = run(makeUri({ scheme: 'vscode-agent-host', authority: 'hex-' + hex, path: '/workspace/x', query: '' }));
	check(out.folders[0].root.authority === 'dev-container+7B22AbC',
		'a dev container authority keeps its case and is not split', out.folders[0].root.authority);
}

// Anything that is not an agent-host hex URI must pass through untouched.
for (const u of [
	makeUri({ scheme: 'vscode-remote', authority: 'wsl+ubuntu', path: '/p', query: '' }),
	makeUri({ scheme: 'file', authority: '', path: '/p', query: '' }),
	makeUri({ scheme: 'vscode-agent-host', authority: 'local', path: '/p', query: '' }),
]) {
	const out = run(u);
	check(out.folders[0].root.scheme === u.scheme && out.folders[0].root.authority === u.authority,
		'passes through unchanged: ' + u.scheme + '://' + u.authority);
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
