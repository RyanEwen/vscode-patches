// Preserve the exact resolved input used to identify a consumed steering message.
export const marker = '__ahSteeringInputText';

function replaceOne(text, pattern, replacement) {
	const count = [...text.matchAll(new RegExp(pattern.source, 'g'))].length;
	if (count !== 1) { throw new Error(`Codex steering input: expected one anchor, found ${count}: ${pattern.source.slice(0, 100)}`); }
	return text.replace(pattern, replacement);
}

export function transformCodexSteeringInput(input) {
	if (input.includes(marker)) {
		if (!/pendingSteeringFlips\.set\([^,]+,\{pendingMessage:/.test(input) || !/if\([\w$]+\.inputText===[\w$]+\)return [\w$]+\.pendingSteeringFlips\.delete\([\w$]+\),[\w$]+\.pendingMessage/.test(input)) {
			throw new Error('Incomplete Codex steering input patch');
		}
		return input;
	}
	const handlers = [...input.matchAll(/_handleSteeredUserMessage\([\w$]+,([\w$]+)\)\{let [\w$]+=([\w$]+)\(\1\),/g)];
	if (handlers.length !== 1) { throw new Error('Cannot identify the Codex input text extractor'); }
	const extractor = handlers[0][2];
	let text = replaceOne(input,
		/let\{input:([\w$]+)\}=([\w$]+)\(([\w$]+),([\w$]+)\.message\.attachments\),([\w$]+)=([\w$]+)\.threadId;\6\.pendingSteeringFlips\.set\(\4\.id,\4\)/,
		(m, resolved, resolver, raw, pending, thread, session) =>
			`let{input:${resolved}}=${resolver}(${raw},${pending}.message.attachments),${thread}=${session}.threadId;/*${marker}*/${session}.pendingSteeringFlips.set(${pending}.id,{pendingMessage:${pending},inputText:${extractor}(${resolved})})`);
	text = replaceOne(text,
		/_takeMatchingPendingSteering\(([\w$]+),([\w$]+)\)\{for\(let\[([\w$]+),([\w$]+)\]of \1\.pendingSteeringFlips\)if\(\4\.message\.text===\2\)return \1\.pendingSteeringFlips\.delete\(\3\),\4\}/,
		(m, session, echoed, id, pending) => `_takeMatchingPendingSteering(${session},${echoed}){for(let[${id},${pending}]of ${session}.pendingSteeringFlips)if(${pending}.inputText===${echoed})return ${session}.pendingSteeringFlips.delete(${id}),${pending}.pendingMessage}`);
	return text;
}
