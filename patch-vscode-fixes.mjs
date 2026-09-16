#!/usr/bin/env node
/**
 * Re-apply the local VS Code agent-host fixes to an INSTALLED VS Code, so they
 * survive a VS Code update without another debugging session.
 *
 * A VS Code update replaces both bundles and silently drops every fix here.
 * Symptoms, in the order they tend to be noticed: sessions stop listing in
 * remote windows, deleting a session stops sticking, browser-tool turns hang.
 *
 * Two bundles are patched, because the code runs in two places:
 *
 *   workbench  the client. For a remote window this is the LOCAL install
 *              (Windows), not the container.
 *                resources/app/out/vs/workbench/workbench.desktop.main.js
 *   agenthost  the agent host. For a dev container this runs INSIDE the
 *              container, from the shared `vscode` docker volume, so one
 *              patch covers every dev container on that server commit.
 *                /vscode/vscode-server/bin/<arch>/<commit>/out/vs/platform/
 *                agentHost/node/agentHostMain.js
 *
 * Usage:
 *   node patch-vscode-fixes.mjs --status
 *   node patch-vscode-fixes.mjs --apply
 *   node patch-vscode-fixes.mjs --revert
 *   node patch-vscode-fixes.mjs --apply --only session-delete,replay-drive
 *   node patch-vscode-fixes.mjs --apply --target "<path to a bundle>"
 *
 * Restart VS Code fully afterwards (not Reload Window): the container's server
 * survives a reload, so only a container restart picks up an agenthost change.
 * Expect a "Your Code installation appears to be corrupt" banner: that is the
 * checksum notice for a modified bundle, dismissible and harmless.
 *
 * Every fix matches on structure and reuses whatever names the build chose,
 * because minified identifiers differ per build. Each must match exactly once
 * or it is skipped, so this fails closed rather than doing anything fuzzy to a
 * multi-megabyte bundle.
 */
import fs from 'node:fs';
import { transformAgentFeedbackReview } from './patchers/agent-feedback-review.mjs';
import { transformCodexSteeringInput } from './patchers/codex-steering-input.mjs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BACKUP_SUFFIX = '.vscodefix-orig';
const VOLUME = 'vscode';
const VOLUME_GLOB = '/vscode/vscode-server/bin/*/*/out/vs/platform/agentHost/node/agentHostMain.js';

/**
 * Pick a local variable name for injected code that cannot collide with any
 * identifier the minifier already chose at that site.
 */
function pickName(taken) {
	for (const name of ['L', 'q', 'z', 'j', 'Z', '_nf']) {
		if (!taken.includes(name)) { return name; }
	}
	throw new Error('no free identifier');
}

const FIXES = [
	{
		id: 'client-tool-input-schema',
		target: 'workbench',
		title: 'a client tool runs with empty input when its arguments never streamed',
		// A call whose arguments never streamed arrives with no `toolInput`, which
		// `resolveToolInput` turns into `{}`, indistinguishable from a genuine empty
		// argument set. The browser tools then prepare with `pageId` undefined and
		// throw, though all nine declare it required. Check the parsed parameters
		// against the tool's own schema at the single invocation point instead.
		// Re-anchored for 1.133.x: upstream inserted an `invocationFailed` branch and
		// made the tool input an awaited read, which widened the gap. Upstream still
		// does not check required properties, so this entry is still doing work.
		unpatched: /if\(!(\w+)\)\{(\w+)\(\w+\(\d+,null,(\w+)\),"toolUnavailable"\);return\}[\s\S]{0,700}?let (\w+);try\{let \w+=JSON\.parse\([\s\S]{0,220}?"invalidInput"\);return\}/,
		patched: /_mreq\.length&&/,
		build: (m, toolData, fail, toolName, params) =>
			m
			+ `let _mreq=${toolData}.inputSchema&&${toolData}.inputSchema.type==="object"&&${toolData}.inputSchema.required`
			+ `?${toolData}.inputSchema.required.filter(k=>${params}[k]===void 0):[];`
			+ `if(_mreq.length&&(${fail}('Invalid tool input for "'+${toolName}+'": missing required '+_mreq.join(", "),"invalidInput"),1))return;`,
	},
	{
		id: 'session-list',
		target: 'workbench',
		title: 'sessions never list in remote windows',
		// A dev-container window listed no sessions at all. The host reports each
		// session's working directories wrapped for the agent-host filesystem
		// (`vscode-agent-host://b64-<host address>/workspace/printstream`), while
		// the window's folder is `vscode-remote://dev-container+<hex>/...`.
		// `isEqualOrParent` gates on the scheme before anything else, so the two
		// never match and the whole list is filtered out. Reported as #330979.
		//
		// The wrapper carries the original URI in its `_ah` query, and unwrapping
		// it here yields the very `vscode-remote:` URI the window uses for that
		// folder, so the comparison is exact rather than assumed. Measured in a
		// live window: the unwrapped authority equals the folder's, byte for byte.
		//
		// Two earlier revisions are recorded so they are not retried. Normalising
		// both sides to `file:` with an empty authority lists the sessions, but
		// compares paths alone, so two different remotes exposing the same path
		// would match. Lifting a `file:` directory into the folder's namespace
		// filtered every session out, and this is why: the reported directory is
		// not `file:` at all, so that rewrite never fired. The namespace lift is
		// kept as the fallback for a host that does report a bare `file:` path.
		//
		// The unwrap is what made this offerable upstream, since it no longer
		// assumes the window's remote is the session's host. Mirrors #331349.
		//
		// The optional clause matches both earlier revisions as well as the
		// upstream form, so an already-patched bundle upgrades in place. That
		// matters because the `.vscodefix-orig` backup here is not pristine.
		unpatched: /_matchesAnyFolder\((\w+),(\w+)\)\{(?:const (\w+)=(\w+)=>\4\.scheme==="file"\?\4:\4\.with\(\{scheme:"file",authority:"",query:"",fragment:""\}\);)?return \1\.some\((\w+)=>\2\.some\((\w+)=>(\w+)\.isEqualOrParent\((?:\3\()?\5\)?,(?:\3\()?\6\.uri\)?\)\)\)\}/,
		patched: /_matchesAnyFolder\(\w+,\w+\)\{const \w+=\(\w+,\w+\)=>/,
		build: (...args) => {
			const src = args[args.length - 1];
			const [, dirs, folders, fn, fnArg, dir, folder, uriNs] = args;
			// The agent-host URI decoder, located by shape so the minifier is free
			// to rename it. Reused rather than reimplemented: it owns the `_ah`
			// encoding, and a copy here would drift from it silently.
			// The second alternative covers 1.136.0, where the query read moved into a helper.
			const decoder = src.match(/function (\w+)\((\w+)\)\{if\(\2\.scheme!==\w+\)return \2;let (?:\w+,\w+=\2\.query\?new URLSearchParams\(\2\.query\)\.get\(|(\w+)=\w+\(\2\);return!\3\|\|typeof \3\.scheme!="string"\?)/);
			if (!decoder) { throw new Error('session-list: agent-host URI decoder not found'); }
			const taken = [dirs, folders, fn, fnArg, dir, folder, uriNs, decoder[1]].filter(Boolean);
			const ns = pickName(taken);
			const d = pickName([...taken, ns]);
			const f = pickName([...taken, ns, d]);
			return `_matchesAnyFolder(${dirs},${folders}){`
				+ `const ${ns}=(${d},${f})=>${d}.scheme==="file"&&${f}.scheme!=="file"&&${f}.authority?`
				+ `${f}.with({path:${d}.path,query:null,fragment:null}):${d};`
				+ `return ${dirs}.some(${dir}=>${folders}.some(${folder}=>`
				+ `${uriNs}.isEqualOrParent(${ns}(${decoder[1]}(${dir}),${folder}.uri),${folder}.uri)))}`;
		},
	},
	{
		id: 'session-list-remote-project-root',
		target: 'workbench',
		title: 'a legacy session whose project root is on the remote is dropped from the list',
		// `_containmentCandidates` admits a legacy session's project root only when
		// it is `file:`. In a dev container that root arrives as `vscode-remote://`,
		// so it is silently excluded and the session matches no workspace folder.
		//
		// The scheme test widens to accept the window's own remote namespace, which
		// is still a directory a workspace folder can contain. The exclusion this
		// test exists for, an `https://` repository URL whose `fsPath` is not a
		// location on disk, is unaffected. Mirrors microsoft/vscode#334145.
		//
		// Distinct from `session-list`, which unwraps `vscode-agent-host://`
		// working directories. This is the project-root candidate beside them.
		unpatched: /([\w$]+)\.scheme===([\w$]+)\.file&&([\w$]+)\.push\(\1\)/,
		patched: /\.scheme===[\w$]+\.file\|\|[\w$]+\.scheme===[\w$]+\.vscodeRemote\)&&[\w$]+\.push\(/,
		build: (m, uri, schemas, arr) =>
			`(${uri}.scheme===${schemas}.file||${uri}.scheme===${schemas}.vscodeRemote)&&${arr}.push(${uri})`,
	},
	{
		id: 'embedded-attachment-content-type',
		target: 'workbench',
		title: 'a pasted image renders as a broken thumbnail',
		// An embedded attachment is persisted without a `contentType`, and the
		// restore path reads `.contentType.startsWith('image/')` straight off it,
		// so the read throws and the attachment never renders.
		//
		// Measured in a real session: the stored record is
		// `{"type":"embeddedResource","label":"Pasted Image","displayKind":"image","data":"..."}`
		// with no `contentType` key anywhere in the database. The Windows-style
		// path in the hover was a red herring: that is just the label formatter
		// rendering a remote path on a Windows client.
		//
		// `displayKind` already says it is an image, so the type is inferred from
		// it rather than guessed. A non-image with no content type falls through to
		// the generic branch instead of being treated as an image.
		//
		// Current producers all default the field, so NEW pastes were never
		// affected; this repairs attachments already on disk. Mirrors
		// microsoft/vscode#331569.
		unpatched: /if\((\w+)\.type==="embeddedResource"\)return \1\.contentType\.startsWith\("image\/"\)\?\{kind:"image",id:(\w+)\(\),name:\1\.label\|\|"image",value:(\w+)\(\1\.data\)\.buffer,mimeType:\1\.contentType,isURL:!1/,
		patched: /\?\?\(\w+\.displayKind==="image"\?"image\/png"/,
		build: (m, att, uuid, decode) =>
			`if(${att}.type==="embeddedResource")return `
			+ `(${att}.contentType??(${att}.displayKind==="image"?"image/png":"")).startsWith("image/")`
			+ `?{kind:"image",id:${uuid}(),name:${att}.label||"image",value:${decode}(${att}.data).buffer,`
			+ `mimeType:${att}.contentType??"image/png",isURL:!1`,
	},
	{
		id: 'client-tool-buffer',
		target: 'agenthost',
		title: 'a client tool result is dropped when it arrives before the SDK asks for it',
		// The workbench runs a client tool off the stream-mapper ready and completes
		// it in milliseconds, before the SDK has invoked the tool and registered its
		// handler. `respond` discards a result nothing is waiting for, so when the
		// SDK registers moments later it waits forever and the turn never finishes.
		// Copilot already uses `respondOrBuffer` here; this brings Claude in line.
		// Verified live: the buffered result is collected ~1.5s later and the turn
		// continues, in auto mode, which never once completed before.
		unpatched: /completeClientToolCall\(([\w$]+),([\w$]+)\)\{let ([\w$]+)=([\w$]+)\(\2,\1\);return this\._pendingClientToolCalls\.respond\(\1,\3\)\}/,
		patched: /completeClientToolCall\([\s\S]{0,200}?_pendingClientToolCalls\.respondOrBuffer\(/,
		build: (m, toolCallId, result, converted, convertFn) => {
			const held = pickName([toolCallId, result, converted, convertFn]);
			return `completeClientToolCall(${toolCallId},${result}){`
				+ `let ${converted}=${convertFn}(${result},${toolCallId}),`
				+ `${held}=this._pendingClientToolCalls.respond(${toolCallId},${converted});`
				+ `${held}||this._pendingClientToolCalls.respondOrBuffer(${toolCallId},${converted});`
				+ `return ${held}}`;
		},
	},
	{
		id: 'client-tool-error',
		target: 'agenthost',
		title: 'a client tool error reaches the model as an empty result',
		// A client tool that throws is reported as an `error` with no content, and
		// only `content` was read, so the model got `{content: [], isError: true}`:
		// told that something failed but never what.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+)\)\{let ([\w$]+)=\{content:\(\2\.content\?\?\[\]\)\.map\(\(([\w$]+),([\w$]+)\)=>([\w$]+)\(\5,\3,\6\)\)\};return \2\.structuredContent!==void 0&&\(\4\.structuredContent=\2\.structuredContent\),\(!\2\.success\|\|\2\.error\)&&\(\4\.isError=!0\),\4\}/,
		patched: /\.error&&\w+\.length===0&&\w+\.push\(\{type:"text",text:\w+\.error\.message\}\)/,
		build: (m, fn, result, toolUseId, out, block, index, convertBlock) => {
			const arr = pickName([fn, result, toolUseId, out, block, index, convertBlock]);
			return `function ${fn}(${result},${toolUseId}){`
				+ `let ${arr}=(${result}.content??[]).map((${block},${index})=>${convertBlock}(${block},${toolUseId},${index}));`
				+ `${result}.error&&${arr}.length===0&&${arr}.push({type:"text",text:${result}.error.message});`
				+ `let ${out}={content:${arr}};`
				+ `return ${result}.structuredContent!==void 0&&(${out}.structuredContent=${result}.structuredContent),`
				+ `(!${result}.success||${result}.error)&&(${out}.isError=!0),${out}}`;
		},
	},
	// The next five edits together implement the replayed-client-tool guard
	// (upstream: the client_tool_invoked signal PR). An SDK resume can replay a
	// transcript-dangling tool_use without streaming anything, so no client
	// execution is ever requested and the turn heartbeats forever. Each edit is
	// inert without the others (the router falls back to register), so partial
	// application after a VS Code update degrades to the unpatched behavior.
	{
		id: 'replay-args',
		target: 'agenthost',
		title: 'client tool MCP handler forwards tool name and args',
		// The handler only forwards the tool_use_id, so the replay path cannot tell
		// which tool was invoked or with what. Forward the name and arguments too.
		//
		// Every identifier is captured, never hardcoded. The 1.133.x minifier
		// swapped the roles of the two names this previously assumed, so the patch
		// silently passed `args.name` (undefined) as the tool name and the tool
		// definition as the arguments. `[REPLAYFIX] await <id> (undefined)` in the
		// agent host log is the signature of that regression.
		unpatched: /(async\(([\w$]+),([\w$]+)\)=>\{let ([\w$]+)=[\w$]+\(\3\);return \4===void 0\?\{content:\[\{type:"text",text:`Client tool "\$\{([\w$]+)\.name\}"[\s\S]{0,160}?`\}\],isError:!0\}:)([\w$]+)\(\4\)(\}\)\)\);return [\w$]+\.createSdkMcpServer\()/,
		patched: /(?:isError:!0\}:|return await )[\w$]+\([\w$]+,[\w$]+\.name,[\w$]+\)/,
		// Also matches the try/catch form `client-tool-handler-never-throws` rewrites this into.
		build: (m, prefix, args, extra, id, toolDef, cb, suffix) =>
			`${prefix}${cb}(${id},${toolDef}.name,${args})${suffix}`,
	},
	{
		id: 'replay-route',
		target: 'agenthost',
		title: 'client tool wiring routes through the replay-aware awaiter',
		unpatched: /\{client:await ([\w$]+)\((\w+),(\w+)=>(\w+)\.register\(\3\),(\w+)\)\}/,
		patched: /\{client:await [\w$]+\(\w+,\(\w+,\w+,\w+\)=>\w+\.__vsAwait\?/,
		build: (m, fn, t, i, n, e) =>
			`{client:await ${fn}(${t},(${i},nm,ag)=>${n}.__vsAwait?${n}.__vsAwait(${i},nm,ag):${n}.register(${i}),${e})}`,
	},
	{
		id: 'replay-turnid',
		target: 'agenthost',
		title: 'session stashes the active turn id',
		unpatched: /async send\(((?:[\w$]+,){2,8}[\w$]+)\)\{let ([\w$]+)=this\._requirePipeline\(\);/,
		patched: /async send\([^\)]*\)\{this\.__vsTurnId=/,
		// `turnId` is the second parameter, whatever the arity.
		build: (m, params, pipe) =>
			`async send(${params}){this.__vsTurnId=${params.split(",")[1]};let ${pipe}=this._requirePipeline();`,
	},
	{
		id: 'replay-seen',
		target: 'agenthost',
		title: 'session records which tool calls actually streamed, and under which turn',
		// Records `toolCallId -> turnId` rather than a bare set of ids. The turn id
		// is needed by `replay-drive`'s resync, and taking it from the signal makes
		// it authoritative: the session-level `__vsTurnId` is stashed only in
		// `send()`, so a turn synthesized elsewhere -- a promoted steering turn --
		// leaves it pointing at the preempted turn. Observed: every client tool
		// call readied inside a steering turn was stranded, because the resync
		// asked for a request under the wrong turn and silently matched nothing.
		unpatched: /this\._register\((\w+)\.onDidProduceSignal\((\w+)=>this\._onDidSessionProgress\.fire\(this\._enrichSignalWithMcpContributor\(this\._enrichSignalWithCredits\(\2\)\)\)\)\)/,
		patched: /onDidProduceSignal\(\w+=>\{\w+&&\w+\.kind==="action"&&\w+\.action&&\(/,
		build: (m, s, y) =>
			`this._register(${s}.onDidProduceSignal(${y}=>{${y}&&${y}.kind==="action"&&${y}.action&&(${y}.action.turnId&&(this.__vsLastTurn=${y}.action.turnId),${y}.action.type==="chat/toolCallStart"&&(this.__vsSeen??=new Map()).set(${y}.action.toolCallId,${y}.action.turnId));this._onDidSessionProgress.fire(this._enrichSignalWithMcpContributor(this._enrichSignalWithCredits(${y})))}))`,
	},
	{
		id: 'replay-drive',
		target: 'agenthost',
		title: 'drive execution for a replayed (never-streamed) client tool call',
		unpatched: /_buildStartupToolWiring\(([\w$]+),([\w$]+)\)\{let ((?:[^;]{0,400}?,)?)([\w$]+)=await ([\w$]+)\(this\.toolDiff,this\._pendingClientToolCalls,this\._sdkService\)/,
		patched: /_buildStartupToolWiring\([^\)]*\)\{this\._pendingClientToolCalls\.__vsAwait=[\s\S]{0,4000}?let done=false,fire=/,
		build: (m, e, e2, lead, t, yl) =>
			`_buildStartupToolWiring(${e},${e2}){`
			+ 'this._pendingClientToolCalls.__vsAwait=(id,nm,ag)=>{'
			+ '(globalThis.__vsDriven??=new Set).add(this.chatChannelUri.toString());'
			+ '(globalThis.__vsInvoked??=new Set).add(id);'
			+ 'this._logService.info(`[REPLAYFIX] await ${id} (${nm}) seen=${!!(this.__vsSeen&&this.__vsSeen.has(id))}`);'
			+ 'if(this.__vsSeen&&this.__vsSeen.has(id)){'
			// The turn the call actually streamed under. `__vsTurnId` is only set in
			// `send()`, so it is stale for a promoted steering turn and the resync
			// then matches no pending request, stranding the call for good.
			+ 'let vt=(this.__vsSeen.get&&this.__vsSeen.get(id))||this.__vsLastTurn||this.__vsTurnId;'
			+ 'this._logService.info(`[REPLAYFIX] resync ${id} turn=${vt} live=${this.__vsLastTurn} stashed=${this.__vsTurnId}`);'
			+ 'globalThis.__vsResync&&globalThis.__vsResync(this.chatChannelUri.toString(),vt,id);'
			+ 'return this._pendingClientToolCalls.register(id)}'
			+ 'return this._pendingClientToolCalls.registerAndFire(id,()=>{'
			+ 'let ow=this.toolDiff.model.ownerOf(nm);'
			+ 'if(!ow){this._logService.warn(`[REPLAYFIX] no owning client for replayed tool ${nm}; ${id} cannot execute`);return}'
			+ 'let done=false,fire=(pid)=>{if(done)return;done=true;'
			+ 'if(pid){this._onDidSessionProgress.fire({kind:"subagent_started",chat:this.chatChannelUri,toolCallId:pid,agentName:"subagent",agentDisplayName:"Subagent"});}'
			+ 'let ex=pid?{parentToolCallId:pid}:{};'
			+ 'let st=this.__vsLastTurn||this.__vsTurnId;'
			+ 'this._logService.info(`[REPLAYFIX] driving replayed client tool ${id} (${nm}) turn=${st} live=${this.__vsLastTurn} stashed=${this.__vsTurnId} parent=${pid||"none"}`);'
			+ 'this._onDidSessionProgress.fire({kind:"action",resource:this.chatChannelUri,...ex,action:{type:"chat/toolCallStart",turnId:st,toolCallId:id,toolName:nm,displayName:nm,contributor:{kind:"client",clientId:ow}}});'
			+ 'this._onDidSessionProgress.fire({kind:"action",resource:this.chatChannelUri,...ex,action:{type:"chat/toolCallReady",turnId:st,toolCallId:id,invocationMessage:nm,toolInput:JSON.stringify(ag??{}),confirmed:"not-needed"}});'
			+ '};'
			+ '(async()=>{try{'
			+ 'let sid=this.sessionId,ids=await this._sdkService.listSubagents(sid);'
			+ 'for(let aid of ids||[]){'
			+ 'let ms=await this._sdkService.getSubagentMessages(sid,aid);'
			+ 'for(let mm of ms||[]){'
			+ 'let cc=mm&&mm.message&&mm.message.content;'
			+ 'if(Array.isArray(cc)&&cc.some(b=>b&&b.type==="tool_use"&&b.id===id)){fire(mm.parent_tool_use_id||void 0);return}'
			+ '}}'
			+ '}catch(e2){this._logService.warn(`[REPLAYFIX] subagent lookup failed for ${id}: ${e2}`)}'
			+ 'fire(void 0)})();'
			+ '})};'
			+ `let ${lead}${t}=await ${yl}(this.toolDiff,this._pendingClientToolCalls,this._sdkService)`,
	},
	// The next four edits together surface a steering message as its own turn,
	// which is what upstream did for Copilot (PR #318456) and what CONTEXT.md M10
	// already specified: the ack belongs at model visibility, not queue
	// acceptance. Without them a steer is acked the moment the queue hands it to
	// the SDK, the pending bubble is removed, and the message is left with no
	// representation while the model visibly acts on it.
	{
		id: 'steering-pending',
		target: 'agenthost',
		title: 'the pipeline only receives the steering id, not the message',
		unpatched: /(\w+)\.injectSteering\((\w+),(\w+)\.id\)\}setPermissionMode/,
		patched: /\w+\.injectSteering\(\w+,\w+\.id,\w+\)\}setPermissionMode/,
		build: (m, pipeline, sdkMessage, pending) =>
			`${pipeline}.injectSteering(${sdkMessage},${pending}.id,${pending})}setPermissionMode`,
	},
	{
		id: 'steering-buffer',
		pr: 333919,
		target: 'agenthost',
		title: 'a steering message is forgotten once it is queued',
		// The guard makes injection idempotent per pending id. `steering-hold`
		// suppresses the early ack, so the client keeps the message pending and
		// re-sends it on any resync. Without it the same steer is queued twice and
		// yielded under two different turns, leaving a turn open that no work fills.
		unpatched: /injectSteering\((\w+),(\w+)\)\{if\(this\._abortController([\s\S]{0,600}?)this\._queue\.push\(\{sdkMessage:\1,/,
		patched: /injectSteering\(\w+,\w+,\w+\)\{if\(this\._steerSeen[\s\S]{0,1200}?_steerFlips=new Map\)\)/,
		build: (m, prompt, pendingId, middle) => {
			const message = pickName([prompt, pendingId]);
			return `injectSteering(${prompt},${pendingId},${message}){`
				+ `if(this._steerSeen&&this._steerSeen.has(${pendingId}))return;`
				+ `(this._steerSeen||(this._steerSeen=new Set)).add(${pendingId});`
				+ `if(this._abortController${middle}`
				+ `(this._steerFlips||(this._steerFlips=new Map)).set(${pendingId},${message}),`
				+ `this._queue.push({sdkMessage:${prompt},`;
		},
	},
	{
		id: 'steering-hold',
		target: 'agenthost',
		title: 'the pending bubble is cleared when the queue hands the message over',
		// Held until the SDK echoes the message back, so it is never invisible.
		// `steering-promote` clears it by starting the steering turn instead.
		unpatched: /,(\w+)=>this\._onDidProduceSignal\.fire\(\{kind:"steering_consumed",chat:this\.chatChannelUri,id:\1\}\)\)\)/,
		patched: /,\(\)=>\{\}\)\),this\._router/,
		build: () => `,()=>{}))`,
	},
	{
		id: 'steering-promote',
		target: 'agenthost',
		title: 'a steering message never becomes its own turn',
		// The SDK emits one result per turn it ran, so the result that ends the
		// preempted turn is where the steer has demonstrably reached the model.
		// It does not echo steering messages on the stream, so there is no
		// earlier signal to use.
		unpatched: /(\w+)&&this\._queue\.isEmpty&&this\._onDidProduceSignal\.fire\(\{kind:"action",resource:this\.chatChannelUri,action:\{type:"chat\/turnComplete",turnId:\1\.turnId,duration:Math\.max\(0,\1\.stopWatch\.elapsed\(\)\)\}\}\)/,
		patched: /__ahPromoted=_sfV\.id/,
		build: (m, completed) => {
			const [pendingId, steering, stamp, watch] = ['_sfI', '_sfV', '_sfS', '_sfW'];
			const drain = `this._steerFlips&&(this._steerFlips.forEach((v,k)=>this._onDidProduceSignal.fire(`
				+ `{kind:"steering_consumed",chat:this.chatChannelUri,id:k})),this._steerFlips.clear())`;
			const complete = (turn, sw) => `this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,`
				+ `action:{type:"chat/turnComplete",turnId:${turn},duration:Math.max(0,${sw})}})`;
			return `${completed}&&(this._queue.isEmpty`
				+ `?(${drain},${complete(`${completed}.turnId`, `${completed}.stopWatch.elapsed()`)},`
				+ `this.__ahPromoted===${completed}.turnId&&(this.__ahPromoted=void 0))`
				+ `:(()=>{`
				+ `let ${pendingId}=this._queue.peekParent()&&this._queue.peekParent().steeringPendingId,`
				+ `${steering}=${pendingId}&&this._steerFlips&&this._steerFlips.get(${pendingId});`
				// REVERTED 2026-09-05. A drain here retired every yielded non-head steer on
				// the merged result, which removed the SECOND bubble at the same moment the
				// first was rendered. That is worse than the behaviour it replaced, where
				// the second stayed put and the first reappeared once read. `steering_consumed`
				// is evidently not "the model has seen it", it is "this bubble has been
				// superseded by something the user can now see", and only the promotion path
				// knows that. Do not re-add a drain here without a rendering signal.
				+ `if(!${steering}){this._logService.warn("[STEERFLIP] result arrived with a non-empty queue but no steering flip for pendingId="`
					+ `+${pendingId}+", so nothing was promoted and the pending bubble will linger until the queue empties");return}`
				+ `this._steerFlips.delete(${steering}.id);`
				+ `${complete(`${completed}.turnId`, `${completed}.stopWatch.elapsed()`)};`
				+ `let ${stamp}=Date.now(),${watch}={elapsed:()=>Date.now()-${stamp}};`
				+ `this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,`
				+ `action:{type:"chat/turnStarted",turnId:${steering}.id,startedAt:new Date().toISOString(),`
				+ `message:${steering}.message,queuedMessageId:${steering}.id}});`
				+ `this.__ahPromoted=${steering}.id;`
				+ `for(let _sfL of[this._queue._toYield,this._queue._yielded,this._queue._popped])`
				+ `for(let _sfE of _sfL||[]){_sfE.turnId=${steering}.id;_sfE.stopWatch=${watch}}`
				+ `})())`;
		},
	},
	{
		id: 'steering-drain',
		target: 'agenthost',
		title: 'a steering message the SDK never echoes leaves its bubble behind on abort',
		unpatched: /abort\(\)\{this\._abortController\.signal\.aborted\|\|\(this\._abortController\.abort\(\),this\._queue\.failAll\(new (\w+)\),this\._needsRebind=!0\)\}/,
		patched: /abort\(\)\{this\._abortController[\s\S]{0,700}?__ahPromoted&&\(this\._onDidProduceSignal/,
		build: (m, cancelError) =>
			`abort(){this._abortController.signal.aborted||(this._abortController.abort(),`
			+ `this._queue.failAll(new ${cancelError}),`
			+ `this._steerFlips&&(this._steerFlips.forEach((v,k)=>this._onDidProduceSignal.fire(`
			+ `{kind:"steering_consumed",chat:this.chatChannelUri,id:k})),this._steerFlips.clear()),`
			+ `this._steerSeen&&this._steerSeen.clear(),`
			+ `this.__ahPromoted&&(this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,`
			+ `action:{type:"chat/turnCancelled",turnId:this.__ahPromoted,duration:0}}),this.__ahPromoted=void 0),`
			+ `this._needsRebind=!0)}`,
	},
	{
		id: 'client-tool-single-trigger',
		target: 'agenthost',
		title: 'a client tool executes off the streamed ready rather than the runtime invocation',
		// Upstream proposal: microsoft/vscode#330933. Admits a Claude client tool
		// to execution only once its runtime invocation is announced, so the call
		// cannot run twice, run with no arguments, or finish before anything
		// awaits it. Other providers announce nothing and are left on the
		// streamed ready, matching the PR.
		unpatched: /(\w+)\?\.status==="running"&&(\w+)\?\.kind==="client"\?this\._setSessionInputNeeded\((\w+),\{id:(\w+),kind:"toolClientExecution"/,
		patched: /globalThis\.__vsInvoked&&globalThis\.__vsInvoked\.has/,
		build: (m, toolCall, contributor, chatUri, requestId) =>
			`(globalThis.__vsResync=globalThis.__vsResync||((c,t,i)=>this._syncToolInputNeeded(c,t,i))),`
			+ `${toolCall}?.status==="running"&&${contributor}?.kind==="client"`
			+ `&&(!globalThis.__vsDriven||!globalThis.__vsDriven.has(${chatUri})`
			+ `||(globalThis.__vsInvoked&&globalThis.__vsInvoked.has(${toolCall}.toolCallId)))`
			+ `?this._setSessionInputNeeded(${chatUri},{id:${requestId},kind:"toolClientExecution"`,
	},
	{
		id: 'session-chip-list-scope',
		target: 'agenthost',
		title: 'the session list re-derives the chip from the branch for inactive sessions',
		// `session-chip-scope` fixes only the WRITE path, which runs on turn
		// completion. The list has its own READ path: `computeListEntryChanges`
		// returns the persisted summary first, and failing that derives one from
		// the BRANCH changeset and persists it. Two consequences, both observed
		// here: a session that has not completed a turn since the patch keeps its
		// branch-derived number forever, and a session that never ran a turn at
		// all still gets one written for it (sessions with zero turns and zero
		// file edits showing +16070 -634, i.e. the entire `dev` vs `origin/main`
		// divergence).
		//
		// Source the read path from the session changeset as well, and stop
		// deriving from the branch at all: with no session-scoped evidence the
		// honest answer is no chip, not the branch's number. The persisted
		// summary is kept as the last resort rather than the first, because in a
		// multi-folder session it holds the all-folder aggregate that must never
		// be clobbered by a primary-only re-derivation (the worked example in
		// `getListMetadataKeys`). Metadata keys and the changeset URI suffix are
		// protocol constants, so they are written literally; the two summarisers
		// are captured, since those names are minifier-chosen.
		unpatched: /computeListEntryChanges\(([\w$]+),([\w$]+)\)\{if\(this\._stateManager\.getSessionState\(\1\)\)return;let ([\w$]+)=\2\[([\w$]+)\];if\(\3!==void 0\)try\{return JSON\.parse\(\3\)\}catch\{return\}let ([\w$]+)=this\._stateManager\.getChangesetState\(([\w$]+)\(\1\)\),([\w$]+)=([\w$]+)\(\5\);if\(\7\)return this\.persistChangesSummary\(\1,\7\),\7;let ([\w$]+)=\2\[([\w$]+)\],([\w$]+)=\2\[([\w$]+)\];if\(\9===void 0&&\11===void 0\)return;let ([\w$]+)=this\.parsePersistedStaticChangesets\(\1,\{branchRaw:\9,legacyRaw:\11\}\),([\w$]+)=([\w$]+)\(\13\.branch\);if\(\14\)return this\.persistChangesSummary\(\1,\14\),\14\}/,
		patched: /computeListEntryChanges\([\w$]+,[\w$]+\)\{if\(this\._stateManager\.getSessionState\([\w$]+\)\)return;let __ls=/,
		build: (m, session, meta, o, summaryKey, i, branchUri, s, fromState, a, branchKey, l, legacyKey, d, c, fromDiffs) =>
			`computeListEntryChanges(${session},${meta}){`
			+ `if(this._stateManager.getSessionState(${session}))return;`
			+ `let __ls=${fromState}(this._stateManager.getChangesetState(${session}+"/changeset/session"));`
			+ `if(__ls)return this.persistChangesSummary(${session},__ls),__ls;`
			+ `let __sr=${meta}["agentHost.changeset.session"];`
			+ `if(__sr!==void 0){`
			+ `let __sp=this.parsePersistedStaticChangesets(${session},{sessionRaw:__sr}),__ss=${fromDiffs}(__sp.session);`
			+ `if(__ss)return this.persistChangesSummary(${session},__ss),__ss}`
			+ `let __st=${meta}["agentHost.changes"];`
			+ `if(__st!==void 0)try{return JSON.parse(__st)}catch{return}`
			+ `}`,
	},
	{
		id: 'slash-resolve-harness',
		target: 'workbench',
		title: 'a message containing a slash command never submits in a remote window',
		// `resolvePromptSlashCommand` parses the command's uri unconditionally,
		// but a built-in skill's uri is a discovery-only identity on the
		// `agent-builtin` scheme with no content behind it ("the entries have no
		// openable content"). The read rejects, the rejection escapes the
		// resolver, and its caller is the input-decoration update that feeds
		// `parsedInput` -- so the message can never be sent and nothing is
		// reported. Reported as microsoft/vscode#331138, fixed by
		// microsoft/vscode#331145.
		//
		// Mirrors the upstream change: the parse becomes best-effort and yields
		// `undefined`, cancellation still propagates, and the two consumers that
		// dereference `parsedPromptFile` are guarded (see `slash-consumer-*`).
		// `isCancellationError` is not reachable by name in the bundle, so the
		// cancellation test is inlined the way that helper defines it.
		unpatched: /async resolvePromptSlashCommand\((\w+),(\w+),(\w+)\)\{let (\w+)=\(await this\.getSlashCommands\(\2,\3\)\)\.find\((\w+)=>\5\.name===\1\);if\(\4\)\{let (\w+)=await this\.promptsService\.parseNew\(\4\.uri,\3\);return\{\.\.\.\4,userInvocable:\6\.header\?\.userInvocable\?\?\4\.userInvocable,parsedPromptFile:\6\}\}\}/,
		patched: /async resolvePromptSlashCommand\(\w+,\w+,\w+\)\{let \w+=\(await this\.getSlashCommands\([\s\S]{0,240}?parseNew\(\w+\.uri,\w+\)\.catch\(/,
		build: (m, name, session, token, cmd, pred, parsed) => {
			const err = pickName([name, session, token, cmd, pred, parsed]);
			return `async resolvePromptSlashCommand(${name},${session},${token}){`
				+ `let ${cmd}=(await this.getSlashCommands(${session},${token})).find(${pred}=>${pred}.name===${name});`
				+ `if(${cmd}){let ${parsed}=await this.promptsService.parseNew(${cmd}.uri,${token}).catch(${err}=>{`
				+ `if(${err}&&(${err}.name==="Canceled"||${err}.name==="AbortError"))throw ${err};return void 0});`
				+ `return{...${cmd},userInvocable:${parsed}?.header?.userInvocable??${cmd}.userInvocable,parsedPromptFile:${parsed}}}}`;
		},
	},
	{
		id: 'slash-resolve-prompts',
		target: 'workbench',
		title: 'the prompts service resolver rejects on an unreadable slash command',
		// Same defect in the other resolver, reached by a different caller. This
		// one has a logger, so a non-cancellation failure is traced with the
		// command name — a real parse regression stays distinguishable from a
		// command that legitimately has nothing to read.
		unpatched: /async resolvePromptSlashCommand\((\w+),(\w+),(\w+)\)\{let (\w+)=\(await this\.getPromptSlashCommands\(\3\)\)\.find\((\w+)=>\5\.name===\1&&(\w+)\(\5\.sessionTypes,\2\)\);if\(\4\)return\{\.\.\.\4,parsedPromptFile:await this\.parseNew\(\4\.uri,\3\)\}\}/,
		patched: /async resolvePromptSlashCommand\(\w+,\w+,\w+\)\{let \w+=\(await this\.getPromptSlashCommands\([\s\S]{0,240}?parseNew\(\w+\.uri,\w+\)\.catch\(/,
		build: (m, name, sessionType, token, cmd, pred, matches) => {
			const err = pickName([name, sessionType, token, cmd, pred, matches]);
			return `async resolvePromptSlashCommand(${name},${sessionType},${token}){`
				+ `let ${cmd}=(await this.getPromptSlashCommands(${token})).find(${pred}=>${pred}.name===${name}&&${matches}(${pred}.sessionTypes,${sessionType}));`
				+ `if(${cmd})return{...${cmd},parsedPromptFile:await this.parseNew(${cmd}.uri,${token}).catch(${err}=>{`
				+ `if(${err}&&(${err}.name==="Canceled"||${err}.name==="AbortError"))throw ${err};`
				+ `this.logger.trace("[resolvePromptSlashCommand] no readable content for \'"+${cmd}.name+"\' ("+${cmd}.uri+"): "+(${err}&&${err}.message||${err}));`
				+ `return void 0})}}`;
		},
	},
	{
		id: 'slash-consumer-sessions',
		target: 'workbench',
		title: 'the session send path dereferences a prompt file that may be absent',
		// With the resolvers now yielding `undefined` for a command with no
		// readable content, this consumer would throw on `.body`/`.uri`. A
		// discovery-only command simply contributes no variable entry.
		unpatched: /if\((\w+)\)\{let (\w+)=\1\.parsedPromptFile,(\w+)=\2\.body\?\.variableReferences\.map\(\(\{name:(\w+),offset:(\w+),fullLength:(\w+)\}\)=>\(\{name:\4,range:new (\w+)\(\5,\5\+\6\)\}\)\)\?\?\[\],(\w+)=(\w+)\.toToolReferences\(\3\);return (\w+)\(\2\.uri,"vscode\.prompt\.file",void 0,!0,\8\)\}/,
		patched: /let \w+=\w+\.parsedPromptFile;if\(\w+\)\{let \w+=\w+\.body\?\.variableReferences/,
		build: (m, cmd, parsed, refs, nameV, offV, lenV, rangeNs, tools, toolsSvc, entryFn) =>
			`if(${cmd}){let ${parsed}=${cmd}.parsedPromptFile;if(${parsed}){`
			+ `let ${refs}=${parsed}.body?.variableReferences.map(({name:${nameV},offset:${offV},fullLength:${lenV}})=>`
			+ `({name:${nameV},range:new ${rangeNs}(${offV},${offV}+${lenV})}))??[],`
			+ `${tools}=${toolsSvc}.toToolReferences(${refs});`
			+ `return ${entryFn}(${parsed}.uri,"vscode.prompt.file",void 0,!0,${tools})}}`,
	},
	{
		id: 'slash-consumer-widget',
		target: 'workbench',
		title: 'the chat widget dereferences a prompt file that may be absent',
		// Same guard on the widget's send path. Prompt-run telemetry is still
		// recorded for a command with no body, and the header metadata step is
		// simply skipped rather than throwing.
		unpatched: /if\(!(\w+)\)return!0;let (\w+)=\1\.parsedPromptFile,(\w+)=\2\.body\?\.variableReferences\.map\(\(\{name:(\w+),offset:(\w+),fullLength:(\w+)\}\)=>\(\{name:\4,range:new (\w+)\(\5,\5\+\6\)\}\)\)\?\?\[\],(\w+)=this\.toolsService\.toToolReferences\(\3\);(\w+)\.attachedContext\.insertFirst\((\w+)\(\2\.uri,"vscode\.prompt\.file",void 0,!0,\8\)\);let (\w+)=\{storage:\1\.storage\}/,
		patched: /let \w+=\w+\.parsedPromptFile;if\(\w+\)\{let \w+=\w+\.body\?\.variableReferences[\s\S]{0,400}?attachedContext\.insertFirst/,
		build: (m, cmd, parsed, refs, nameV, offV, lenV, rangeNs, tools, input, entryFn, evt) =>
			`if(!${cmd})return!0;let ${parsed}=${cmd}.parsedPromptFile;if(${parsed}){`
			+ `let ${refs}=${parsed}.body?.variableReferences.map(({name:${nameV},offset:${offV},fullLength:${lenV}})=>`
			+ `({name:${nameV},range:new ${rangeNs}(${offV},${offV}+${lenV})}))??[],`
			+ `${tools}=this.toolsService.toToolReferences(${refs});`
			+ `${input}.attachedContext.insertFirst(${entryFn}(${parsed}.uri,"vscode.prompt.file",void 0,!0,${tools}))}`
			+ `let ${evt}={storage:${cmd}.storage}`,
	},
	{
		id: 'slash-consumer-widget-header',
		target: 'workbench',
		title: 'the chat widget applies header metadata from an absent prompt file',
		// Tail of the same function: the header step must tolerate no prompt file.
		unpatched: /!\((\w+)\.header&&!await this\._applyPromptMetadata\(\1\.header,(\w+)\)\)/,
		patched: /!\(\w+\?\.header&&!await this\._applyPromptMetadata\(/,
		build: (m, parsed, input) =>
			`!(${parsed}?.header&&!await this._applyPromptMetadata(${parsed}.header,${input}))`,
	},
	{
		id: 'client-tool-owner-recency',
		target: 'agenthost',
		title: 'a tool call is stamped with a client that has gone away',
		// `ownerOf` without a preference resolves to the first-inserted
		// contributor. A window reload connects with a new clientId and
		// re-pushes the same tools while the departed entry can still be
		// present, so every later call is stamped with a dead client and fails
		// on arrival — permanently, not for the grace window. Prefer the most
		// recent contributor: a reconnecting window is the one most recently
		// known to be alive. Mirrors microsoft/vscode#331300.
		unpatched: /setTools\((\w+),(\w+)\)\{this\._toolSet\.set\(\1,\2\),this\._merged\.set\(this\._toolSet\.merged\(\),void 0\)\}getTools\((\w+)\)\{return this\._toolSet\.get\(\3\)\}removeClient\((\w+)\)\{this\._toolSet\.delete\(\4\)&&this\._merged\.set\(this\._toolSet\.merged\(\),void 0\)\}ownerOf\((\w+),(\w+)\)\{return this\._toolSet\.ownerOf\(\5,\6\)\}/,
		patched: /setTools\(\w+,\w+\)\{this\.__rec=/,
		build: (m, cid, tools, getId, remId, tname, pref) =>
			`setTools(${cid},${tools}){this.__rec=(this.__rec||[]).filter(_r=>_r!==${cid}),this.__rec.unshift(${cid}),`
			+ `this._toolSet.set(${cid},${tools}),this._merged.set(this._toolSet.merged(),void 0)}`
			+ `getTools(${getId}){return this._toolSet.get(${getId})}`
			+ `removeClient(${remId}){this.__rec=(this.__rec||[]).filter(_r=>_r!==${remId}),`
			+ `this._toolSet.delete(${remId})&&this._merged.set(this._toolSet.merged(),void 0)}`
			+ `ownerOf(${tname},${pref}){`
			+ `let _c=${pref}?[${pref}].concat(this.__rec||[]):(this.__rec||[]);`
			+ `for(let _id of _c)if(this._toolSet.get(_id).some(_t=>_t.name===${tname}))return _id;`
			+ `return this._toolSet.ownerOf(${tname},${pref})}`,
	},
	{
		id: 'native-model-vision',
		target: 'agenthost',
		title: 'a pasted image is labelled unsupported though the model receives it',
		// The native (SDK) projection hardcodes supportsVision to false while the
		// CAPI one reads the real capability. The SDK's ModelInfo carries no vision
		// field, so false stood in for "unknown" -- but nothing downstream treats it
		// that way: the provider collapses it to a boolean and the attachment widget
		// renders a warning plus "{model} does not support images" over an image the
		// model does receive and describe. Every row this transport offers is a
		// Claude model with image input. Mirrors microsoft/vscode#331396.
		unpatched: /(\{provider:\w+,id:\w+\.value,name:\w+\.displayName,)supportsVision:!1/,
		patched: /\{provider:\w+,id:\w+\.value,name:\w+\.displayName,supportsVision:!0/,
		build: (m, head) => `${head}supportsVision:!0`,
	},
	{
		id: 'consumed-message-not-removed',
		target: 'workbench',
		title: 'a queued message the host consumed is retired as cancelled',
		// `removePendingRequest` settles the caller's `sendRequest` promise as
		// `{kind:"rejected",reasonCode:"cancelled"}`, which is right for a message
		// the user withdrew. The server-initiated turn path calls it for the
		// message the host just STARTED RUNNING, so a delivered message reports
		// cancellation. Skip the id that is becoming this turn; the queue entry
		// still clears via the reconciliation that follows the same state change.
		// Mirrors microsoft/vscode#331408.
		//
		// Re-anchored for 1.136.0: upstream (#332461) inserted a second
		// assignment, `previousTurnIds = currentTurnIds`, between the queue
		// assignment and `startServerRequest`. The optional group keeps older
		// bundles matching, and the build re-emits that assignment when it is
		// present. The removal loop itself is unchanged, so this entry still
		// does work.
		unpatched: /for\(let (\w+) of (\w+)\)(\w+)\.has\(\1\)\|\|this\._chatService\.removePendingRequest\((\w+),\1\);\2=\3,(?:(\w+)=(\w+),)?(\w+)\.startServerRequest\((\w+)\.id,/,
		patched: /\|\|\w+===\w+\.id\|\|this\._chatService\.removePendingRequest/,
		build: (m, it, prev, cur, session, prevTurns, curTurns, chatSession, turn) =>
			`for(let ${it} of ${prev})${cur}.has(${it})||${it}===${turn}.id||this._chatService.removePendingRequest(${session},${it});`
			+ `${prev}=${cur},`
			+ (prevTurns ? `${prevTurns}=${curTurns},` : '')
			+ `${chatSession}.startServerRequest(${turn}.id,`,
	},
	{
		id: 'consumed-message-settles-sent',
		target: 'workbench',
		title: 'a consumed queued message never resolves its send promise',
		// The other half: with the cancel path skipped, the caller is still
		// waiting. The request the host's turn creates arrives under the very id
		// the message was queued with, so settle the deferred there, as sent.
		//
		// Every path settles exactly once, because nothing else will now that
		// reconciliation leaves a consumed message alone. Reporting it as sent
		// means handing back an agent and a response to await, so when there is
		// neither the caller is told the send failed rather than left waiting.
		// The completion promise is settled by the session's store as well as by
		// the response, so a session closed mid-turn cannot leave it pending;
		// the ordinary send path makes the same guarantee.
		//
		// Mirrors microsoft/vscode#331408, including its review round.
		//
		// Re-anchored for 1.136.0: upstream (#332461) put a `resume` branch at
		// the top of the handler, which reopens an existing request and returns
		// early, so the gap before `getAgent` grew from under 140 characters to
		// 214. Only the window changed. The settlement is still appended to the
		// non-resume path; a resumed turn's request already exists, so it has
		// no deferred left to settle.
		unpatched: /(\w+)\.onDidStartServerRequest&&(\w+)\.add\(\1\.onDidStartServerRequest\(\(\{id:(\w+),[\s\S]{0,240}?\}\)=>\{[\s\S]{0,320}?let (\w+)=this\.chatAgentService\.getAgent\(\w+\),\w+=\w+\(\w+,\4\);(\w+)=\w+\.addRequest\([\s\S]{0,240}?\),\w+=0,\w+\(\)/,
		patched: /_qcm=this\._queuedRequestDeferreds\.get\(/,
		build: (m, provider, store, id, agent, lastRequest) =>
			m
			+ `,(()=>{let _qcm=this._queuedRequestDeferreds.get(${id});`
			+ `if(!_qcm)return;`
			+ `this._queuedRequestDeferreds.delete(${id});`
			+ `let _qcr=${lastRequest}&&${lastRequest}.response;`
			+ `if(!${agent}||!_qcr){_qcm.complete({kind:"rejected",reason:"The provider started the request but the session could not describe it"});return}`
			+ `let _qcs,_qcc=new Promise(_qcx=>{_qcs=_qcx});`
			+ `let _qcf=()=>{if(_qcs){let _qcy=_qcs;_qcs=void 0;_qcy()}};`
			+ `if(_qcr.isComplete)_qcf();`
			+ `else{let _qcl=${store}.add(_qcr.onDidChange(()=>{_qcr.isComplete&&(_qcl.dispose(),_qcf())}));`
			+ `${store}.add({dispose:_qcf})}`
			+ `_qcm.complete({kind:"sent",data:{agent:${agent},`
			+ `responseCreatedPromise:Promise.resolve(_qcr),responseCompletePromise:_qcc}})})()`,
	},
	{
		id: 'consumed-message-sync-reconcile',
		target: 'workbench',
		title: 'reconciliation cancels the consumed message and settles nothing',
		// Two defects in one function, both on the path the host's own turn takes.
		//
		// `getPendingRequests` hands back the model's live array, and
		// `replacePendingRequests` empties it in place before the settlement loop
		// runs, so the loop iterates nothing and every message that really did
		// leave the provider queue is left waiting forever. Copying it first is
		// what makes the loop, and therefore the guard below, do anything at all.
		//
		// The loop then rejects the message the host just consumed, racing the
		// `sent` settlement from `consumed-message-settles-sent`: both follow the
		// same state change. Skipping the consumed id leaves that settlement to
		// the request path, which reports what actually happened.
		//
		// The read is matched in both its copied and uncopied forms, so this entry
		// keeps applying if microsoft/vscode#334002 lands on its own. Without that
		// the entry would drop while its three siblings kept applying, leaving the
		// consumed message racing between "sent" and "cancelled".
		//
		// The id arrives in a third parameter, supplied by
		// `consumed-message-sync-arg`. Other callers pass two arguments and get
		// `undefined`, which no request id equals, so they are unaffected.
		// Mirrors microsoft/vscode#331408.
		unpatched: /syncPendingRequestsFromRemote\((\w+),(\w+)\)\{let (\w+)=this\._sessionModels\.get\(\1\);if\(!\3\)return;let (\w+)=(?:\[\.\.\.)?\3\.getPendingRequests\(\)\]?,([\s\S]{0,900}?)for\(let (\w+) of \4\)\{if\((\w+)\.has\(\6\.request\.id\)\)continue;/,
		patched: /syncPendingRequestsFromRemote\(\w+,\w+,_qcid\)/,
		build: (m, res, remote, model, prev, mid, entry, kept) =>
			`syncPendingRequestsFromRemote(${res},${remote},_qcid){`
			+ `let ${model}=this._sessionModels.get(${res});if(!${model})return;`
			+ `let ${prev}=[...${model}.getPendingRequests()],${mid}`
			+ `for(let ${entry} of ${prev}){`
			+ `if(${kept}.has(${entry}.request.id)||${entry}.request.id===_qcid)continue;`,
	},
	{
		id: 'consumed-message-sync-arg',
		target: 'workbench',
		title: 'reconciliation is not told which message the host consumed',
		// The projection knows which turn the host started, so it can name the
		// message that left the queue by being run rather than withdrawn. Feeds
		// `consumed-message-sync-reconcile`, which is inert without it.
		//
		// Anchored on the enclosing method rather than on the nearest preceding
		// `_getSessionState` call: a lazy match from that alone starts at an
		// earlier method and captures ITS state variable, emitting a name that is
		// not in scope here. Caught before install, by reading what was emitted.
		// Mirrors microsoft/vscode#331408.
		unpatched: /_applyRemotePendingMessages\((\w+),(\w+)\)\{([\s\S]{0,300}?)let (\w+)=this\._getSessionState\(([\s\S]{0,700}?)this\._chatService\.syncPendingRequestsFromRemote\((\w+),(\w+)\)/,
		patched: /syncPendingRequestsFromRemote\(\w+,\w+,\w+\.activeTurn\?\.id\)/,
		build: (m, res, chat, pre, state, mid, arg, projected) =>
			m.slice(0, m.lastIndexOf(`this._chatService.syncPendingRequestsFromRemote(`))
			+ `this._chatService.syncPendingRequestsFromRemote(${arg},${projected},${state}.activeTurn?.id)`,
	},
	{
		id: 'steer-preempt-not-error',
		target: 'agenthost',
		title: 'a turn interrupted by a steer renders as failed',
		// Interrupting a turn makes the SDK emit a result of subtype
		// `error_during_execution`, and the mapper turns any such result into a
		// ChatError. Without `steering-promote` the preempted turn has no bubble
		// so this is invisible; promoting the steer gives it somewhere to land,
		// and every steered message renders an error above its own correct answer.
		//
		// The SDK always makes an internal diagnostic the FIRST entry of `errors`
		// and appends the real errors, if any, after it. On its own it is not a
		// failure: an interrupted turn carries nothing else. So the fix belongs
		// where the error text is extracted, not in the signal fan-out. Dropping
		// the diagnostic leaves a genuine error intact (minus a prefix never meant
		// for users) and leaves an interrupted turn with no error text at all, so
		// no ChatError is built for it.
		//
		// Two earlier attempts were wrong and are recorded so they are not retried:
		// keying the fan-out on the pending steer raced (the promotion clears the
		// flip at the same result seam the signal flows through), and matching the
		// `[ede_diagnostic]` marker alone was too broad, since a genuine failure
		// starts with that marker too.
		//
		// Pairs with `steering-promote`: enabling that without this brings the
		// error bubble back. Mirrors the fix pushed to microsoft/vscode#330785.
		unpatched: /if\((\w+)\.subtype==="error_during_execution"\)return \1\.errors\?\.join\(`\n`\)/,
		patched: /startsWith\("\[ede_diagnostic\]"\)/,
		build: (m, msg) =>
			`if(${msg}.subtype==="error_during_execution"){let _de=${msg}.errors?.filter(e=>!e.startsWith("[ede_diagnostic]"));return _de&&_de.length?_de.join(String.fromCharCode(10)):void 0}`,
	},
	{
		id: 'toolcall-progress-emit',
		target: 'agenthost',
		title: 'a long tool call reports nothing while it runs',
		// The SDK already says a tool call is still working. Every foreground
		// tool call over ~30s produces a `tool_progress` heartbeat, and a running
		// subagent produces `system/task_progress` naming its current step. The
		// mapper switch handles stream_event/result/assistant/user and delegates
		// only `system` to the subagent handler, so both fall through `default`
		// and are dropped. A turn that spends minutes inside one call sends the
		// client nothing but keepalives.
		//
		// Heartbeat frames carry a SYNTHETIC tool_use_id of the form
		// `<real>-heartbeat-<n>`, which matches no tool call; the real id is in
		// `parent_tool_use_id`. Keying on tool_use_id compiles, runs, and never
		// matches. Verified live: a 95s Bash call produced heartbeats at 29s, 58s
		// and 87s, each carrying the synthetic id.
		//
		// Upstream this is `chat/toolCallProgress`, submitted to the
		// agent-host-protocol repo which owns these types. VS Code cannot carry
		// it until that lands and is synced, so this applies the same action to
		// the shipped bundles. Actions are not filtered by negotiated version
		// (isActionKnownToVersion has no callers), so an unknown action type
		// reaches the client untouched.
		unpatched: /switch\(([\w$]+)\.type\)\{case"stream_event":return ([\w$]+)\(([\w$]+)\(\1\.event,([\w$]+),([\w$]+),(.{0,500}?)default:return \1\.type==="system"\?([\w$]+)\(\1,\4,([\w$]+)\):\[\]\}/,
		patched: /chat\/toolCallProgress/,
		build: (m, msg, tag, mapStream, chat, turn, mid, sysFn, reg) =>
			`switch(${msg}.type){case"stream_event":return ${tag}(${mapStream}(${msg}.event,${chat},${turn},${mid}`
			+ `default:{let P=null;`
			+ `if(${msg}.type==="tool_progress"){P={i:${msg}.parent_tool_use_id||${msg}.tool_use_id,m:Math.round((${msg}.elapsed_time_seconds||0)*1e3),t:void 0}}`
			+ `else if(${msg}.type==="system"&&${msg}.subtype==="task_progress"){P={i:${msg}.tool_use_id,m:(${msg}.usage&&${msg}.usage.duration_ms)||0,t:${msg}.summary||${msg}.description}}`
			+ `if(P&&P.i&&${turn}!==void 0){return[{kind:"action",resource:${chat},action:{type:"chat/toolCallProgress",turnId:${turn},toolCallId:P.i,elapsedMs:P.m,...P.t?{message:P.t}:{}}}]}`
			+ `return ${msg}.type==="system"?${sysFn}(${msg},${chat},${reg}):[]}}`,
	},
	{
		id: 'toolcall-progress-reduce',
		target: 'workbench',
		title: 'the client has nowhere to record tool call progress',
		// Pairs with `toolcall-progress-emit`. The chat reducer has no case for
		// the action, so it would land nowhere, the state would never change, and
		// the render path would never be triggered. Mirrors the upstream reducer:
		// running only, replacing any previous report wholesale.
		unpatched: /case"chat\/toolCallContentChanged":return (\w+)\((\w+),(\w+)\.turnId,\3\.toolCallId,(\w+)=>\4\.status!=="running"\?\4:\{\.\.\.\4,\.\.\.\3\._meta!==void 0\?\{_meta:\3\._meta\}:\{\},content:\3\.content\}\);/,
		patched: /case"chat\/toolCallProgress":/,
		build: (m, upd, st, act, tc) =>
			`case"chat/toolCallContentChanged":return ${upd}(${st},${act}.turnId,${act}.toolCallId,${tc}=>${tc}.status!=="running"?${tc}:{...${tc},...${act}._meta!==void 0?{_meta:${act}._meta}:{},content:${act}.content});`
			+ `case"chat/toolCallProgress":return ${upd}(${st},${act}.turnId,${act}.toolCallId,${tc}=>${tc}.status!=="running"?${tc}:{...${tc},...${act}._meta!==void 0?{_meta:${act}._meta}:{},progress:{elapsedMs:${act}.elapsedMs,...${act}.message!==void 0?{message:${act}.message}:{}}});`,
	},
	{
		id: 'toolcall-progress-reduce-host',
		target: 'agenthost',
		title: 'the agent host does not know the progress action either',
		// The host bundles its own copy of the chat reducer, so without this it
		// logs `Unhandled action type` for every progress report it forwards.
		// Same edit as `toolcall-progress-reduce`, which patches the workbench copy;
		// upstream both come from one source file and need only the single case.
		unpatched: /case"chat\/toolCallContentChanged":return (\w+)\((\w+),(\w+)\.turnId,\3\.toolCallId,(\w+)=>\4\.status!=="running"\?\4:\{\.\.\.\4,\.\.\.\3\._meta!==void 0\?\{_meta:\3\._meta\}:\{\},content:\3\.content\}\);/,
		patched: /case"chat\/toolCallProgress":/,
		build: (m, upd, st, act, tc) =>
			`case"chat/toolCallContentChanged":return ${upd}(${st},${act}.turnId,${act}.toolCallId,${tc}=>${tc}.status!=="running"?${tc}:{...${tc},...${act}._meta!==void 0?{_meta:${act}._meta}:{},content:${act}.content});`
			+ `case"chat/toolCallProgress":return ${upd}(${st},${act}.turnId,${act}.toolCallId,${tc}=>${tc}.status!=="running"?${tc}:{...${tc},...${act}._meta!==void 0?{_meta:${act}._meta}:{},progress:{elapsedMs:${act}.elapsedMs,...${act}.message!==void 0?{message:${act}.message}:{}}});`,
	},
	{
		id: 'toolcall-progress-render',
		target: 'workbench',
		title: 'a running tool call renders no progress',
		// Pairs with the other two. The chat UI already has a progress channel:
		// the Executing state carries a `progress` observable, which the generic
		// running row renders in place of the invocation message. Nothing on the
		// agent-host path ever feeds it, so it stays empty for the life of every
		// turn. `acceptProgress` is its only writer and its sole caller is the
		// extension-host tools service.
		//
		// A bare heartbeat carries no message, so the elapsed time is appended to
		// whatever label the row already shows rather than replacing it with
		// nothing.
		unpatched: /(\w+)\.status!=="running"\)return;(\w+)\.invocationMessage=(\w+)\(\1\.invocationMessage,(\w+)\)\?\?\2\.invocationMessage,/,
		patched: /acceptProgress\(\{progress:void 0/,
		build: (m, tc, inv, resolve, auth) =>
			`${tc}.status!=="running")return;${tc}.progress&&${inv}.acceptProgress({progress:void 0,message:((a,b)=>{let c=typeof a==="string"?a:a&&a.value,s=Math.floor(b/1e3),d=s<60?s+"s":Math.floor(s/60)+"m "+s%60+"s";return(c||"Working")+" ("+d+")"})(${resolve}(${tc}.progress.message,${auth})??${inv}.invocationMessage,${tc}.progress.elapsedMs)}),`
			+ `${inv}.invocationMessage=${resolve}(${tc}.invocationMessage,${auth})??${inv}.invocationMessage,`,
	},
	{
		id: 'session-delete',
		target: 'agenthost',
		title: 'deleting a Claude session does not delete the transcript',
		// Delete reaches the provider, and each implements it itself: Copilot has
		// `_deleteSdkSession`, Claude's `_disposeChat` is in-memory only, so the
		// transcript survives and the session is re-listed on reopen. Claude already
		// calls `_sdkService.deleteSession` in `truncateChat`, so the comment in
		// `_disposeChat` claiming the SDK has no delete RPC is simply stale.
		//
		// Re-anchored for 1.133.x: the old `disposeSession`/`_teardownEntry` shape
		// this matched no longer exists in any build. A provisional chat is skipped,
		// since it never reached the SDK and asking would pull in the download that
		// provisional creation avoids. Both reads happen before the teardown that
		// clears them. Tracked upstream as microsoft/vscode#330698.
		unpatched: /let ([\w$]+)=this\._findChatByUri\(([\w$]+)\);\1&&await this\._disposeLiveSession\(\1\),this\._chatBackings\.delete\(\2\),this\._chatConfigScopes\.delete\(\2\),this\._pruneActiveClientHandlesForChat\(([\w$]+)\),this\._otelService\.releaseSessionTraceContext\(([\w$]+)\.resource\.toString\(\)\)/,
		patched: /deleteSession\(__sid\)/,
		build: (m, target, chatKey, chat, ctx) => {
			const err = pickName([target, chatKey, chat, ctx]);
			return `let ${target}=this._findChatByUri(${chatKey});`
				+ `let __prov=${target}!==void 0&&!${target}.isPipelineReady,`
				+ `__sid=__prov?void 0:this._chatBackings.get(${chatKey})?.sdkSessionId;`
				+ `${target}&&await this._disposeLiveSession(${target}),`
				+ `this._chatBackings.delete(${chatKey}),this._chatConfigScopes.delete(${chatKey}),`
				+ `this._pruneActiveClientHandlesForChat(${chat}),`
				+ `this._otelService.releaseSessionTraceContext(${ctx}.resource.toString());`
				+ `if(__sid!==void 0){try{await this._sdkService.deleteSession(__sid),`
				+ 'this._logService.info(`[Claude] Deleted SDK session transcript ${__sid}`)}'
				+ `catch(${err}){`
				+ 'this._logService.warn(`[Claude] Failed to delete SDK session transcript: ${' + err + '}`)}}';
		},
	},
	{
		id: 'remote-window-authority-init',
		target: 'workbench',
		title: 'the in-window agent host claims to be local in a remote window',
		// LOCAL_AGENT_HOST_AUTHORITY means "the host shares the client's
		// filesystem", which toAgentHostUri relies on to hand `file:` URIs
		// through untouched. In a dev container the host runs on the remote
		// machine, so those paths reach a Windows renderer as `C:\workspace\...`
		// and every agent link and image is dead.
		//
		// Name the machine the paths are on: "local" for the client, or
		// "local+<remoteAuthority>" for the window's remote. The mapping entry
		// turns the latter into vscode-remote URIs.
		unpatched: /this\._isSessionsWindow=(\w+)\.isSessionsWindow,this\._enableSmokeTestDriver=!!\1\.enableSmokeTestDriver,/,
		patched: /this\.__ahAuth=/,
		build: (m, env) =>
			`this._isSessionsWindow=${env}.isSessionsWindow,this._enableSmokeTestDriver=!!${env}.enableSmokeTestDriver,`
			+ `this.__ahAuth=${env}.remoteAuthority?"local+"+${env}.remoteAuthority.toLowerCase():"local",`,
	},
	{
		id: 'remote-window-authority-fs',
		target: 'workbench',
		title: 'the agent host filesystem registers under the local authority',
		// Pairs with the other two. The filesystem provider must answer for the
		// same authority the URIs are wrapped with, or nothing resolves.
		unpatched: /_agentHostFileSystemService\.registerAuthority\((\w+),this\._agentHostService\)/,
		patched: /_agentHostFileSystemService\.registerAuthority\(this\.__ahAuth,this\._agentHostService\)/,
		build: () =>
			`_agentHostFileSystemService.registerAuthority(this.__ahAuth,this._agentHostService)`,
	},
	{
		id: 'remote-window-authority-session',
		target: 'workbench',
		title: 'the session handler is told the host is local',
		// The third site. This is the value threaded to every toAgentHostUri
		// call, so it decides whether chat links, images, attachments and diffs
		// are wrapped.
		unpatched: /connection:this\._agentHostService,connectionAuthority:(\w+),/,
		patched: /connection:this\._agentHostService,connectionAuthority:this\.__ahAuth,/,
		build: () =>
			`connection:this._agentHostService,connectionAuthority:this.__ahAuth,`,
	},
	{
		id: 'remote-window-authority-map',
		target: 'workbench',
		title: 'agent host file paths are handed to the client unmapped',
		// The fast path returns `file:` URIs untouched whenever the host is
		// "local", which is only safe when the host really is on the client's
		// machine. Rebase onto the window's own remote connection instead:
		// RemoteAuthorities.rewrite gives the browser a loadable URL, so images
		// render, and links open the same editor the explorer already uses.
		// Wrapping in vscode-agent-host: would fix links but not images, since
		// FileAccess.uriToBrowserUri only rewrites vscode-remote and file.
		//
		// Re-anchored for 1.136.0: upstream (#332791) moved the body into a
		// three-parameter `wrapAgentHostUri(uri, authority, contentRef)`, with
		// `toAgentHostUri` and `toAgentHostContentUri` as two-argument wrappers.
		// The fast path is unchanged. The optional third parameter keeps older
		// bundles matching; when present it is re-emitted so the untouched
		// `...contentRef?{contentRef:!0}:{}` tail still names a declared variable.
		unpatched: /function (\w+)\((\w+),(\w+)(?:,(\w+))?\)\{if\(\3==="local"&&\2\.scheme===(\w+)\.file\)return \2;/,
		patched: /__ahWin/,
		build: (m, fn, uri, auth, contentRef, schemas) =>
			`function ${fn}(${uri},${auth}` + (contentRef ? ',' + contentRef : '') + `){if(${uri}.scheme===${schemas}.file){if(${auth}==="local")return ${uri};`
			+ `let __ahWin=${auth}.startsWith("local+")?${auth}.slice(6):void 0;`
			+ `if(__ahWin)return ${uri}.with({scheme:${schemas}.vscodeRemote,authority:__ahWin})}`,
	},
	{
		id: 'workspace-folder-uses-real-remote',
		target: 'workbench',
		title: 'opening a session folder yields a window that can resolve nothing',
		// `_buildWorkspaceFromUri` uses the agent host URI as the workspace folder
		// root, so "Open in editor" writes
		// `vscode-agent-host://hex-<connection>/path?_ah=...` into the generated
		// `agent-sessions.code-workspace` and opens it in a plain window. That
		// window registers its agent host under "local", never under the hex
		// authority, so every read fails with "No connection for authority" and
		// the explorer shows folder stubs with error badges.
		//
		// Measured 2026-09-09: authority `hex-77736c3a5562756e7475` decodes to
		// `wsl:Ubuntu`, and the same generated workspace already carried a working
		// `vscode-remote://wsl+ubuntu/...` folder beside the broken one.
		//
		// Only the folder root is rewritten, back to the remote authority the
		// client can address on its own. In-window file access still goes through
		// `vscode-agent-host:` exactly as before, so the Agents window, which has
		// the connection but no WSL remote, is unaffected.
		//
		// The scheme names are written literally because the module constants are
		// not reliably in scope at this call site.
		unpatched: /_buildWorkspaceFromUri\(([\w$]+)\)\{let ([\w$]+)=([\w$]+)\(\1\)\|\|\1\.path,/,
		patched: /__ahWsFolder/,
		build: (m, uri, label, basename) =>
			`_buildWorkspaceFromUri(${uri}){`
			+ `${uri}=(__ahWsFolder=>{try{`
			+ `if(__ahWsFolder.scheme!=="vscode-agent-host")return __ahWsFolder;`
			+ `let __ahWsAuth=__ahWsFolder.authority||"";`
			+ `if(__ahWsAuth.indexOf("hex-")!==0)return __ahWsFolder;`
			+ `let __ahWsDec=__ahWsAuth.slice(4).replace(/../g,__ahWsPair=>String.fromCharCode(parseInt(__ahWsPair,16)));`
			+ `if(!__ahWsDec)return __ahWsFolder;`
			+ `let __ahWsAt=__ahWsDec.indexOf(":");`
			// `wsl:Ubuntu` is the connection form; the client addresses it as
			// `wsl+ubuntu`. Authorities that already use `+` (dev containers) carry
			// a case-sensitive payload and are passed through untouched.
			+ `let __ahWsRemote=__ahWsAt<0?__ahWsDec:__ahWsDec.slice(0,__ahWsAt)+"+"+__ahWsDec.slice(__ahWsAt+1).toLowerCase();`
			+ `return __ahWsFolder.with({scheme:"vscode-remote",authority:__ahWsRemote,query:""})`
			+ `}catch(__ahWsErr){return __ahWsFolder}})(${uri});`
			+ `let ${label}=${basename}(${uri})||${uri}.path,`,
	},
	{
		id: 'session-workspace-folder-real-remote',
		target: 'workbench',
		title: 'a session workspace keeps the agent host authority its folders cannot resolve',
		// Companion to `workspace-folder-uses-real-remote`. That one covers
		// `_buildWorkspaceFromUri`, which serves folder browsing. A session opened
		// from the list goes through this builder instead, which takes the stored
		// working directories and uses them as folder roots directly, so the
		// `vscode-agent-host://hex-<connection>/...` form reaches a plain window
		// that has no connection registered for that authority.
		//
		// Same narrow scope: only the folder roots are rebased, onto the remote
		// authority the client can address by itself. Every other URI is returned
		// untouched, so this is inert for local, remote and GitHub workspaces.
		//
		// The `[AHWS]` line names the producer that actually ran. Opening a session
		// folder has now had two plausible producers and only one of them is on the
		// path, so the log settles it rather than another round of inference.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+),([\w$]+),([\w$]+)\)\{let ([\w$]+)=\6\?\.baseBranchName,/,
		patched: /__ahWsConv/,
		build: (m, fn, repo, dirs, opts, meta, gitMeta, base) =>
			`function ${fn}(${repo},${dirs},${opts},${meta},${gitMeta}){`
			+ `let __ahWsConv=__ahWsU=>{try{`
			+ `if(!__ahWsU||__ahWsU.scheme!=="vscode-agent-host")return __ahWsU;`
			+ `let __ahWsA=__ahWsU.authority||"";`
			+ `if(__ahWsA.indexOf("hex-")!==0)return __ahWsU;`
			+ `let __ahWsD=__ahWsA.slice(4).replace(/../g,__ahWsP=>String.fromCharCode(parseInt(__ahWsP,16)));`
			+ `if(!__ahWsD)return __ahWsU;`
			+ `let __ahWsI=__ahWsD.indexOf(":");`
			+ `let __ahWsR=__ahWsI<0?__ahWsD:__ahWsD.slice(0,__ahWsI)+"+"+__ahWsD.slice(__ahWsI+1).toLowerCase();`
			+ `try{console.log("[AHWS] session workspace root "+__ahWsU.toString()+" -> "+__ahWsR)}catch(__ahWsL){}`
			+ `return __ahWsU.with({scheme:"vscode-remote",authority:__ahWsR,query:""})`
			+ `}catch(__ahWsE){return __ahWsU}};`
			+ `${dirs}=(${dirs}||[]).map(__ahWsConv);`
			+ `let ${base}=${gitMeta}?.baseBranchName,`,
	},
	{
		id: 'subagent-completion-when-idle',
		target: 'agenthost',
		title: 'a background subagent that finishes after its turn stays running',
		// The router derives the turn id from the prompt queue head and drops
		// every SDK message once the queue drains. A background subagent settles
		// after the turn that spawned it has ended, so its `task_notification`
		// lands with no turn and is discarded. The chip then spins forever and
		// the spawn record leaks, which contradicts the registry's own contract:
		// "Background spawns survive across turns by design (their completion
		// arrives later via `system.task_notification`)".
		//
		// The completion path is inlined rather than calling the mapper, so the
		// patch cannot bind to the wrong function if minified names shift.
		// `task_started` always arrives mid-turn, so it needs no handling here.
		unpatched: /,(\w+)!==void 0\)try\{let (\w+)=(\w+)\((\w+),this\._chatChannelUri,\1,this\._mapperState,this\._logService,this\._subagents,this\._clientToolOwner,(\w+)\?\.turnDuration\);for\(let (\w+) of \2\)this\._onDidProduceSignal\.fire\(\6\)\}catch\((\w+)\)\{this\._logService\.warn\(`\[ClaudeSdkMessageRouter\] mapper threw, skipping message: \$\{\7\}`\)\}/,
		patched: /__ahIdleSpawn/,
		build: (m, turn, sig, mapFn, msg, ctx, one, err) =>
			`,${turn}!==void 0)try{let ${sig}=${mapFn}(${msg},this._chatChannelUri,${turn},this._mapperState,this._logService,this._subagents,this._clientToolOwner,${ctx}?.turnDuration);`
			+ `for(let ${one} of ${sig})this._onDidProduceSignal.fire(${one})}`
			+ `catch(${err}){this._logService.warn(\`[ClaudeSdkMessageRouter] mapper threw, skipping message: \${${err}}\`)}`
			+ `else if(${msg}.type==="system"&&${msg}.subtype==="task_notification"&&${msg}.tool_use_id&&(${msg}.status==="completed"||${msg}.status==="failed"||${msg}.status==="stopped")){`
			+ `let __ahIdleSpawn=this._subagents.getSpawn(${msg}.tool_use_id);`
			+ `__ahIdleSpawn&&__ahIdleSpawn.markCompleted()&&(this._subagents.removeSpawn(${msg}.tool_use_id),`
			+ `this._onDidProduceSignal.fire({kind:"subagent_completed",chat:this._chatChannelUri,toolCallId:${msg}.tool_use_id}))}`,
	},
	{
		id: 'sdk-initiated-turn',
		target: 'agenthost',
		title: 'the SDK starts a turn the host never queued, so everything in it is discarded',
		// `turnId` is derived from the host's own outbound prompt queue, but the SDK
		// can begin a turn the host never queued: when background subagents finish it
		// injects a `task-notification` prompt and answers it. With the queue drained,
		// `peekParent()` returns undefined and the router drops every message of that
		// turn, silently and at no log level.
		//
		// Measured: after one such turn opened, three assistant text blocks, five
		// Bash calls, a Read and an AskUserQuestion were discarded over six minutes.
		// The AskUserQuestion was auto-denied without ever being shown, because
		// `hasActiveTurn` is `!queue.isEmpty` and the queue was empty.
		//
		// Three gates read three different sources, so supplying a turn id alone is
		// not enough: the router reads the queue, `AgentSideEffects` re-derives from
		// the state manager, and `requestUserInput` reads the queue again. This opens
		// a real turn: an entry goes into the already-yielded list, so `peekParent`
		// and `hasActiveTurn` both see it and the next `result` settles it through
		// the existing `settleHead`, and `chat/turnStarted` is dispatched so the
		// state manager has an active turn too.
		//
		// The trigger is a top-level `user` envelope carrying text and no tool
		// results, which is exactly how the replay mapper decides a turn boundary
		// (`user-text` opens a turn, `user-tool-results` does not). Live then agrees
		// with replay by construction rather than by resemblance. A broader trigger
		// was rejected: an assistant message arrives in the same second the queue
		// drains, and would open a spurious turn for the previous turn's own tail.
		// Reported as microsoft/vscode#332073.
		// Widened 2026-09-06 after measuring a real drop. The trigger only fired on a
		// `user` message, and the orphaned turn observed in the wild contained none: it
		// was `command_lifecycle`, two `system`, sixteen `stream_event`, `assistant`,
		// `result`. So the guard never ran, `[SDKTURN]` never appeared in any log, and
		// sixteen seconds of streamed answer went in the bin. An `assistant` or
		// `stream_event` arriving with no parent IS the model's output about to be
		// discarded, so those open a turn too. Content-bearing types only, so an empty
		// queue at session start still cannot manufacture a phantom turn.
		unpatched: /for await\(let ([\w$]+) of ([\w$]+)\)\{([\s\S]{0,400}?)let ([\w$]+)=this\._queue\.peekParent\(\),([\w$]+)=\4\?\.turnId,([\w$]+)=\4\?\.clientContext,([\w$]+)=\4\?\.stopWatch\.elapsed\(\);/,
		patched: /__ahSdkTurn/,
		build: (m, msg, query, mid, parent, turnId, ctx, dur) =>
			`for await(let ${msg} of ${query}){${mid}`
				+ `let ${parent}=this._queue.peekParent();`
				+ `if(!${parent}&&${msg}&&!${msg}.parent_tool_use_id&&(${msg}.type==="user"||${msg}.type==="assistant"||${msg}.type==="stream_event")){`
				+ `let __ahC=${msg}.message&&${msg}.message.content,__ahHasText=${msg}.type!=="user",__ahHasResult=false;`
				+ `if(${msg}.type==="user"){`
				+ `if(typeof __ahC==="string")__ahHasText=__ahC.length>0;`
				+ `else if(Array.isArray(__ahC))for(let __ahB of __ahC){`
				+ `if(__ahB&&__ahB.type==="text")__ahHasText=true;`
				+ `if(__ahB&&__ahB.type==="tool_result")__ahHasResult=true}}`
				+ `if(__ahHasText&&!__ahHasResult){`
				+ `let __ahSdkTurn="sdkturn-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10),__ahAt=Date.now();`
				+ `this._queue._yielded.push({sdkMessage:${msg},sdkUuid:(${msg}.uuid||__ahSdkTurn),turnId:__ahSdkTurn,`
				+ `stopWatch:{elapsed:()=>Date.now()-__ahAt},`
				+ `deferred:{isSettled:false,p:Promise.resolve(),complete(){this.isSettled=true},error(){this.isSettled=true}}});`
				+ `this._logService.info("[SDKTURN] opened "+__ahSdkTurn+" for an SDK-initiated prompt");`
				+ `this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,action:{type:"chat/turnStarted",turnId:__ahSdkTurn,startedAt:new Date().toISOString(),message:{text:"",origin:{kind:"user"}}}});`
				+ `${parent}=this._queue.peekParent()}}`
				+ `let ${turnId}=${parent}?.turnId,${ctx}=${parent}?.clientContext,${dur}=${parent}?.stopWatch.elapsed();`,
	},
	{
		id: 'subagent-inactive-resume',
		target: 'agenthost',
		title: 'a running subagent produces output that is discarded once its chat has no active turn',
		// `AgentSideEffects` resolves a signal's subagent chat, then gates on that
		// chat's active turn. With no turn it logs `Dropping <signal> for inactive
		// subagent` and returns, so the signal is neither dispatched nor buffered:
		// the subagent keeps working and nothing it produces reaches the client.
		//
		// Measured in one session: the parent turn ended, and from that point 92
		// signals were dropped across model_call_completed, chat/responsePart and
		// the three toolCall actions, while the subagent went on running for a
		// further four minutes. 8 subagent turns started, 0 subagent_completed.
		// It cannot self-heal, because `subagent_completed` is dropped by the same
		// gate, so the chip never resolves either.
		//
		// Buffering into `_pendingSubagentSignals` would not work here: that buffer
		// is drained only from `subagent_started`, which has long since fired. The
		// host's own `_resumeSubagentSession` is the right lever. It is synchronous,
		// and returns early when a turn already exists, so the first late signal
		// opens a turn and the rest dispatch normally. A completed or cancelled
		// subagent is not revived, since both paths delete the chat first and this
		// branch is only reached while the chat is still registered.
		//
		// Reported on microsoft/vscode#332073.
		unpatched: /([\w$]+)\?([\w$]+)\.kind==="model_call_completed"\?this\._recordModelCallCompleted\(\2,([\w$]+)\.chatUri,\1,"remap"\):this\._dispatchActionForSession\(\2,\3\.chatUri,\1,"remap",([\w$]+)\):\(this\._logService\.error\(`\[AgentSideEffects\] Dropping \$\{this\._describeSignal\(\2\)\} for inactive subagent \$\{([\w$]+)\}\/\$\{([\w$]+)\}`\),\2\.kind==="pending_confirmation"&&\4\.respondToPermissionRequest\(\2\.state\.toolCallId,!1\)\);return\}/,
		patched: /_resumeSubagentSession\([\w$]+,[\w$]+\),\([\w$]+=this\._stateManager\.getActiveTurnId/,
		build: (m, turn, sig, sub, agent, chatKey, parentTool) => {
			const dispatch = `${sig}.kind==="model_call_completed"`
				+ `?this._recordModelCallCompleted(${sig},${sub}.chatUri,${turn},"remap")`
				+ `:this._dispatchActionForSession(${sig},${sub}.chatUri,${turn},"remap",${agent})`;
			const drop = '(this._logService.error("[AgentSideEffects] Dropping "+this._describeSignal(' + sig + ')+" for inactive subagent "+' + chatKey + '+"/"+' + parentTool
				+ '),' + sig + '.kind===\"pending_confirmation\"&&' + agent + '.respondToPermissionRequest(' + sig + '.state.toolCallId,!1))';
			return `${turn}?${dispatch}:(this._resumeSubagentSession(${chatKey},${parentTool}),`
				+ `(${turn}=this._stateManager.getActiveTurnId(${sub}.chatUri))?${dispatch}:${drop});return}`;
		},
	},
	{
		id: 'replay-user-prompt-only',
		target: 'agenthost',
		title: 'restored messages show context the user never typed',
		// resolvePromptToContentBlocks sends the prompt as the first text block
		// and appends host-composed context after it: attachment representations
		// (shared browser pages, repo and branch details) and the reference
		// reminder. The replay mapper joins every text block back together, so a
		// rehydrated turn shows that context as words the user typed. Live turns
		// are unaffected, which is why it only appears on returning to a session.
		//
		// It also leaks into session titles, which are seeded from the first
		// turn's text, producing sessions named after the browser-context blurb.
		unpatched: /return\{kind:"user-text",uuid:(\w+)\.uuid,text:(\w+)\.map\((\w+)=>\3\.text\)\.join\(`\n`\),timestamp:(\w+)\}/,
		patched: /kind:"user-text",uuid:\w+\.uuid,text:\w+\[0\]\.text/,
		build: (m, msg, blocks, b, ts) =>
			`return{kind:"user-text",uuid:${msg}.uuid,text:${blocks}[0].text,timestamp:${ts}}`,
	},
	{
		id: 'local-command-output-visible',
		target: 'agenthost',
		title: 'a local slash command runs, produces output, and the turn renders empty',
		// The CLI records a local command's result as a `system` message with
		// `subtype: local_command`, wrapping the payload in `<local-command-stdout>`,
		// and separately injects a `<local-command-caveat>` telling the model not to
		// respond to it. The live mapper only recognises subagent task subtypes, so
		// the message maps to no signal, the model correctly stays silent, and the
		// turn ends with an empty bubble.
		//
		// Observed with `/code-review`: it ran for 11 minutes, produced 13.6 KB of
		// findings, and rendered nothing. The output was recovered from the SDK
		// transcript afterwards. Every local slash command behaves this way, and the
		// same command prints normally in the terminal CLI.
		//
		// Emits the stdout as a markdown response part on the active turn. The
		// caveat entry is what keeps the model from replying, so surfacing this
		// changes only what the user sees. Reported as microsoft/vscode#334575.
		unpatched: /if\(([\w$]+)&&\1\.i&&([\w$]+)!==void 0\)\{return\[([\s\S]{0,240}?)\]\}return ([\w$]+)\.type==="system"\?([\w$]+)\(\4,([\w$]+),([\w$]+)\):\[\]/,
		patched: /__ahLocalCmd/,
		build: (m, prog, turnId, payload, msg, mapSys, chat, reg) =>
			`if(${prog}&&${prog}.i&&${turnId}!==void 0){return[${payload}]}`
				// The SDK stream's subtype is `local_command_output` (sdk.d.ts:4286). The
				// TRANSCRIPT records the same payload as `local_command`, and matching that
				// is why this entry never fired once between being written and 2026-09-05:
				// it was keyed off the file on disk rather than the wire type. Both are
				// accepted now, since the transcript spelling costs nothing to keep.
				//
				// Not redundant with `skill-subagent-result-visible`, which only surfaces
				// output on a turn that spent no model tokens. A turn where the model runs
				// AND a local command produces output is this entry's case alone.
				+ `let __ahLocalCmd=${msg}.type==="system"&&(${msg}.subtype==="local_command_output"||${msg}.subtype==="local_command")&&typeof ${msg}.content==="string"?${msg}.content:void 0;`
				+ `if(__ahLocalCmd){`
				+ `for(let __t of ["<local-command-stdout>","</local-command-stdout>","<local-command-stderr>","</local-command-stderr>"])__ahLocalCmd=__ahLocalCmd.split(__t).join("");`
				+ `__ahLocalCmd=__ahLocalCmd.trim();`
				+ `if(__ahLocalCmd&&${turnId}!==void 0)return [{kind:"action",resource:${chat},action:{type:"chat/responsePart",turnId:${turnId},part:{kind:"markdown",id:"lcmd-"+(${msg}.uuid||String(Date.now())),content:__ahLocalCmd}}}];`
				+ `}`
				+ `return ${msg}.type==="system"?${mapSys}(${msg},${chat},${reg}):[]`,
	},
	{
		id: 'agenthost-require-global',
		target: 'agenthost',
		title: 'the bundle is ESM, so later entries have no require for node builtins',
		// `require` is not in scope at an arbitrary patch site in this bundle. One is
		// created at module level through `createRequire`, but that binding is minified
		// and renamed on every build, so no entry can reference it by name. This
		// captures it once and exposes it as `globalThis.__ahReq`.
		//
		// Entries that use it must treat a missing `__ahReq` as a reason to fall back to
		// stock behaviour, so if this anchor ever drifts the dependent entries degrade
		// quietly instead of throwing at runtime.
		unpatched: /import\{createRequire as ([\w$]+)\}from"module";var ([\w$]+)=\1\(import\.meta\.url\);/,
		patched: /globalThis\.__ahReq=/,
		build: (m, cr, req) =>
			`import{createRequire as ${cr}}from"module";var ${req}=${cr}(import.meta.url);globalThis.__ahReq=${req};`,
	},
	{
		id: 'resume-missing-conversation-starts-fresh',
		target: 'agenthost',
		title: 'cancelling a skill-subagent turn bricks a new chat permanently',
		// A skill that runs in a subagent consumes the whole turn without the parent
		// model ever running, so the CLI writes no user or assistant message and never
		// persists the conversation. Cancel before it finishes and the transcript is
		// left holding only a file snapshot and a couple of queue records. Every later
		// prompt then resumes an id the CLI does not know, fails with `No conversation
		// found with session ID`, and the chat is dead for good.
		//
		// Observed 2026-09-04: chat 7a65fd1f was bound to session 11d51889, whose
		// transcript was 551 bytes with zero user or assistant entries. A session that
		// already has history is unaffected, so this only bites a brand new chat.
		//
		// Resumes only when the transcript on disk actually holds a conversation, and
		// otherwise starts a fresh one under the same id, which leaves the host's
		// existing binding intact. Any doubt at all (no `__ahReq`, an unreadable
		// directory, no transcript found) keeps the stock resume, so this can only act
		// where a conversation is positively known to be absent. That matters because
		// starting fresh over a healthy transcript would discard the user's history.
		unpatched: /\.\.\.([\w$]+)\.isResume\?\{resume:\1\.sessionId,\.\.\.\1\.resumeSessionAt\?\{resumeSessionAt:\1\.resumeSessionAt\}:\{\}\}:\{sessionId:\1\.sessionId\}/,
		patched: /__ahHasConvo/,
		// The host does not run as the user the CLI stores transcripts for. Measured in
		// the printstream container: the agent host has `HOME=/root`, `/root/.claude`
		// exists but has no `projects` directory, and the transcripts are under
		// `/home/node/.claude/projects`. A single `HOME` guess therefore throws, takes
		// the catch, and silently degrades to stock resume, which is how the first
		// version of this entry did nothing at all. Several candidate roots are tried.
		build: (m, r) =>
			`...(${r}.isResume&&(()=>{try{`
				+ `if(!globalThis.__ahReq)return true;`
				+ `let __ahFs=globalThis.__ahReq("fs"),__ahRoots=[];`
				+ `if(process.env.CLAUDE_CONFIG_DIR)__ahRoots.push(process.env.CLAUDE_CONFIG_DIR+"/projects");`
				+ `if(process.env.HOME)__ahRoots.push(process.env.HOME+"/.claude/projects");`
				+ `try{__ahRoots.push(globalThis.__ahReq("os").homedir()+"/.claude/projects")}catch(__ahE1){}`
				+ `try{for(let __ahU of __ahFs.readdirSync("/home"))__ahRoots.push("/home/"+__ahU+"/.claude/projects")}catch(__ahE2){}`
				+ `for(let __ahBase of __ahRoots){`
				+ `let __ahDirs;try{__ahDirs=__ahFs.readdirSync(__ahBase)}catch(__ahE3){continue}`
				+ `for(let __ahD of __ahDirs){`
				+ `let __ahP=__ahBase+"/"+__ahD+"/"+${r}.sessionId+".jsonl";`
				+ `if(__ahFs.existsSync(__ahP)){`
				+ `let __ahT=__ahFs.readFileSync(__ahP,"utf8"),__ahHasConvo=__ahT.indexOf('"type":"user"')>=0||__ahT.indexOf('"type":"assistant"')>=0;`
				// Moving the stub aside is what makes `{sessionId}` viable at all. The CLI
				// rejects a fresh spawn while `<id>.jsonl` exists (claudeSdkPipeline.ts:317),
				// so choosing `{sessionId}` over a surviving transcript merely swaps the
				// permanent "No conversation found" for a permanent "Session ID ... is
				// already in use". Observed 2026-09-05 on session 583fa3c2, which this
				// entry's earlier form bricked exactly that way.
				//
				// Safe to move: this branch is only reached once the transcript has been
				// read and positively shown to contain no user or assistant entry, so
				// there is no conversation in it. Renamed rather than deleted, so the file
				// is still there if that judgement is ever wrong.
				+ `if(!__ahHasConvo){try{__ahFs.renameSync(__ahP,__ahP+".orphan-"+Date.now());`
				+ `console.error("[AHNOCONVO] "+${r}.sessionId+" had a transcript with no conversation; moved it aside so the id can be reused")}`
				+ `catch(__ahE4){console.error("[AHNOCONVO] could not move aside "+__ahP+", so --session-id will fail as already in use: "+__ahE4)}}`
				+ `return __ahHasConvo}}}`
				+ `}catch(__ahE){}return true})())`
				+ `?{resume:${r}.sessionId,...${r}.resumeSessionAt?{resumeSessionAt:${r}.resumeSessionAt}:{}}:{sessionId:${r}.sessionId}`,
	},
	{
		id: 'result-error-subtypes-surface',
		target: 'agenthost',
		title: 'hitting a turn, budget or retry cap renders as a successful empty turn',
		// `getResultErrorText` extracts error text for exactly two result subtypes,
		// `success` (when `is_error`) and `error_during_execution`, and returns
		// undefined for everything else. The SDK (0.3.239) also declares
		// `error_max_turns`, `error_max_budget_usd` and
		// `error_max_structured_output_retries`.
		//
		// So a turn that hits a cap produces no error text, therefore no chat/error,
		// and the pipeline still fires chat/turnComplete. The turn ticks over to
		// complete, looking successful, with no indication of why the agent stopped.
		// The tokens are already spent.
		//
		// Also fixes the empty-bubble case: `errors?.join(...)` on an empty array
		// returns the empty string, which is not undefined, so the host raises a
		// chat/error carrying no message at all.
		//
		// Emits `String.fromCharCode(10)` rather than an escape, because a `\n`
		// written in the patcher's own template literal becomes a real newline in the
		// emitted source and a raw newline inside a string literal will not parse.
		// ORDER: this must stay after `steer-preempt-not-error`, which rewrites the
		// `error_during_execution` branch of this same function to drop the SDK's
		// `[ede_diagnostic]` marker. This entry anchors on that entry's output and
		// appends the remaining subtypes after it, leaving its behaviour untouched.
		// Anchoring on the pristine shape instead cost two round trips: the minifier
		// also drops the source's trailing `return undefined`.
		unpatched: /if\(([\w$]+)\.subtype==="error_during_execution"\)\{let ([\w$]+)=\1\.errors\?\.filter\(([\s\S]{0,80}?)\);return \2&&\2\.length\?\2\.join\(String\.fromCharCode\(10\)\):void 0\}\}/,
		patched: /__ahResultMsg/,
		build: (m, r, de, filt) =>
			`if(${r}.subtype==="error_during_execution"){let ${de}=${r}.errors?.filter(${filt});`
				+ `return ${de}&&${de}.length?${de}.join(String.fromCharCode(10)):void 0}`
				+ `let __ahResultMsg;`
				+ `if(${r}.subtype==="error_max_turns")__ahResultMsg="The agent stopped after reaching its maximum number of turns.";`
				+ `else if(${r}.subtype==="error_max_budget_usd")__ahResultMsg="The agent stopped after reaching its spending limit.";`
				+ `else if(${r}.subtype==="error_max_structured_output_retries")__ahResultMsg="The agent stopped after too many structured output retries.";`
				+ `else if(typeof ${r}.subtype==="string"&&${r}.subtype.indexOf("error")===0)__ahResultMsg="The agent stopped: "+${r}.subtype;`
				+ `return __ahResultMsg}`,
	},
	{
		id: 'result-usage-any-subtype',
		target: 'agenthost',
		title: 'a turn that stops at a cap reports none of the tokens it spent',
		// `mapResult` emits chat/usage only when the subtype is `success`, so a turn
		// ending at a cap reports nothing, even though the tokens were spent. That is
		// the same turn this patcher's `result-error-subtypes-surface` entry gives an
		// error message to, and the two together make a capped turn legible.
		//
		// Gated on the fields existing rather than on the subtype, so a result that
		// carries no usage behaves exactly as before instead of throwing.
		unpatched: /if\(([\w$]+)\.subtype==="success"\)\{let ([\w$]+)=Object\.keys\(\1\.modelUsage\)\[0\];/,
		patched: /__ahUsageAny/,
		build: (m, r, key) =>
			`if(${r}.usage&&${r}.modelUsage){let __ahUsageAny=1,${key}=Object.keys(${r}.modelUsage)[0];`,
	},
	{
		id: 'toolcall-hidden-respects-liveness',
		target: 'workbench',
		title: 'a tool card is hidden when its call completes, even when its work is still running',
		// `isEffectivelyHidden` is `presentation === 'hidden' || (presentation ===
		// 'hiddenAfterComplete' && isComplete(invocation))`. The second clause encodes
		// "this card stopped being useful when its call ended", which holds for a
		// synchronous tool and breaks for anything whose work outlives its own call.
		//
		// A backgrounded subagent is the case that bites: its launch call completes in
		// about two seconds while the agent runs for minutes, so the card is hidden
		// almost immediately and real work proceeds with nothing on screen.
		//
		// This is the root-cause fix for what `background-subagent-stays-visible`
		// treated at one call site, and it replaces that entry. It is better in two
		// ways: it covers every route to hiding rather than the single completion site,
		// and it re-hides the card once the subagent genuinely finishes, which the
		// retired entry never did.
		//
		// Liveness is deliberately NOT `isActive` alone. `isActive` mirrors the child
		// chat's active turn, which is the correct signal, but it is also forced false
		// when the observation store is disposed, and that store's lifetime is tied to
		// the parent turn. So a subagent that is still running can report
		// `isActive === false`. The second disjunct, started but with no recorded
		// duration, keeps the card visible in exactly that case. Worst case this
		// degrades to the behaviour of the entry it replaces (card stays visible), never
		// to stock (card vanishes mid-run).
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+)\)\{return!!\(\2\.presentation==="hidden"\|\|\2\.presentation==="hiddenAfterComplete"&&([\w$]+)\(\2,\3\)\)\}m\.isEffectivelyHidden=\1/,
		patched: /__ahLiveWork/,
		build: (m, fn, inv, reader, isComplete) =>
			`function ${fn}(${inv},${reader}){`
				+ `let __ahTsd=${inv}.toolSpecificData,`
				+ `__ahLiveWork=!!(__ahTsd&&__ahTsd.kind==="subagent"&&(__ahTsd.isActive===true`
				+ `||(__ahTsd.startedAt!==void 0&&__ahTsd.duration===void 0)));`
				+ `return!!(${inv}.presentation==="hidden"`
				+ `||${inv}.presentation==="hiddenAfterComplete"&&${isComplete}(${inv},${reader})&&!__ahLiveWork)`
				+ `}m.isEffectivelyHidden=${fn}`,
	},
	{
		id: 'claude-turn-reports-activity',
		pr: 334742,
		target: 'agenthost',
		title: 'the Claude provider never reports chat activity, so a silent turn looks dead',
		// AHP already has a progress channel and the workbench already renders it well.
		// `chat/activityChanged` carries a human-readable string, and the client turns it
		// into a shimmering row with a stable id, so each update REPLACES the previous one
		// and the row hides itself the moment real content follows.
		//
		// The gap is in the middle: the only producer of that action anywhere in the host
		// is worktree creation, which is why "Creating isolated worktree (42%)" is the only
		// activity anyone ever sees. The Claude pipeline never emits it, so every turn that
		// is quiet for a while (a skill subagent, MCP startup, a long tool call) renders
		// nothing at all and reads as a hung session.
		//
		// This supersedes three earlier local hacks, all of which were rebuilding this
		// facility badly: polling subagent transcripts on disk to infer liveness, injecting
		// fake markdown response parts as a status line, and two reducer patches trying to
		// make those parts update in place.
		//
		// The markdown route could never have worked. Response parts are an append-only
		// stream: `seedEmittedLengths` tracks `content.length` and emits only the suffix
		// beyond what was already sent, because content is assumed to grow monotonically.
		// "Working, 23s" is not a prefix-extension of "Working, 8s", so every tick appended
		// a whole new line. Worse, the injected parts made `responseParts` non-empty, which
		// is exactly the condition that suppresses the native activity row, so the hack was
		// disabling the correct mechanism while imitating it.
		//
		// Activity is a single string field rather than a list, so stacking is impossible
		// by construction. No filesystem access, no subagent counting, no client patches.
		//
		// Cleared on every exit path, mirroring the worktree code, so a finished or wedged
		// turn cannot strand the row on a stale "Working".
		// The minified comparison is `==`, not `===`. Anchoring on the strict form found
		// nothing, which is the same class of miss as writing the anchor from the source
		// instead of the shipped bundle.
		unpatched: /let ([\w$]+)=\{sdkMessage:([\w$]+),sdkUuid:typeof \2\.uuid=="string"\?\2\.uuid:([\w$]+),turnId:\3,clientContext:([\w$]+),stopWatch:([\w$]+)\.create\(!1\),deferred:new ([\w$]+)\};return this\._queue\.push\(\1\)/,
		patched: /__ahHeartbeat/,
		build: (m, entry, msg, turnId, ctx, watch, deferred) =>
			`let ${entry}={sdkMessage:${msg},sdkUuid:typeof ${msg}.uuid=="string"?${msg}.uuid:${turnId},turnId:${turnId},`
				+ `clientContext:${ctx},stopWatch:${watch}.create(!1),deferred:new ${deferred}};`
				+ `try{this.__ahHeartbeat&&clearInterval(this.__ahHeartbeat)}catch(__ahH0){}`
				+ `this.__ahHbStart=Date.now();this.__ahHbTicks=0;`
				+ `this.__ahHbSaid=0;`
				+ `this.__ahHbSay=__ahA=>{try{`
				+ `if(__ahA!==void 0&&!this.__ahHbSaid){this.__ahHbSaid=1;`
				+ `this._logService.info("[AHACT] emitting chat/activityChanged on "+this.chatChannelUri+" : "+__ahA)}`
				+ `this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,`
				+ `action:{type:"chat/activityChanged",activity:__ahA}})}catch(__ahH5){}};`
				// A push means work resumed, so hand the row straight back rather than
				// leaving a stale elapsed count standing over live output. Without this
				// the last string persisted until the turn ended, because the timer was
				// restarted here but the activity was only ever cleared on exit.
				+ `if(this.__ahHbShown){this.__ahHbShown=0;this.__ahHbSay(void 0)}`
				// A turn is running from here until its result lands. Tearing down on
				// `_queue.isEmpty` instead was wrong: an empty queue means nothing is in
				// flight this instant, which is exactly the state during a long skill
				// subagent run. `/code-review` therefore killed its own indicator within
				// a second or two and then rendered nothing for seven minutes, which is
				// the case this whole mechanism exists for.
				+ `this.__ahHbActive=1;`
				+ `this.__ahHeartbeat=setInterval(()=>{try{`
				// ~50 minutes at this cadence, so a wedged turn still cannot leak a timer.
				+ `if(++this.__ahHbTicks>3000||!this.__ahHbActive){`
				+ `clearInterval(this.__ahHeartbeat);this.__ahHeartbeat=void 0;`
				+ `this.__ahHbShown=0;this.__ahHbSay(void 0);return}`
				+ `let __ahSec=Math.round((Date.now()-this.__ahHbStart)/1000);`
				// Clients render their own indicator while a turn is quiet, and theirs is
				// better: it rotates, and it is what the product looks like. Setting an
				// activity string replaces it, so speak only once the silence is long
				// enough that "still going" has stopped being informative. At 20 seconds
				// this was taking over ordinary turns and reading as a regression.
				+ `if(__ahSec<120){if(this.__ahHbShown){this.__ahHbShown=0;this.__ahHbSay(void 0)}return}`
				+ `this.__ahHbShown=1;`
				+ `this.__ahHbSay("Working, "+(__ahSec<60?__ahSec+"s":Math.floor(__ahSec/60)+"m "+(__ahSec%60)+"s")+" elapsed")`
				+ `}catch(__ahH4){}},1000);`
				+ `return this._queue.push(${entry})`,
	},
	{
		id: 'activity-clears-when-the-turn-results',
		target: 'agenthost',
		title: 'the liveness row needs a real end signal, not an empty queue',
		// Pairs with `claude-turn-reports-activity`, which starts the row in `send`
		// and now runs until `__ahHbActive` is cleared. This is what clears it: the
		// turn's result, which is the only signal that actually means the turn is
		// over. Without this the row would linger past the end of a slow turn until
		// the tick ceiling, so the two entries must ship together.
		unpatched: /this\._logService\.info\(`\[Claude:\$\{this\.sessionId\}\] result for sdkUuid=\$\{([\w$]+)\?\.sdkUuid\}`\),/,
		patched: /__ahHbEnd/,
		build: (m, entry) =>
			'this._logService.info(`[Claude:${this.sessionId}] result for sdkUuid=${' + entry + '?.sdkUuid}`),'
			+ `(__ahHbEnd=>{try{`
			+ `this.__ahHbActive=0;`
			+ `if(this.__ahHeartbeat){clearInterval(this.__ahHeartbeat);this.__ahHeartbeat=void 0}`
			+ `if(this.__ahHbShown&&this.__ahHbSay){this.__ahHbShown=0;this.__ahHbSay(void 0)}`
			+ `}catch(__ahHbE){}})(0),`,
	},
	{
		id: 'turn-prune-anchor-missing-is-loud',
		target: 'agenthost',
		title: 'restoring a checkpoint at a turn with no database row silently prunes nothing',
		// `truncateFromTurn` and `deleteTurnsAfter` both bound the delete with
		// `rowid >= (SELECT rowid FROM turns WHERE id = ?)`. When the subquery matches
		// nothing it yields NULL, and `rowid >= NULL` is NULL, so **zero rows are
		// deleted and no error is raised**. The callers pass a rendered turn id, and a
		// rendered turn does not always have a row: `turns` is populated by live turns
		// and the checkpoint service, while the rendered list comes from the CLI
		// transcript.
		//
		// Measured 2026-09-04 across 21 chat databases on this machine: 13 of them have
		// at least one rendered turn with no `turns` row. Worst cases were 195 rendered
		// against 180 rows (17 missing), 133 against 125, and one small session with 4
		// rendered against 2 rows. So restoring a checkpoint at one of those turns
		// leaves `file_edits`, `turn_usage`, `turn_delegation` and `checkpoint_ref` for
		// every later turn behind, and the next turn's diff is taken against a tree the
		// user discarded.
		//
		// This entry is DIAGNOSTIC ONLY and deliberately does not change the delete.
		// Recovering the correct boundary needs the rendered turn order, which lives in
		// the caller and not in the database, so a local patch cannot do it correctly.
		// What it can do is stop the failure being invisible, which is the same
		// principle as the silent router drop: a prune that quietly does nothing is
		// indistinguishable from a prune that worked.
		unpatched: /\(await (\w+)\((\w+),"SELECT checkpoint_ref FROM turns WHERE checkpoint_ref IS NOT NULL ORDER BY rowid",\[\]\)\)\.map\((\w+)=>\3\.checkpoint_ref\)\}truncateFromTurn\((\w+)\)\{return this\._mutateTurnUsage\(async (\w+)=>\{await (\w+)\(\5,"DELETE FROM turns WHERE rowid >= \(SELECT rowid FROM turns WHERE id = \?\)",\[\4\]\)\}\)\}deleteTurnsAfter\((\w+)\)\{return this\._mutateTurnUsage\(async (\w+)=>\{await \6\(\8,"DELETE FROM turns WHERE rowid > \(SELECT rowid FROM turns WHERE id = \?\)",\[\7\]\)\}\)\}/,
		patched: /__ahPruneAnchor/,
		build: (m, dbAll, db0, mapVar, tId, tDb, dbRun, dId, dDb) =>
			`(await ${dbAll}(${db0},"SELECT checkpoint_ref FROM turns WHERE checkpoint_ref IS NOT NULL ORDER BY rowid",[])).map(${mapVar}=>${mapVar}.checkpoint_ref)}`
				+ `truncateFromTurn(${tId}){return this._mutateTurnUsage(async ${tDb}=>{`
				+ `let __ahPruneAnchor=await ${dbAll}(${tDb},"SELECT rowid FROM turns WHERE id = ?",[${tId}]);`
				+ `if(!__ahPruneAnchor||__ahPruneAnchor.length===0)console.warn("[AHPRUNE] truncateFromTurn: no turns row for "+${tId}+", so the delete matches nothing and later per-turn rows survive");`
				+ `await ${dbRun}(${tDb},"DELETE FROM turns WHERE rowid >= (SELECT rowid FROM turns WHERE id = ?)",[${tId}])})}`
				+ `deleteTurnsAfter(${dId}){return this._mutateTurnUsage(async ${dDb}=>{`
				+ `let __ahPruneAnchor2=await ${dbAll}(${dDb},"SELECT rowid FROM turns WHERE id = ?",[${dId}]);`
				+ `if(!__ahPruneAnchor2||__ahPruneAnchor2.length===0)console.warn("[AHPRUNE] deleteTurnsAfter: no turns row for "+${dId}+", so the delete matches nothing and later per-turn rows survive");`
				+ `await ${dbRun}(${dDb},"DELETE FROM turns WHERE rowid > (SELECT rowid FROM turns WHERE id = ?)",[${dId}])})}`,
	},
	{
		id: 'router-drop-is-loud',
		target: 'agenthost',
		title: 'every SDK message with no resolvable turn id is discarded with no log at all',
		// `ClaudeSdkMessageRouter.handle` returns early when `turnId === undefined`,
		// with no log, no counter and no trace. Every signal in that message is lost
		// and nothing anywhere records that it happened.
		//
		// This is the single most expensive line in the system for debugging. It is the
		// mechanism behind `sdk-initiated-turn`, and it is why "no drops in the log" is
		// never evidence of anything: the code cannot report a drop at any log level. I
		// cited that non-evidence twice before finding this.
		//
		// Logs at `warn` rather than `trace` deliberately. The condition means real
		// model output is being thrown away, which is not routine, and `trace` is not
		// enabled in practice.
		//
		// The source's early `if (turnId === undefined) { return; }` does not survive
		// minification: it becomes a positive guard at the tail of a comma expression,
		// `..., t !== void 0) try { ... }`, with no `return` anywhere. So this extends
		// that condition with a logging term rather than patching a return that is not
		// there. Anchoring on the source shape found nothing.
		unpatched: /,(\w+)!==void 0\)try\{let (\w+)=(\w+)\((\w+),this\._chatChannelUri,\1,/,
		patched: /__ahRouterDrop/,
		build: (m, turnId, signals, mapper, msg) =>
			`,(${turnId}===void 0&&(this._logService.warn("[ClaudeSdkMessageRouter] __ahRouterDrop: no turn id for an SDK message of type "`
				+ `+(${msg}&&${msg}.type)+", discarding every signal it carried"),true),${turnId}!==void 0))`
				+ `try{let ${signals}=${mapper}(${msg},this._chatChannelUri,${turnId},`,
	},
	{
		id: 'slash-command-single-block',
		target: 'agenthost',
		title: 'a slash command is never expanded because the host appends context as a second block',
		// The composer returns the user's text as the first block and then appends
		// host-composed context: attachment representations, read-only snapshot
		// notes, and the reference reminder. The Claude CLI only treats a message
		// as a slash command when its content is a single text block, so any turn
		// carrying context silently stops being a command. The model then receives
		// `/code-review ...` as ordinary prose and answers from its own head, which
		// reads as the command being missing even though completion offered it.
		//
		// Measured against the SDK in this container, same command and session,
		// varying only the content shape:
		//   string bare .................. expands
		//   string with context inline .... expands
		//   one text block, context inline  expands
		//   two text blocks ............... DOES NOT expand
		//
		// So the discriminator is the block count, not the context, and merging the
		// text blocks keeps both the command and everything the host wanted to say.
		// Non-text blocks (images) are preserved and follow the merged text.
		// Only messages whose first block already starts with `/` are touched.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+)\)\{let ([\w$]+)=\[\{type:"text",text:\2\}\];if\(!\3\?\.length\)return \4;/,
		patched: /__vsMergeSlash/,
		build: (m, fn, text, atts, blocks) =>
			`function __vsMergeSlash(b){try{`
				+ `if(!Array.isArray(b))return b;`
				+ `var t=b.filter(function(x){return x&&x.type==="text"});`
				+ `if(t.length<2)return b;`
				+ `var f=String(t[0].text||"");`
				+ `if(f.trimStart().charAt(0)!=="/")return b;`
				+ `var o=b.filter(function(x){return !(x&&x.type==="text")});`
				+ `var nl=String.fromCharCode(10,10);`
				+ `return [{type:"text",text:t.map(function(x){return x.text}).join(nl)}].concat(o);`
				+ `}catch(e){return b}}`
				+ `function ${fn}(${text},${atts}){return __vsMergeSlash(${fn}$vs(${text},${atts}))}`
				+ `function ${fn}$vs(${text},${atts}){let ${blocks}=[{type:"text",text:${text}}];if(!${atts}?.length)return ${blocks};`,
	},
	{
		id: 'session-chip-scope-v2',
		target: 'agenthost',
		title: 'the session list chip counts the whole branch, not the session',
		// Re-anchored for the current bundle: upstream added a multi-root
		// branch ahead of the summary write, so the previous entry no longer
		// matched and silently stopped applying to the live server.
		//
		// The chip must count the session's own footprint. Keep the multi-folder
		// aggregate under the branch changeset, and move the legacy diffs key
		// and the summary write to the session changeset.
		// Mirrors microsoft/vscode#331345.
		unpatched: /this\._persistSessionFlag\((\w+),(\w+)\((\w+)\),JSON\.stringify\((\w+)\)\),\3==="branch"\)\{this\._persistSessionFlag\(\1,(\w+),JSON\.stringify\(\4\)\);let (\w+)=this\._configurationService\.getEffectiveWorkingDirectories\(\1\);if\((\w+)\(\6\)\)await this\._updateMultiFolderChangesSummary\(\1,(\w+)\.object,\6,\4\);else\{let (\w+)=(\w+)\(\4\)\?\?\{additions:0,deletions:0,files:0\};this\.persistChangesSummary\(\1,\9\),this\._stateManager\.setSessionSummaryChanges\(\1,\9\)\}\}/,
		patched: /==="session"&&\(\(\)=>\{this\._persistSessionFlag/,
		build: (m, session, keyFor, kind, diffs, legacyKey, workDirs, isMulti, ref, summary, summarise) =>
			`this._persistSessionFlag(${session},${keyFor}(${kind}),JSON.stringify(${diffs})),`
			+ `(${kind}==="session"&&(()=>{`
			+ `this._persistSessionFlag(${session},${legacyKey},JSON.stringify(${diffs}));`
			+ `let ${workDirs}=this._configurationService.getEffectiveWorkingDirectories(${session}),${summary}=${summarise}(${diffs});`
			+ `if(!${isMulti}(${workDirs})&&${summary}){this.persistChangesSummary(${session},${summary}),this._stateManager.setSessionSummaryChanges(${session},${summary})}`
			+ `})()),`
			+ `${kind}==="branch"){`
			+ `let ${workDirs}=this._configurationService.getEffectiveWorkingDirectories(${session});`
			+ `if(${isMulti}(${workDirs}))await this._updateMultiFolderChangesSummary(${session},${ref}.object,${workDirs},${diffs})`
			+ `}`,
	},
	{
		id: 'session-scope-counts-other-sessions-work',
		target: 'agenthost',
		title: 'a session is credited with every uncommitted change in the folder',
		// Session scope answers "what did THIS session change". It is computed as
		// a git diff from the session baseline checkpoint to the latest turn
		// checkpoint. The baseline, `refs/agents/<id>/checkpoints/turn/0`, is cut
		// with HEAD's tree, so it holds none of the work that was already
		// uncommitted when the session started, while the latest turn checkpoint
		// snapshots the dirty tree. The difference is the whole folder's
		// uncommitted state, so every session opened in that folder reports the
		// same numbers, and they climb as the shared tree gets dirtier.
		//
		// Measured 2026-09-08 in one repo: five sessions started within eleven
		// minutes all reported 3679/76/46, one of them a single turn that wrote
		// only two files under /tmp while posting a GitHub issue. Minutes later
		// the same figure had become 3874/117/48. That repo held 51 dirty paths
		// and checkpoint refs for 232 sessions.
		//
		// The session's own footprint is already recorded, in the `file_edits`
		// table of the database that is open here, so restrict the session
		// changeset to paths this session actually wrote. Branch and uncommitted
		// scope are left alone, because folder-wide is what they mean.
		//
		// Known limitation: a file changed by a command the agent ran in a
		// terminal (codegen, a formatter, `git apply`) has no `file_edits` row,
		// so it drops out of session scope. It stays visible under branch and
		// uncommitted scope. Under-reporting a side effect is the better failure
		// than crediting one session with another's work.
		unpatched: /let ([\w$]+)=([\w$]+)==="branch"\?await this\._computeReviewedInfo\(([\w$]+),([\w$]+)\.object\):void 0;if\(this\._publishChangesetDiffs\(\3,([\w$]+),([\w$]+),\1\),([\w$]+)=\6\.length,/,
		patched: /__ahOwnEdits/,
		build: (m, reviewed, kind, session, dbRef, key, diffs, fileCount) =>
			`let ${reviewed}=${kind}==="branch"?await this._computeReviewedInfo(${session},${dbRef}.object):void 0;`
			+ `if(${kind}==="session"){try{`
			+ `let __ahOwnEdits=await ${dbRef}.object.getAllFileEdits(),__ahOwnPaths=new Set();`
			+ `for(let __ahOwnE of __ahOwnEdits||[]){`
			+ `if(__ahOwnE.filePath)__ahOwnPaths.add(__ahOwnE.filePath);`
			+ `if(__ahOwnE.originalPath)__ahOwnPaths.add(__ahOwnE.originalPath)}`
			// Strip any scheme and authority, not just `file://`. Working
			// directories arrive as `vscode-remote://dev-container+<hex>/...`
			// in a dev container, and a filter that silently matched nothing
			// would report every session as touching no files at all.
			+ `let __ahOwnFs=__ahOwnU=>{__ahOwnU=String(__ahOwnU||"");`
			+ `let __ahOwnI=__ahOwnU.indexOf("://");if(__ahOwnI<0)return __ahOwnU;`
			+ `let __ahOwnJ=__ahOwnU.indexOf("/",__ahOwnI+3);if(__ahOwnJ<0)return __ahOwnU;`
			+ `let __ahOwnR=__ahOwnU.slice(__ahOwnJ);`
			+ `try{return decodeURIComponent(__ahOwnR)}catch{return __ahOwnR}};`
			+ `let __ahOwnBefore=${diffs}.length;`
			+ `${diffs}=${diffs}.filter(__ahOwnD=>__ahOwnPaths.has(__ahOwnFs((__ahOwnD.after&&__ahOwnD.after.uri)||(__ahOwnD.before&&__ahOwnD.before.uri))));`
			+ `this._logService.info("[AHDIFF] session scope "+__ahOwnBefore+" -> "+${diffs}.length+" files, edited paths "+__ahOwnPaths.size)`
			+ `}catch(__ahOwnErr){this._logService.warn("[AHDIFF] session-scope filter failed",__ahOwnErr)}}`
			+ `if(this._publishChangesetDiffs(${session},${key},${diffs},${reviewed}),${fileCount}=${diffs}.length,`,
	},
	{
		id: 'keyed-item-transient-empty',
		target: 'workbench',
		title: 'a momentarily empty collection tears down live keyed items',
		// autorunPerKeyedItem disposes the store of every key missing from the
		// incoming collection. A derived collection that reads empty for a tick
		// during a state update therefore destroys every item at once.
		//
		// For agent host client tools that disposal reaches the request
		// lifecycle, which cancels the shared execution token, so an in-flight
		// tool dies as "Canceled" or "Tool permission request aborted" while the
		// host still holds the request and waits forever for a completion.
		// Observed with a logpoint: the dropped key had zero siblings present.
		//
		// Treat an empty read as "nothing new to reconcile" rather than
		// "everything went away". A key that returns reuses its existing item,
		// so the work continues, and the helper's outer cleanup still disposes
		// the stores when the autorun itself is torn down.
		unpatched: /for\(let\[(\w+),(\w+)\]of (\w+)\)(\w+)\.has\(\1\)\|\|\(\2\.store\.dispose\(\),\3\.delete\(\1\)\)/,
		patched: /\.size!==0\)for\(let\[\w+,\w+\]of \w+\)\w+\.has/,
		build: (m, key, cell, map, present) =>
			`if(${present}.size!==0)for(let[${key},${cell}]of ${map})${present}.has(${key})||(${cell}.store.dispose(),${map}.delete(${key}))`,
	},
	{
		id: 'client-tool-stale-self-abort',
		target: 'workbench',
		title: 'a client tool abandons itself when only its label changes',
		// A client tool call is readied twice: once with a placeholder label
		// ("Run MCP tool client__issue_fetch") and once with the real one
		// ("issue_fetch"), same toolInput both times. The in-flight attempt asks
		// whether it is still current by comparing the whole request, so the
		// label change makes it judge itself superseded and abandon, leaving the
		// execution request outstanding and the agent waiting forever.
		//
		// Measured in one turn that issued two identical calls at the same
		// instant: the call readied once completed, the call readied twice
		// stalled with its execution request never removed.
		//
		// Accept the attempt as current when the tool name and input still
		// match. The original equality stays as the first test, so this only
		// widens what counts as current and never narrows it.
		//
		// Pairs with keyed-item-transient-empty. That one stops a mass teardown
		// from cancelling the token; this one stops the attempt abandoning
		// itself. Either alone leaves the call stranded.
		unpatched: /\(\)=>(\w+)===(\w+)&&\((\w+)\|\|(\w+)\((\w+)\.read\(void 0\),(\w+)\)\)/,
		patched: /__ahCur/,
		build: (m, gen, cur, started, eq, obs, req) =>
			`()=>${gen}===${cur}&&(${started}||${eq}(${obs}.read(void 0),${req})||(()=>{`
			+ `let __ahCur=${obs}.read(void 0);`
			+ `return!!__ahCur&&!!__ahCur.toolCall&&!!${req}.toolCall`
			+ `&&__ahCur.toolCall.toolName===${req}.toolCall.toolName`
			+ `&&JSON.stringify(__ahCur.toolCall.toolInput??null)===JSON.stringify(${req}.toolCall.toolInput??null)})())`,
	},
	{
		id: 'cold-chat-customizations',
		target: 'agenthost',
		title: 'a restored session has no slash commands until its next message',
		// `getChatCustomizations` resolves the chat through its LIVE runtime, so
		// a chat that has a backing but no resident runtime reports no
		// customizations at all: no project commands, no skills, no agents, no
		// rules, not even the read-only built-ins. That is every session
		// restored into a fresh host process, and every session idle eviction
		// released. Typing `/` then offers only the host's own commands
		// (`/rename`), and sending any message puts them all back.
		//
		// The provider already supports the cold read. The provisional session
		// `_createProvisionalChatSession` builds recovers its working
		// directories from the SDK transcript cwd or the persisted overlay and
		// starts no SDK Query, and `getSessionCustomizations` documents the
		// pre-materialize path as showing the full disk set. This entry point
		// is simply the one that never reaches it.
		//
		// The runtime is torn down again before returning. Leaving it resident
		// makes `_ensureResolvedChatSession` treat the chat as provisional on
		// the next send and materialize it fresh (`isResume: false` starts the
		// SDK with `sessionId` rather than `resume`), so a chat with a
		// transcript would silently begin a new conversation. A read must not
		// decide that.
		//
		// Queued on the chat's own sequencer and re-checked inside the lock, so
		// it cannot race a send resolving the same backing. Filed upstream as
		// microsoft/vscode#332047.
		unpatched: /async getChatCustomizations\((\w+),(\w+),(\w+)\)\{let (\w+)=this\._findChatByUri\(\1\);return \4\?\(\3&&\4\.setHostCustomizations\(\3\),\4\.getSessionCustomizations\(\)\):\[\]\}/,
		patched: /__ahColdCtx/,
		build: (m, chat, ctx, host, sess) =>
			`async getChatCustomizations(${chat},${ctx},${host}){let ${sess}=this._findChatByUri(${chat});`
			+ `if(!${sess}){let __ahColdCtx=this._resolveChatContext(${chat},${ctx});`
			+ `if(!__ahColdCtx.sdkSessionId)return[];`
			+ `return this._sessionSequencer.queue(__ahColdCtx.sequencerKey,async()=>{`
			+ `let __ahResident=this._findChatByUri(__ahColdCtx.chatKey);`
			+ `if(__ahResident)return ${host}&&__ahResident.setHostCustomizations(${host}),__ahResident.getSessionCustomizations();`
			+ `let __ahTransient;`
			+ `try{__ahTransient=await this._createProvisionalChatSession(__ahColdCtx.configurationResource,${chat},__ahColdCtx.resource);`
			+ `return ${host}&&__ahTransient.setHostCustomizations(${host}),await __ahTransient.getSessionCustomizations()}`
			+ `catch(__ahErr){this._logService.warn(\`[Claude] customization read could not resolve chat \${__ahColdCtx.chatKey}\`,__ahErr);return[]}`
			+ `finally{__ahTransient&&this._deleteLiveChat(__ahColdCtx.chatKey)}})}`
			+ `return ${host}&&${sess}.setHostCustomizations(${host}),${sess}.getSessionCustomizations()}`,
	},
	{
		id: 'subagent-spawn-turn',
		target: 'agenthost',
		title: 'a spawned subagent does not record the turn that spawned it',
		// Pairs with subagent-resumed-output: that fix needs to know which turn
		// a still-running subagent belongs to, and the spawn record does not
		// carry it. Stamped first-writer-wins, matching the record's other
		// fields. Upstream as microsoft/vscode#332075.
		unpatched: /function ([\w$]+)\((\w+),(\w+),(\w+),(\w+)\)\{let (\w+)=\2\.input,(\w+)=typeof \6\?\.description=="string"\?\6\.description:void 0,(\w+)=typeof \6\?\.subagent_type=="string"\?\6\.subagent_type:void 0,(\w+)=typeof \6\?\.prompt=="string"\?\6\.prompt:void 0,(\w+)=\2\.input!==void 0\?([\w$]+)\(\2\.input\):void 0;\5\.recordSpawn\(\2\.id,\{subagentType:\8,description:\7,prompt:\9\}\);/,
		patched: /__ahSpawnRec/,
		build: (m, fn, blk, chat, turn, reg, input, desc, stype, prompt, inputJson, stringify) =>
			`function ${fn}(${blk},${chat},${turn},${reg}){let ${input}=${blk}.input,`
			+ `${desc}=typeof ${input}?.description=="string"?${input}.description:void 0,`
			+ `${stype}=typeof ${input}?.subagent_type=="string"?${input}.subagent_type:void 0,`
			+ `${prompt}=typeof ${input}?.prompt=="string"?${input}.prompt:void 0,`
			+ `${inputJson}=${blk}.input!==void 0?${stringify}(${blk}.input):void 0;`
			+ `let __ahSpawnRec=${reg}.recordSpawn(${blk}.id,{subagentType:${stype},description:${desc},prompt:${prompt}});`
			+ `__ahSpawnRec.turnId===void 0&&(__ahSpawnRec.turnId=${turn});`,
	},
	{
		id: 'subagent-resume-anchor',
		target: 'agenthost',
		title: 'nothing records the turn a parent will resume into after a subagent',
		// Records the spawning turn on the registry when a background subagent
		// starts. It has to live on the registry rather than the spawn because
		// completion removes the spawn, and completion is exactly when the
		// parent resumes. Pairs with subagent-resumed-output. Upstream as
		// microsoft/vscode#332075.
		unpatched: /if\((\w+)==="task_started"\)\{let (\w+)=(\w+)\.tool_use_id,(\w+)=\2\?(\w+)\.getSpawn\(\2\):void 0;return \4&&\(\4\.background=!0\),\[\]\}/,
		patched: /__ahResumeTurn=/,
		build: (m, sub, id, msg, spawn, reg) =>
			`if(${sub}==="task_started"){let ${id}=${msg}.tool_use_id,${spawn}=${id}?${reg}.getSpawn(${id}):void 0;`
			+ `return ${spawn}&&(${spawn}.background=!0,${spawn}.turnId!==void 0&&(${reg}.__ahResumeTurn=${spawn}.turnId)),[]}`,
	},
	{
		id: 'subagent-resumed-output',
		target: 'agenthost',
		title: 'everything the parent says after a background subagent finishes is dropped',
		// The pipeline takes the turn from the prompt queue head, so a parent
		// that spawns background subagents ends its own turn and every later
		// message arrives with no turn. The router then returns early and drops
		// it, silently at every log level, so when the subagents settle and the
		// parent resumes the chat shows nothing more. The transcript keeps it
		// all, which is why restarting the agent host reveals the whole reply.
		//
		// Falls back to the anchor subagent-resume-anchor recorded at spawn
		// time, and drops that anchor once a message for a different turn
		// arrives. Anchoring on the spawn event rather than on live spawns is
		// what makes it survive the completion that removes the spawn.
		// Upstream as microsoft/vscode#332075.
		unpatched: /async handle\((\w+),(\w+),(\w+)\)\{if\(\1\.type==="assistant"\?/,
		patched: /this\._subagents\.__ahResumeTurn/,
		build: (m, msg, turn, ctx) =>
			`async handle(${msg},${turn},${ctx}){`
			+ `if(${turn}!==void 0&&${turn}!==this._subagents.__ahResumeTurn)this._subagents.__ahResumeTurn=void 0;`
			+ `${turn}===void 0&&(${turn}=this._subagents.__ahResumeTurn);`
			+ `if(${msg}.type==="assistant"?`,
	},
	{
		id: 'optimistic-turn-start-masks-streaming',
		target: 'workbench',
		title: 'responses appear only when the turn ends, never streaming',
		// The client applies its own `chat/turnStarted` optimistically and keeps it
		// in `_pendingActions` until the backend echoes it with the originating
		// clientSeq. The agent host does not echo that clientSeq, so the pending
		// start survives the whole turn, and `_recomputeOptimistic` replays it over
		// the confirmed state on every single action. Replaying a turn start resets
		// `activeTurn` to a fresh empty turn, so `activeTurn.responseParts` reads as
		// empty for the entire stream no matter how many deltas have been applied.
		//
		// Measured in a live window: 17 `chat/delta` envelopes arrived between 8.0s
		// and 19.4s and every one passed the channel filter, yet the confirmed part
		// count of 1 was rewritten to 0 on all 19 recomputes. The renderer set up
		// its markdown observer at 19.4s and emitted the whole 2,432 characters in
		// one go. With the fix the same prompt set the observer up at 7.8s and
		// emitted 16 times across 12 seconds.
		//
		// The existing code already knows the echo lacks the clientSeq: it promotes
		// the pending start when a terminal action arrives, which is exactly why the
		// text lands all at once at the end. Widening that promotion to the first
		// action naming the turn confirms the start while the turn is still running.
		// Upstream as microsoft/vscode#332087.
		//
		// The minified method keeps its `IfTerminal` name because renaming it would
		// mean rewriting its call site for no behavioural gain.
		unpatched: /_promotePendingTurnStartIfTerminal\((\w+)\)\{if\(!(\w+)\(\1\)\|\|\1\.type!=="chat\/turnComplete"&&\1\.type!=="chat\/turnCancelled"&&\1\.type!=="chat\/error"\)return;/,
		patched: /_promotePendingTurnStartIfTerminal\(\w+\)\{if\(!\w+\(\w+\)\|\|\w+\.turnId===void 0\)return;/,
		build: (m, act, isChat) =>
			`_promotePendingTurnStartIfTerminal(${act}){if(!${isChat}(${act})||${act}.turnId===void 0)return;`,
	},
	{
		id: 'chat-turnstarted-idempotent',
		target: 'workbench',
		title: 'a replayed turn start keeps rebuilding the turn empty, so the response never streams',
		// Root cause of the same defect `optimistic-turn-start-masks-streaming`
		// works around from the other end, and both are wanted.
		//
		// The chat subscription keeps an optimistic overlay: every action the
		// client dispatches is applied locally, held in `_pendingActions`, and
		// replayed on top of confirmed state each time a confirmed action
		// arrives. A pending entry is retired only when the backend echoes it
		// with the client's own clientSeq, and the agent host does not echo the
		// clientSeq for `chat/turnStarted`, so that start stays pending for the
		// whole turn.
		//
		// The reducer case then rebuilt `activeTurn` unconditionally, with an
		// empty `responseParts`, on every replay. Once the start was confirmed by
		// some other path each recompute wiped the streamed content again, so
		// `activeTurn.responseParts` read as empty for the entire turn no matter
		// how many deltas had been applied, and the whole response landed in one
		// go at turn end.
		//
		// Returning `state` unchanged when the turn is already the active turn,
		// or already among the completed turns, makes the case idempotent: a
		// replayed start can no longer reset a turn in progress, and cannot
		// resurrect a finished turn as an empty active one. Restarting a finished
		// turn stays `chat/turnResume`'s job.
		//
		// Only the workbench copy is patched. The agent host bundles this same
		// reducer, but it has no optimistic overlay at all (no `_pendingActions`,
		// `applyOptimistic` or `_recomputeOptimistic` anywhere in that bundle), so
		// it applies each action once and never replays one. Patching it there
		// would be inert.
		//
		// `state.turns` is read without a guard because the reducer's own
		// `chat/truncated` case already does the same, so it is never absent.
		// Upstream as microsoft/vscode#332087.
		unpatched: /case"chat\/turnStarted":\{let (\w+)=\{\.\.\.(\w+),activeTurn:\{id:(\w+)\.turnId,startedAt:\3\.startedAt,message:\3\.message,responseParts:\[\],usage:void 0\}\};/,
		patched: /case"chat\/turnStarted":\{if\(\w+\.activeTurn\?\.id===\w+\.turnId\|\|\w+\.turns\.some\(/,
		build: (m, next, state, action) => {
			const turn = pickName([next, state, action]);
			return `case"chat/turnStarted":{`
				+ `if(${state}.activeTurn?.id===${action}.turnId`
				+ `||${state}.turns.some(${turn}=>${turn}.id===${action}.turnId))return ${state};`
				+ `let ${next}={...${state},activeTurn:{id:${action}.turnId,startedAt:${action}.startedAt,`
				+ `message:${action}.message,responseParts:[],usage:void 0}};`;
		},
	},
	{
		id: 'truncation-retire-stranded',
		target: 'workbench',
		title: 'a stranded optimistic truncation is replayed forever and blanks the transcript',
		// Same optimistic-overlay mechanism as `chat-turnstarted-idempotent`, but
		// the action here is not idempotent by nature, so making the reducer
		// tolerant is not the fix: the pending entry has to be retired.
		//
		// A client-dispatched `chat/truncated` is applied optimistically and stays
		// in `_pendingActions` until the host echoes its clientSeq. The agent host
		// applies it without echoing, so the pending truncation is replayed over
		// confirmed state on every later envelope, clearing `activeTurn` and, when
		// it carries no turnId, every turn with it. The workbench dispatches the
		// truncation immediately before `chat/turnStarted`, so this blanks the
		// transcript of the turn that follows, for as long as the entry lives.
		//
		// Retire it once the host has evidently applied it, folding it into
		// confirmed state on the way out. Two observations count as evidence:
		//   - a confirmed `chat/truncated` for the same turnId that carries NO
		//     origin. Our own echo is already dropped by clientSeq, and a foreign
		//     origin is not proof that OUR action was applied.
		//   - a confirmed `chat/turnStarted` this client dispatched after the
		//     truncation. Dispatches are processed in order, so a later one being
		//     acknowledged means the earlier one was seen.
		//
		// Exactly one entry, the earliest match, is retired per observation,
		// because one observation is evidence of one host-side application. The
		// first revision retired every match and is recorded so it is not
		// retried: with two truncations pending around a turn start, echoing the
		// first retired the second as well, and the replay then restored the very
		// turn the second was meant to clear.
		//
		// `_reconcile` is restructured the way upstream restructured it, which is
		// load bearing rather than cosmetic: the echoed entry is dropped by
		// clientSeq BEFORE any promotion runs, so promoting an earlier entry
		// cannot shift the index of the echoed one. It also brings the two
		// promotions onto one path, so the truncation check sees own-origin
		// envelopes too, which is what the second evidence case needs.
		//
		// `isChatAction` is not re-tested. `receiveEnvelope` returns early unless
		// `_isRelevantEnvelope` passed, and this subclass tests exactly that, so
		// nothing else can reach `_reconcile`. The regex keeps `this._chatUri` in
		// the match for the same reason it matters here: four subscription classes
		// in this bundle carry a byte-identical `_reconcile`, and only the chat one
		// is meant.
		//
		// Upstream's helper takes a `promote` flag for the turn-start caller;
		// here it always promotes, since `_promotePendingTurnStartIfTerminal` is
		// deliberately left alone. That method is rewritten by
		// `optimistic-turn-start-masks-streaming`, and folding it into this entry
		// would make the two collide over one site for no behavioural gain.
		//
		// Upstream branch fix/retire-stranded-truncation.
		unpatched: /_isRelevantEnvelope\((\w+)\)\{return (\w+)\(\1\.action\)&&\1\.channel===this\._chatUri\}_onSnapshotApplied\((\w+)\)\{super\._onSnapshotApplied\(\3\),this\._recomputeOptimistic\(\)\}_reconcile\((\w+),(\w+)\)\{if\(\5&&\4\.origin\)\{let (\w+)=this\._pendingActions\.findIndex\((\w+)=>\7\.clientSeq===\4\.origin\.clientSeq\);\6!==-1\?\(\4\.rejectionReason\|\|this\._confirmedApply\(\4\.action\),this\._pendingActions\.splice\(\6,1\)\):\4\.rejectionReason\|\|this\._confirmedApply\(\4\.action\)\}else \4\.rejectionReason\|\|\(this\._promotePendingTurnStartIfTerminal\(\4\.action\),this\._confirmedApply\(\4\.action\)\);this\._recomputeOptimistic\(\)\}/,
		patched: /__ahRetireTruncation\(\w+,\w+\)\{let /,
		build: (m, relArg, isChat, snapArg, env, own) =>
			`_isRelevantEnvelope(${relArg}){return ${isChat}(${relArg}.action)&&${relArg}.channel===this._chatUri}`
			+ `_onSnapshotApplied(${snapArg}){super._onSnapshotApplied(${snapArg}),this._recomputeOptimistic()}`
			+ `_reconcile(${env},${own}){`
			+ `${own}&&${env}.origin&&this.dropPendingByClientSeq(${env}.origin.clientSeq);`
			+ `${env}.rejectionReason||(`
			+ `${own}||this._promotePendingTurnStartIfTerminal(${env}.action),`
			+ `this.__ahRetireTruncation(${env},${own}),`
			+ `this._confirmedApply(${env}.action));`
			+ `this._recomputeOptimistic()}`
			+ `__ahRetireTruncation(_ahE,_ahO){`
			+ `let _ahA=_ahE.action,_ahG=_ahE.origin;`
			+ `_ahA.type==="chat/truncated"&&!_ahG`
			+ `?this.__ahRetireEarliest(_ahP=>_ahP.action.type==="chat/truncated"&&_ahP.action.turnId===_ahA.turnId)`
			+ `:_ahA.type==="chat/turnStarted"&&_ahO&&_ahG`
			+ `&&this.__ahRetireEarliest(_ahP=>_ahP.action.type==="chat/truncated"&&_ahP.clientSeq<_ahG.clientSeq)}`
			+ `__ahRetireEarliest(_ahF){`
			+ `let _ahI=this._pendingActions.findIndex(_ahF);`
			+ `_ahI!==-1&&this._confirmedApply(this._pendingActions.splice(_ahI,1)[0].action)}`,
	},
	{
		id: 'plugin-read-surface-errors',
		target: 'agenthost',
		title: 'a filesystem the host cannot address looks exactly like an absent file',
		// `readJsonFile` and `pathExists` in `pluginParsers` are the two reads all
		// of plugin discovery goes through, and both swallow every error and
		// report absent. A missing `plugin.json` and a filesystem the host cannot
		// address at all are therefore indistinguishable, at every log level.
		//
		// That is why a whole cluster of remote-window defects was invisible. A
		// remote window hands the host `vscode-agent-host://`-wrapped URIs, and
		// inside the container `FileService` has no provider for them, so every
		// probe throws `ENOPRO: No file system provider found for resource ...`
		// and discovery reports an empty, entirely plausible-looking result.
		// Permission errors vanish the same way.
		//
		// Keep the read absent, but say so. A missing file (`FILE_NOT_FOUND`) or
		// a path that runs through a file (`FILE_NOT_DIRECTORY`) stays silent
		// because those are the ordinary answers; everything else is warned with
		// the resource and the message.
		//
		// The classification is inlined rather than calling the bundle's own
		// `toFileOperationResult`, which sits far from this site and would need a
		// second unanchored identifier. The two forms it has to recognise are
		// `FileOperationError`, which carries the numeric `fileOperationResult`
		// (`FILE_NOT_FOUND` 1, `FILE_NOT_DIRECTORY` 9, fixed by the declaration
		// order of the const enum in `files.ts`), and `FileSystemProviderError`,
		// which carries `code` and, via `markAsFileSystemProviderError`, the
		// `"<code> (FileSystemError)"` name. Verified against this bundle's own
		// `toFileOperationResult`, whose switch maps `EntryNotFound` to 1 and
		// `EntryNotADirectory` to 9. A raw node `ENOENT` that reached here would
		// be logged rather than silenced, which is what upstream does too.
		//
		// LOCAL SCOPE, deliberately narrower than the upstream branch
		// `fix/surface-missing-provider-errors`. That change threads an
		// `ILogService` through 22 files to reach these helpers, because they are
		// free functions that take only a URI and an `IFileService`. Rethreading
		// that in a minified bundle is not worth the blast radius, so the logger
		// is taken off the `IFileService` itself: the concrete `FileService` is
		// constructed as `new FileService(logService)` and keeps it as a plain
		// `logService` property, which this build preserves. If a future build
		// mangles that property, or the caller passes something other than the
		// concrete service, it falls back to `console.warn` so the message is
		// still emitted somewhere rather than lost. Upstream's `tryResolve` and
		// the bare `fileService.resolve` swallows in `readSkills`,
		// `readMarkdownComponents` and `readInstructionComponents` are NOT
		// covered here; these two helpers carry the overwhelming majority of the
		// probes and all of the manifest reads.
		unpatched: /async function ([\w$]+)\(([\w$]+),([\w$]+)\)\{try\{let ([\w$]+)=await \3\.readFile\(\2\);return ([\w$]+)\(\4\.value\.toString\(\)\)\}catch\{return\}\}async function ([\w$]+)\(([\w$]+),([\w$]+)\)\{try\{return await \8\.resolve\(\7\),!0\}catch\{return!1\}\}/,
		patched: /__ahPluginReadWarn/,
		build: (m, readJsonFile, jsonUri, jsonFs, contents, parseJSONC, pathExists, existsUri, existsFs) =>
			`function __ahPluginReadSilent(e){`
			+ `let r=e&&e.fileOperationResult;if(typeof r=="number")return r===1||r===9;`
			+ `let c=e&&typeof e.code=="string"?e.code:"";`
			+ `if(!c){let n=String(e&&e.name||"");c=n.endsWith(" (FileSystemError)")?n.slice(0,-18):""}`
			+ `return c==="EntryNotFound"||c==="EntryNotADirectory"}`
			+ `function __ahPluginReadWarn(u,f,e){`
			+ `if(__ahPluginReadSilent(e))return;`
			+ `let t="[pluginParsers] Failed to read '"+u.toString()+"': "+(e instanceof Error?e.message:String(e));`
			+ `try{let l=f&&f.logService;typeof l?.warn=="function"?l.warn(t):console.warn(t)}catch{console.warn(t)}}`
			+ `async function ${readJsonFile}(${jsonUri},${jsonFs}){`
			+ `try{let ${contents}=await ${jsonFs}.readFile(${jsonUri});return ${parseJSONC}(${contents}.value.toString())}`
			+ `catch(__ahReadErr){__ahPluginReadWarn(${jsonUri},${jsonFs},__ahReadErr);return}}`
			+ `async function ${pathExists}(${existsUri},${existsFs}){`
			+ `try{return await ${existsFs}.resolve(${existsUri}),!0}`
			+ `catch(__ahReadErr){__ahPluginReadWarn(${existsUri},${existsFs},__ahReadErr);return!1}}`,
	},
	{
		id: 'client-tool-no-host-confirm',
		target: 'agenthost',
		title: 'a client tool the workbench already confirmed is confirmed again by the host',
		// The Claude SDK gates in-process MCP tools through `canUseTool`, so a
		// workbench client tool (`mcp__client__*`) took the generic
		// pending_confirmation path even though the stream mapper had already
		// readied it as a running client execution. The extra host-side prompt
		// regresses the call from Running back to PendingConfirmation, and the
		// workbench rewrites that into a SECOND ToolClientExecution request with
		// no pre-approval, which is how a client tool gets run twice
		// (microsoft/vscode#330683).
		//
		// The allow sits after the interactive built-ins (`AskUserQuestion`,
		// `ExitPlanMode`) and before the server-tool auto-allow, because the
		// interactive pair is exempt from auto-approval by design: their
		// "permission" IS the user-facing question, and allowing them early would
		// swallow it. `allowedTools` is deliberately left alone; its semantics for
		// in-process MCP tools under the plan and dontAsk modes are unverified.
		//
		// The ownership test is not optional. The SDK server map is built from the
		// external MCP configuration plus the in-process client server with no
		// reserved-name check, so a workspace or user MCP server literally named
		// `client` also emits `mcp__client__*` tools. Keying on the prefix alone
		// would skip confirmation for tools no window owns. Anything carrying the
		// prefix without an owner falls through to the MCP confirmation path
		// unchanged.
		//
		// Upstream adds a `hasClientTool(name)` accessor on the session; here it is
		// inlined as the one expression that accessor is (`toolDiff.model.ownerOf`),
		// so this stays a single anchorable site rather than an entry that is inert
		// without a second one. Both name helpers are captured from the bundle
		// rather than reimplemented, since the `mcp__<server>__` prefix is built
		// from a module constant the minifier is free to rename.
		// Mirrors microsoft/vscode#334037.
		unpatched: /if\((\w+)\.has\((\w+)\)\)return (\w+)\((\w+),(\w+),\2,(\w+),(\w+)\);let (\w+)=(\w+)\(\2\),(\w+)=\4\.serverToolHost;/,
		patched: /\.toolDiff\.model\.ownerOf\(\w+\(\w+\)\)!==void 0\)return\{behavior:"allow"/,
		build: (...args) => {
			const src = args[args.length - 1];
			const [, interactive, toolName, handleInteractive, deps, session, input, options, serverToolName, extractServerTool, serverToolHost] = args;
			// `stripClientToolNamePrefix` / `hasClientToolNamePrefix`, located by
			// shape. Both read the same `mcp__${CLAUDE_CLIENT_MCP_SERVER_NAME}__`
			// template, which is what makes the pair identifiable.
			const names = src.match(/var (\w+)="client";function (\w+)\((\w+)\)\{let (\w+)=`mcp__\$\{\1\}__`;return \3\.startsWith\(\4\)\?\3\.slice\(\4\.length\):\3\}function (\w+)\((\w+)\)\{return \6\.startsWith\(`mcp__\$\{\1\}__`\)\}/);
			if (!names) { throw new Error('client-tool-no-host-confirm: client tool name helpers not found'); }
			const [, , strip, , , hasPrefix] = names;
			return `if(${interactive}.has(${toolName}))return ${handleInteractive}(${deps},${session},${toolName},${input},${options});`
				+ `if(${hasPrefix}(${toolName})&&${session}.toolDiff.model.ownerOf(${strip}(${toolName}))!==void 0)`
				+ `return{behavior:"allow",updatedInput:${input}};`
				+ `let ${serverToolName}=${extractServerTool}(${toolName}),${serverToolHost}=${deps}.serverToolHost;`;
		},
	},
	{
		id: 'client-tool-ownerless-fail-map-start',
		target: 'agenthost',
		title: 'the stream mapper does not record that a client tool call has no owner',
		// First of five edits implementing the ownerless-client-tool failure. A
		// client tool (`mcp__client__<name>`) runs on whichever connected window
		// contributed it. When no connected client provides it, the Claude session
		// stamps no contributor on ChatToolCallStart, so nothing publishes a
		// ToolClientExecution request, the disconnect grace timer never arms, and
		// the in-process MCP handler parks on the pending registry forever: the
		// turn hangs with no error and no way out. The Copilot session already
		// fails such calls immediately (`No client was connected to run ...`);
		// this brings Claude in line.
		//
		// Each edit is inert without the others. Without this one the flag is never
		// set, so `-map-stop` emits nothing; without `-session` the completion is
		// rendered but the handler still parks. Partial application after a VS Code
		// update therefore degrades to the unpatched hang rather than to a
		// half-failed call.
		//
		// The owner lookup already exists a few statements later (it feeds the
		// `contributor` field); this hoists it above `startToolBlock` so the answer
		// is available while the block is being recorded. Upstream widens
		// `startToolBlock` with a sixth `ownerless` parameter and stores it in the
		// active-block record. Here the record is stamped through
		// `getActiveToolBlock` instead, which is the same object by identity and
		// keeps the whole change inside this one function: widening the method
		// signature would need a second anchor in `ClaudeMapperState`, several
		// thousand characters away, that is inert on its own.
		unpatched: /if\((\w+)\.type==="tool_use"\)\{let (\w+)=(\w+)\(\1\.name\),(\w+)=(\w+)\(\1\.name\);(\w+)\.startToolBlock\((\w+)\.index,\1\.id,\2,(\w+),\4\);let (\w+)=!\4&&(\w+)\.has\(\2\);(\w+)===null\?\9&&(\w+)\.recordSpawn\(\1\.id\):\12\.noteInnerTool\(\1\.id,\11\);let (\w+)=\4\?void 0:(\w+)\(\2\),(\w+)=\4\?(\w+)\?\.\(\2\):void 0;return\[/,
		patched: /\.getActiveToolBlock\(\w+\.index\)\.ownerless=!0/,
		build: (m, block, toolName, strip, isClientTool, hasPrefix, state, event, turnId, spawns, spawnNames, parent, registry, meta, metaFor, owner, ownerOf) =>
			`if(${block}.type==="tool_use"){`
			+ `let ${toolName}=${strip}(${block}.name),${isClientTool}=${hasPrefix}(${block}.name),`
			+ `${owner}=${isClientTool}?${ownerOf}?.(${toolName}):void 0;`
			+ `${state}.startToolBlock(${event}.index,${block}.id,${toolName},${turnId},${isClientTool}),`
			+ `${isClientTool}&&${owner}===void 0&&(${state}.getActiveToolBlock(${event}.index).ownerless=!0);`
			+ `let ${spawns}=!${isClientTool}&&${spawnNames}.has(${toolName});`
			+ `${parent}===null?${spawns}&&${registry}.recordSpawn(${block}.id):${registry}.noteInnerTool(${block}.id,${parent});`
			+ `let ${meta}=${isClientTool}?void 0:${metaFor}(${toolName});return[`,
	},
	{
		id: 'nested-subagent-spawn-recorded',
		target: 'agenthost',
		title: 'a subagent spawned by another subagent never gets a chat, so its work never renders',
		// A spawning tool call is recorded in the spawn registry only when it is
		// top level. When one subagent spawns another the call is merely noted as
		// an inner tool, so `getSpawn` misses it, no `subagent_started` is emitted,
		// the host never creates the subagent chat, and the client's subscribe to
		// that chat fails with `Resource not found`. The nested subagent runs to
		// completion with nothing it produces ever reaching the UI.
		//
		// Measured in one session: 11 spawns at depth 1 all started a turn and
		// rendered; all 4 at depth 2 failed their subscribe and started no turn.
		// The correlation with `spawnDepth` in the on-disk subagent metadata was
		// exact, and the host log carries only two lines for each depth-2 call, a
		// forwarded client tool completion and the failed subscribe.
		//
		// The inner-tool edge is still recorded, because `oI` reads it back through
		// `getParentSpawn` to fill `parentToolCallId` on the emitted signal, which
		// is what nests the chat under its parent rather than the session root.
		unpatched: /([\w$]+)===null\?([\w$]+)&&([\w$]+)\.recordSpawn\(([\w$]+)\.id\):\3\.noteInnerTool\(\4\.id,\1\)/,
		patched: /recordSpawn\([\w$]+\.id\),[\w$]+\.noteInnerTool\(/,
		build: (m, parent, isSpawn, reg, block) =>
			`${parent}===null?${isSpawn}&&${reg}.recordSpawn(${block}.id)`
				+ `:(${isSpawn}&&${reg}.recordSpawn(${block}.id),${reg}.noteInnerTool(${block}.id,${parent}))`,
	},
	{
		id: 'client-tool-ownerless-fail-map-stop',
		target: 'agenthost',
		title: 'a client tool call no window can run is never failed',
		// Second of five. Pairs with `-map-start`, which marks the active tool
		// block when the client-tool owner lookup came back empty. At
		// `content_block_stop` the mapper already emits ChatToolCallReady for the
		// call; this follows it with a ChatToolCallComplete carrying
		// `success:false` and the `toolUnavailable` error code the workbench
		// already uses for exactly this situation, so the call renders as failed
		// instead of running forever.
		//
		// It has to come AFTER the ready rather than instead of it: the reducer
		// only accepts a completion for a call it has already seen readied, and
		// the tool-call tracker keys its bookkeeping off the same order.
		//
		// The two message strings are emitted as plain concatenation. Upstream
		// runs them through `localize` with the tool name as a placeholder, but a
		// minified patch cannot add an nls id, and the English text is what the
		// non-localized build resolves to anyway. The error CODE is protocol
		// rather than UI text, so it is written literally on both sides.
		unpatched: /(\w+)\.push\(\{kind:"action",resource:(\w+),action:\{type:"chat\/toolCallReady",turnId:(\w+),toolCallId:(\w+)\.toolUseId,invocationMessage:(\w+)\.invocationMessage,\.\.\.\5\.toolInput!==void 0\?\{toolInput:\5\.toolInput\}:\{\},confirmed:"not-needed",\.\.\.(\w+)\?\{_meta:\6\}:\{\}\}\}\),\1\}/,
		patched: /toolCallId:(\w+)\.toolUseId,result:\{success:!1,pastTenseMessage:\1\.toolName\+" failed"/,
		build: (m, signals, chat, turnId, tracked, info, meta) =>
			`${signals}.push({kind:"action",resource:${chat},action:{type:"chat/toolCallReady",turnId:${turnId},`
			+ `toolCallId:${tracked}.toolUseId,invocationMessage:${info}.invocationMessage,`
			+ `...${info}.toolInput!==void 0?{toolInput:${info}.toolInput}:{},confirmed:"not-needed",`
			+ `...${meta}?{_meta:${meta}}:{}}}),`
			+ `${tracked}.ownerless&&${signals}.push({kind:"action",resource:${chat},action:{type:"chat/toolCallComplete",`
			+ `turnId:${turnId},toolCallId:${tracked}.toolUseId,result:{success:!1,`
			+ `pastTenseMessage:${tracked}.toolName+" failed",`
			+ `error:{message:"No client was connected to run "+${tracked}.toolName,code:"toolUnavailable"}}}}),`
			+ `${signals}}`,
	},
	{
		id: 'client-tool-ownerless-fail-subagent',
		target: 'agenthost',
		title: 'a subagent client tool call no window can run is never failed',
		// Third of five. The same defect on the other producer: inner tool uses
		// arrive pre-parsed on a synthesized `assistant` message rather than as
		// streamed content blocks, so they never pass through
		// `content_block_start` / `content_block_stop` and `-map-start` /
		// `-map-stop` cannot see them. This site owns the whole start/ready pair
		// for an inner call, and the owner is already resolved here, so the
		// completion is emitted inline rather than through the active-block record.
		//
		// Nothing tags the parent here on purpose: the caller runs every signal
		// this function returns through `tagWithParent`, so the completion picks
		// up the same `parentToolCallId` as the start and ready beside it. Tagging
		// it here as well would set the field twice with the same value and hide
		// that the routing is the caller's job.
		//
		// Anchored across BOTH pushes rather than the ready alone, because the
		// clientId this branches on is only named in the start push
		// (`...clientId?{contributor:...}`), and re-deriving it would mean
		// duplicating the owner lookup.
		unpatched: /(\w+)\.push\(\{kind:"action",resource:(\w+),action:\{type:"chat\/toolCallStart",turnId:(\w+),toolCallId:(\w+)\.id,toolName:(\w+),displayName:(\w+),\.\.\.(\w+)\?\{contributor:\{kind:"client",clientId:\7\}\}:\{\},\.\.\.(\w+)\?\{_meta:\8\}:\{\}\}\}\),\1\.push\(\{kind:"action",resource:\2,action:\{type:"chat\/toolCallReady",turnId:\3,toolCallId:\4\.id,invocationMessage:(\w+)\?\6:(\w+)\(\5,\6,\4\.input\),\.\.\.(\w+)!==void 0\?\{toolInput:\11\}:\{\},confirmed:"not-needed"\}\}\);continue\}/,
		patched: /toolCallId:\w+\.id,result:\{success:!1,pastTenseMessage:(\w+)\+" failed",error:\{message:"No client was connected to run "\+\1/,
		build: (m, signals, chat, turnId, block, toolName, displayName, clientId, meta, isClientTool, invocationFor, toolInputStr) =>
			`${signals}.push({kind:"action",resource:${chat},action:{type:"chat/toolCallStart",turnId:${turnId},`
			+ `toolCallId:${block}.id,toolName:${toolName},displayName:${displayName},`
			+ `...${clientId}?{contributor:{kind:"client",clientId:${clientId}}}:{},...${meta}?{_meta:${meta}}:{}}}),`
			+ `${signals}.push({kind:"action",resource:${chat},action:{type:"chat/toolCallReady",turnId:${turnId},`
			+ `toolCallId:${block}.id,invocationMessage:${isClientTool}?${displayName}:${invocationFor}(${toolName},${displayName},${block}.input),`
			+ `...${toolInputStr}!==void 0?{toolInput:${toolInputStr}}:{},confirmed:"not-needed"}}),`
			+ `${isClientTool}&&${clientId}===void 0&&${signals}.push({kind:"action",resource:${chat},`
			+ `action:{type:"chat/toolCallComplete",turnId:${turnId},toolCallId:${block}.id,result:{success:!1,`
			+ `pastTenseMessage:${toolName}+" failed",`
			+ `error:{message:"No client was connected to run "+${toolName},code:"toolUnavailable"}}}});continue}`,
	},
	{
		id: 'client-tool-ownerless-fail-session',
		target: 'agenthost',
		title: 'the SDK handler for a failed client tool call still parks forever',
		// Fourth of five, and the one that actually ends the hang. `-map-stop` and
		// `-subagent` render the call as failed, but the SDK's in-process MCP
		// handler is a separate round trip: it parks a deferred on the pending
		// client-tool registry and waits for a completion that, with no window to
		// run the tool, is never going to arrive. Buffering the failure through
		// `respondOrBuffer` means the handler's later `register` finds a result
		// waiting and resolves immediately, whichever order the two arrive in.
		//
		// The tool call ids are recorded because `-permission` needs them, and the
		// buffers are swept at `chat/turnComplete`: a permission mode that denies
		// before execution never runs the MCP handler at all, so an unswept buffer
		// would sit in the registry until the session was disposed and grow with
		// every ownerless call. The sweep deletes straight out of `_earlyResults`
		// rather than through the `discardBufferedResult` accessor upstream adds,
		// so this entry stays self-contained: a separate accessor entry that
		// failed to apply would turn this sweep into a TypeError on every turn.
		//
		// It hooks `_enrichSignalWithMcpContributor` rather than the
		// `onDidProduceSignal` registration that calls it. Same instant (the
		// enricher has exactly one call site, the session's own signal re-fire),
		// but `replay-seen` already rewrites that registration, and anchoring
		// there would make the two entries order-dependent in the FIXES array.
		//
		// The SDK's own `tool_result` still maps to a second ChatToolCallComplete
		// for the same id later. That is left alone: the reducer and the tool-call
		// tracker both ignore a completion for a call that already completed.
		unpatched: /_enrichSignalWithMcpContributor\((\w+)\)\{if\(\1\.kind!=="action"\|\|\1\.action\.type!=="chat\/toolCallStart"\|\|\1\.action\.contributor!==void 0\)return \1;/,
		// Deliberately not a bare `__ahOwnerless` test: `-permission` writes that
		// same name, so a loose marker here would report this entry as already
		// applied once that one had run and quietly skip it.
		patched: /_enrichSignalWithMcpContributor\(\w+\)\{if\(\w+\.kind==="action"\)/,
		build: (m, signal) =>
			`_enrichSignalWithMcpContributor(${signal}){`
			+ `if(${signal}.kind==="action"){`
			+ `if(${signal}.action.type==="chat/turnComplete"){`
			+ `if(this.__ahOwnerless){`
			+ `for(let __ahId of this.__ahOwnerless)this._pendingClientToolCalls._earlyResults.delete(__ahId);`
			+ `this.__ahOwnerless.clear()}}`
			+ `else if(${signal}.action.type==="chat/toolCallComplete"&&${signal}.action.result?.error?.code==="toolUnavailable"){`
			+ `this._logService.warn("[Claude:"+this.sessionId+"] client tool call "+${signal}.action.toolCallId`
			+ `+" has no connected client; failing it immediately");`
			+ `(this.__ahOwnerless??=new Set).add(${signal}.action.toolCallId);`
			+ `this._pendingClientToolCalls.respondOrBuffer(${signal}.action.toolCallId,`
			+ `{content:[{type:"text",text:${signal}.action.result.error.message}],isError:!0})}}`
			+ `if(${signal}.kind!=="action"||${signal}.action.type!=="chat/toolCallStart"||${signal}.action.contributor!==void 0)return ${signal};`,
	},
	{
		id: 'client-tool-ownerless-fail-permission',
		target: 'agenthost',
		title: 'the SDK still asks permission for a client tool call already failed',
		// Fifth of five. `-session` answers the MCP handler, but the SDK asks
		// permission through a different channel, and the host drops a permission
		// ask for a call it has already failed without replying to it, so the ask
		// itself becomes the new place the turn hangs. Short-circuit the ids
		// `-session` recorded: allow, so the SDK proceeds and reads the buffered
		// failure, and do it before `registerAndFire` so nothing is parked and no
		// pending_confirmation reaches the client for a call that is already dead.
		//
		// Keyed off the tool call id rather than the permission mode. Gating on
		// the mode was considered and rejected: the SDK documents `acceptEdits` as
		// auto-accepting file edit operations only, so a client tool still reaches
		// `canUseTool` in that mode, and skipping the answer there would restore
		// the hang. The id test needs no such enumeration and is mode-independent.
		//
		// Nothing is written to the permission registry, deliberately. Buffering
		// the approval there instead (the first shape this took) leaks in every
		// mode that never calls `canUseTool`: the answer sits in the registry's
		// early results until the session is disposed, and repeated ownerless
		// calls grow it for the session lifetime.
		//
		// Also covers what `client-tool-no-host-confirm` cannot: that entry only
		// allows a client tool an active client OWNS, so an ownerless one falls
		// through to exactly this method.
		// Mirrors microsoft/vscode#334037's companion change.
		unpatched: /requestPermission\((\w+)\)\{return!this\._pipeline\|\|this\._pipeline\.isAborted\?Promise\.resolve\(!1\):this\._pendingPermissions\.registerAndFire\(\1\.toolUseID,/,
		patched: /requestPermission\(\w+\)\{if\(this\.__ahOwnerless/,
		build: (m, args) =>
			`requestPermission(${args}){`
			+ `if(this.__ahOwnerless&&this.__ahOwnerless.has(${args}.toolUseID))return Promise.resolve(!0);`
			+ `return!this._pipeline||this._pipeline.isAborted?Promise.resolve(!1):`
			+ `this._pendingPermissions.registerAndFire(${args}.toolUseID,`,
	},
	{
		id: 'remote-working-directory-actions',
		target: 'agenthost',
		title: 'adding or removing a workspace folder from a container window is rejected by the host',
		// `resolveSessionWorkingDirectoryAction` is the validator every dynamic
		// working-directory action goes through, and it threw `Working directory
		// must be a file URI` for anything that was not `file:`. The client
		// dispatches the raw workspace-folder URIs, which in a dev-container
		// window are `vscode-remote://dev-container+<hex>/...`, so every add,
		// remove and replace after the session exists was rejected.
		//
		// `createSession` meanwhile accepted and stored those same URIs with no
		// scheme check at all, which is why sessions come up with the right
		// folders and only later edits fail. The two paths disagreeing is the
		// actual defect; the create path is the one that matches how the rest of
		// the system reads this state.
		//
		// Normalising to `file:` at ingress was considered and rejected. Host
		// state is echoed back unmodified (the protocol client only unwraps
		// agent-host URIs inbound and only wraps `file:` outbound), and the
		// client compares the echoed set against its `vscode-remote:` workspace
		// folders with extUri, in both `agentHostSessionListStore` and the
		// working-directory synchronizer. A `file:` entry would match neither, so
		// the session would drop out of the list and the synchronizer would
		// re-add the folder on every reconcile.
		//
		// Both throw sites sit in one function here, so one shared predicate
		// covers them, emitted as a sibling declaration rather than inlined twice
		// so the two cannot drift. `Schemas` is already named at this site, so
		// the scheme constants are read off it rather than hardcoded.
		//
		// LOCAL SCOPE, narrower than the upstream branch
		// `fix/remote-working-directory-actions`. That branch also puts the
		// predicate in `AgentService.createSession` and parses each
		// `createSession.workingDirectories` value strictly at the protocol
		// boundary. Both halves only ADD rejections: the first turns a currently
		// accepted unsupported scheme into a throw, the second turns a
		// scheme-less string from a generic provider-not-found error into
		// InvalidParams. Neither unblocks anything here, and the first is a new
		// failure mode on the create path, so only the reducer half is carried
		// over. The upstream drift argument does not apply to a bundle that is
		// re-derived from source on every VS Code update.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+)\)\{let ([\w$]+)=([\w$]+)\.parse\(\2\.directory,!0\);if\(\5\.scheme!==([\w$]+)\.file\)throw new Error\(`Working directory must be a file URI: \$\{\2\.directory\}`\);([\s\S]{0,600}?)let ([\w$]+)=\6\.parse\(\2\.replacement,!0\);if\(\9\.scheme!==\7\.file\)throw new Error\(`Working directory replacement must be a file URI: \$\{\2\.replacement\}`\);/,
		patched: /__ahSupportedWorkingDirectory/,
		build: (m, fn, action, dirs, capability, directory, uri, schemas, middle, replacement) =>
			`function __ahSupportedWorkingDirectory(u){return u.scheme===${schemas}.file||u.scheme===${schemas}.vscodeRemote}`
			+ `function ${fn}(${action},${dirs},${capability}){`
			+ `let ${directory}=${uri}.parse(${action}.directory,!0);`
			+ `if(!__ahSupportedWorkingDirectory(${directory}))`
			+ 'throw new Error(`Working directory must be a file or vscode-remote URI: ${' + action + '.directory}`);'
			+ middle
			+ `let ${replacement}=${uri}.parse(${action}.replacement,!0);`
			+ `if(!__ahSupportedWorkingDirectory(${replacement}))`
			+ 'throw new Error(`Working directory replacement must be a file or vscode-remote URI: ${' + action + '.replacement}`);',
	},
	{
		id: 'remote-folders-at-session-create',
		target: 'workbench',
		title: 'a session created from the chat handler in a container window gets no working directories at all',
		// `_hostAddressableWorkingDirectories` drops any folder whose scheme, as
		// the host will receive it, is not the scheme of the host's own
		// `defaultDirectory`. Every host reports that as `file:`. A dev-container
		// window's folders are `vscode-remote:` and the remote client's mapper
		// only unwraps `vscode-agent-host:` URIs, so they arrive here still
		// spelled `vscode-remote:` and every one of them is filtered out.
		//
		// The filter then falls back to `undefined`, so the session is created
		// with no working directories and the host picks its own. Nothing
		// recovers from that: the host treats the session as workspace-less, the
		// working-directory synchronizer refuses to touch a session it did not
		// see folders for, the session list's containment check matches nothing
		// so the session never lists, and the same filtered set seeds the
		// customization scope roots, which come up empty too.
		//
		// The comparison is wrong for this window specifically because
		// `EditorRemoteAgentHostTransport` already rewrites `vscode-remote:`
		// directories of the window's own authority to `file:` on createSession,
		// createChat and the working-directory actions, and maps them back
		// inbound. The other create path, the provisional session the chat input
		// picker pre-creates, sends the raw folders through that transport and
		// works; this handler path is taken whenever no provisional session
		// exists at first send, for example when the picker never attached or the
		// target folder was untrusted when it prewarmed.
		//
		// Keep a folder when its unwrapped scheme is the host's OR
		// `vscode-remote:`, which preserves the filter's original intent: a
		// scheme the host genuinely cannot address, such as a virtual `https:`
		// repository, is still dropped, and a local window's `file:` folders are
		// unaffected. This is the client-side counterpart of the agent host's
		// `remote-working-directory-actions`, so both ends of createSession agree
		// on which folders may be sent.
		//
		// The scheme is compared against the literal `"vscode-remote"` rather
		// than a `Schemas` member because no `Schemas` identifier is named
		// anywhere in this method, and reaching for one would need a second
		// unanchored capture for no gain.
		//
		// Upstream branch fix/remote-folders-at-session-create.
		unpatched: /_hostAddressableWorkingDirectories\(([\w$]+)\)\{let ([\w$]+)=this\._config\.connection\.initializeResult\.get\(\)\?\.defaultDirectory;if\(!\1\?\.length\|\|!\2\)return \1;let ([\w$]+)=([\w$]+)\.isUri\(\2\)\?\4\.revive\(\2\)\.scheme:\4\.parse\(\2\)\.scheme,([\w$]+)=\1\.filter\(([\w$]+)=>this\._config\.connection\.resourceUris\.toAgentHost\(\6\)\.scheme===\3\);/,
		patched: /__ahDirScheme/,
		build: (m, dirs, defaultDirectory, hostScheme, uri, addressable, directory) =>
			`_hostAddressableWorkingDirectories(${dirs}){`
			+ `let ${defaultDirectory}=this._config.connection.initializeResult.get()?.defaultDirectory;`
			+ `if(!${dirs}?.length||!${defaultDirectory})return ${dirs};`
			+ `let ${hostScheme}=${uri}.isUri(${defaultDirectory})?${uri}.revive(${defaultDirectory}).scheme:${uri}.parse(${defaultDirectory}).scheme,`
			+ `${addressable}=${dirs}.filter(${directory}=>{`
			+ `let __ahDirScheme=this._config.connection.resourceUris.toAgentHost(${directory}).scheme;`
			+ `return __ahDirScheme===${hostScheme}||__ahDirScheme==="vscode-remote"});`,
	},
	{
		id: 'subagent-observation-lifetime',
		target: 'workbench',
		title: 'a subagent turn hangs forever when its chat outlives the turn that spawned it',
		// The client starts observing a subagent's chat as soon as it sees the
		// spawning tool call, but the observation is owned by the disposable
		// store of the PARENT TURN. `onTurnEnded` disposes that store, which
		// releases the child chat subscription while the client's `subscribe`
		// is still in flight; the server's post-await liveness check fails it
		// and the protocol handler reports `Resource not found`. Nothing
		// re-subscribes, so the subagent's chat is never observed again.
		//
		// That is the normal ordering for a background subagent, whose chat is
		// created after its parent turn completes (measured at ~2s later on a
		// real one). Client tool execution is gated on a claimant that only the
		// chat observer sets (`_markToolCallRendered`), so the subagent's tool
		// is never executed and its turn never closes: the visible symptom is a
		// subagent turn that heartbeats forever. Mirrors microsoft/vscode#333931.
		//
		// The fix moves subagent observations off the parent turn's store. At
		// turn end an observation whose child chat has not settled is handed to
		// a handler-scoped map instead of being disposed, and is released when
		// the subagent settles or when a live in-turn observation supersedes
		// it. An observation whose subagent already finished is disposed exactly
		// as before, so the common case is unchanged. The detached observer's
		// progress sink is gated on `turnEnded`, because the parent's response
		// is closed by then and `acceptResponseProgress` THROWS on a completed
		// response. The claim and the subscription do not go through the sink,
		// so gating it does not stop the subagent finishing.
		//
		// DELIBERATE REDUCTION, because this is a regex patch on a minified
		// bundle. Upstream also sweeps the detached map when the backend session
		// is torn down, and guards re-entrancy while that sweep runs. Both live
		// at a third site far from these two, so neither is backported. The
		// consequence is a leak with a known bound: if a session is closed while
		// a subagent is still unsettled, that one observation and its chat
		// subscription are retained until the window is closed. A retained
		// subscription is much cheaper than a turn that never ends.
		//
		// Two sites, one entry, because they must move together: the context
		// object (which stops being owned by the turn store, and gains the
		// child-chat map and the `turnEnded` flag) and the single call that
		// populates that map and wraps the sink. The ~13KB between them is
		// captured and re-emitted verbatim.
		unpatched: /\{observations:(\w+)\.add\(new (\w+)\)\}([\s\S]{0,14000}?)this\._observeSubagentSession\((\w+)\.sessionResource,\4\.backendSession,(\w+),(\w+),(\w+),(\w+),\4\.sink,(\w+),(\w+),(\w+),(\w+)\)/,
		patched: /\{observations:new \w+,childChats:new Map,turnEnded:!1\}/,
		build: (m, turnStore, disposableMap, mid, opts, toolCallId, childChatUri, rootInvocationId, invocation, observationStore, ctx, credits, model) =>
			// The context object is built by an IIFE because the site is one
			// declarator of a `let` chain: a comma expression there would assign
			// the wrong value.
			`(()=>{let _ahX={observations:new ${disposableMap},childChats:new Map,turnEnded:!1},`
			// Settled means the child chat has run and has no active turn, which
			// is the same test upstream uses to decide there is nothing left to watch.
			+ `_ahS=(_ahU,_ahC)=>{let _ahT=this._getSessionState(_ahU,_ahC);return!!_ahT&&!_ahT.activeTurn&&_ahT.turns.length>0};`
			+ `${turnStore}.add({dispose:()=>{`
			+ `_ahX.turnEnded=!0;`
			+ `let _ahM=this.__ahDetachedSubagentObs||(this.__ahDetachedSubagentObs=new Map);`
			// Nothing to hand off to once the handler itself is going away: it
			// disposes every chat subscription on the way out.
			+ `if(!this._store.isDisposed)for(let _ahK of[..._ahX.observations.keys()]){`
			+ `let _ahP=_ahX.childChats.get(_ahK);`
			+ `if(!_ahP||_ahS(_ahP.s,_ahP.c))continue;`
			+ `let _ahO=_ahX.observations.deleteAndLeak(_ahK);`
			+ `if(!_ahO)continue;`
			+ `_ahM.get(_ahP.c)?.dispose();_ahM.set(_ahP.c,_ahO);`
			// The ref the observation already holds, read rather than acquired:
			// acquiring one mid-teardown can throw.
			+ `let _ahB=this._additionalChatSubscriptions.get(_ahP.c)?.object;`
			+ `_ahB&&_ahO.add(_ahB.onDidChange(()=>{`
			+ `_ahM.get(_ahP.c)===_ahO&&_ahS(_ahP.s,_ahP.c)&&(_ahM.delete(_ahP.c),_ahO.dispose())}))}`
			// Whatever is left is settled, and is disposed exactly as before.
			+ `_ahX.observations.dispose()}});return _ahX})()`
			+ mid
			// The child chat uri is only known here, so this is where the detach
			// hook is told which chat each observation is watching.
			+ `${ctx}.childChats.set(${toolCallId},{s:${opts}.backendSession.toString(),c:${childChatUri}});`
			// A live in-turn observation supersedes the one an earlier turn left behind.
			+ `this.__ahDetachedSubagentObs?.get(${childChatUri})?.dispose(),`
			+ `this.__ahDetachedSubagentObs?.delete(${childChatUri});`
			+ `this._observeSubagentSession(${opts}.sessionResource,${opts}.backendSession,${toolCallId},`
			+ `${childChatUri},${rootInvocationId},${invocation},`
			+ `_ahQ=>{${ctx}.turnEnded||${opts}.sink(_ahQ)},`
			+ `${observationStore},${ctx},${credits},${model})`,
	},
	{
		id: 'steer-keeps-tool-attribution',
		pr: 334008,
		target: 'agenthost',
		title: 'a tool still running when a steer lands never completes',
		// A steering message is injected with priority `now`, so the SDK emits a
		// `result` for the preempted turn even though the protocol turn is not
		// over. The pipeline already treats that result as intermediate and defers
		// `ChatTurnComplete` to the final one. The mapper did not: `mapResult`
		// cleared the tool_use attribution map and drained foreground subagent
		// spawns on EVERY result, intermediate ones included. A tool still in
		// flight when the steer landed therefore lost its attribution, its later
		// `tool_result` hit the unknown-id path, no completion was emitted, and
		// the tool showed Running for the rest of the session. A foreground
		// subagent that call had spawned vanished from the registry the same way,
		// so `subagent_started` was never announced and its inner signals stayed
		// buffered.
		//
		// Upstream takes the cleanup out of `mapResult` and gives the router a
		// `clearPendingTurnState` method the pipeline calls in the branch that
		// fires `ChatTurnComplete`. That is two files; a regex patch gets one
		// contiguous site, so the same semantics are reached from the pipeline
		// alone. The two cleanup methods are shadowed on the very instances the
		// router hands the mapper (`_mapperState` and `_subagents`, the same
		// objects passed to `mapSDKMessageToAgentSignals`) for the duration of the
		// routing call, and are then run explicitly once the queue reports the
		// turn drained. Cleanup happens exactly once, on the final result, which
		// is what upstream does; the mapper is left untouched.
		//
		// The shadow is an own property removed with `delete`, so the classes keep
		// their prototype methods and nothing survives the message. A second
		// consumer loop overlapping a rebind finds the shadow already installed,
		// leaves it alone and skips the explicit run, which degrades to the
		// unpatched behaviour for that one result rather than clearing twice. With
		// no `_router` at all nothing is shadowed and the mapper clears as before.
		//
		// The match deliberately STOPS before
		// `<completed>&&this._queue.isEmpty&&this._onDidProduceSignal.fire(...)`,
		// which is `steering-promote`'s whole anchor. That expression is left byte
		// for byte intact and this entry only inserts a statement ahead of it, so
		// the two apply in either order and neither hides the other's site.
		unpatched: /try\{await this\._router\.handle\((\w+),(\w+),\{turnDuration:(\w+),mode:this\._currentPermissionMode,clientContext:(\w+)\}\)\}catch\((\w+)\)\{this\._logService\.warn\(`\[ClaudeSdkPipeline:\$\{this\.sessionId\}\] router threw, skipping: \$\{\5\}`\)\}if\(\1\.type==="result"\)\{let (\w+)=this\._queue\.settleHead\(\);this\._logService\.info\(`\[Claude:\$\{this\.sessionId\}\] result for sdkUuid=\$\{\6\?\.sdkUuid\}`\),/,
		patched: /__ahHeld/,
		build: (m, msg, turn, duration, clientCtx, routerErr, completed) =>
			`let __ahHeld;`
			+ `if(${msg}.type==="result"&&this._router){`
			+ `let __ahMs=this._router._mapperState,__ahSg=this._router._subagents;`
			+ `__ahMs&&__ahSg&&!Object.prototype.hasOwnProperty.call(__ahMs,"clearPendingToolCalls")`
			+ `&&(__ahHeld={s:__ahMs,g:__ahSg},__ahMs.clearPendingToolCalls=function(){},`
			+ `__ahSg.drainForegroundSpawns=function(){return[]})}`
			+ `try{await this._router.handle(${msg},${turn},{turnDuration:${duration},`
			+ `mode:this._currentPermissionMode,clientContext:${clientCtx}})}`
			+ `catch(${routerErr}){this._logService.warn(`
			+ '`[ClaudeSdkPipeline:${this.sessionId}] router threw, skipping: ${' + routerErr + '}`)}'
			+ `__ahHeld&&(delete __ahHeld.s.clearPendingToolCalls,delete __ahHeld.g.drainForegroundSpawns);`
			+ `if(${msg}.type==="result"){let ${completed}=this._queue.settleHead();`
			+ 'this._logService.info(`[Claude:${this.sessionId}] result for sdkUuid=${' + completed + '?.sdkUuid}`),'
			+ `__ahHeld&&${completed}&&this._queue.isEmpty&&(__ahHeld.s.clearPendingToolCalls(this._logService),`
			+ `__ahHeld.g.drainForegroundSpawns().forEach(__ahOrphan=>this._logService.warn(`
			+ '`[ClaudeSdkPipeline] turn ended with pending subagent-spawning tool_use ${__ahOrphan.toolUseId}'
			+ ' (agentId=${__ahOrphan.agentId??"<unresolved>"}); dropping cross-message state`))),',
	},
	{
		id: 'skill-subagent-result-visible',
		pr: 334631,
		target: 'agenthost',
		title: 'a skill that runs in a subagent works for minutes and the turn renders empty',
		// A skill invoked as a subagent (the built-in `/code-review`, for one) is
		// spawned by the skill runner rather than by a `Task` tool call, so its
		// sidechain agent carries no tool-use id. `SubagentRegistry` is keyed
		// entirely on that id, so the host never learns the agent exists, opens no
		// subagent chat, and receives nothing on the stream while it runs.
		//
		// Measured on 2026-09-04: a `/code-review` ran for 10 minutes 8 seconds and
		// made 40 tool calls. Over that window the workbench received exactly one
		// `chat/turnStarted`, one `chat/usage` reporting zero tokens, and one
		// `chat/turnComplete`. No response part, no tool call. The 13.6 KB of
		// findings it produced were recovered from the SDK transcript afterwards.
		//
		// The parent model never runs in this shape, which is why the turn reports
		// zero tokens, and the whole product of the turn is the `result` message's
		// own text. The stock branch settles the head, logs the uuid, and discards
		// `result` unconditionally. This surfaces it as a markdown response part
		// when the turn spent no tokens, so a normal turn (whose result text merely
		// repeats the assistant message already streamed) is never duplicated.
		// Errors are left alone so the host keeps reporting them its own way.
		//
		// ORDER: this must stay after `steer-keeps-tool-attribution`, whose anchor
		// needs `settleHead();this._logService.info(` contiguous. This entry inserts
		// between those two, so running it first silently costs that entry its site.
		// That is exactly what happened on 2026-09-04, and only the marker check in
		// verify-agenthost-patches.mjs caught it, because the patcher still reported
		// `applying` for every entry it could still see.
		//
		// The part renders live but does not survive a reload. The host stores no
		// chat content of its own (`session.db` has turns, usage, metadata and
		// drafts, and no parts table), and re-renders by replaying what the CLI
		// streams on resume. A skill subagent turn leaves no assistant message in
		// the CLI transcript, so there is nothing to replay. Fixing that needs a
		// change upstream of the host.
		unpatched: /if\(([\w$]+)\.type==="result"\)\{let ([\w$]+)=this\._queue\.settleHead\(\);/,
		patched: /__ahSkillOut/,
		build: (m, msg, head) =>
			`if(${msg}.type==="result"){let ${head}=this._queue.settleHead();`
				+ `let __ahSkillOut=typeof ${msg}.result==="string"?${msg}.result.trim():"";`
				// A skill that returns structured findings (`/code-review` does) emits a
				// fenced JSON array, and normally the parent model would read it and write
				// the user a summary. In this shape the parent never runs, so the raw array
				// is what reaches the chat. Rendering it as markdown is the difference
				// between a wall of JSON and something readable.
				//
				// Any failure returns the original text untouched, so the worst case is
				// exactly what was shipping before.
				+ `try{let __ahA=__ahSkillOut.indexOf("\\u0060\\u0060\\u0060json");`
				+ `if(__ahA>=0){let __ahB=__ahSkillOut.indexOf("\\u0060\\u0060\\u0060",__ahA+7);`
				+ `if(__ahB>__ahA){let __ahArr=JSON.parse(__ahSkillOut.slice(__ahA+7,__ahB));`
				+ `if(Array.isArray(__ahArr)&&__ahArr.length){`
				+ `let __ahNL=String.fromCharCode(10),__ahOut=[],__ahPre=__ahSkillOut.slice(0,__ahA).trim();`
				+ `__ahOut.push("**"+__ahArr.length+" finding"+(__ahArr.length===1?"":"s")+"**");`
				+ `for(let __ahI=0;__ahI<__ahArr.length;__ahI++){let __ahF=__ahArr[__ahI]||{};`
				// The chat panel is narrow and inline code does not wrap, so a full monorepo
				// path (52 unbreakable characters for EditorView.tsx) overflows exactly the
				// way the raw JSON did. Seen directly in the running UI on 2026-09-05: every
				// summary was cut off mid-sentence and unreadable without scrolling
				// sideways. Last two segments keep it identifiable and inside the panel.
				+ `let __ahSeg=String(__ahF.file||"").split("/"),`
				+ `__ahShort=__ahSeg.length>2?(String.fromCharCode(8230)+"/"+__ahSeg.slice(-2).join("/")):__ahSeg.join("/"),`
				+ `__ahLoc=__ahShort+(__ahF.line?(":"+__ahF.line):"");`
				+ `__ahOut.push("");`
				+ `__ahOut.push("**"+(__ahI+1)+". "+(__ahF.summary||__ahF.short_summary||"(no summary)")+"**");`
				+ `if(__ahLoc)__ahOut.push("\\u0060"+__ahLoc+"\\u0060");`
				+ `if(__ahF.failure_scenario){__ahOut.push("");__ahOut.push(__ahF.failure_scenario)}}`
				+ `__ahSkillOut=(__ahPre?__ahPre+__ahNL+__ahNL:"")+__ahOut.join(__ahNL)}}}`
				+ `}catch(__ahJ){}`
				+ `let __ahSkillU=${msg}.usage||{},__ahSkillQuiet=(__ahSkillU.output_tokens||__ahSkillU.outputTokens||0)===0&&(__ahSkillU.input_tokens||__ahSkillU.inputTokens||0)===0;`
				+ `if(${head}&&__ahSkillQuiet&&${msg}.is_error!==true){`
				+ `if(__ahSkillOut){`
				+ `this._logService.info("[SKILLOUT] surfacing "+__ahSkillOut.length+" chars, the turn spent no model tokens so its output came from a skill subagent");`
				+ `this._onDidProduceSignal.fire({kind:"action",resource:this.chatChannelUri,action:{type:"chat/responsePart",turnId:${head}.turnId,part:{kind:"markdown",id:"skillout-"+String(Date.now()),content:__ahSkillOut}}});`
				+ `}else{`
				+ `this._logService.info("[SKILLOUT] the turn spent no model tokens and the result carried no text, so nothing could be surfaced");`
				+ `}}`,
	},
	{
		id: 'queue-settles-by-correlation',
		target: 'agenthost',
		title: 'the queue drifts because one result settles one entry, however many it consumed',
		// `settleHead` pops one entry per `result`. The CLI merges several queued
		// messages into a single delivery and emits ONE result for it, so every merged
		// entry after the first is never settled. The queue then runs permanently
		// behind, and each later result settles a stale entry instead of its own.
		//
		// Measured 2026-09-05: four steers sent between 18:36 and 18:47; the result at
		// 19:02:57 carried `sdkUuid=request_d212008d`, an entry from 18:39, while the
		// 18:47 entry was still unsettled. The model had already ended its turn, so no
		// further result was coming, and the session sat with a pending steering bubble
		// that could never clear. `queueDrainContribution` also refuses to drain queued
		// messages while a steering message is set, so the chat looked dead.
		//
		// The SDK result carries `user_message_uuid` (sdk.d.ts:4645), the uuid of the
		// user message it consumed, and a merged delivery reports the LAST merged uuid.
		// Entries already carry `sdkUuid`. So the result can settle exactly the entries
		// it consumed: everything up to and including the correlated one.
		//
		// Engages ONLY on real drift, when the correlated entry is present but is not
		// the head. In the normal one-result-per-entry case the head is the correlated
		// entry and this is byte-for-byte the stock single `settleHead()`. Anything
		// unrecognised (no `user_message_uuid`, uuid not in `_yielded`) also falls back
		// to stock, so it can never settle more than the SDK says was consumed.
		//
		// ORDER: must run after `steer-keeps-tool-attribution` and
		// `skill-subagent-result-visible`, both of which rewrite this branch; it anchors
		// on their combined output.
		//
		// UNVERIFIED against a live steering sequence. Settling the merged group empties
		// the queue sooner, which lets `steering-promote`'s `isEmpty` branch drain its
		// flips, and an over-eager drain there is exactly the regression reverted on
		// 2026-09-05. The difference is that this only settles entries the SDK reports as
		// consumed, rather than guessing from `_yielded`. Watch a two-steer turn before
		// trusting it, and revert this entry alone if a bubble disappears early.
		unpatched: /if\(([\w$]+)\.type==="result"\)\{let ([\w$]+)=this\._queue\.settleHead\(\);let __ahSkillOut/,
		patched: /__ahUmu/,
		build: (m, msg, head) =>
			`if(${msg}.type==="result"){let ${head};{`
				+ `let __ahUmu=${msg}.user_message_uuid,__ahY=this._queue._yielded;`
				+ `if(__ahUmu&&__ahY&&__ahY.length>1&&__ahY[0]&&__ahY[0].sdkUuid!==__ahUmu`
				+ `&&__ahY.some(__ahE=>__ahE&&__ahE.sdkUuid===__ahUmu)){`
				+ `let __ahN=0;`
				+ `while(__ahN++<64){`
				+ `let __ahH=__ahY[0],__ahS=this._queue.settleHead();`
				+ `if(!__ahS)break;`
				+ `${head}=__ahS;`
				+ `this._logService.info("[QDRIFT] settled queue entry sdkUuid="+(__ahH&&__ahH.sdkUuid)+" consumed by the delivery for "+__ahUmu);`
				+ `if(__ahH&&__ahH.sdkUuid===__ahUmu)break}`
				+ `}else ${head}=this._queue.settleHead()}`
				+ `let __ahSkillOut`,
	},
	{
		id: 'clearpending-spares-background-subagent',
		pr: 334559,
		target: 'agenthost',
		title: 'a background subagent loses its tool attribution at every parent turn end',
		// `clearPending` drops all cross-message tool attribution on every `result`
		// envelope. A background subagent outlives the turn that spawned it, so its
		// inner tool call is still in flight and its result is still coming, but its
		// entry is wiped with the genuinely orphaned ones. The late result then
		// renders with the generic past-tense message instead of the real command,
		// and live diverges from replay.
		//
		// `drainForegroundSpawns`, called on the same envelope one statement later,
		// already spares background spawns by design. Rather than reach into the
		// registry class, this lifts the background entries out around the wipe and
		// puts them back, which is a single site and leaves the class untouched.
		// Mirrors microsoft/vscode#334559.
		unpatched: /([\w$]+)\.clearPendingToolCalls\(([\w$]+)\);for\(let ([\w$]+) of ([\w$]+)\.drainForegroundSpawns\(\)\)/,
		patched: /__ahBgKeep/,
		build: (m, state, log, orphan, reg) =>
			`(()=>{let __ahBgMap=${state}.toolCalls&&${state}.toolCalls._entries,__ahBgKeep=[];`
				+ `if(__ahBgMap&&${reg}&&${reg}.getParentSpawn){`
				+ `for(let __ahE of __ahBgMap){let __ahP=${reg}.getParentSpawn(__ahE[0]);if(__ahP&&__ahP.background)__ahBgKeep.push(__ahE)}`
				+ `for(let __ahE of __ahBgKeep)__ahBgMap.delete(__ahE[0])}`
				+ `${state}.clearPendingToolCalls(${log});`
				+ `for(let __ahE of __ahBgKeep)__ahBgMap.set(__ahE[0],__ahE[1])})();`
				+ `for(let ${orphan} of ${reg}.drainForegroundSpawns())`,
	},
	{
		id: 'reap-orphaned-session-data',
		pr: 334010,
		target: 'agenthost',
		title: 'a pruned external session leaves its data directory behind forever',
		// Discovery creates a data directory for every external session it lists,
		// because seeding the read state writes through the session database and
		// opening that database makes the directory. The 30-day startup prune then
		// unregisters the stale row and stops there, so the directory outlives the
		// only record that could ever name it: with the registry row gone nothing
		// can match a directory back to a session again, and `cleanupOrphanedData`
		// (which would) has no callers. Measured on this machine: 503 of 528
		// session data directories were such empty shells.
		//
		// Deleting the pruned row's data as the row goes stops the leak growing.
		// It does NOT reclaim the ones already there. That is the startup sweep
		// half of the upstream change, and it is deliberately not backported here:
		// it is a signature change on the data service plus a rewritten ownership
		// test (base64url session fragment for peer chats, a derived subagent
		// prefix, a per-directory database read for the chat-backing marker) plus
		// a new startup hook, so it is several sites rather than one, and what it
		// does is delete directories in bulk. That is not something to express as
		// a regex against a bundle in daily use. The existing shells stay until
		// the sweep ships upstream, costing disk only.
		//
		// `deleteSessionData` is the same call the ordinary session-delete path
		// makes, with the same working-directories argument, so a pruned session
		// reaches the `onWillDeleteSessionData` listeners exactly as a deleted one
		// does. It tests existence first and swallows its own failures, so a row
		// that never had a directory is a no-op and a locked directory warns
		// rather than throwing out of the prune.
		unpatched: /for\(let (\w+) of (\w+)\)await this\._sessionRegistry\.unregister\(\1\);\2\.length>0&&\(this\._invalidateSessionList\(\),this\._queueSessionListReconciliation\(\)\)/,
		patched: /deleteSessionData\([\s\S]{0,140}?\),await this\._sessionRegistry\.unregister\(/,
		build: (m, session, stale) =>
			`for(let ${session} of ${stale})await this._sessionDataService.deleteSessionData(${session},`
			+ `this._configurationService.getEffectiveWorkingDirectories(${session}.toString())),`
			+ `await this._sessionRegistry.unregister(${session});`
			+ `${stale}.length>0&&(this._invalidateSessionList(),this._queueSessionListReconciliation())`,
	},
	{
		id: 'peer-chat-unavailable-subagent',
		target: 'agenthost',
		title: 'one unresolvable subagent chat rejects every turn the session will ever start',
		// A chat that can never resolve makes `_resolvePeerChatsForTurnValidation`
		// throw, and that rejection escapes to the dispatch queue, which rejects the
		// client action. Since the offending chat is rebuilt from the transcript on
		// every restore, EVERY `chat/turnStarted` is rejected from then on and the
		// session can never be used again. Observed with the rejection carrying the
		// user's own message text and reason `Subagent transcript is not available
		// yet`, on a session that had been stopped, closed and reopened.
		//
		// This is upstream commit 7949faffc31 (microsoft/vscode#334312), which landed
		// on 2026-09-03, one day after this build was cut, so it is a backport rather
		// than a new fix. Chats whose transcript is unavailable are collected and
		// skipped instead of aborting validation for the whole session.
		//
		// It masks a symptom: the phantom chat is still registered and still fails to
		// subscribe. `denied-subagent-no-phantom-chat` addresses why it exists.
		unpatched: /async _resolvePeerChatsForTurnValidation\(([\w$]+)\)\{for\(;;\)\{let ([\w$]+)=this\._getUnresolvedPeerChats\(\1\);if\(!\2\)throw new Error\("Cannot validate turn id for unknown session"\);if\(\2\.length===0\)return;await Promise\.all\(\2\.map\(async ([\w$]+)=>\{if\(!await this\._stateManager\.resolveChatState\(\3\)\)throw new Error\("Cannot resolve peer chat for turn id validation"\)\}\)\)\}\}/,
		patched: /__ahUnavail/,
		build: (m, chan, list, chat) =>
			`async _resolvePeerChatsForTurnValidation(${chan}){let __ahUnavail=new Set;for(;;){`
				+ `let ${list}=this._getUnresolvedPeerChats(${chan})?.filter(c=>!__ahUnavail.has(c));`
				+ `if(!${list})throw new Error("Cannot validate turn id for unknown session");`
				+ `if(${list}.length===0)return;`
				+ `await Promise.all(${list}.map(async ${chat}=>{try{`
				+ `if(!await this._stateManager.resolveChatState(${chat}))throw new Error("Cannot resolve peer chat for turn id validation")`
				+ `}catch(__ahE){`
				+ `if(__ahE&&String(__ahE.message||__ahE).indexOf("Subagent transcript is not available yet")>=0){__ahUnavail.add(${chat});return}`
				+ `throw __ahE}}))}}`,
	},
	{
		id: 'denied-subagent-no-phantom-chat',
		target: 'agenthost',
		title: 'a denied Agent call is still recorded as a subagent, creating a chat that can never exist',
		// Subagent-ness is taken from the tool NAME, not the outcome, so a denied
		// `Agent` call still gets a subagent marker attached to its result. On restore
		// that marker registers a subagent chat whose transcript will never exist,
		// because the subagent never ran.
		//
		// Seen live when auto mode could not classify the call and denied it with
		// `toolDenialKind: automode-unavailable`. The SDK transcript for that session
		// has 47 lines and zero sidechain entries, confirming nothing was spawned.
		//
		// The fix is one token: the result already computes `is_error` immediately
		// before the push and simply does not consult it. Still unfixed upstream as of
		// origin/main, so this is not a backport.
		unpatched: /let ([\w$]+)=([\w$]+)\.is_error,([\s\S]{0,200}?)([\w$]+)&&([\w$]+)\.push\(\{type:"subagent",/,
		patched: /&&![\w$]+&&[\w$]+\.push\(\{type:"subagent",/,
		build: (m, isErr, msg, mid, isSub, parts) =>
			`let ${isErr}=${msg}.is_error,${mid}${isSub}&&!${isErr}&&${parts}.push({type:"subagent",`,
	},
	{
		id: 'codex-progress-not-output-host',
		target: 'agenthost',
		title: 'MCP progress narration is persisted as the tool result',
		// `mapMcpToolCallProgress` appended every `mcpToolCall/progress` message to
		// `entry.output`, the same field real streamed output uses, and re-sent the
		// whole growing accumulation as the tool call's content. Three consequences,
		// all of them user-visible:
		//
		//   * `mapItemCompleted` falls back to `entry.output` when the MCP tool
		//     returned nothing, so a tool that legitimately produces no output has
		//     the progress narration persisted as its result.
		//   * an interrupted turn gives the orphaned completion the same narration.
		//   * each notification resent the entire accumulation, so a long call's
		//     content grew quadratically.
		//
		// Progress is a status line, not output, so it now rides on
		// `_meta.progressMessage` and the content carries only real output.
		// Identical consecutive messages are coalesced, and the completion path
		// drops its `|| entry.output` fallback: nothing writes `output` for an
		// `mcpToolCall` item any more, and keeping the fallback would leave the one
		// route by which narration could still reach the result.
		//
		// The two halves are one entry because they have to move together. Dropping
		// the fallback alone still streams the narration as content; rewriting the
		// mapper alone leaves a fallback reading an `output` that no longer
		// accumulates, which is inert but pointless. The captured gap between them
		// is re-emitted verbatim.
		//
		// Upstream also stores the start `_meta` on the shell and web_search entries
		// so a progress notification landing on one of those cannot replace its
		// `toolKind` bag (the reducer swaps the whole `_meta` whenever an action
		// carries one). That is NOT backported and does not need to be: codex item
		// ids are per item, an `mcpToolCall/progress` notification only ever
		// resolves to the `mcpToolCall` entry of the same id, and this build's
		// `mcpToolCall` branch of `mapItemStartedBody` emits `chat/toolCallStart`
		// with no `_meta` at all, so there is no bag to replace. Verified in this
		// bundle: that branch sets `{toolCallId,turnId,toolName,output:""}` and its
		// start action carries only an optional `contributor`.
		//
		// The matching `progressMessage` key in `readToolCallMeta` is not backported
		// either. Nothing in the agent host reads it, and the workbench half
		// (`codex-progress-not-output-client`) reads `_meta.progressMessage` off the
		// tool call directly, applying the same `typeof === "string"` guard the
		// reader would.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+)\)\{let ([\w$]+)=\2\.itemToToolCall\.get\(\3\.itemId\);return \4\?\(\4\.output=\[\4\.output,\3\.message\]\.filter\(Boolean\)\.join\(`\n`\),\[\{type:"chat\/toolCallContentChanged",turnId:\4\.turnId,toolCallId:\4\.toolCallId,content:\[\{type:"text",text:\4\.output\}\]\}\]\):\[\]\}([\s\S]{0,3400}?)=([\w$]+)\(([\w$]+)\.item\.result,\7\.item\.error\?\.message\)\|\|([\w$]+)\.output,/,
		patched: /_meta:\{progressMessage:/,
		build: (m, mapProgress, state, params, entry, gap, mcpToolOutput, doneParams, doneEntry) =>
			`function ${mapProgress}(${state},${params}){`
			+ `let ${entry}=${state}.itemToToolCall.get(${params}.itemId);`
			+ `return!${entry}||${params}.message===${entry}.progressMessage?[]:`
			+ `(${entry}.progressMessage=${params}.message,`
			+ `[{type:"chat/toolCallContentChanged",turnId:${entry}.turnId,toolCallId:${entry}.toolCallId,`
			+ `content:${entry}.output?[{type:"text",text:${entry}.output}]:[],`
			+ `_meta:{progressMessage:${params}.message}}])}`
			+ gap
			+ `=${mcpToolOutput}(${doneParams}.item.result,${doneParams}.item.error?.message),`,
	},
	{
		id: 'codex-progress-not-output-client',
		target: 'workbench',
		title: 'a running MCP call shows no progress, and a stale one becomes its past-tense label',
		// Pairs with `codex-progress-not-output-host`, which moves codex MCP tool
		// progress off `entry.output` and onto `_meta.progressMessage`. Nothing on
		// the client reads that key, so on its own the host half is silent: the
		// narration correctly stops being persisted as the result, and correctly
		// stops being rendered, but nothing takes its place.
		//
		// The chat UI already has the channel for it. `ChatToolInvocation` keeps a
		// `_progress` observable whose only writer is `acceptProgress`, and the
		// running row renders its message. This feeds it from the tool call's
		// `_meta` at the three points upstream does:
		//
		//   A  toolCallStateToInvocation   a client attaching mid-turn builds the
		//                                  invocation from current state, so the
		//                                  message has to be seeded there too.
		//   B  updateRunningToolSpecificData   every subsequent Running update.
		//   C  finalizeToolInvocation      clears the progress before the state
		//                                  transition, because `didExecuteTool`
		//                                  promotes `_progress.message` to
		//                                  `pastTenseMessage` whenever the result
		//                                  carries no `toolResultMessage`. The
		//                                  agent-host adapter never sets one, so
		//                                  without the clear the last progress
		//                                  string becomes the finished row's label.
		//
		// All three are in one entry deliberately. A/B without C is worse than
		// nothing: it is exactly the "stale narration becomes the past-tense label"
		// defect, in the UI instead of the transcript. Anchoring them together
		// makes the trio atomic, at the cost of failing closed if a future build
		// reorders these three functions. The two gaps are re-emitted verbatim.
		//
		// The test is `typeof ... === "string"`, NOT truthiness. `progressMessage`
		// is typed and validated as any string, and codex sends an empty message to
		// clear a status line it set earlier; a truthy test drops that and leaves
		// the stale text on screen. The mapper still coalesces on equality, and an
		// entry's `progressMessage` starts undefined rather than empty, so a first
		// empty message is a real change and still emits.
		//
		// `_meta.progressMessage` is read inline rather than through
		// `readToolCallMeta`, which would need a fourth, distant edit in that
		// reader for the sole purpose of copying one string through a
		// `typeof === "string"` check that is cheaper to inline. Verified in this
		// bundle: the reader is `function bM(s){let o=s._meta;...}`, the bag is
		// flat, and the keys are unprefixed, so the two reads are equivalent.
		// The `_meta` arrives because the reducer's existing
		// `chat/toolCallContentChanged` case already spreads an action's `_meta`
		// onto the tool call.
		//
		// The gapAB bound is 6000 rather than the ~2600 this build needs, because
		// `toolcall-progress-render` inserts into that span and inflates it. At the
		// old 4200 the headroom was around 1350 bytes, and a build growing this
		// region would have failed THIS entry with "site not found" for a reason
		// that looks unrelated to the entry that caused it.
		//
		// Overlaps `toolcall-progress-render`, which writes the same channel from
		// the elapsed-time heartbeat at the TOP of `updateRunningToolSpecificData`;
		// site B sits below it and is untouched by that entry, and each tolerates
		// the other being absent. If both ever fired for one call this one would
		// win on a Running update, but they cannot: heartbeats come from the Claude
		// SDK mapper and `progressMessage` from the codex mapper.
		unpatched: /([\w$]+)\.status==="auth-required"&&([\w$]+)\.setAuthenticationRequired\(([\w$]+)\(\1,([\w$]+)\)\),([\s\S]{0,6000}?);let ([\w$]+)=([\w$]+)\(([\w$]+)\);if\(\6\)\{([\w$]+)\.toolSpecificData=\{kind:"subagent",isActive:([\s\S]{0,6000}?),toolResultDetails:([\w$]+)\}:void 0;return ([\w$]+)&&([\w$]+)\.cancelFromStreaming\(/,
		patched: /_meta\?\.progressMessage=="string"/,
		build: (m, tcA, invA, authServer, authArg, gapAB, subagent, subagentContent, tcB, invB, gapBC, details, cancelled, invC) => {
			// Same shape at both live sites: only surface a message while the call
			// is Running, and let an empty string through so it can clear.
			const apply = (inv, tc) =>
				`${tc}.status==="running"&&typeof ${tc}._meta?.progressMessage=="string"`
				+ `&&${inv}.acceptProgress({message:${tc}._meta.progressMessage})`;
			return `${tcA}.status==="auth-required"&&${invA}.setAuthenticationRequired(${authServer}(${tcA},${authArg})),`
				+ `${apply(invA, tcA)},`
				+ gapAB
				+ `;${apply(invB, tcB)};`
				+ `let ${subagent}=${subagentContent}(${tcB});if(${subagent}){${invB}.toolSpecificData={kind:"subagent",isActive:`
				+ gapBC
				+ `,toolResultDetails:${details}}:void 0;`
				+ `${invC}.acceptProgress({message:void 0});`
				+ `return ${cancelled}&&${invC}.cancelFromStreaming(`;
		},
	},
	{
		id: 'subscribe-cancelled-not-missing',
		pr: 334066,
		target: 'agenthost',
		title: 'a client cancelling a subscribe is reported as a missing resource, at error level',
		// `agentService.subscribe` throws `Subscription cancelled: <uri>` when its
		// subscription is released while it waits for a pending subagent chat, and
		// the protocol server's subscribe handler rewraps ANY non-ProtocolError as
		// `Resource not found: <uri>`. `shouldLogFailedRequest` then lets that
		// through at error level, because it only stays quiet for a NotFound on a
		// file resource read.
		//
		// So a routine client cancellation is reported as a missing resource that
		// exists and was registered correctly, and it points at a host registration
		// bug when the observation lifetime on the client is what actually ended.
		// That cost a real debugging session on this machine.
		//
		// Upstream adds `SubscriptionCancelledError extends ProtocolError`, throws
		// it at all five sites that already signalled this concept, keys the
		// handler on `instanceof`, and excludes it from `shouldLogFailedRequest`.
		// A class cannot carry across the five throw sites here: they sit in two
		// modules thousands of characters apart, and a patch is one contiguous
		// edit. So this recognises the concept at the single point where it was
		// being misreported, by message shape, and converts it there.
		//
		// The message shape is exact rather than fuzzy. All five sites emit the
		// literal prefix `Subscription cancelled: `, and nothing else in this
		// bundle produces that text (verified: 5 occurrences, all of them that
		// throw). Four of the five funnel into this one catch, directly or through
		// `_subscribeStateChannel` and `agentService.subscribe`; the fifth is the
		// reconnect restore loop, whose own catch already logs at info and rewraps
		// nothing, so it is unaffected either way. What is NOT reproduced is a
		// discriminator other code could use: only this handler can tell the two
		// apart, where upstream any caller can.
		//
		// The genuinely-unknown-resource path is provably untouched. The new branch
		// is guarded on `!(err instanceof ProtocolError)` as well as the prefix, so
		// every input that reaches the old code reaches the same arm of it: a
		// ProtocolError is still rethrown as-is, and anything else still becomes
		// `Resource not found` with the same code and the same error-level log.
		// `Cannot subscribe to unknown resource` is a plain Error with a different
		// message and still rewraps.
		//
		// Suppressing the error log needs `shouldLogFailedRequest` too, so the two
		// sites are matched together with the gap between them re-emitted verbatim.
		// They are coupled by an own property stamped on the error this catch
		// builds, not by a second string test: nothing else can set it, so the
		// helper's answer changes for exactly the objects this entry created. The
		// property never reaches the wire, because the JSON-RPC error is built from
		// `code`, `message` and `data` only.
		//
		// The rewrap reuses the handler's own not-found code, as upstream does, and
		// for the same reason: the synced protocol has no cancellation code. The
		// client therefore sees the same code as before and a truthful message.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+),([\w$]+)\)\{return!\(\4 instanceof ([\w$]+)\)\|\|\4\.code!==([\w$]+)\.NotFound\|\|!([\w$]+)\(\2,\3\)\}([\s\S]{0,2600}?)\}catch\(([\w$]+)\)\{throw!([\w$]+)\.active&&([\w$]+)\.subscriptions\.get\(([\w$]+)\.uri\)===\10&&\11\.subscriptions\.delete\(\12\.uri\),\9 instanceof \5\?\9:new \5\(([\w$]+),`Resource not found: \$\{([\w$]+)\.channel\}`\)\}/,
		patched: /__ahSubscribeCancelled/,
		build: (m, shouldLog, method, params, err, ProtocolError, codes, isFileRead, gap, caught, pending, client, classified, notFoundCode, req) =>
			`function ${shouldLog}(${method},${params},${err}){`
			+ `if(${err}&&${err}.__ahSubscribeCancelled)return!1;`
			+ `return!(${err} instanceof ${ProtocolError})||${err}.code!==${codes}.NotFound||!${isFileRead}(${method},${params})}`
			+ gap
			+ `}catch(${caught}){`
			+ `if(!${pending}.active&&${client}.subscriptions.get(${classified}.uri)===${pending}){${client}.subscriptions.delete(${classified}.uri)}`
			+ `if(!(${caught} instanceof ${ProtocolError})&&${caught} instanceof Error`
			+ `&&typeof ${caught}.message=="string"&&${caught}.message.startsWith("Subscription cancelled: ")){`
			+ `let __ahCancelled=new ${ProtocolError}(${notFoundCode},${caught}.message);`
			+ `__ahCancelled.__ahSubscribeCancelled=!0;`
			+ `this._logService.info(\`[ProtocolServer] Subscribe cancelled by client: \${${req}.channel}\`);`
			+ `throw __ahCancelled}`
			+ `if(${caught} instanceof ${ProtocolError})throw ${caught};`
			+ `throw new ${ProtocolError}(${notFoundCode},\`Resource not found: \${${req}.channel}\`)}`,
	},
	{
		id: 'client-tool-handler-never-throws',
		target: 'agenthost',
		title: 'a rejected client-tool wait escapes the MCP handler as a bare "Canceled"',
		// The in-process MCP server that surfaces workbench client tools to the
		// Claude SDK awaits the parked deferred with no try/catch, so a rejection
		// escapes into the SDK's tool path instead of being answered as a tool
		// result. Rejections are routine rather than theoretical: the pending
		// registry rejects every parked request on `rejectAll`, which runs when the
		// session rebinds a client and when it is disposed.
		//
		// The MCP SDK turns a thrown handler error into a bare tool error, so what
		// reaches the model is "Canceled" with no tool name and no reason, and the
		// turn continues on a result that explains nothing. Catching here produces
		// the same `isError` shape the sibling branch a few characters earlier
		// already uses for a missing `tool_use_id`, and the same shape the
		// server-tool MCP server uses for its own failures.
		//
		// The handler is rewritten from a ternary into statements because the
		// original body is a single `return <cond>?<errorResult>:awaitResult(id)`
		// expression and `await` has to sit inside a `try`. The error branch is
		// re-emitted verbatim from the captured identifiers, including the meta-key
		// constant, so the message the SDK already produces is unchanged.
		//
		// Pairs with `pending-register-shares-deferred`, which removes one of the
		// two sources of these rejections (a duplicate `register` for the same
		// `tool_use_id`). Neither entry depends on the other: this one still has to
		// answer the rebind and dispose sweeps, and that one is correct on its own.
		// Also complements `client-tool-ownerless-fail-session`, which buffers a
		// failure result so the handler resolves rather than parking; this covers
		// the rejections that buffering cannot reach.
		//
		// MUST STAY AFTER `replay-args` IN THIS ARRAY, and it is, being appended at
		// the end. `replay-args` rewrites the very call this wraps, widening it from
		// `awaitResult(id)` to `awaitResult(id,def.name,input)`, and its own anchor
		// pins the ternary plus the `})));return ...createSdkMcpServer(` tail that
		// follows it. Turning the ternary into statements necessarily moves that
		// tail, so applying this one first would leave `replay-args` unmatched.
		// The array order already guarantees the right sequence; nothing else here
		// touches the site. The argument list is captured whole and re-emitted
		// verbatim rather than rebuilt, so the entry matches the bundle both before
		// and after `replay-args` has widened it, which is what keeps
		// `--only client-tool-handler-never-throws` correct on a pristine bundle.
		unpatched: /async\(([\w$]+),([\w$]+)\)=>\{let ([\w$]+)=([\w$]+)\(\2\);return \3===void 0\?\{content:\[\{type:"text",text:`Client tool "\$\{([\w$]+)\.name\}" could not run: SDK omitted tool_use_id \(expected at extra\._meta\["\$\{([\w$]+)\}"\]\)\.`\}\],isError:!0\}:([\w$]+)\((\3(?:,[\w$]+(?:\.[\w$]+)?){0,3})\)\}/,
		patched: /catch\(__ahClientToolError\)/,
		build: (m, toolInput, extra, toolUseId, readToolUseId, def, metaKey, awaitResult, callArgs) =>
			`async(${toolInput},${extra})=>{let ${toolUseId}=${readToolUseId}(${extra});`
			+ `if(${toolUseId}===void 0)return{content:[{type:"text",`
			+ `text:\`Client tool "\${${def}.name}" could not run: SDK omitted tool_use_id (expected at extra._meta["\${${metaKey}}"]).\`}],isError:!0};`
			+ `try{return await ${awaitResult}(${callArgs})}`
			+ `catch(__ahClientToolError){return{content:[{type:"text",`
			+ `text:\`Client tool "\${${def}.name}" failed: \${__ahClientToolError instanceof Error?__ahClientToolError.message:String(__ahClientToolError)}\`}],isError:!0}}}`,
	},
	{
		id: 'pending-register-shares-deferred',
		target: 'agenthost',
		title: 'a second wait on one pending request cancels the first waiter',
		// `PendingRequestRegistry.register` parks a deferred under a key and hands
		// back its promise. Registering a key that is already parked rejects the
		// PREVIOUS deferred with a cancellation and replaces it, so the first
		// waiter unwinds with "Canceled" even though the request it was waiting on
		// is still live and will still be responded to. Only the last registrant
		// can ever see the answer; every earlier one is failed on its behalf.
		//
		// Sharing the parked deferred instead means both waiters settle on the one
		// `respond`, which is what a duplicated `tool_use_id` (an SDK retry, a
		// replay, or a host bug) actually deserves. Nothing relied on the reject:
		// every caller registers one key per request, and the `rejectAll` /
		// `denyAll` sweeps used for abort and dispose are untouched by this entry.
		//
		// Deliberately narrow. The early-result branch above it is re-emitted
		// verbatim and still wins, so `respondOrBuffer` keeps resolving a later
		// `register` immediately; only the already-parked branch changes. That
		// matters because `client-tool-ownerless-fail-session` depends on the
		// buffered path, not on this one.
		//
		// The `CancellationError` constructor the old branch used is captured and
		// then dropped from the output. It stays defined and is used elsewhere in
		// the bundle, so leaving it unreferenced here is inert.
		//
		// This is the registry side of `client-tool-handler-never-throws`: it
		// removes one source of the rejection that entry has to answer for. The
		// other source, the rebind and dispose sweeps, is genuine, so both entries
		// are worth having and neither is inert without the other.
		unpatched: /register\(([\w$]+),\.\.\.([\w$]+)\)\{if\(this\._earlyResults\.has\(\1\)\)\{let ([\w$]+)=this\._earlyResults\.get\(\1\);return this\._earlyResults\.delete\(\1\),Promise\.resolve\(\3\)\}let ([\w$]+)=this\._entries\.get\(\1\);\4&&!\4\.deferred\.isSettled&&\4\.deferred\.error\(new ([\w$]+)\);let ([\w$]+)=new ([\w$]+);return this\._entries\.set\(\1,\{deferred:\6,metadata:\2\[0\]\}\),\6\.p\}/,
		patched: /_entries\.get\([\w$]+\);if\([\w$]+&&![\w$]+\.deferred\.isSettled\)return/,
		build: (m, key, metadata, buffered, existing, cancellationError, deferred, DeferredPromise) =>
			`register(${key},...${metadata}){`
			+ `if(this._earlyResults.has(${key})){let ${buffered}=this._earlyResults.get(${key});`
			+ `return this._earlyResults.delete(${key}),Promise.resolve(${buffered})}`
			+ `let ${existing}=this._entries.get(${key});`
			+ `if(${existing}&&!${existing}.deferred.isSettled)return ${existing}.deferred.p;`
			+ `let ${deferred}=new ${DeferredPromise};`
			+ `return this._entries.set(${key},{deferred:${deferred},metadata:${metadata}[0]}),${deferred}.p}`,
	},
	{
		id: 'register-and-fire-reuses-parked',
		target: 'agenthost',
		title: 'a duplicate tool_use_id orphans the first request, which then never settles',
		// `registerAndFire` replaces an entry that is still parked, unlike
		// `register`, which cancels the superseded deferred on purpose so its
		// awaiter unwinds. Only one response is ever produced for a tool call, so
		// the replaced promise is never settled and its SDK invocation hangs for
		// the life of the session.
		//
		// Reuses rather than cancels: a duplicate awaits the parked request and
		// does not fire again, so the single response settles both callers.
		// Cancelling would fail an invocation whose tool then runs and succeeds.
		// Mirrors microsoft/vscode#334146.
		unpatched: /registerAndFire\(([\w$]+),([\w$]+),\.\.\.([\w$]+)\)\{if\(this\._earlyResults\.has\(\1\)\)\{let ([\w$]+)=this\._earlyResults\.get\(\1\);return this\._earlyResults\.delete\(\1\),Promise\.resolve\(\4\)\}let ([\w$]+)=new ([\w$]+);return this\._entries\.set\(\1,\{deferred:\5,metadata:\3\[0\]\}\),\2\(\),\5\.p\}/,
		patched: /__ahReuseParked/,
		build: (m, key, fire, meta, early, deferred, ctor) =>
			`registerAndFire(${key},${fire},...${meta}){`
				+ `if(this._earlyResults.has(${key})){let ${early}=this._earlyResults.get(${key});`
				+ `return this._earlyResults.delete(${key}),Promise.resolve(${early})}`
				+ `let __ahReuseParked=this._entries.get(${key});`
				+ `if(__ahReuseParked&&!__ahReuseParked.deferred.isSettled)return __ahReuseParked.deferred.p;`
				+ `let ${deferred}=new ${ctor};`
				+ `return this._entries.set(${key},{deferred:${deferred},metadata:${meta}[0]}),${fire}(),${deferred}.p}`,
	},
	{
		id: 'steering-list-reduce-set',
		pr: 334743,
		target: 'workbench',
		title: 'a second steering message evicts the first from the sidebar',
		// `ChatState` stores steering as one slot (`steeringMessage`) next to a
		// `queuedMessages` list, and the reducer overwrites it with no id check,
		// three lines above a queued branch that correctly finds by id and appends.
		// A second steer therefore evicts the first from state, its bubble vanishes,
		// and it reappears later when the model consumes it. Nothing is lost: the
		// agent was handed the first before the second arrived.
		//
		// Upstream fix is microsoft/vscode#334743, which renames the field to a list
		// across host, providers and workbench. That is too many sites to mirror in
		// minified code, so this keeps a parallel `steeringMessages` array ALONGSIDE
		// the singular field. Every existing consumer still reads the newest message
		// and behaves exactly as before; only the rendering path reads the array.
		//
		// Client only, deliberately. The host's own state is left alone, so a full
		// state resync from the host simply drops the array and the projection falls
		// back to the singular field, which is today's behaviour. That degrades to
		// the old bug rather than to a stale bubble that never clears.
		unpatched: /if\((\w+)\.kind==="steering"\)return\{\.\.\.(\w+),steeringMessage:(\w+)\};/,
		patched: /__ahSL/,
		build: (m, act, st, entry) =>
			`if(${act}.kind==="steering"){`
				+ `let __ahSL=${st}.steeringMessages||(${st}.steeringMessage?[${st}.steeringMessage]:[]),`
				+ `__ahSI=__ahSL.findIndex(__ahM=>__ahM.id===${act}.id),__ahSN;`
				+ `if(__ahSI>=0){__ahSN=[...__ahSL];__ahSN[__ahSI]=${entry}}else __ahSN=[...__ahSL,${entry}];`
				+ `return{...${st},steeringMessage:${entry},steeringMessages:__ahSN}}`,
	},
	{
		id: 'steering-list-reduce-remove',
		pr: 334743,
		target: 'workbench',
		title: 'removing one steering message must not drop the others',
		// Companion to `steering-list-reduce-set`. Without it a consumed steer stays
		// in the array forever, which swaps a disappearing bubble for one that never
		// clears. The singular field follows the array's tail so consumers still see
		// a pending steer while any remain.
		unpatched: /if\((\w+)\.kind==="steering"\)return!(\w+)\.steeringMessage\|\|\2\.steeringMessage\.id!==\1\.id\?\2:\{\.\.\.\2,steeringMessage:void 0\};/,
		patched: /__ahSR/,
		build: (m, act, st) =>
			`if(${act}.kind==="steering"){`
				+ `if(!${st}.steeringMessage&&!${st}.steeringMessages)return ${st};`
				+ `let __ahSR=(${st}.steeringMessages||(${st}.steeringMessage?[${st}.steeringMessage]:[]))`
				+ `.filter(__ahM=>__ahM.id!==${act}.id);`
				+ `return{...${st},steeringMessage:__ahSR.length?__ahSR[__ahSR.length-1]:void 0,`
				+ `steeringMessages:__ahSR.length?__ahSR:void 0}}`,
	},
	{
		id: 'steering-list-turnstarted',
		pr: 334743,
		target: 'workbench',
		title: 'a steering message auto-started as a turn must leave the list',
		// `chat/turnStarted` carries `queuedMessageId` when the turn was started from
		// a pending message, and clears the singular slot. The array has to follow or
		// the bubble outlives the turn it became.
		unpatched: /(\w+)\.queuedMessageId&&\((\w+)\.steeringMessage\?\.id===\1\.queuedMessageId&&\(\2=\{\.\.\.\2,steeringMessage:void 0\}\),\2\.queuedMessages\)/,
		patched: /__ahSTC/,
		build: (m, act, st) =>
			`${act}.queuedMessageId&&((__ahSTC=>{`
				+ `let __ahSL2=${st}.steeringMessages||(${st}.steeringMessage?[${st}.steeringMessage]:[]);`
				+ `if(!__ahSL2.length)return;`
				+ `let __ahSF=__ahSL2.filter(__ahM=>__ahM.id!==__ahSTC);`
				+ `if(__ahSF.length!==__ahSL2.length)${st}={...${st},`
				+ `steeringMessage:__ahSF.length?__ahSF[__ahSF.length-1]:void 0,`
				+ `steeringMessages:__ahSF.length?__ahSF:void 0}`
				+ `})(${act}.queuedMessageId),${st}.queuedMessages)`,
	},
	{
		id: 'steering-list-merge',
		pr: 334743,
		target: 'workbench',
		title: 'the per-chat projection drops the steering list',
		// `mergeSessionWithDefaultChat` copies the conversation fields onto the
		// session view the rendering path reads. Without the array here the
		// projection sees only the singular field and the fix is invisible.
		unpatched: /activeTurn:(\w+)\?\.activeTurn,steeringMessage:\1\?\.steeringMessage,/,
		patched: /steeringMessages:\w+\?\.steeringMessages/,
		build: (m, chat) =>
			`activeTurn:${chat}?.activeTurn,steeringMessage:${chat}?.steeringMessage,`
				+ `steeringMessages:${chat}?.steeringMessages,`,
	},
	{
		id: 'steering-list-projection',
		pr: 334743,
		target: 'workbench',
		title: 'only one steering bubble is projected into the chat model',
		// The projection already builds a list carrying a kind per entry, and pushed
		// at most one steering entry only because the state could hold at most one.
		unpatched: /(\w+)=\[\];(\w+)\.steeringMessage&&\1\.push\((\w+)\(\2\.steeringMessage,"steering"\)\);/,
		patched: /__ahSP/,
		build: (m, arr, st, toRemote) =>
			`${arr}=[];for(let __ahSP of (${st}.steeringMessages||(${st}.steeringMessage?[${st}.steeringMessage]:[])))`
				+ `${arr}.push(${toRemote}(__ahSP,"steering"));`,
	},
	{
		id: 'steering-list-removal-detect',
		pr: 334743,
		target: 'workbench',
		title: 'the sidebar retires the previous steering bubble whenever the id changes',
		// This is what actually removes the bubble: the watcher tracked ONE steering
		// id and called `removePendingRequest` whenever it changed, so a second steer
		// retired the first even though both were still pending. Tracks the set of
		// pending ids instead and retires only the ones that genuinely went away.
		//
		// The captured variable holds nothing else after this statement (verified in
		// the shipped bundle), so widening it from an id to a Set is contained.
		unpatched: /,(\w+)=(\w+)\.state\.steeringMessage\?\.id;(\w+)&&\3!==\1&&this\._chatService\.removePendingRequest\((\w+),\3\),\3=\1;/,
		patched: /__ahSD/,
		build: (m, cur, ev, prev, target) =>
			`,${cur}=new Set(((${ev}.state.steeringMessages)||(${ev}.state.steeringMessage?[${ev}.state.steeringMessage]:[])).map(__ahM=>__ahM.id));`
				+ `${prev}&&${prev}.forEach&&${prev}.forEach(__ahSD=>{${cur}.has(__ahSD)||this._chatService.removePendingRequest(${target},__ahSD)}),${prev}=${cur};`,
	},
	{
		id: 'activity-row-survives-content',
		pr: 334742,
		target: 'workbench',
		title: 'the liveness row disappears the moment a turn produces anything',
		// The activity row is only emitted while the turn has produced NO response
		// parts: `!activity || responseParts.length > 0 || sink([...])`. Upstream that
		// is deliberate ("from then on its own parts tell the story"), and for a chatty
		// turn it is fine. For this workload it is exactly backwards: a `/code-review`
		// or a multi-agent mapping turn emits one tool call early, the row vanishes,
		// and the next several minutes render as a dead panel. Measured 2026-09-06: a
		// 2m33s turn across four subagents showed no liveness at all after its first
		// step, while 1.7 MB of subagent transcript was written out of sight.
		//
		// Dropping the response-part term keeps the row up for the whole turn. It stays
		// tidy rather than noisy because `chatProgressContentPart` hides a progress row
		// only when NON-progress content follows it, and this row is appended last on
		// every tick, so nothing ever follows it. The stable id means each update
		// replaces the previous row instead of stacking, and clearing the activity at
		// turn end removes it.
		//
		// Upstream reported this shape on microsoft/vscode#334742: Copilot's review said
		// "the rendering contract needs to permit active-tool activity, or this status
		// should be integrated into the tool part". This is the local half of that.
		// Pairs with `claude-turn-reports-activity`, which supplies the label.
		unpatched: /!(\w+)\|\|(\w+)\.read\((\w+)\)\.length>0\|\|(\w+)\.sink\(\[\{kind:"progressMessage",id:(\w+),/,
		patched: /__ahKeepRow/,
		build: (m, activity, parts, reader, opts, id) =>
			`!${activity}||(__ahKeepRow=>__ahKeepRow)(0)||${opts}.sink([{kind:"progressMessage",id:${id},`,
	},
	{
		id: 'chat-input-default-permission-mode',
		pr: 334087,
		target: 'workbench',
		title: 'every new chat-input session starts on Default approvals',
		// `AgentHostUntitledProvisionalSessionService._getInitialConfig` seeds a new
		// session from `chat.defaultConfiguration`, which writes only the `autoApprove`
		// and `mode` axes. Claude's Approvals chip reads `permissionMode`, which that
		// setting never writes, so every new chat in the panel opens on Default no
		// matter how many times the user changes it. The Agents window does not have
		// this problem because it replays the user's last picks from profile storage.
		//
		// Upstream fix is microsoft/vscode#334814, which shares that store with this
		// path. It cannot be mirrored here: the remembered-picks key does not appear in
		// `workbench.desktop.main.js` at all (the Agents window is a separate bundle),
		// and reading profile storage needs an `IStorageService` this class does not
		// have, which minified DI cannot be extended with safely.
		//
		// So this reads a plain configuration value instead. `getValue` returns whatever
		// is in settings.json even for a key VS Code never registered, so no schema
		// contribution is needed. The result is a configured default rather than a
		// remembered pick, which is the practical half of what upstream does.
		//
		// Set `"chat.agentHost.defaultPermissionMode": "auto"` in user settings to use
		// it. An absent or non-string value leaves the stock behaviour untouched.
		// Uses the key microsoft/vscode#334087 introduces, not one of our own, so the
		// local stand-in and the upstream setting are the same knob rather than two.
		// That PR reads it host side in `resolveChatConfig`; this reads it client side
		// in the seed, so whichever lands first the setting keeps working.
		unpatched: /(\{isolation:"folder"\},\w+=this\._configurationService\.getValue\("chat\.defaultConfiguration"\),(\w+)=this\._configurationService\.inspect\("chat\.tools\.global\.autoApprove"\)\.policyValue[\s\S]{0,400}?return typeof (\w+)=="string"&&(\w+)\.has\(\3\)&&\((\w+)\.mode=\3\),)(\w+)\(\5\)\}/,
		patched: /__ahPermMode/,
		build: (m, head, policy, modeVar, modeSet, cfg, migrate) =>
			// `acceptEdits`, `auto` and `bypassPermissions` auto-approve at least some tool
			// calls, so they degrade to `default` while policy restricts auto-approval.
			`${head}(__ahPermMode=>{typeof __ahPermMode=="string"&&__ahPermMode&&(`
				+ `${cfg}.permissionMode=${policy}===!1&&__ahPermMode!=="default"&&__ahPermMode!=="plan"?"default":__ahPermMode)})`
				+ `(this._configurationService.getValue("chat.agentHost.claudeAgent.defaultPermissionMode")),${migrate}(${cfg})}`,
	},
	{
		id: 'replay-keeps-local-command-output',
		target: 'agenthost',
		pr: 0,
		title: 'a slash command\'s output is dropped on replay, so a restart empties the turn',
		// A forked slash command writes its result into the CLI transcript as a `system`
		// record of subtype `local_command`, wrapped in `<local-command-stdout>`. The
		// replay mapper's allowlist is `compact_boundary` and `notification` only, and
		// its own comment says anything else is dropped. So the turn renders live and is
		// empty after a restart.
		//
		// The exclusion is reasonable for what the surrounding comment describes: an echo
		// of a local handler, "Set model to claude-opus-4.7". It is wrong for a forked
		// command, where that same record carries the entire product of the turn. Measured
		// 2026-09-06: a `/code-review` result of 12,295 characters, present in the
		// transcript, discarded on replay, and gone from the chat after a full restart.
		//
		// This is NOT the skill-subagent case, which genuinely leaves no assistant message
		// behind and cannot be repaired here. The record exists; it is being filtered.
		//
		// Strips the wrapper tags with string operations rather than a regex, because
		// backslashes do not survive being written into this file reliably.
		unpatched: /function ([\w$]+)\(([\w$]+),([\w$]+)\)\{let ([\w$]+)=([\w$]+)\(\2\.message\);if\(\4===void 0\|\|!([\w$]+)\.has\(\4\)\)return;let ([\w$]+)=([\w$]+)\(\2\.message\)\?\?`\[\$\{\4\}\]`;return\{kind:"system-notification",uuid:\2\.uuid,subtype:\4,text:\7,timestamp:\3\};?\}var \6=new Set\(\["compact_boundary","notification"\]\)/,
		patched: /__ahLocalCmdReplay/,
		build: (m, fn, msg, ts, subtype, readSubtype, set, text, readText) =>
			`function ${fn}(${msg},${ts}){let ${subtype}=${readSubtype}(${msg}.message);`
				+ `if(${subtype}===void 0||!${set}.has(${subtype}))return;`
				+ `let ${text}=${readText}(${msg}.message)??("["+${subtype}+"]");`
				+ `if(typeof ${text}==="string"&&${text}.charAt(0)==="<"){`
				+ `let __ahLocalCmdReplay=${text}.indexOf(">");`
				+ `if(__ahLocalCmdReplay>0&&${text}.slice(1,__ahLocalCmdReplay).indexOf("local-command")===0){`
				+ `${text}=${text}.slice(__ahLocalCmdReplay+1);`
				+ `let __ahEnd=${text}.lastIndexOf("</local-command");`
				+ `if(__ahEnd>=0)${text}=${text}.slice(0,__ahEnd)}}`
				+ `return{kind:"system-notification",uuid:${msg}.uuid,subtype:${subtype},text:${text},timestamp:${ts}}}`
				+ `var ${set}=new Set(["compact_boundary","notification","local_command","local_command_output"])`,
	},
	{
		id: 'discovery-suppression-loud',
		target: 'agenthost',
		title: 'discovery suppresses two thirds of sessions and never says which are which',
		// Diagnostic, not a fix. Measured 2026-09-07: discovery reported 122 candidates,
		// 39 registered and 83 "suppressed as subagent/chat backing", and the Sessions
		// view showed only 3-week-old archived entries. The recent sessions are somewhere
		// in that 83, but the summary counts the two causes together so there is no way
		// to tell a real subagent from a chat backing from the log.
		//
		// The shipped code collapses both tests into one branch, so this splits them and
		// names the one that fired, per session. `isSubagentSession` is evaluated first
		// and short-circuits, exactly as the original `||` does, so the chat-backing
		// check still runs only when the first is false and no extra work is added.
		//
		// Logs through `_logService`, which is the sink every other agent-host marker
		// uses and is known to reach `agenthost.log`. Three earlier probes went through
		// renderer-side loggers and produced silence that could not be distinguished
		// from the code not running.
		unpatched: /if\((\w+)\((\w+)\.toString\(\)\)\|\|await this\._isChatBacking\(\2\)\)return (\w+)\+\+,!1;/,
		patched: /__ahSupWhy/,
		build: (m, isSubagent, session, counter) =>
			`if(await(async()=>{let __ahSupSub=${isSubagent}(${session}.toString()),`
				+ `__ahSupBack=__ahSupSub?false:await this._isChatBacking(${session});`
				+ `if(!__ahSupSub&&!__ahSupBack)return false;`
				+ `let __ahSupWhy=__ahSupSub?"isSubagentSession":"isChatBacking";`
				+ `try{this._logService.info("[AHSUP] "+__ahSupWhy+" suppressed "+${session}.toString())}catch(__ahSupE){}`
				+ `return true})())return ${counter}++,!1;`,
	},
	{
		id: 'stale-peer-chat-backing-ignored',
		target: 'agenthost',
		title: 'a session that once had a peer chat is hidden from the list forever',
		// Opening a peer chat for a session writes `peerChatBacking` into that session's
		// own database. Discovery then suppresses the session, on the reasonable basis
		// that its chat represents it. The marker is durable and nothing ever clears it,
		// so the session stays suppressed long after the chat is gone, and is never
		// titled either, because `_scheduleExternalSessionTitles` only sees sessions that
		// reach registration.
		//
		// Measured 2026-09-07: 553 of 1262 session databases carried the marker, every
		// one a pure shell with a single row and zero turns. Discovery reported 83
		// suppressed, and instrumenting the branch showed 83 of 83 were `isChatBacking`
		// and none were subagents. Three fresh markers appeared within minutes of
		// clearing them by hand, so it accumulates continuously.
		//
		// `_readSessionRegistrationFacts` has two sources for this fact. The in-memory
		// `_unpersistedChatBackings` set is checked first and is the live one: it holds
		// the chats that actually exist right now, and it is left alone, so a session
		// genuinely backing an open peer chat is still suppressed and cannot appear
		// twice. The persisted read is the stale one, and its value is now ignored.
		//
		// Reads the metadata anyway rather than skipping the call, so `hostCreated` keeps
		// coming from the same object and the database access pattern is unchanged.
		//
		// Not offered upstream as-is: the real fix is to clear the marker when the chat
		// goes, or to check the referenced chat still exists, and neither is expressible
		// here. This trades a permanent disappearance for a transient duplicate in the
		// window where a peer chat exists but the process has restarted, which is the
		// better failure of the two.
		unpatched: /return\{chatBacking:!!([\w$]+)\[([\w$]+)\],hostCreated:\1\[([\w$]+)\]!==void 0\}/,
		patched: /__ahStaleBacking/,
		build: (m, meta, backingKey, workspacelessKey) =>
			`return{chatBacking:(__ahStaleBacking=>!1)(${meta}[${backingKey}]),`
				+ `hostCreated:${meta}[${workspacelessKey}]!==void 0}`,
	},
	{
		id: 'codex-steering-resolved-input',
		target: 'agenthost',
		title: 'steering with attached context stays pending after Codex consumes it',
		// Match the consumed echo against the exact resolved text sent to Codex.
		// Browser context, selected files and embedded text extend the raw prompt.
		// Preserve the original PendingMessage for the visible turn, and wait for
		// the actual userMessage echo rather than treating turn/steer success as ingestion.
		// Upstream: #335547 fixes #335546. Source: [PR snapshot](../../source-patches/vscode/335547.patch).
		unpatched: /^(?=[\s\S]*pendingSteeringFlips\.set\()[\s\S]+$/,
		patched: /__ahSteeringInputText/,
		build: text => transformCodexSteeringInput(text),
	},
	{
		id: 'agent-feedback-review-editor',
		target: 'workbench',
		title: 'review confirmations cannot load comments in regular editor windows',
		// Backport of #336430, fixing #336428, including cancellation and ARIA review fixes.
		// Editor-only commands read the owning host's annotations after hydration.
		// Explicit selection precedes approval; failed loads are not empty results.
		// Validated on Windows ARM64 1.137.0 build 645f29cc31; this same client
		// renders Windows and WSL editor windows. No server bundle changes are needed.
		// Strict structural guards exclude the dedicated Agents-window bundle.
		unpatched: /^(?=[\s\S]*"workbench.contrib.chat.agentHostLegacyMigrationGate")[\s\S]+$/,
		patched: /__ahFeedbackReviewV1/,
		build: transformAgentFeedbackReview,
	},
];

function sha(text) {
	return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function docker(args) {
	return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
}

function dockerAvailable() {
	try { docker(['version', '--format', '{{.Server.Os}}']); return true; } catch { return false; }
}

/** Installed workbench bundles. Stable nests the bundle under a build-hash dir. */
/** Installed VS Code roots. Stable nests the app under a build-hash directory. */
function installRoots() {
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
	return roots;
}

/** Resolve one install-relative path across every root, direct or build-hash nested. */
function resolveInInstalls(rel) {
	const found = [];
	for (const root of installRoots()) {
		if (!fs.existsSync(root)) { continue; }
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

/**
 * Client bundles. The Agents window is a SEPARATE bundle carrying its own copy of
 * the same chat client, so patching only the workbench left that window on stock
 * behaviour: steering messages evicted, and the chat activity row unpatched.
 */
function workbenchTargets() {
	return [
		...resolveInInstalls('resources/app/out/vs/workbench/workbench.desktop.main.js'),
		...resolveInInstalls('resources/app/out/vs/sessions/sessions.desktop.main.js'),
	];
}

/**
 * Agent host bundles inside the shared `vscode` docker volume. Old server
 * versions accumulate there; already-patched and non-matching ones are skipped,
 * so listing them all is self-limiting and covers a freshly installed server.
 */
function agentHostTargets() {
	if (!dockerAvailable()) { return []; }
	let out;
	try {
		out = docker(['run', '--rm', '-v', `${VOLUME}:/vscode`, 'alpine', 'sh', '-c', `ls -1 ${VOLUME_GLOB} 2>/dev/null`]);
	} catch { return []; }
	return out.split('\n').map(l => l.trim()).filter(Boolean).map(p => `docker:${p}`);
}

/**
 * Agent host bundles installed directly on this filesystem: the server bins used
 * when a window opens a plain WSL folder, and the copy inside the installed app
 * itself, which serves windows with no remote at all.
 */
function localAgentHostTargets() {
	const rel = 'out/vs/platform/agentHost/node/agentHostMain.js';
	const found = [];
	for (const dir of ['.vscode-server', '.vscode-server-insiders']) {
		const home = path.join(os.homedir(), dir);

		const bin = path.join(home, 'bin');
		if (fs.existsSync(bin)) {
			for (const entry of fs.readdirSync(bin, { withFileTypes: true })) {
				if (!entry.isDirectory()) { continue; }
				const p = path.join(bin, entry.name, rel);
				if (fs.existsSync(p)) { found.push(p); }
			}
		}

		// The server the CLI installs, which is the one a WSL window actually runs.
		// Only `bin/` was searched before, so every WSL session ran a stock agent
		// host: six bundles here carried no marker at all while `bin/` looked fully
		// patched, and nothing reported a gap because the two never meet.
		const cliServers = path.join(home, 'cli', 'servers');
		if (fs.existsSync(cliServers)) {
			for (const entry of fs.readdirSync(cliServers, { withFileTypes: true })) {
				if (!entry.isDirectory()) { continue; }
				const p = path.join(cliServers, entry.name, 'server', rel);
				if (fs.existsSync(p)) { found.push(p); }
			}
		}
	}
	found.push(...resolveInInstalls('resources/app/' + rel));
	return found;
}
const isDocker = (t) => t.startsWith('docker:');
const dockerPath = (t) => t.slice('docker:'.length);

// Files copied out of the volume land root-owned, so reads and writes use
// separate names rather than fighting over one.
function readTarget(target, io) {
	if (!isDocker(target)) { return fs.readFileSync(target, 'utf8'); }
	docker(['run', '--rm', '-v', `${VOLUME}:/vscode`, '-v', `${io}:/io`, 'alpine',
		'cp', dockerPath(target), '/io/in.js']);
	return fs.readFileSync(path.join(io, 'in.js'), 'utf8');
}

function writeTarget(target, text, io) {
	if (!isDocker(target)) { fs.writeFileSync(target, text); return; }
	fs.writeFileSync(path.join(io, 'out.js'), text);
	docker(['run', '--rm', '-v', `${VOLUME}:/vscode`, '-v', `${io}:/io`, 'alpine',
		'cp', '/io/out.js', dockerPath(target)]);
}

function backupExists(target, io) {
	if (!isDocker(target)) { return fs.existsSync(target + BACKUP_SUFFIX); }
	const out = docker(['run', '--rm', '-v', `${VOLUME}:/vscode`, 'alpine', 'sh', '-c',
		`test -f ${dockerPath(target)}${BACKUP_SUFFIX} && echo yes || echo no`]);
	return out.trim() === 'yes';
}

function copyInPlace(target, from, to) {
	if (!isDocker(target)) { fs.copyFileSync(from, to); return; }
	docker(['run', '--rm', '-v', `${VOLUME}:/vscode`, 'alpine', 'cp', from, to]);
}

/** A broken bundle bricks the app, so never install anything that will not parse. */
function syntaxOk(text, io) {
	const probe = path.join(io, 'probe.mjs');
	fs.writeFileSync(probe, text);
	try { execFileSync(process.execPath, ['--check', probe], { stdio: 'pipe' }); return true; }
	catch { return false; }
	finally { fs.rmSync(probe, { force: true }); }
}

/**
 * Build hashes of the installed workbench bundles. A server bundle in the
 * shared volume belongs to the running VS Code when its bin directory starts
 * with one of these, which is how a live bundle is told from the superseded
 * copies that pile up beside it.
 */
function installedBuildHashes(targets) {
	const hashes = new Set();
	for (const t of targets) {
		if (isDocker(t) || /agentHostMain\.js$/.test(t)) { continue; }
		for (const seg of String(t).split(/[\/]/)) {
			if (/^[0-9a-f]{8,}$/i.test(seg)) { hashes.add(seg.toLowerCase()); }
		}
	}
	return hashes;
}

/** Whether `label` is a bundle the installed VS Code actually loads. */
function isLiveBundle(label, hashes) {
	if (!/agentHostMain\.js$/.test(label)) { return true; }
	const m = label.match(/\/bin\/[^/]+\/([0-9a-f]+)\//i);
	if (!m) { return false; }
	const bin = m[1].toLowerCase();
	for (const h of hashes) { if (bin.startsWith(h)) { return true; } }
	return false;
}

function main() {
	const args = process.argv.slice(2);
	if (args.includes('--list')) {
		console.log(JSON.stringify(FIXES.map(({ id, target, title }) => ({ id, target, title })), null, 2));
		return;
	}
	const flag = (n) => args.includes(n);
	const valueOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };

	const only = new Set((valueOf('--only') ?? '').split(',').filter(Boolean));
	// Leave a fix out of an otherwise full apply. `--revert` restores the whole
	// backup, so dropping one fix means revert, then re-apply with this set.
	const except = new Set((valueOf('--except') ?? '').split(',').filter(Boolean));
	const mode = flag('--apply') ? 'apply' : flag('--revert') ? 'revert' : 'status';
	const explicit = valueOf('--target');
	const targets = explicit
		? [explicit]
		: [...workbenchTargets(), ...localAgentHostTargets(), ...agentHostTargets()];

	if (targets.length === 0) {
		console.error('No bundles found. Is VS Code installed, and is docker running?');
		process.exit(1);
	}

	const buildHashes = installedBuildHashes(targets);
	const collected = [];
	const io = fs.mkdtempSync(path.join(os.tmpdir(), 'vscodefix-'));
	let failures = 0;
	let skipped = 0;
	try {
		for (const target of targets) {
			const kind = isDocker(target) || /agentHostMain\.js$/.test(target) ? 'agenthost' : 'workbench';
			const label = isDocker(target) ? dockerPath(target) : target;
			const header = `\n[${kind}] ${label}`;

			let data;
			try { data = readTarget(target, io); }
			catch (err) { console.log(`${header}\n  unreadable: ${err.message}`); failures++; continue; }

			const applicable = FIXES.filter(f => f.target === kind && (only.size === 0 || only.has(f.id)) && !except.has(f.id));
			if (applicable.length === 0) { console.log(`${header}\n  no applicable fixes`); continue; }

			// Superseded server versions pile up in the shared volume and match
			// nothing. Stay quiet about them unless asked, so the output shows the
			// handful of bundles that actually matter.
			const stale = kind === 'agenthost' && !explicit
				&& applicable.every(f => !f.patched.test(data) && data.match(new RegExp(f.unpatched.source, 'g')) === null);
			if (stale && !flag('--verbose')) { skipped++; continue; }
			console.log(header);

			if (mode === 'revert') {
				if (!backupExists(target, io)) { console.log('  no backup to restore'); continue; }
				copyInPlace(target, label + BACKUP_SUFFIX, label);
				console.log(`  reverted from ${BACKUP_SUFFIX}`);
				continue;
			}

			let next = data;
			const results = [];
			for (const fix of applicable) {
				if (fix.patched.test(next)) { results.push([fix, 'PATCHED']); continue; }
				const hits = next.match(new RegExp(fix.unpatched.source, 'g'));
				if (hits === null) { results.push([fix, 'site not found']); continue; }
				if (hits.length !== 1) { results.push([fix, `ABORT: ${hits.length} occurrences`]); continue; }
				if (mode === 'status') { results.push([fix, 'unpatched (patchable)']); continue; }
				try {
					next = next.replace(fix.unpatched, fix.build);
				} catch (err) {
					// One entry's build must not abort every other fix for this bundle.
					results.push([fix, `BUILD FAILED: ${err instanceof Error ? err.message : String(err)}`]);
					continue;
				}
				results.push([fix, 'applying']);
			}
			for (const [fix, state] of results) { console.log(`  ${fix.id.padEnd(18)} ${state}`); }
			collected.push({ label, kind, results });

			if (mode === 'status' || next === data) { continue; }
			if (!syntaxOk(next, io)) {
				console.log('  ABORT: patched bundle fails a syntax check, nothing written');
				failures++;
				continue;
			}
			if (!backupExists(target, io)) {
				copyInPlace(target, label, label + BACKUP_SUFFIX);
				console.log(`  backup -> ${path.basename(label)}${BACKUP_SUFFIX}`);
			}
			writeTarget(target, next, io);
			console.log(`  written (${sha(data)} -> ${sha(next)}). Restart VS Code fully.`);
		}
	} finally {
		fs.rmSync(io, { recursive: true, force: true });
	}
	// A fix can stop matching after a VS Code update and quietly apply to the
	// superseded copies only, where the aggregate counts still look healthy.
	// Report that case against the bundle the running VS Code actually loads.
	const liveGaps = [];
	for (const fix of FIXES) {
		const rows = collected.flatMap(c => c.results
			.filter(([f]) => f.id === fix.id)
			.map(([, state]) => ({ label: c.label, state, live: isLiveBundle(c.label, buildHashes) })));
		const missing = rows.filter(r => r.live && r.state !== 'PATCHED' && r.state !== 'applying');
		const elsewhere = rows.filter(r => !r.live && r.state === 'PATCHED').length;
		if (missing.length > 0 && elsewhere > 0) { liveGaps.push({ fix, missing, elsewhere }); }
	}
	if (liveGaps.length > 0) {
		console.log('\nLIVE BUNDLE CHECK');
		for (const gap of liveGaps) {
			console.log(`  ${gap.fix.id}: applied on ${gap.elsewhere} superseded bundle(s) but NOT on the bundle in use`);
			for (const m of gap.missing) { console.log(`    ${m.state}: ${m.label}`); }
		}
		console.log('  Re-anchor these against the current bundle; the counts above hide the gap.');
	}
	if (skipped > 0) {
		console.log(`\n(${skipped} superseded agent host bundle(s) matched nothing; --verbose to list)`);
	}
	process.exit(failures === 0 ? 0 : 1);
}

// Exported so the behavioural tests can drive the real entries instead of
// keeping their own copies of each regex, which drift.
export { FIXES };

// Patch only when invoked directly. Importing this file must have no effect.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
	main();
}
