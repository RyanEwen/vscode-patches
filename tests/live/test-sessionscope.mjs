/**
 * Exercise `session-scope-counts-other-sessions-work` against the shipped bundle.
 *
 * Applies the entry in memory, extracts the patched `_doComputeStaticChangeset`,
 * and runs it with stubs so the filter is observed rather than inferred.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FIXES as PATCHES } from '../../patch-vscode-fixes.mjs';

const COMMIT = process.env.VSCODE_COMMIT || 'a44adf7f53e00964ab890f9f8758a334f1fc15bc';
const B = `/v/vscode-server/bin/linux-arm64/${COMMIT}/out/vs/platform/agentHost/node/agentHostMain.js`;
// Always read the shipped bundle fresh. Caching it made this test pass only
// while the bundle happened to be unpatched.
const LOCAL = '/tmp/agentHostMain.scopetest.js';
fs.writeFileSync(LOCAL, execFileSync('docker',
	['run', '--rm', '-v', 'vscode:/v', 'alpine', 'cat', B],
	{ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
let src = fs.readFileSync(LOCAL, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

const entry = PATCHES.find(p => p.id === 'session-scope-counts-other-sessions-work');
check(!!entry, 'entry present in the patcher');

// The bundle may already carry the fix. Both states must be exercisable, so
// that this keeps testing behaviour rather than testing when it was last run.
const already = entry.patched.test(src);
if (already) {
	console.log('  [note] bundle already patched; testing the shipped code as-is');
} else {
	const hits = src.match(new RegExp(entry.unpatched.source, 'g')) ?? [];
	check(hits.length === 1, 'anchor matches exactly once in the shipped bundle', 'matches=' + hits.length);
	src = src.replace(entry.unpatched, (...a) => entry.build(...a));
}
check(entry.patched.test(src), 'marker present in the source under test');

// Pull the patched method out and make it a standalone async function. The
// definition is the occurrence with a defaulted parameter; the other is the
// call site inside `_scheduleStaticRecompute`.
const defAt = /_doComputeStaticChangeset\(([\w$,]*[\w$]+=[^)]*)\)\{/.exec(src);
check(!!defAt, 'located the definition rather than the call site');
const at = defAt.index;
const open = at + defAt[0].length - 1;
let depth = 0, end = open;
for (let k = open; k < src.length; k++) {
	if (src[k] === '{') { depth++; }
	else if (src[k] === '}') { depth--; if (depth === 0) { end = k; break; } }
}
const method = src.slice(at, end + 1);
const fnText = 'async function __f' + method.slice(method.indexOf('('));
check(/getAllFileEdits/.test(method), 'filter landed inside _doComputeStaticChangeset');

// Free variables the body closes over in the bundle.
const FREE = ['TT', 'He', 'Dr', 'ZD', 'v', 'ume', 'Hg', 'wT', 'XD', 'QD'];
const make = new Function(...FREE, `return ${fnText};`);

/** Build a host whose git diff always returns the whole dirty tree. */
const TREE = [
	'file:///workspace/example/CLAUDE.md',
	'file:///workspace/example/apps/api/src/lib/audit-logs.ts',
	'file:///workspace/example/apps/web/src/app.tsx',
].map(u => ({ before: { uri: u }, after: { uri: u }, diff: 'x' }));

const runWith = (edits, tree = TREE) => {
	let published;
	const host = {
		_configurationService: { getEffectiveWorkingDirectories: () => ['file:///workspace/example'] },
		_activeStaticComputes: new Set(),
		_stateManager: {
			getChangesetState: () => ({ status: 'ready', files: [] }),
			registerChangeset: () => 'cs',
			dispatchServerAction: () => { },
			onChangesetLivenessChanged: () => { },
			setSessionSummaryChanges: () => { },
			getSessionState: () => ({ turns: [{ id: 't1' }], chats: [] }),
		},
		_sessionDataService: {
			openDatabase: () => ({
				object: { getAllFileEdits: async () => edits },
				dispose: () => { },
			}),
		},
		_logService: { info: () => { }, warn: () => { }, debug: () => { } },
		_tryComputeGitDiffs: async () => tree.slice(),
		_computeReviewedInfo: async () => undefined,
		_publishChangesetDiffs: (_s, _k, diffs) => { published = diffs; },
		_persistSessionFlag: () => { },
		persistChangesSummary: () => { },
		_updateMultiFolderChangesSummary: async () => { },
		_restoreStaticChangesetStatus: () => { },
		_readPreviousChangesetDiffs: () => undefined,
		_openPeerChatSources: () => [],
	};
	const fn = make(
		(a, b) => a + '/' + b,                       // TT
		{ create: () => ({ elapsed: () => 1 }) },    // He
		() => false,                                 // Dr (isMultiRoot)
		() => { },                                   // ZD (telemetry)
		{ parse: (u) => u },                         // v
		(k) => 'agentHost.changeset.' + k,           // ume
		'diffs',                                     // Hg
		() => ({ additions: 0, deletions: 0, files: 0 }), // wT
		async () => [],                              // XD
		async () => [],                              // QD
	);
	return fn.call(host, 'file:///s/1', 'session', undefined, 'ready')
		.then(() => published);
};

const repoEdit = [{ filePath: '/workspace/example/apps/web/src/app.tsx', kind: 'edit' }];
const tmpOnly = [
	{ filePath: '/tmp/issue-support.md', kind: 'create' },
	{ filePath: '/tmp/issue-remote.md', kind: 'create' },
];

const a = await runWith(repoEdit);
check(Array.isArray(a) && a.length === 1, 'session that edited one repo file reports 1 file', 'got ' + a?.length);
check(a?.[0]?.after?.uri.endsWith('app.tsx'), 'and it is the file it actually edited', a?.[0]?.after?.uri);

const b = await runWith(tmpOnly);
check(Array.isArray(b) && b.length === 0, 'issue-only session (edits in /tmp) reports 0 files', 'got ' + b?.length);

const c = await runWith([]);
check(Array.isArray(c) && c.length === 0, 'session with no edits reports 0 files', 'got ' + c?.length);

// In a dev container the diff can carry a remote-authority URI. Matching must
// survive that, or every session silently reports touching nothing.
const REMOTE = 'vscode-remote://dev-container%2B7b22/workspace/example/apps/web/src/app.tsx';
const d = await runWith(repoEdit, [{ before: { uri: REMOTE }, after: { uri: REMOTE }, diff: 'x' }]);
check(Array.isArray(d) && d.length === 1, 'a remote-authority diff URI still matches its edit', 'got ' + d?.length);

// A failing database must leave the diff untouched rather than lose the changeset.
let broke;
{
	const fn = make((x, y) => x + '/' + y, { create: () => ({ elapsed: () => 1 }) }, () => false, () => { },
		{ parse: (u) => u }, (k) => k, 'diffs', () => undefined, async () => [], async () => []);
	const host = {
		_configurationService: { getEffectiveWorkingDirectories: () => ['file:///workspace/example'] },
		_activeStaticComputes: new Set(),
		_stateManager: {
			getChangesetState: () => ({ status: 'ready', files: [] }), registerChangeset: () => 'cs',
			dispatchServerAction: () => { }, onChangesetLivenessChanged: () => { },
			setSessionSummaryChanges: () => { }, getSessionState: () => ({ turns: [{ id: 't1' }], chats: [] }),
		},
		_sessionDataService: { openDatabase: () => ({ object: {}, dispose: () => { } }) },
		_logService: { info: () => { }, warn: () => { }, debug: () => { } },
		_tryComputeGitDiffs: async () => TREE.slice(),
		_computeReviewedInfo: async () => undefined,
		_publishChangesetDiffs: (_s, _k, diffs) => { broke = diffs; },
		_persistSessionFlag: () => { }, persistChangesSummary: () => { },
		_updateMultiFolderChangesSummary: async () => { }, _restoreStaticChangesetStatus: () => { },
		_readPreviousChangesetDiffs: () => undefined, _openPeerChatSources: () => [],
	};
	await fn.call(host, 'file:///s/2', 'session', undefined, 'ready');
}
check(Array.isArray(broke) && broke.length === 3, 'a DB without getAllFileEdits degrades to unfiltered', 'got ' + broke?.length);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
