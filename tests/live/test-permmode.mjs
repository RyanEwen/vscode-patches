import fs from 'node:fs';

const F = process.env.VSCODE_WORKBENCH_BUNDLE;
if (!F) throw new Error('Set VSCODE_WORKBENCH_BUNDLE to the bundle to test.');
const s = fs.readFileSync(F, 'utf8');

let failures = 0;
const check = (ok, label, detail) => {
	if (!ok) { failures++; }
	console.log(`  [${ok ? 'pass' : 'FAIL'}] ${label}${detail !== undefined ? '  ' + detail : ''}`);
};

check(s.includes('__ahPermMode'), 'marker __ahPermMode present');

/** Slice a function body by matching braces, since minified code has no line structure. */
function bodyAt(text, sig) {
	const at = text.indexOf(sig);
	if (at < 0) { throw new Error('signature not found: ' + sig); }
	let i = text.indexOf('{', at + sig.length - 1);
	const open = i;
	let depth = 0;
	for (; i < text.length; i++) {
		const c = text[i];
		if (c === '{') { depth++; }
		else if (c === '}') { depth--; if (depth === 0) { return text.slice(open + 1, i); } }
	}
	throw new Error('unbalanced');
}

const body = bodyAt(s, '_getInitialConfig(){');
console.log('\nbody tail:\n  ...' + body.slice(-260) + '\n');

const modeSet = body.match(/&&(\w+)\.has\(/)?.[1];
const approvals = body.match(/=(\w+)\(\w+\?\.approvals\)/)?.[1];
const migrate = body.match(/,(\w+)\((\w+)\)$/)?.[1];
console.log(`modeSet=${modeSet} approvalsMapper=${approvals} migrate=${migrate}`);

const make = (settings, policyValue) => {
	const self = {
		_environmentService: { isSessionsWindow: false },
		_configurationService: {
			getValue: (k) => settings[k],
			inspect: () => ({ policyValue }),
		},
	};
	const fn = new Function(approvals, modeSet, migrate, `return function(){${body}}`);
	return fn(() => undefined, new Set(['interactive', 'plan', 'autopilot']), (c) => c).call(self);
};

console.log('');
const withSetting = make({ 'chat.agentHost.claudeAgent.defaultPermissionMode': 'auto' });
check(withSetting?.permissionMode === 'auto', 'setting seeds permissionMode', JSON.stringify(withSetting));

const without = make({});
check(without?.permissionMode === undefined, 'absent setting leaves it unset', JSON.stringify(without));

const bogus = make({ 'chat.agentHost.claudeAgent.defaultPermissionMode': 42 });
check(bogus?.permissionMode === undefined, 'non-string value is ignored', JSON.stringify(bogus));

check(withSetting?.isolation === 'folder', 'isolation still host-owned', withSetting?.isolation);

// Elevated modes degrade to default while policy restricts auto-approval.
const clamped = make({ 'chat.agentHost.claudeAgent.defaultPermissionMode': 'auto' }, false);
check(clamped?.permissionMode === 'default', 'elevated mode clamped under policy', clamped?.permissionMode);
const planned = make({ 'chat.agentHost.claudeAgent.defaultPermissionMode': 'plan' }, false);
check(planned?.permissionMode === 'plan', 'plan is not elevated, survives policy', planned?.permissionMode);

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
