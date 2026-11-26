(function(globalScope) {
	'use strict';

	const DIRECTIVES = new Set([
		'define', 'undef', 'ifdef', 'ifndef', 'if', 'elif', 'else', 'endif',
		'include', 'pragma', 'error', 'warning'
	]);

	const QUICK_CHECK_RE = /(?:^|\r?\n)[ \t]*(?:<\?bop[ \t]+)?#[ \t]*(?:define|undef|ifdef|ifndef|if|elif|else|endif|include|pragma|error|warning)\b|\b(?:__BOP__|__DATE__|__TIME__)\b/i;

	const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function formatAnsiDate(d) {
		const mon = MONTHS_SHORT[d.getMonth()];
		const day = String(d.getDate()).padStart(2, ' ');
		const yr = d.getFullYear();
		return '"' + mon + ' ' + day + ' ' + yr + '"';
	}

	function formatAnsiTime(d) {
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		return '"' + hh + ':' + mm + ':' + ss + '"';
	}

	function isIdentStart(ch) {
		return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
	}

	function isIdentPart(ch) {
		return isIdentStart(ch) || (ch >= '0' && ch <= '9');
	}

	function stripTrailingComment(text) {
		let i = 0;
		const len = text.length;
		let out = '';
		while (i < len) {
			const ch = text.charAt(i);
			if (ch === "'" || ch === '"') {
				const q = ch;
				out += ch;
				i++;
				while (i < len) {
					const c2 = text.charAt(i);
					out += c2;
					i++;
					if (c2 === '\\' && i < len) {
						out += text.charAt(i);
						i++;
					} else if (c2 === q) {
						break;
					}
				}
				continue;
			}
			if (ch === '/' && text.charAt(i + 1) === '/') {
				break;
			}
			if (ch === '/' && text.charAt(i + 1) === '*') {
				const close = text.indexOf('*/', i + 2);
				if (close === -1) break;
				out += ' ';
				i = close + 2;
				continue;
			}
			out += ch;
			i++;
		}
		return out.trim();
	}

	function stringifyMacroArg(raw) {
		const trimmed = raw.trim();
		let collapsed = '';
		let inSpace = false;
		let i = 0;
		while (i < trimmed.length) {
			const ch = trimmed.charAt(i);
			if (ch === '"' || ch === "'") {
				if (inSpace) {
					collapsed += ' ';
					inSpace = false;
				}
				const q = ch;
				collapsed += ch;
				i++;
				while (i < trimmed.length) {
					const c2 = trimmed.charAt(i);
					collapsed += c2;
					i++;
					if (c2 === '\\' && i < trimmed.length) {
						collapsed += trimmed.charAt(i);
						i++;
					} else if (c2 === q) {
						break;
					}
				}
				continue;
			}
			if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
				inSpace = true;
				i++;
				continue;
			}
			if (inSpace) {
				collapsed += ' ';
				inSpace = false;
			}
			collapsed += ch;
			i++;
		}
		const escaped = collapsed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return '"' + escaped + '"';
	}

	function tokenizeMacroBody(body) {
		const tokens = [];
		let i = 0;
		const len = body.length;
		while (i < len) {
			const ch = body.charAt(i);
			if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
				let start = i;
				while (i < len && (body.charAt(i) === ' ' || body.charAt(i) === '\t' || body.charAt(i) === '\r' || body.charAt(i) === '\n')) i++;
				tokens.push({ type: 'ws', text: body.slice(start, i) });
				continue;
			}
			if (ch === "'" || ch === '"') {
				const q = ch;
				let start = i;
				i++;
				while (i < len) {
					const c2 = body.charAt(i);
					i++;
					if (c2 === '\\' && i < len) {
						i++;
					} else if (c2 === q) {
						break;
					}
				}
				tokens.push({ type: 'str', text: body.slice(start, i) });
				continue;
			}
			if (ch === '$' && i + 1 < len && isIdentStart(body.charAt(i + 1))) {
				let start = i;
				i += 2;
				while (i < len && isIdentPart(body.charAt(i))) i++;
				tokens.push({ type: 'var', text: body.slice(start, i) });
				continue;
			}
			if (ch === '#' && body.charAt(i + 1) === '#') {
				tokens.push({ type: 'paste', text: '##' });
				i += 2;
				continue;
			}
			if (ch === '#') {
				tokens.push({ type: 'hash', text: '#' });
				i++;
				continue;
			}
			if (isIdentStart(ch)) {
				let start = i;
				i++;
				while (i < len && isIdentPart(body.charAt(i))) i++;
				tokens.push({ type: 'ident', text: body.slice(start, i) });
				continue;
			}
			if (ch === '-' && body.charAt(i + 1) === '>') {
				tokens.push({ type: 'arrow', text: '->' });
				i += 2;
				continue;
			}
			tokens.push({ type: 'other', text: ch });
			i++;
		}
		return tokens;
	}

	function parseMacroCallArgs(src, openParenIdx) {
		const len = src.length;
		let i = openParenIdx + 1;
		let depth = 1;
		const args = [];
		let cur = '';
		while (i < len && depth > 0) {
			const ch = src.charAt(i);
			if (ch === "'" || ch === '"') {
				const q = ch;
				cur += ch;
				i++;
				while (i < len) {
					const c2 = src.charAt(i);
					cur += c2;
					i++;
					if (c2 === '\\' && i < len) {
						cur += src.charAt(i);
						i++;
					} else if (c2 === q) {
						break;
					}
				}
				continue;
			}
			if (ch === '(') {
				depth++;
				cur += ch;
				i++;
				continue;
			}
			if (ch === ')') {
				depth--;
				if (depth === 0) {
					args.push(cur);
					return { args: args, endIdx: i + 1 };
				}
				cur += ch;
				i++;
				continue;
			}
			if (ch === ',' && depth === 1) {
				args.push(cur);
				cur = '';
				i++;
				continue;
			}
			cur += ch;
			i++;
		}
		return null;
	}

	function substituteFunctionMacro(macro, rawArgs, macros, hideSet, depth) {
		const paramRawMap = Object.create(null);
		const paramExpMap = Object.create(null);
		const fixedCount = macro.params.length;

		for (let p = 0; p < fixedCount; p++) {
			const rawVal = (p < rawArgs.length ? rawArgs[p] : '').trim();
			paramRawMap[macro.params[p]] = rawVal;
			paramExpMap[macro.params[p]] = expandText(rawVal, macros, hideSet, depth + 1);
		}
		if (macro.variadic) {
			const vaRaw = rawArgs.slice(fixedCount).map(function(s) { return s.trim(); }).join(', ');
			paramRawMap['__VA_ARGS__'] = vaRaw;
			paramExpMap['__VA_ARGS__'] = expandText(vaRaw, macros, hideSet, depth + 1);
		}

		const bodyTokens = tokenizeMacroBody(macro.body);
		const out = [];

		function prevNonWsIdx(arr) {
			for (let k = arr.length - 1; k >= 0; k--) {
				if (arr[k].type !== 'ws') return k;
			}
			return -1;
		}

		let i = 0;
		while (i < bodyTokens.length) {
			const tok = bodyTokens[i];

			// Stringification: # param
			if (tok.type === 'hash') {
				let j = i + 1;
				while (j < bodyTokens.length && bodyTokens[j].type === 'ws') j++;
				if (j < bodyTokens.length && bodyTokens[j].type === 'ident' && Object.prototype.hasOwnProperty.call(paramRawMap, bodyTokens[j].text)) {
					out.push({ type: 'str', text: stringifyMacroArg(paramRawMap[bodyTokens[j].text]) });
					i = j + 1;
					continue;
				}
				out.push(tok);
				i++;
				continue;
			}

			// Token pasting: lhs ## rhs
			if (tok.type === 'paste') {
				const lhsIdx = prevNonWsIdx(out);
				let j = i + 1;
				while (j < bodyTokens.length && bodyTokens[j].type === 'ws') j++;
				if (j < bodyTokens.length) {
					const rhsTok = bodyTokens[j];
					const rhsIsVa = rhsTok.type === 'ident' && rhsTok.text === '__VA_ARGS__' && macro.variadic;
					const rhsText = (rhsTok.type === 'ident' && Object.prototype.hasOwnProperty.call(paramRawMap, rhsTok.text))
						? paramRawMap[rhsTok.text]
						: rhsTok.text;

					// GCC/C99 extension: ", ##__VA_ARGS__" drops trailing comma when variadic args are empty
					if (rhsIsVa && rhsText === '' && lhsIdx !== -1 && out[lhsIdx].text === ',') {
						out.length = lhsIdx;
						i = j + 1;
						continue;
					}

					if (lhsIdx !== -1) {
						const lhsTok = out[lhsIdx];
						const lhsText = lhsTok.rawParam !== undefined ? lhsTok.rawParam : lhsTok.text;
						out.length = lhsIdx;
						out.push({ type: 'other', text: lhsText + rhsText });
					} else {
						out.push({ type: 'other', text: rhsText });
					}
					i = j + 1;
					continue;
				}
				i++;
				continue;
			}

			if (tok.type === 'ident' && Object.prototype.hasOwnProperty.call(paramRawMap, tok.text)) {
				// Look ahead to see if this token is immediately followed by ##
				let nextNonWs = i + 1;
				while (nextNonWs < bodyTokens.length && bodyTokens[nextNonWs].type === 'ws') nextNonWs++;
				const followedByPaste = nextNonWs < bodyTokens.length && bodyTokens[nextNonWs].type === 'paste';
				out.push({
					type: 'other',
					text: followedByPaste ? paramRawMap[tok.text] : paramExpMap[tok.text],
					rawParam: paramRawMap[tok.text]
				});
				i++;
				continue;
			}

			out.push(tok);
			i++;
		}

		return out.map(function(t) { return t.text; }).join('');
	}

	function expandText(text, macros, hideSet, depth) {
		if (!text || depth > 40) return text;
		const len = text.length;
		let i = 0;
		let out = '';
		let prevWasArrow = false;

		while (i < len) {
			const ch = text.charAt(i);

			// Single-quoted or double-quoted string literal (skip unchanged)
			if (ch === "'" || ch === '"') {
				const q = ch;
				const start = i;
				i++;
				while (i < len) {
					const c2 = text.charAt(i);
					i++;
					if (c2 === '\\' && i < len) {
						i++;
					} else if (c2 === q) {
						break;
					}
				}
				out += text.slice(start, i);
				prevWasArrow = false;
				continue;
			}

			// Line comments // or # (skip rest of line)
			if ((ch === '/' && text.charAt(i + 1) === '/') || ch === '#') {
				out += text.slice(i);
				break;
			}

			// Inline block comment /* ... */
			if (ch === '/' && text.charAt(i + 1) === '*') {
				const close = text.indexOf('*/', i + 2);
				if (close === -1) {
					out += text.slice(i);
					break;
				}
				out += text.slice(i, close + 2);
				i = close + 2;
				continue;
			}

			// BOP $variable — never macro-expand variable names
			if (ch === '$' && i + 1 < len && isIdentStart(text.charAt(i + 1))) {
				const start = i;
				i += 2;
				while (i < len && isIdentPart(text.charAt(i))) i++;
				out += text.slice(start, i);
				prevWasArrow = false;
				continue;
			}

			// Object member access operator ->
			if (ch === '-' && text.charAt(i + 1) === '>') {
				out += '->';
				i += 2;
				prevWasArrow = true;
				continue;
			}

			if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
				out += ch;
				i++;
				continue;
			}

			// Identifier candidate for macro expansion
			if (isIdentStart(ch)) {
				const start = i;
				i++;
				while (i < len && isIdentPart(text.charAt(i))) i++;
				const ident = text.slice(start, i);
				const skipProp = prevWasArrow;
				prevWasArrow = false;

				if (!skipProp && !hideSet.has(ident) && macros.has(ident)) {
					const macro = macros.get(ident);
					if (macro.isFunc) {
						let j = i;
						while (j < len && (text.charAt(j) === ' ' || text.charAt(j) === '\t')) j++;
						if (j < len && text.charAt(j) === '(') {
							const parsed = parseMacroCallArgs(text, j);
							if (parsed) {
								const rawArgs = (parsed.args.length === 1 && parsed.args[0].trim() === '' && macro.params.length === 0)
									? []
									: parsed.args;
								const expectedMin = macro.params.length;
								if (!macro.variadic && rawArgs.length !== expectedMin && !(expectedMin === 0 && rawArgs.length === 0)) {
									throw new Error('Macro "' + ident + '" expects ' + expectedMin + ' argument(s), got ' + rawArgs.length);
								}
								if (macro.variadic && rawArgs.length < expectedMin) {
									throw new Error('Macro "' + ident + '" expects at least ' + expectedMin + ' argument(s), got ' + rawArgs.length);
								}
								const substituted = substituteFunctionMacro(macro, rawArgs, macros, hideSet, depth);
								const nextHide = new Set(hideSet);
								nextHide.add(ident);
								out += expandText(substituted, macros, nextHide, depth + 1);
								i = parsed.endIdx;
								continue;
							}
						}
						// Function-like macro name not followed by '(' stays literal (ANSI C rule)
						out += ident;
						continue;
					} else {
						const nextHide = new Set(hideSet);
						nextHide.add(ident);
						out += expandText(macro.body, macros, nextHide, depth + 1);
						continue;
					}
				}

				out += ident;
				continue;
			}

			prevWasArrow = false;
			out += ch;
			i++;
		}

		return out;
	}

	// --- ANSI C #if / #elif constant integer expression evaluator ---
	function preprocessIfCondition(exprText, macros) {
		// Step 1: Replace defined(NAME) and defined NAME before macro expansion
		let resolved = '';
		let i = 0;
		const len = exprText.length;
		while (i < len) {
			const ch = exprText.charAt(i);
			if (ch === "'" || ch === '"') {
				const q = ch;
				const start = i;
				i++;
				while (i < len) {
					const c2 = exprText.charAt(i);
					i++;
					if (c2 === '\\' && i < len) i++;
					else if (c2 === q) break;
				}
				resolved += exprText.slice(start, i);
				continue;
			}
			if (isIdentStart(ch)) {
				const start = i;
				i++;
				while (i < len && isIdentPart(exprText.charAt(i))) i++;
				const word = exprText.slice(start, i);
				if (word === 'defined') {
					let j = i;
					while (j < len && (exprText.charAt(j) === ' ' || exprText.charAt(j) === '\t')) j++;
					let hasParen = false;
					if (j < len && exprText.charAt(j) === '(') {
						hasParen = true;
						j++;
						while (j < len && (exprText.charAt(j) === ' ' || exprText.charAt(j) === '\t')) j++;
					}
					const nameStart = j;
					if (j < len && isIdentStart(exprText.charAt(j))) {
						j++;
						while (j < len && isIdentPart(exprText.charAt(j))) j++;
					}
					const macroName = exprText.slice(nameStart, j);
					if (hasParen) {
						while (j < len && (exprText.charAt(j) === ' ' || exprText.charAt(j) === '\t')) j++;
						if (j < len && exprText.charAt(j) === ')') j++;
					}
					resolved += macros.has(macroName) ? '1' : '0';
					i = j;
					continue;
				}
				resolved += word;
				continue;
			}
			resolved += ch;
			i++;
		}

		// Step 2: Expand macros in the condition
		return expandText(resolved, macros, new Set(), 0);
	}

	function tokenizeIfExpr(expr) {
		const toks = [];
		let i = 0;
		const len = expr.length;
		while (i < len) {
			const ch = expr.charAt(i);
			if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
				i++;
				continue;
			}
			if (ch >= '0' && ch <= '9') {
				const start = i;
				if (ch === '0' && (expr.charAt(i + 1) === 'x' || expr.charAt(i + 1) === 'X')) {
					i += 2;
					while (i < len && /[0-9a-fA-F]/.test(expr.charAt(i))) i++;
					const raw = expr.slice(start, i);
					while (i < len && /[uUlL]/.test(expr.charAt(i))) i++;
					toks.push({ type: 'num', val: parseInt(raw, 16) || 0 });
					continue;
				}
				if (ch === '0' && (expr.charAt(i + 1) === 'b' || expr.charAt(i + 1) === 'B')) {
					i += 2;
					while (i < len && (expr.charAt(i) === '0' || expr.charAt(i) === '1')) i++;
					const raw = expr.slice(start + 2, i);
					while (i < len && /[uUlL]/.test(expr.charAt(i))) i++;
					toks.push({ type: 'num', val: parseInt(raw, 2) || 0 });
					continue;
				}
				while (i < len && expr.charAt(i) >= '0' && expr.charAt(i) <= '9') i++;
				const raw = expr.slice(start, i);
				while (i < len && /[uUlL]/.test(expr.charAt(i))) i++;
				const val = (raw.length > 1 && raw.charAt(0) === '0' && /^[0-7]+$/.test(raw))
					? parseInt(raw, 8)
					: parseInt(raw, 10);
				toks.push({ type: 'num', val: val || 0 });
				continue;
			}
			if (ch === "'") {
				i++;
				let code = 0;
				if (i < len && expr.charAt(i) === '\\') {
					i++;
					const esc = expr.charAt(i++);
					if (esc === 'n') code = 10;
					else if (esc === 'r') code = 13;
					else if (esc === 't') code = 9;
					else if (esc === '0') code = 0;
					else code = esc.charCodeAt(0);
				} else if (i < len) {
					code = expr.charCodeAt(i++);
				}
				if (i < len && expr.charAt(i) === "'") i++;
				toks.push({ type: 'num', val: code });
				continue;
			}
			if (isIdentStart(ch)) {
				const start = i;
				i++;
				while (i < len && isIdentPart(expr.charAt(i))) i++;
				const word = expr.slice(start, i);
				if (word === 'true') toks.push({ type: 'num', val: 1 });
				else if (word === 'false') toks.push({ type: 'num', val: 0 });
				else toks.push({ type: 'num', val: 0 }); // ANSI C: undefined identifiers evaluate to 0
				continue;
			}
			const two = expr.slice(i, i + 2);
			if (two === '||' || two === '&&' || two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '<<' || two === '>>') {
				toks.push({ type: 'op', val: two });
				i += 2;
				continue;
			}
			toks.push({ type: 'op', val: ch });
			i++;
		}
		toks.push({ type: 'eof', val: '' });
		return toks;
	}

	function evalIfExpr(exprText, macros) {
		const expanded = preprocessIfCondition(stripTrailingComment(exprText), macros);
		const toks = tokenizeIfExpr(expanded);
		let pos = 0;

		function peek() { return toks[pos]; }
		function next() { return toks[pos++]; }
		function match(op) {
			if (peek().type === 'op' && peek().val === op) {
				pos++;
				return true;
			}
			return false;
		}

		function parseTernary() {
			let c = parseLogOr();
			if (match('?')) {
				const t = parseTernary();
				if (!match(':')) throw new Error('Expected ":" in #if ternary expression');
				const f = parseTernary();
				return c ? t : f;
			}
			return c;
		}
		function parseLogOr() {
			let v = parseLogAnd();
			while (match('||')) {
				const r = parseLogAnd();
				v = (v || r) ? 1 : 0;
			}
			return v;
		}
		function parseLogAnd() {
			let v = parseBitOr();
			while (match('&&')) {
				const r = parseBitOr();
				v = (v && r) ? 1 : 0;
			}
			return v;
		}
		function parseBitOr() {
			let v = parseBitXor();
			while (match('|')) v = (v | parseBitXor());
			return v;
		}
		function parseBitXor() {
			let v = parseBitAnd();
			while (match('^')) v = (v ^ parseBitAnd());
			return v;
		}
		function parseBitAnd() {
			let v = parseEq();
			while (match('&')) v = (v & parseEq());
			return v;
		}
		function parseEq() {
			let v = parseRel();
			while (true) {
				if (match('==')) v = (v === parseRel()) ? 1 : 0;
				else if (match('!=')) v = (v !== parseRel()) ? 1 : 0;
				else break;
			}
			return v;
		}
		function parseRel() {
			let v = parseShift();
			while (true) {
				if (match('<=')) v = (v <= parseShift()) ? 1 : 0;
				else if (match('>=')) v = (v >= parseShift()) ? 1 : 0;
				else if (match('<')) v = (v < parseShift()) ? 1 : 0;
				else if (match('>')) v = (v > parseShift()) ? 1 : 0;
				else break;
			}
			return v;
		}
		function parseShift() {
			let v = parseAdd();
			while (true) {
				if (match('<<')) v = (v << parseAdd());
				else if (match('>>')) v = (v >> parseAdd());
				else break;
			}
			return v;
		}
		function parseAdd() {
			let v = parseMul();
			while (true) {
				if (match('+')) v = v + parseMul();
				else if (match('-')) v = v - parseMul();
				else break;
			}
			return v;
		}
		function parseMul() {
			let v = parseUnary();
			while (true) {
				if (match('*')) v = v * parseUnary();
				else if (match('/')) {
					const d = parseUnary();
					if (d === 0) throw new Error('Division by zero in #if expression');
					v = Math.trunc(v / d);
				} else if (match('%')) {
					const d = parseUnary();
					if (d === 0) throw new Error('Modulo by zero in #if expression');
					v = Math.trunc(v % d);
				} else break;
			}
			return v;
		}
		function parseUnary() {
			if (match('+')) return +parseUnary();
			if (match('-')) return -parseUnary();
			if (match('!')) return parseUnary() ? 0 : 1;
			if (match('~')) return ~parseUnary();
			return parsePrimary();
		}
		function parsePrimary() {
			if (match('(')) {
				const v = parseTernary();
				if (!match(')')) throw new Error('Unclosed "(" in #if expression');
				return v;
			}
			const tok = next();
			if (tok.type === 'num') return tok.val;
			throw new Error('Unexpected token "' + tok.val + '" in #if expression');
		}

		const result = parseTernary();
		if (peek().type !== 'eof') {
			throw new Error('Unexpected trailing token "' + peek().val + '" in #if expression');
		}
		return result !== 0;
	}

	function dirOfPath(p) {
		const s = String(p || '').replace(/\\/g, '/');
		const idx = s.lastIndexOf('/');
		return idx === -1 ? '' : s.slice(0, idx);
	}

	function joinRelPath(baseDir, relPath) {
		const cleanRel = String(relPath || '').replace(/\\/g, '/');
		if (!baseDir || cleanRel.charAt(0) === '/') return cleanRel;
		return baseDir + '/' + cleanRel;
	}

	function stripOuterBopTags(code) {
		let s = String(code ?? '');
		// Strip leading <?bop (with optional whitespace before it)
		const openMatch = /^[ \t]*<\?bop(?=[ \t\r\n]|$)/i.exec(s);
		if (openMatch) {
			s = s.slice(openMatch[0].length);
		}
		// Strip trailing ?> if present at the very end
		const closeMatch = /\?>[ \t\r\n]*$/.exec(s);
		if (closeMatch) {
			s = s.slice(0, closeMatch.index);
		}
		return s;
	}

	function scanBopLineSegments(line, scanState, macros) {
		let out = '';
		let i = 0;
		const len = line.length;

		while (i < len) {
			if (!scanState.inBop) {
				const openIdx = line.indexOf('<?', i);
				if (openIdx === -1) {
					out += line.slice(i);
					break;
				}
				out += line.slice(i, openIdx);
				const after = line.slice(openIdx);
				const bopMatch = /^<\?bop(?=\s|$)/i.exec(after);
				if (bopMatch) {
					out += bopMatch[0];
					i = openIdx + bopMatch[0].length;
					scanState.inBop = true;
					continue;
				}
				if (after.startsWith('<?=')) {
					out += '<?=';
					i = openIdx + 3;
					scanState.inBop = true;
					continue;
				}
				out += '<?';
				i = openIdx + 2;
				continue;
			}

			// Inside BOP code region: respect multi-line block comments, strings, heredoc
			if (scanState.heredocEnd !== null) {
				const trimmed = line.slice(i).trim();
				out += line.slice(i);
				if (trimmed === scanState.heredocEnd || trimmed === scanState.heredocEnd + ';') {
					scanState.heredocEnd = null;
				}
				break;
			}

			if (scanState.inBlockComment) {
				const closeIdx = line.indexOf('*/', i);
				if (closeIdx === -1) {
					out += line.slice(i);
					break;
				}
				out += line.slice(i, closeIdx + 2);
				i = closeIdx + 2;
				scanState.inBlockComment = false;
				continue;
			}

			if (scanState.inString !== null) {
				const q = scanState.inString;
				const start = i;
				while (i < len) {
					const c = line.charAt(i);
					i++;
					if (c === '\\' && i < len) {
						i++;
					} else if (c === q) {
						scanState.inString = null;
						break;
					}
				}
				out += line.slice(start, i);
				continue;
			}

			// Normal BOP code chunk until line comment, heredoc, ?>, or an UNCLOSED multi-line string/block comment.
			// Same-line string literals and inline /* ... */ comments stay inside the chunk so function-like
			// macros such as LOG("msg", $x) can parse string arguments cleanly and "?>" does not close BOP mode.
			const chunkStart = i;
			let chunkEnd = i;
			let nextMode = null;
			while (chunkEnd < len) {
				const c = line.charAt(chunkEnd);
				if (c === '?' && line.charAt(chunkEnd + 1) === '>') {
					nextMode = 'closeBop';
					break;
				}
				if (c === "'" || c === '"') {
					const q = c;
					let k = chunkEnd + 1;
					let closed = false;
					while (k < len) {
						const c2 = line.charAt(k);
						k++;
						if (c2 === '\\' && k < len) {
							k++;
						} else if (c2 === q) {
							closed = true;
							break;
						}
					}
					if (closed) {
						chunkEnd = k;
						continue;
					}
					nextMode = c;
					break;
				}
				if (c === '/' && line.charAt(chunkEnd + 1) === '/') {
					nextMode = 'lineComment';
					break;
				}
				if (c === '#') {
					nextMode = 'lineComment';
					break;
				}
				if (c === '/' && line.charAt(chunkEnd + 1) === '*') {
					const closeIdx = line.indexOf('*/', chunkEnd + 2);
					if (closeIdx !== -1) {
						chunkEnd = closeIdx + 2;
						continue;
					}
					nextMode = 'blockComment';
					break;
				}
				if (c === '<' && line.slice(chunkEnd, chunkEnd + 3) === '<<<') {
					const hm = /^<<<[ \t]*(?:'([A-Za-z_][A-Za-z0-9_]*)'|"([A-Za-z_][A-Za-z0-9_]*)"|([A-Za-z_][A-Za-z0-9_]*))[ \t]*$/.exec(line.slice(chunkEnd));
					if (hm) {
						nextMode = { heredoc: hm[1] || hm[2] || hm[3] };
						break;
					}
				}
				chunkEnd++;
			}

			if (chunkEnd > chunkStart) {
				out += expandText(line.slice(chunkStart, chunkEnd), macros, new Set(), 0);
			}
			i = chunkEnd;

			if (nextMode === 'closeBop') {
				out += '?>';
				i += 2;
				scanState.inBop = false;
			} else if (nextMode === "'" || nextMode === '"') {
				scanState.inString = nextMode;
				out += line.slice(i);
				break;
			} else if (nextMode === 'lineComment') {
				out += line.slice(i);
				break;
			} else if (nextMode === 'blockComment') {
				scanState.inBlockComment = true;
				out += line.slice(i);
				break;
			} else if (nextMode && nextMode.heredoc) {
				out += line.slice(i);
				scanState.heredocEnd = nextMode.heredoc;
				break;
			}
		}

		return out;
	}

	async function preprocessBopSource(source, options) {
		const rawSource = String(source ?? '');
		const opts = options || {};
		const hasCustomDefines = opts.defines && typeof opts.defines === 'object' && Object.keys(opts.defines).length > 0;

		// Fast path: skip full preprocessing when no C directives or predefined macros exist
		if (!hasCustomDefines && !QUICK_CHECK_RE.test(rawSource)) {
			return rawSource;
		}

		const now = new Date();
		const macros = new Map();
		macros.set('__BOP__', { isFunc: false, params: [], variadic: false, body: '1' });
		macros.set('__DATE__', { isFunc: false, params: [], variadic: false, body: formatAnsiDate(now) });
		macros.set('__TIME__', { isFunc: false, params: [], variadic: false, body: formatAnsiTime(now) });

		if (hasCustomDefines) {
			Object.keys(opts.defines).forEach(function(k) {
				if (isIdentStart(k.charAt(0))) {
					const v = opts.defines[k];
					macros.set(k, {
						isFunc: false,
						params: [],
						variadic: false,
						body: v === null || v === undefined ? '' : String(v)
					});
				}
			});
		}

		const pragmaOnceSet = new Set();
		const MAX_INCLUDE_DEPTH = 32;
		const normalizePath = typeof opts.normalizePath === 'function'
			? opts.normalizePath
			: function(p) { return String(p || ''); };
		const loadFile = typeof opts.loadFile === 'function' ? opts.loadFile : null;
		const onWarning = typeof opts.onWarning === 'function' ? opts.onWarning : null;

		async function resolveAndLoadInclude(incTarget, currentFile, lineNum) {
			if (!loadFile) {
				throw new Error('BOP Preprocessor error: #include "' + incTarget + '" requires a file loader in ' + currentFile + ' on line ' + lineNum);
			}
			const candidates = [];
			const baseDir = dirOfPath(currentFile);
			if (baseDir && incTarget.charAt(0) !== '/') {
				candidates.push(joinRelPath(baseDir, incTarget));
			}
			if (candidates.indexOf(incTarget) === -1) {
				candidates.push(incTarget);
			}

			let lastErr = null;
			for (let c = 0; c < candidates.length; c++) {
				const cand = candidates[c];
				try {
					const text = await loadFile(cand);
					return { path: cand, canon: normalizePath(cand), code: String(text ?? '') };
				} catch (err) {
					lastErr = err;
				}
			}
			const reason = lastErr && lastErr.message ? lastErr.message : 'File not found';
			throw new Error('BOP Preprocessor error: #include "' + incTarget + '" failed (' + reason + ') in ' + currentFile + ' on line ' + lineNum);
		}

		async function processUnit(codeText, filePath, depth, initialInBop) {
			if (depth > MAX_INCLUDE_DEPTH) {
				throw new Error('BOP Preprocessor error: #include nested too deeply (max ' + MAX_INCLUDE_DEPTH + ') in ' + filePath);
			}
			const canonFile = normalizePath(filePath || 'unknown');
			if (depth > 0 && pragmaOnceSet.has(canonFile)) {
				return '';
			}

			const rawLines = codeText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
			const outLines = [];
			const condStack = []; // { parentActive, branchTaken, active, seenElse, line }
			const scanState = {
				inBop: Boolean(initialInBop),
				inBlockComment: false,
				inString: null,
				heredocEnd: null
			};

			function isActive() {
				return condStack.length === 0 || condStack[condStack.length - 1].active;
			}

			let idx = 0;
			while (idx < rawLines.length) {
				const lineNum = idx + 1;
				const line = rawLines[idx];

				// Only recognize C directives when in BOP code (or immediately after <?bop on the same line)
				// and outside strings/comments/heredoc
				let leadingTag = '';
				let dirMatch = null;
				if (!scanState.inBop) {
					const inlineTagDir = /^([ \t]*<\?bop[ \t]+)#[ \t]*([A-Za-z_][A-Za-z0-9_]*)(.*)$/i.exec(line);
					if (inlineTagDir && DIRECTIVES.has(inlineTagDir[2])) {
						leadingTag = inlineTagDir[1];
						scanState.inBop = true;
						dirMatch = [inlineTagDir[0], inlineTagDir[2], inlineTagDir[3]];
					}
				} else if (!scanState.inBlockComment && scanState.inString === null && scanState.heredocEnd === null) {
					dirMatch = /^[ \t]*#[ \t]*([A-Za-z_][A-Za-z0-9_]*)(.*)$/.exec(line);
				}

				if (dirMatch && DIRECTIVES.has(dirMatch[1])) {
					const directive = dirMatch[1];
					let rest = dirMatch[2];
					let consumed = 1;

					// Handle ANSI C backslash line continuations inside directives
					while (/[\\][ \t]*$/.test(rest) && idx + consumed < rawLines.length) {
						rest = rest.replace(/[\\][ \t]*$/, '') + rawLines[idx + consumed];
						consumed++;
					}

					const emitConsumedBlanks = function(count) {
						for (let k = 0; k < count; k++) {
							outLines.push(k === 0 ? leadingTag : '');
						}
					};

					const parentActive = condStack.length === 0 ? true : condStack[condStack.length - 1].active;

					if (directive === 'ifdef' || directive === 'ifndef') {
						const name = stripTrailingComment(rest).trim().split(/\s+/)[0] || '';
						if (!name || !isIdentStart(name.charAt(0))) {
							throw new Error('BOP Preprocessor error: #' + directive + ' requires a macro name in ' + filePath + ' on line ' + lineNum);
						}
						const cond = directive === 'ifdef' ? macros.has(name) : !macros.has(name);
						const branchActive = parentActive && cond;
						condStack.push({ parentActive: parentActive, branchTaken: cond, active: branchActive, seenElse: false, line: lineNum });
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'if') {
						let cond = false;
						if (parentActive) {
							try {
								cond = evalIfExpr(rest, macros);
							} catch (err) {
								throw new Error('BOP Preprocessor error: ' + err.message + ' in ' + filePath + ' on line ' + lineNum);
							}
						}
						const branchActive = parentActive && cond;
						condStack.push({ parentActive: parentActive, branchTaken: cond, active: branchActive, seenElse: false, line: lineNum });
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'elif') {
						if (condStack.length === 0) {
							throw new Error('BOP Preprocessor error: #elif without matching #if in ' + filePath + ' on line ' + lineNum);
						}
						const top = condStack[condStack.length - 1];
						if (top.seenElse) {
							throw new Error('BOP Preprocessor error: #elif after #else in ' + filePath + ' on line ' + lineNum);
						}
						if (top.parentActive && !top.branchTaken) {
							let cond = false;
							try {
								cond = evalIfExpr(rest, macros);
							} catch (err) {
								throw new Error('BOP Preprocessor error: ' + err.message + ' in ' + filePath + ' on line ' + lineNum);
							}
							top.active = cond;
							if (cond) top.branchTaken = true;
						} else {
							top.active = false;
						}
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'else') {
						if (condStack.length === 0) {
							throw new Error('BOP Preprocessor error: #else without matching #if in ' + filePath + ' on line ' + lineNum);
						}
						const top = condStack[condStack.length - 1];
						if (top.seenElse) {
							throw new Error('BOP Preprocessor error: duplicate #else in ' + filePath + ' on line ' + lineNum);
						}
						top.seenElse = true;
						top.active = top.parentActive && !top.branchTaken;
						top.branchTaken = true;
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'endif') {
						if (condStack.length === 0) {
							throw new Error('BOP Preprocessor error: #endif without matching #if in ' + filePath + ' on line ' + lineNum);
						}
						condStack.pop();
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					// Directives below only take effect in active branches
					if (!isActive()) {
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'define') {
						const defTrim = rest.replace(/^[ \t]+/, '');
						const nameMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(defTrim);
						if (!nameMatch) {
							throw new Error('BOP Preprocessor error: invalid #define macro name in ' + filePath + ' on line ' + lineNum);
						}
						const name = nameMatch[1];
						const afterName = defTrim.slice(name.length);
						if (afterName.charAt(0) === '(') {
							// Function-like macro (strictly no whitespace before '(')
							const closeParen = afterName.indexOf(')');
							if (closeParen === -1) {
								throw new Error('BOP Preprocessor error: unclosed parameter list in #define ' + name + ' in ' + filePath + ' on line ' + lineNum);
							}
							const rawParamList = afterName.slice(1, closeParen).trim();
							const params = [];
							let variadic = false;
							if (rawParamList !== '') {
								const parts = rawParamList.split(',');
								for (let p = 0; p < parts.length; p++) {
									const pName = parts[p].trim();
									if (pName === '...') {
										if (p !== parts.length - 1) {
											throw new Error('BOP Preprocessor error: "..." must be the last parameter in #define ' + name + ' in ' + filePath + ' on line ' + lineNum);
										}
										variadic = true;
									} else if (isIdentStart(pName.charAt(0)) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pName)) {
										params.push(pName);
									} else {
										throw new Error('BOP Preprocessor error: invalid parameter "' + pName + '" in #define ' + name + ' in ' + filePath + ' on line ' + lineNum);
									}
								}
							}
							const body = stripTrailingComment(afterName.slice(closeParen + 1));
							macros.set(name, { isFunc: true, params: params, variadic: variadic, body: body });
						} else {
							const body = stripTrailingComment(afterName);
							macros.set(name, { isFunc: false, params: [], variadic: false, body: body });
						}
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'undef') {
						const name = stripTrailingComment(rest).trim().split(/\s+/)[0] || '';
						if (!name || !isIdentStart(name.charAt(0))) {
							throw new Error('BOP Preprocessor error: #undef requires a macro name in ' + filePath + ' on line ' + lineNum);
						}
						macros.delete(name);
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'pragma') {
						const pragmaText = stripTrailingComment(rest).trim();
						if (pragmaText === 'once') {
							pragmaOnceSet.add(canonFile);
						}
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'error') {
						const msg = stripTrailingComment(rest).trim() || 'preprocessor #error';
						throw new Error('BOP Preprocessor error: ' + msg + ' in ' + filePath + ' on line ' + lineNum);
					}

					if (directive === 'warning') {
						const msg = stripTrailingComment(rest).trim() || 'preprocessor #warning';
						if (onWarning) {
							onWarning('Preprocessor #warning: ' + msg, filePath, lineNum);
						}
						emitConsumedBlanks(consumed);
						idx += consumed;
						continue;
					}

					if (directive === 'include') {
						let incRaw = stripTrailingComment(rest).trim();
						let target = null;
						let m = /^"([^"]+)"$/.exec(incRaw) || /^<([^>]+)>$/.exec(incRaw);
						if (!m) {
							incRaw = expandText(incRaw, macros, new Set(), 0).trim();
							m = /^"([^"]+)"$/.exec(incRaw) || /^<([^>]+)>$/.exec(incRaw);
						}
						if (!m) {
							throw new Error('BOP Preprocessor error: #include expects "filename" or <filename> in ' + filePath + ' on line ' + lineNum);
						}
						target = m[1];
						const loaded = await resolveAndLoadInclude(target, filePath, lineNum);
						const cleanHeader = stripOuterBopTags(loaded.code);
						const expandedHeader = await processUnit(cleanHeader, loaded.path, depth + 1, true);
						if (expandedHeader !== '') {
							outLines.push(leadingTag + expandedHeader);
						} else if (leadingTag) {
							outLines.push(leadingTag);
						}
						for (let k = 1; k < consumed; k++) outLines.push('');
						idx += consumed;
						continue;
					}
				}

				if (!isActive()) {
					outLines.push('');
					idx++;
					continue;
				}

				try {
					outLines.push(scanBopLineSegments(line, scanState, macros));
				} catch (err) {
					throw new Error('BOP Preprocessor error: ' + err.message + ' in ' + filePath + ' on line ' + lineNum);
				}
				idx++;
			}

			if (condStack.length > 0) {
				const unclosed = condStack[condStack.length - 1];
				throw new Error('BOP Preprocessor error: unterminated #if/#ifdef started on line ' + unclosed.line + ' in ' + filePath);
			}

			return outLines.join('\n');
		}

		return await processUnit(rawSource, opts.filePath || 'unknown', 0, Boolean(opts.startInBop));
	}

	globalScope.preprocessBopSource = preprocessBopSource;
})(typeof window !== 'undefined' ? window : globalThis);
