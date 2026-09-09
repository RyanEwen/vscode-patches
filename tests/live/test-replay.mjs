import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const COMMIT = process.env.VSCODE_COMMIT || 'a44adf7f53e00964ab890f9f8758a334f1fc15bc';
const B = `/v/vscode-server/bin/linux-arm64/${COMMIT}/out/vs/platform/agentHost/node/agentHostMain.js`;
const LOCAL = '/tmp/agentHostMain.replaytest.js';
fs.writeFileSync(LOCAL, execFileSync('docker',
	['run', '--rm', '-v', 'vscode:/v', 'alpine', 'cat', B],
	{ encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }));
const s = fs.readFileSync(LOCAL, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

check(s.includes('__ahLocalCmdReplay'), 'marker __ahLocalCmdReplay present');
check(s.includes('"compact_boundary","notification","local_command"'), 'allowlist carries local_command');

// Minified names can start with `$` (this one is `$ie`), so every identifier class
// here is `[\w$]+`. Using `\w` is what made both the patch anchor and this test miss.
const setAt = s.indexOf('new Set(["compact_boundary","notification","local_command"');
const fnStart = s.lastIndexOf('function ', setAt);
const body = s.slice(fnStart, s.indexOf(')', setAt) + 1);

const fnName = body.match(/^function ([\w$]+)/)?.[1];
const msgV = body.match(/^function [\w$]+\(([\w$]+),/)?.[1];
const readSubtype = body.match(/=([\w$]+)\([\w$]+\.message\);if/)?.[1];
const readText = body.match(/=([\w$]+)\([\w$]+\.message\)\?\?/)?.[1];
console.log(`  parsed: fn=${fnName} readSubtype=${readSubtype} readText=${readText}`);
check(!!(fnName && readSubtype && readText), 'function and its two readers identified');

// Supply the readers it depends on, then evaluate the shipped function.
const parse = new Function(readSubtype, readText, `${body}; return ${fnName};`)(
	(m) => m?.subtype,
	(m) => m?.content,
);

const run = (subtype, content) => parse({ uuid: 'u1', message: { subtype, content } }, '2026-09-06T00:00:00Z');

const wrapped = run('local_command', '<local-command-stdout>13 findings</local-command-stdout>');
check(wrapped !== undefined, 'local_command survives replay', wrapped?.subtype);
check(wrapped?.text === '13 findings', 'wrapper tags stripped', JSON.stringify(wrapped?.text));

check(run('compact_boundary', 'x') !== undefined, 'compact_boundary still allowed');
check(run('some_other_subtype', 'x') === undefined, 'an unlisted subtype is still dropped');
check(run('local_command', 'Set model to opus').text === 'Set model to opus',
	'untagged text passes through unchanged');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
