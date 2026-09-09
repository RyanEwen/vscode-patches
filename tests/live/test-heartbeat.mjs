/**
 * Exercise `claude-turn-reports-activity` against the shipped bundle.
 *
 * The injected code is a timer, so it is driven here with a stubbed
 * `setInterval` and a controlled clock, and the emitted activity strings are
 * observed. The point of interest is what the row says while a turn is quiet
 * and, more importantly, what it stops saying once work resumes: clients render
 * their own indicator, and a stale elapsed count sitting over live output is
 * what made this read as a regression.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FIXES } from '../../patch-vscode-fixes.mjs';

const COMMIT = process.env.VSCODE_COMMIT || 'a44adf7f53e00964ab890f9f8758a334f1fc15bc';
const B = `/v/vscode-server/bin/linux-arm64/${COMMIT}/out/vs/platform/agentHost/node/agentHostMain.js`;
const LOCAL = '/tmp/agentHostMain.hbtest.js';
fs.writeFileSync(LOCAL, execFileSync('docker',
	['run', '--rm', '-v', 'vscode:/v', 'alpine', 'cat', B],
	{ encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
let src = fs.readFileSync(LOCAL, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

const entry = FIXES.find(p => p.id === 'claude-turn-reports-activity');
check(!!entry, 'entry present in the patcher');

if (entry.patched.test(src)) {
	console.log('  [note] bundle already patched; testing the shipped code as-is');
} else {
	const hits = src.match(new RegExp(entry.unpatched.source, 'g')) ?? [];
	check(hits.length === 1, 'anchor matches exactly once', 'matches=' + hits.length);
	src = src.replace(entry.unpatched, (...a) => entry.build(...a));
}
check(entry.patched.test(src), 'marker present in the source under test');

// Lift the injected block: everything from the timer teardown up to the
// `setInterval(...,1000);` that installs it.
const from = src.indexOf('try{this.__ahHeartbeat&&clearInterval');
const tail = src.indexOf('},1000);', from);
check(from > 0 && tail > from, 'located the injected heartbeat block');
const block = src.slice(from, tail + '},1000);'.length);

/** Run the block against a fake host, then step the clock. */
const drive = () => {
	const emitted = [];
	let tick = null;
	let now = 1_000_000;
	const host = {
		_logService: { info: () => { }, warn: () => { } },
		chatChannelUri: 'chat://x',
		_onDidProduceSignal: {
			fire: (sig) => emitted.push(sig?.action?.activity),
		},
		// Empty from the outset, which is what a skill subagent turn looks like:
		// nothing in flight for minutes. The row must survive that.
		_queue: { isEmpty: true },
	};
	const realNow = Date.now;
	const install = new Function('setInterval', 'clearInterval', 'Date', `return function(){${block}};`)(
		(fn) => { tick = fn; return 1; },
		() => { tick = null; },
		{ now: () => now },
	);
	return {
		emitted,
		host,
		push: () => install.call(host),
		advance: (seconds) => {
			for (let i = 0; i < seconds; i++) {
				now += 1000;
				if (tick) { tick(); }
			}
		},
		// What the turn's result does, per `activity-clears-when-the-turn-results`.
		stop: () => { host.__ahHbActive = 0; if (tick) { tick(); } Date.now = realNow; },
	};
};

// A turn that is quiet for well under two minutes must stay silent, so the
// client's own rotating indicator is what the user sees.
{
	const h = drive();
	h.push();
	h.advance(45);
	check(h.emitted.filter(a => a !== undefined).length === 0,
		'45s of silence emits no activity, leaving the client indicator alone',
		'emitted ' + JSON.stringify(h.emitted.filter(a => a !== undefined).slice(0, 2)));
}

// A genuinely long stall should speak.
{
	const h = drive();
	h.push();
	h.advance(130);
	const said = h.emitted.filter(a => a !== undefined);
	check(said.length > 0, 'a 130s stall does report activity', said[0]);
	check(/^Working, /.test(said[0] ?? ''), 'and it reads as an elapsed count', said[0]);
}

// The regression: once work resumes the row must be handed back immediately.
{
	const h = drive();
	h.push();
	h.advance(130);
	const before = h.emitted.length;
	h.push();
	const cleared = h.emitted.slice(before);
	check(cleared.includes(undefined), 'a push after a stall clears the activity row', JSON.stringify(cleared));
}

// The `/code-review` case: a slash command whose skill subagent runs for minutes
// with an empty queue throughout. This is what previously killed the timer within
// a second or two and rendered nothing for the whole run.
{
	const h = drive();
	h.push();
	h.advance(300);
	const said = h.emitted.filter(a => a !== undefined);
	check(said.length > 0, 'a 5m skill-subagent turn with an empty queue still reports', said.at(-1));
	check(/^Working, 5m/.test(said.at(-1) ?? ''), 'and the count keeps climbing', said.at(-1));
}

// Ending the turn must not strand a row either.
{
	const h = drive();
	h.push();
	h.advance(130);
	const before = h.emitted.length;
	h.stop();
	check(h.emitted.slice(before).includes(undefined), 'turn end clears the activity row');
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
