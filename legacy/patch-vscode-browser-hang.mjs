#!/usr/bin/env node
/**
 * Patch/revert the VS Code browser-tool hang (microsoft/vscode#322990) in an
 * INSTALLED VS Code, so the fix can be tested without building from source.
 *
 * The bug: when the owning client disconnects mid-turn, the agent host
 * synthesises a `ChatToolCallReady` with no `toolInput`. The workbench resolves
 * that to `{}` and invokes the browser tool with empty parameters.
 * `createBrowserPageLink(undefined)` then does `undefined.toString()` and
 * throws out of `prepareToolInvocation`, leaving the tool call stuck awaiting a
 * completion that never arrives, so the turn hangs with nothing logged.
 *
 * The patch adds the missing guard, matching the upstream source fix: with no
 * page id, return the plain unlinked label instead of throwing. The tool then
 * reaches its own `invoke`, which already reports a missing page id as a normal
 * error, so the turn completes instead of hanging.
 *
 * Usage (from Windows PowerShell/cmd, or WSL):
 *   node patch-vscode-browser-hang.mjs --apply
 *   node patch-vscode-browser-hang.mjs --revert
 *   node patch-vscode-browser-hang.mjs --status
 *   node patch-vscode-browser-hang.mjs --apply --target "<path to workbench.desktop.main.js>"
 *
 * Restart VS Code afterwards. Expect a "Your Code installation appears to be
 * corrupt" banner: that is the checksum notice for a modified bundle, it is
 * dismissible ("Don't show again") and does not affect behaviour. A VS Code
 * update replaces the file and silently undoes the patch.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const MARKER = 'vscodeLinkType=browser';

/**
 * Minified identifiers differ per build (stable uses cy/Vl, Insiders ly/Sc), so
 * match on structure and reuse whatever names the build chose. Anchored on the
 * whole function body, and required to match exactly once, so it fails closed
 * rather than doing anything fuzzy to an 18MB bundle.
 */
const UNPATCHED = /function (\w+)\((\w+)\)\{return typeof \2=="string"&&\(\2=(\w+)\.forId\(\2\)\),`\[\$\{(\w+)\.DEFAULT_LABEL\}\]\(\$\{\2\.toString\(\)\}\?vscodeLinkType=browser\)`\}/;
const PATCHED = /function (\w+)\((\w+)\)\{if\(\2==null\|\|\2===""\)return (\w+)\.DEFAULT_LABEL;return typeof \2=="string"/;

/** Rebuild the function with the guard, preserving the build's own identifiers. */
function patchedForm(match, fn, arg, uriNs, labelNs) {
	return 'function ' + fn + '(' + arg + '){'
		+ 'if(' + arg + '==null||' + arg + '==="")return ' + labelNs + '.DEFAULT_LABEL;'
		+ 'return typeof ' + arg + '=="string"&&(' + arg + '=' + uriNs + '.forId(' + arg + ')),'
		+ '`[${' + labelNs + '.DEFAULT_LABEL}](${' + arg + '.toString()}?vscodeLinkType=browser)`}';
}

function candidateTargets() {
	const rel = 'resources/app/out/vs/workbench/workbench.desktop.main.js';
	const roots = [];
	if (process.platform === 'win32') {
		const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
		roots.push(
			path.join(local, 'Programs', 'Microsoft VS Code'),
			path.join(local, 'Programs', 'Microsoft VS Code Insiders'),
			'C:\\Program Files\\Microsoft VS Code',
		);
	} else {
		// WSL reaching the Windows install. The WSL username rarely matches the
		// Windows one, so enumerate profiles rather than guessing.
		const winUsers = '/mnt/c/Users';
		if (fs.existsSync(winUsers)) {
			for (const entry of fs.readdirSync(winUsers, { withFileTypes: true })) {
				if (!entry.isDirectory()) { continue; }
				const base = path.join(winUsers, entry.name, 'AppData/Local/Programs');
				roots.push(
					path.join(base, 'Microsoft VS Code'),
					path.join(base, 'Microsoft VS Code Insiders'),
				);
			}
		}
		roots.push('/usr/share/code');
	}
	const found = [];
	for (const root of roots) {
		if (!fs.existsSync(root)) { continue; }
		// Stable installs nest the bundle under a build-hash directory.
		const direct = path.join(root, rel);
		if (fs.existsSync(direct)) { found.push(direct); continue; }
		for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory()) { continue; }
			const nested = path.join(root, entry.name, rel);
			if (fs.existsSync(nested)) { found.push(nested); }
		}
	}
	return found;
}

function sha(text) {
	return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function backupPathFor(target) {
	return target + '.prepatch-backup';
}

function main() {
	const args = process.argv.slice(2);
	const flag = (n) => args.includes(n);
	const valueOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

	const explicit = valueOf('--target');
	const targets = explicit ? [explicit] : candidateTargets();
	if (targets.length === 0) {
		console.error('No workbench.desktop.main.js found. Pass --target <path>.');
		process.exit(1);
	}

	for (const target of targets) {
		console.log(`\n${target}`);
		if (!fs.existsSync(target)) { console.log('  missing'); continue; }
		const data = fs.readFileSync(target, 'utf8');
		const patched = PATCHED.test(data);
		const matches = data.match(new RegExp(UNPATCHED.source, 'g'));
		const patchable = !patched && matches !== null;
		const backup = backupPathFor(target);

		if (flag('--status') || (!flag('--apply') && !flag('--revert'))) {
			console.log(`  state:   ${patched ? 'PATCHED' : patchable ? 'unpatched (patchable)' : 'site not found'}`);
			console.log(`  marker:  ${data.includes(MARKER) ? 'present' : 'ABSENT (wrong file?)'}`);
			console.log(`  backup:  ${fs.existsSync(backup) ? backup : 'none'}`);
			continue;
		}

		if (flag('--revert')) {
			if (!fs.existsSync(backup)) { console.log('  no backup to restore'); continue; }
			fs.copyFileSync(backup, target);
			console.log('  reverted from backup');
			continue;
		}

		// --apply
		if (patched) { console.log('  already patched'); continue; }
		if (!patchable) {
			console.log('  patch site not found (VS Code version changed?).');
			console.log(`  Search the bundle for "${MARKER}" and re-derive the snippet.`);
			continue;
		}
		if (matches.length !== 1) {
			console.log(`  ABORT: expected exactly one occurrence, found ${matches.length}`);
			continue;
		}
		if (!fs.existsSync(backup)) {
			fs.copyFileSync(target, backup);
			console.log(`  backup -> ${backup}`);
		}
		console.log(`  sha before: ${sha(data)}`);
		const next = data.replace(UNPATCHED, patchedForm);
		fs.writeFileSync(target, next);
		console.log(`  sha after:  ${sha(next)}`);
		console.log('  PATCHED. Restart VS Code (fully, not Reload Window).');
	}
}

main();
