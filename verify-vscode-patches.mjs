#!/usr/bin/env node
/**
 * Verify the local VS Code agent host patches are actually in force.
 *
 * `patch-vscode-fixes.mjs --status` reports per entry, but its output is dominated by
 * the 25 plus historical bundles in the volume, all of which legitimately report
 * `site not found`. This filters to the bundle the running container actually loads,
 * asserts every agenthost entry applied, checks each patched bundle still parses, and
 * runs behavioural fixtures for the injected logic that has decision-making in it.
 *
 * Usage, from WSL:
 *   node verify-vscode-patches.mjs
 *   node verify-agenthost-patches.mjs --container <name> --workbench <path>
 *
 * Exit code 0 means every check passed.
 */
import { execFileSync } from 'node:child_process';
import fsSync from 'node:fs';

const args = process.argv.slice(2);
const valueOf = (flag) => {
	const i = args.indexOf(flag);
	return i >= 0 ? args[i + 1] : undefined;
};

const CONTAINER = valueOf('--container');
if (!CONTAINER || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(CONTAINER)) throw new Error('Pass --container <name-or-id>.');
const REL = 'out/vs/platform/agentHost/node/agentHostMain.js';

let failures = 0;
let checks = 0;

function report(ok, label, detail) {
	checks++;
	if (!ok) { failures++; }
	const mark = ok ? 'pass' : 'FAIL';
	console.log(`  [${mark}] ${label}${detail ? `  ${detail}` : ''}`);
}

function docker(argv, opts = {}) {
	return execFileSync('docker', argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

function inContainer(script) {
	return docker(['exec', CONTAINER, 'sh', '-c', script]);
}

/** The commit the container is running, taken from its own server directory. */
function currentCommit() {
	const out = inContainer('ls -1 /home/node/.vscode-server/bin 2>/dev/null | head -1').trim();
	if (!out) { throw new Error('could not determine the running commit from the container'); }
	return out;
}

/**
 * Markers each entry leaves behind, so presence is checked against the bundle itself
 * rather than trusting the patcher's own report.
 */
const MARKERS = [
	['skill-subagent-result-visible', '__ahSkillOut'],
	['agenthost-require-global', '__ahReq'],
	['resume-missing-conversation-starts-fresh', '__ahHasConvo'],
	// Without the move-aside, choosing `{sessionId}` over a surviving transcript just
	// swaps "No conversation found" for "Session ID ... is already in use".
	['resume guard moves the stub transcript aside', 'orphan-'],
	['local-command-output-visible', '__ahLocalCmd'],
	// Each marker is the entry's own `patched:` regex. Guessing instead of reading it
	// produced a false failure for clearpending and hid a real one for steer.
	['clearpending-spares-background-subagent', '__ahBgKeep'],
	['steer-keeps-tool-attribution', '__ahHeld'],
	['queue-settles-by-correlation', '__ahUmu'],
	['claude-turn-reports-activity', '__ahHeartbeat'],
	// Activity is a single string field, so the row cannot stack. The two
	// `heartbeat-part-updates-in-place-*` entries were retired with the markdown
	// heartbeat they were trying to rescue; their markers must be gone.
	['claude-turn-reports-activity uses the real channel', 'chat/activityChanged'],
	['turn-prune-anchor-missing-is-loud', '__ahPruneAnchor'],
	['router-drop-is-loud', '__ahRouterDrop'],
	['result-error-subtypes-surface', '__ahResultMsg'],
	['result-usage-any-subtype', '__ahUsageAny'],
	['steer-preempt-not-error', 'ede_diagnostic'],
	['sdk-initiated-turn', 'SDKTURN'],
	['slash-command-single-block', '__vsMergeSlash'],
	['peer-chat-unavailable-subagent', '__ahUnavail'],
	['session-scope-counts-other-sessions-work', '__ahOwnEdits'],
	['activity-clears-when-the-turn-results', '__ahHbEnd'],
];

/**
 * The resume guard decides whether a session id has a real conversation on disk. It runs
 * inside the host, which does not share the CLI user's HOME, so the fixtures pin both the
 * decision and the environment that broke the first version of it.
 */
const HAS_CONVO_FIXTURE = `
const fixtureFs = {
 readdirSync(p) { return p === "/home" ? ["fixture"] : p === "/home/fixture/.claude/projects" ? ["project"] : []; },
 existsSync(p) { return /\\/(empty|healthy)\\.jsonl$/.test(p); },
 readFileSync(p) { return p.endsWith("/healthy.jsonl") ? JSON.stringify({type:"user"}) : JSON.stringify({type:"queue-operation"}); }
};
function hasConvo(sid){
  try{
    let fs=fixtureFs, roots=[];
    if(process.env.CLAUDE_CONFIG_DIR)roots.push(process.env.CLAUDE_CONFIG_DIR+"/projects");
    if(process.env.HOME)roots.push(process.env.HOME+"/.claude/projects");
    try{roots.push(require("os").homedir()+"/.claude/projects")}catch(e1){}
    try{for(let u of fs.readdirSync("/home"))roots.push("/home/"+u+"/.claude/projects")}catch(e2){}
    for(let base of roots){
      let dirs; try{dirs=fs.readdirSync(base)}catch(e3){continue}
      for(let d of dirs){
        let p=base+"/"+d+"/"+sid+".jsonl";
        if(fs.existsSync(p)){let t=fs.readFileSync(p,"utf8");
          return t.indexOf('"type":"user"')>=0||t.indexOf('"type":"assistant"')>=0}}}
  }catch(e){}
  return true;
}
let out=[];
// A transcript with no user or assistant entry is not a conversation, so resume must not be used.
out.push(["empty transcript", hasConvo("empty"), false]);
// A healthy session must still resume, because starting fresh would discard its history.
out.push(["healthy transcript", hasConvo("healthy"), true]);
// Anything we cannot find keeps the stock behaviour rather than guessing.
out.push(["unknown session", hasConvo("00000000-0000-0000-0000-000000000000"), true]);
console.log(JSON.stringify(out));
`;

console.log('agent host patch verification');
console.log('');

let commit;
try {
	commit = currentCommit();
	console.log(`container : ${CONTAINER}`);
	console.log(`commit    : ${commit}`);
	console.log('');
} catch (err) {
	console.log(`  [FAIL] container reachable  ${err.message}`);
	process.exit(1);
}

const bundle = `/home/node/.vscode-server/bin/${commit}/${REL}`;
const node = `/home/node/.vscode-server/bin/${commit}/node`;

console.log('markers present in the running bundle');
let bundleText = '';
try {
	bundleText = inContainer(`grep -o -e ${MARKERS.map(([, m]) => m).join(' -e ')} ${bundle} | sort | uniq -c`);
} catch {
	bundleText = '';
}
for (const [id, marker] of MARKERS) {
	report(bundleText.includes(marker), id, `marker ${marker}`);
}

console.log('');
console.log('retired local hacks are gone');
// The markdown heartbeat could never have worked. Response parts are an append-only
// stream (`seedEmittedLengths` emits only the suffix past what was already sent), so a
// value that changes rather than grows appends a fresh line every tick. Worse, the
// injected parts made `responseParts` non-empty, which is exactly the condition that
// suppresses the native activity row. Superseded by `claude-turn-reports-activity`.
const RETIRED = ['__ahHbUpsert', '__ahHbBytes', '__ahHbSeen', 'subprog-'];
for (const marker of RETIRED) {
	let hit = '';
	try {
		hit = inContainer(`grep -c -e ${marker} ${bundle} || true`).trim();
	} catch {
		hit = '?';
	}
	report(hit === '0', `retired marker ${marker} absent`, `count ${hit}`);
}

console.log('');
console.log('bundle integrity');
try {
	inContainer(`${node} --check ${bundle}`);
	report(true, 'agentHostMain.js parses');
} catch (err) {
	report(false, 'agentHostMain.js parses', String(err.stderr || err.message).slice(0, 200));
}

// The original bundle must survive, or --revert can never restore a clean base.
try {
	const orig = inContainer(`test -f ${bundle}.vscodefix-orig && echo yes || echo no`).trim();
	report(orig === 'yes', 'pristine .vscodefix-orig retained');
} catch {
	report(false, 'pristine .vscodefix-orig retained');
}

console.log('');
console.log('workbench bundle');
// The client bundle lives on the Windows side under a directory named for the first
// ten characters of the commit, and is reachable from WSL through /mnt/c.
const WB = valueOf('--workbench') ?? process.env.VSCODE_WORKBENCH_BUNDLE;
try {
	const text = fsSync.readFileSync(WB, 'utf8');
	report(text.includes('__ahLiveWork'), 'toolcall-hidden-respects-liveness', 'marker __ahLiveWork');
	// The steering list is six coupled entries: miss one and a bubble either
	// vanishes as before or never clears. `test-steering.mjs` exercises the
	// extracted reducer; these only assert every site was reached.
	for (const [id, marker] of [
		['steering-list-reduce-set', '__ahSL'],
		['steering-list-reduce-remove', '__ahSR'],
		['steering-list-turnstarted', '__ahSTC'],
		['steering-list-merge', 'steeringMessages:'],
		['steering-list-projection', '__ahSP'],
		['steering-list-removal-detect', '__ahSD'],
		['activity-row-survives-content', '__ahKeepRow'],
		['chat-input-default-permission-mode', '__ahPermMode'],
	]) {
		report(text.includes(marker), id, `marker ${marker}`);
	}
	// `background-subagent-stays-visible` was retired in favour of the liveness fix.
	// Its marker must be absent, or a stale copy is still shadowing the new behaviour.
	report(!text.includes('__ahBgIn'), 'retired background-subagent-stays-visible is gone');
	report(fsSync.existsSync(`${WB}.vscodefix-orig`), 'workbench .vscodefix-orig retained');
} catch (err) {
	report(false, 'workbench bundle readable', String(err.message).slice(0, 160));
	report(false, 'workbench .vscodefix-orig retained');
}

// A card must stay visible while its work is still running, and must still tidy itself
// away once that work genuinely ends. The `startedAt && !duration` disjunct is what keeps
// a running subagent visible when `isActive` has been forced false by observer teardown,
// so the "observer disposed mid-run" case is the important regression test here.
{
	const isHidden = (presentation, complete, tsd) => {
		const live = !!(tsd && tsd.kind === 'subagent'
			&& (tsd.isActive === true || (tsd.startedAt !== undefined && tsd.duration === undefined)));
		return !!(presentation === 'hidden'
			|| (presentation === 'hiddenAfterComplete' && complete && !live));
	};
	const running = { kind: 'subagent', isActive: true };
	const disposedMidRun = { kind: 'subagent', isActive: false, startedAt: 1 };
	const finished = { kind: 'subagent', isActive: false, startedAt: 1, duration: 5000 };
	const cases = [
		['explicit hidden always hides', ['hidden', false, running], true],
		['completed plain tool hides', ['hiddenAfterComplete', true, undefined], true],
		['incomplete call never hides', ['hiddenAfterComplete', false, undefined], false],
		['running subagent stays', ['hiddenAfterComplete', true, running], false],
		['observer disposed mid-run stays', ['hiddenAfterComplete', true, disposedMidRun], false],
		['finished subagent hides', ['hiddenAfterComplete', true, finished], true],
		['non-subagent data irrelevant', ['hiddenAfterComplete', true, { kind: 'input' }], true],
	];
	for (const [label, args, want] of cases) {
		report(isHidden(...args) === want, `hidden: ${label}`, `expected ${want}`);
	}
}

// The merged-delivery drain that used to be tested here was reverted on 2026-09-05: it
// retired the second steer's bubble at the moment the first was rendered, which is worse
// than the lingering bubble it replaced. Left as a note so the fixtures are not restored
// without a rendering signal to key on.

// A result settles exactly the entries the SDK says it consumed, identified by
// `user_message_uuid`. "later entry untouched" is the case that separates this from the
// reverted drain: an entry queued after the delivery must survive, or its bubble is
// retired before the model has seen it.
{
	const settled = (yieldedUuids, resultUuid) => {
		const i = yieldedUuids.indexOf(resultUuid);
		const drift = resultUuid !== undefined && yieldedUuids.length > 1 && i > 0;
		return drift ? yieldedUuids.slice(0, i + 1) : yieldedUuids.slice(0, 1);
	};
	const cases = [
		['single entry settles head', [['a'], 'a'], ['a']],
		['head is the correlated entry', [['a', 'b'], 'a'], ['a']],
		['drift of one settles both', [['a', 'b'], 'b'], ['a', 'b']],
		['drift of two settles three', [['a', 'b', 'c'], 'c'], ['a', 'b', 'c']],
		['later entry untouched', [['a', 'b', 'c'], 'b'], ['a', 'b']],
		['unknown uuid falls back to stock', [['a', 'b'], 'z'], ['a']],
		['absent uuid falls back to stock', [['a', 'b'], undefined], ['a']],
	];
	for (const [label, [yielded, uuid], want] of cases) {
		const got = settled(yielded, uuid);
		report(JSON.stringify(got) === JSON.stringify(want), `settle: ${label}`, `expected [${want}]`);
	}
}

console.log('');
console.log('resume guard behaviour (run with the host\'s own HOME, not the CLI user\'s)');
try {
	const raw = docker(['exec', '-u', 'node', '-e', 'HOME=/root', CONTAINER, node, '-e', HAS_CONVO_FIXTURE]);
	const rows = JSON.parse(raw.trim().split('\n').pop());
	for (const [label, got, want] of rows) {
		report(got === want, label, `expected ${want}, got ${got}`);
	}
} catch (err) {
	report(false, 'resume guard fixtures ran', String(err.message).slice(0, 200));
}

console.log('');
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
