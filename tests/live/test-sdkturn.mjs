import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const COMMIT = process.env.VSCODE_COMMIT || 'a44adf7f53e00964ab890f9f8758a334f1fc15bc';
const B = `/v/vscode-server/bin/linux-arm64/${COMMIT}/out/vs/platform/agentHost/node/agentHostMain.js`;
fs.writeFileSync('/tmp/agentHostMain.fresh.js', execFileSync('docker',
	['run', '--rm', '-v', 'vscode:/v', 'alpine', 'cat', B],
	{ encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }));
const s = fs.readFileSync('/tmp/agentHostMain.fresh.js', 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

// Pull the injected guard out by brace matching, so the test runs shipped code.
const at = s.indexOf('.parent_tool_use_id&&(');
const open = s.lastIndexOf('if(!', at);
let depth = 0;
let end = -1;
for (let i = s.indexOf('{', at); i < s.length; i++) {
	if (s[i] === '{') { depth++; }
	else if (s[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const guard = s.slice(open, end);
console.log('guard head: ' + guard.slice(0, 150) + '\n');

const parentVar = guard.match(/^if\(!(\w+)&&(\w+)&&/)?.slice(1);
const [pVar, mVar] = parentVar ?? [];
console.log(`parent=${pVar} message=${mVar}\n`);

const run = (msg) => {
	const fired = [];
	const self = {
		_queue: { _yielded: [], peekParent: () => self._queue._yielded[0] },
		_logService: { info: () => { } },
		_onDidProduceSignal: { fire: (x) => fired.push(x) },
		chatChannelUri: 'ahp-chat://default/test',
	};
	const fn = new Function(pVar, mVar, `${guard}; return this._queue._yielded;`);
	const yielded = fn.call(self, undefined, msg);
	return { yielded, fired };
};

// The shape actually observed being dropped: streamed output, no user message.
const streamed = run({ type: 'stream_event' });
check(streamed.yielded.length === 1, 'stream_event with no parent opens a turn', streamed.yielded.length);
check(streamed.fired.some(f => f.action?.type === 'chat/turnStarted'), 'fires chat/turnStarted');
check(String(streamed.yielded[0]?.turnId).startsWith('sdkturn-'), 'turn id is synthetic', streamed.yielded[0]?.turnId);

const assistant = run({ type: 'assistant' });
check(assistant.yielded.length === 1, 'assistant with no parent opens a turn');

// Existing behaviour must survive: a bare tool_result must not manufacture a turn.
const toolResult = run({ type: 'user', message: { content: [{ type: 'tool_result' }] } });
check(toolResult.yielded.length === 0, 'user carrying only a tool_result opens nothing');

const userText = run({ type: 'user', message: { content: [{ type: 'text' }] } });
check(userText.yielded.length === 1, 'user with text still opens a turn');

const inner = run({ type: 'assistant', parent_tool_use_id: 'toolu_x' });
check(inner.yielded.length === 0, 'a subagent inner message opens nothing');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
