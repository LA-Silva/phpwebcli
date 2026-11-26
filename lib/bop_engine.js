(function(globalScope) {
	'use strict';

	// =========================================================================
	// 1. Runtime Value Types & Conversion Helpers
	// =========================================================================

	class BopCell {
		constructor(value, isRef = false) {
			this.value = value;
			this.isRef = isRef;
		}
	}

	function normalizeArrayKey(k) {
		if (typeof k === 'number') {
			return Number.isFinite(k) ? Math.trunc(k) : 0;
		}
		if (typeof k === 'boolean') {
			return k ? 1 : 0;
		}
		if (k === null || k === undefined) {
			return '';
		}
		const s = String(k);
		if (/^(?:0|-?[1-9]\d*)$/.test(s)) {
			const n = Number(s);
			if (Number.isSafeInteger(n)) {
				return n;
			}
		}
		return s;
	}

	function arrayMapKey(normKey) {
		return (typeof normKey === 'number' ? 'n:' : 's:') + String(normKey);
	}

	class BopArray {
		constructor(entries = null) {
			this.entries = [];
			this.indexMap = new Map();
			this.nextIntKey = 0;
			this.pointer = 0;
			if (entries) {
				for (let i = 0; i < entries.length; i++) {
					const e = entries[i];
					this.setCell(e.key, new BopCell(cloneBopValue(e.cell.value), e.cell.isRef));
				}
			}
		}

		_reindexMap() {
			this.indexMap.clear();
			for (let i = 0; i < this.entries.length; i++) {
				this.indexMap.set(arrayMapKey(this.entries[i].key), i);
			}
		}

		has(rawKey) {
			const k = normalizeArrayKey(rawKey);
			return this.indexMap.has(arrayMapKey(k));
		}

		getCell(rawKey) {
			const k = normalizeArrayKey(rawKey);
			const idx = this.indexMap.get(arrayMapKey(k));
			return idx === undefined ? null : this.entries[idx].cell;
		}

		get(rawKey) {
			const cell = this.getCell(rawKey);
			return cell ? cell.value : undefined;
		}

		ensureCell(rawKey) {
			if (rawKey === null) {
				const k = this.nextIntKey++;
				const cell = new BopCell(null);
				this.indexMap.set(arrayMapKey(k), this.entries.length);
				this.entries.push({ key: k, cell: cell });
				return cell;
			}
			const k = normalizeArrayKey(rawKey);
			const mk = arrayMapKey(k);
			let idx = this.indexMap.get(mk);
			if (idx !== undefined) {
				return this.entries[idx].cell;
			}
			if (typeof k === 'number' && k >= this.nextIntKey) {
				this.nextIntKey = k + 1;
			}
			const cell = new BopCell(null);
			this.indexMap.set(mk, this.entries.length);
			this.entries.push({ key: k, cell: cell });
			return cell;
		}

		set(rawKey, value) {
			if (rawKey === null) {
				return this.push(value);
			}
			const k = normalizeArrayKey(rawKey);
			const mk = arrayMapKey(k);
			const idx = this.indexMap.get(mk);
			if (idx !== undefined) {
				this.entries[idx].cell.value = value;
			} else {
				if (typeof k === 'number' && k >= this.nextIntKey) {
					this.nextIntKey = k + 1;
				}
				this.indexMap.set(mk, this.entries.length);
				this.entries.push({ key: k, cell: new BopCell(value) });
			}
			return value;
		}

		setCell(rawKey, cell) {
			if (rawKey === null) {
				const k = this.nextIntKey++;
				this.indexMap.set(arrayMapKey(k), this.entries.length);
				this.entries.push({ key: k, cell: cell });
				return cell;
			}
			const k = normalizeArrayKey(rawKey);
			const mk = arrayMapKey(k);
			const idx = this.indexMap.get(mk);
			if (idx !== undefined) {
				this.entries[idx].cell = cell;
			} else {
				if (typeof k === 'number' && k >= this.nextIntKey) {
					this.nextIntKey = k + 1;
				}
				this.indexMap.set(mk, this.entries.length);
				this.entries.push({ key: k, cell: cell });
			}
			return cell;
		}

		push(value) {
			const k = this.nextIntKey++;
			this.indexMap.set(arrayMapKey(k), this.entries.length);
			this.entries.push({ key: k, cell: new BopCell(value) });
			return value;
		}

		delete(rawKey) {
			const k = normalizeArrayKey(rawKey);
			const mk = arrayMapKey(k);
			const idx = this.indexMap.get(mk);
			if (idx === undefined) {
				return false;
			}
			this.entries.splice(idx, 1);
			this._reindexMap();
			if (this.pointer > idx && this.pointer > 0) {
				this.pointer--;
			}
			if (this.pointer >= this.entries.length) {
				this.pointer = this.entries.length > 0 ? this.entries.length - 1 : 0;
			}
			return true;
		}

		length() {
			return this.entries.length;
		}

		clone() {
			const copy = new BopArray();
			copy.nextIntKey = this.nextIntKey;
			copy.pointer = this.pointer;
			for (let i = 0; i < this.entries.length; i++) {
				const e = this.entries[i];
				const clonedCell = e.cell.isRef
					? e.cell
					: new BopCell(cloneBopValue(e.cell.value), false);
				copy.indexMap.set(arrayMapKey(e.key), copy.entries.length);
				copy.entries.push({ key: e.key, cell: clonedCell });
			}
			return copy;
		}

		isDenseList() {
			for (let i = 0; i < this.entries.length; i++) {
				if (this.entries[i].key !== i) {
					return false;
				}
			}
			return true;
		}

		toJs() {
			if (this.isDenseList()) {
				return this.entries.map(function(e) {
					return toJsValue(e.cell.value);
				});
			}
			const obj = {};
			for (let i = 0; i < this.entries.length; i++) {
				const e = this.entries[i];
				obj[String(e.key)] = toJsValue(e.cell.value);
			}
			return obj;
		}
	}

	let nextObjectHashSeq = 1;

	class BopClass {
		constructor(name) {
			this.name = name;
			this.parent = null;
			this.interfaces = [];
			this.isAbstract = false;
			this.isFinal = false;
			this.constants = new Map();
			this.staticProps = new Map();
			this.propDefs = new Map();
			this.methods = new Map();
		}

		isSubclassOf(targetName) {
			const target = String(targetName).toLowerCase();
			let cur = this;
			while (cur) {
				if (cur.name.toLowerCase() === target) return true;
				for (let i = 0; i < cur.interfaces.length; i++) {
					if (cur.interfaces[i].isSubclassOf(targetName)) return true;
				}
				cur = cur.parent;
			}
			return false;
		}

		getMethod(name) {
			const lc = String(name).toLowerCase();
			let cur = this;
			while (cur) {
				if (cur.methods.has(lc)) {
					return { owner: cur, method: cur.methods.get(lc) };
				}
				cur = cur.parent;
			}
			return null;
		}

		getConstant(name) {
			let cur = this;
			while (cur) {
				if (cur.constants.has(name)) {
					return { found: true, value: cur.constants.get(name) };
				}
				cur = cur.parent;
			}
			for (let i = 0; i < this.interfaces.length; i++) {
				const r = this.interfaces[i].getConstant(name);
				if (r.found) return r;
			}
			return { found: false, value: undefined };
		}

		getStaticPropCell(name) {
			let cur = this;
			while (cur) {
				if (cur.staticProps.has(name)) {
					return cur.staticProps.get(name);
				}
				cur = cur.parent;
			}
			return null;
		}
	}

	class BopObject {
		constructor(klass) {
			this.klass = klass;
			this.props = new Map();
			this.hashId = '00000000' + (nextObjectHashSeq++).toString(16).padStart(8, '0');
		}
	}

	class BopClosure {
		constructor(opts) {
			this.name = opts.name || '{closure}';
			this.params = opts.params || [];
			this.body = opts.body;
			this.useCells = opts.useCells || new Map();
			this.boundThis = opts.boundThis || null;
			this.boundClass = opts.boundClass || null;
			this.staticCells = new Map();
			this.file = opts.file || 'unknown';
			this.namespace = opts.namespace || '';
			this.returnsRef = Boolean(opts.returnsRef);
			this.isBuiltin = Boolean(opts.isBuiltin);
			this.jsFn = opts.jsFn || null;
		}
	}

	class BopResource {
		constructor(resourceType, data) {
			this.resourceType = String(resourceType || 'Unknown');
			this.data = data;
		}
	}

	class BopHostObject {
		constructor(target) {
			this.target = target;
		}
	}

	function cloneBopValue(val) {
		if (val instanceof BopArray) {
			return val.clone();
		}
		return val;
	}

	function toBool(val) {
		if (val === null || val === undefined || val === false) return false;
		if (val === true) return true;
		if (typeof val === 'number') return val !== 0 && !Number.isNaN(val);
		if (typeof val === 'string') return val !== '' && val !== '0';
		if (val instanceof BopArray) return val.length() > 0;
		if (val instanceof BopObject || val instanceof BopHostObject || val instanceof BopResource || val instanceof BopClosure) {
			return true;
		}
		return Boolean(val);
	}

	function parseLeadingNumber(str) {
		const m = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(str);
		if (!m) return 0;
		const n = Number(m[1]);
		return Number.isNaN(n) ? 0 : n;
	}

	function toNumber(val) {
		if (typeof val === 'number') return val;
		if (val === null || val === undefined || val === false) return 0;
		if (val === true) return 1;
		if (typeof val === 'string') return parseLeadingNumber(val);
		if (val instanceof BopArray) return val.length() > 0 ? 1 : 0;
		if (val instanceof BopResource) return 1;
		return 1;
	}

	function toInt(val) {
		if (typeof val === 'number') {
			if (!Number.isFinite(val)) return 0;
			return Math.trunc(val) || 0;
		}
		return Math.trunc(toNumber(val)) || 0;
	}

	function toFloat(val) {
		return toNumber(val);
	}

	function isNumericString(s) {
		return typeof s === 'string' && /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*$/.test(s);
	}

	function toBopString(val) {
		if (val === null || val === undefined || val === false) return '';
		if (val === true) return '1';
		if (typeof val === 'string') return val;
		if (typeof val === 'number') {
			if (Number.isNaN(val)) return 'NAN';
			if (val === Infinity) return 'INF';
			if (val === -Infinity) return '-INF';
			return String(val);
		}
		if (val instanceof BopArray) return 'Array';
		if (val instanceof BopHostObject) {
			if (val.target && typeof val.target.__toString === 'function') {
				return String(val.target.__toString());
			}
			return String(val.target);
		}
		if (val instanceof BopResource) return 'Resource';
		if (val instanceof BopObject) return 'Object(' + val.klass.name + ')';
		return String(val);
	}

	function toJsValue(val, engineRef = null) {
		if (val instanceof BopArray) {
			return val.toJs();
		}
		if (val instanceof BopHostObject) {
			return val.target;
		}
		if (val instanceof BopClosure && engineRef) {
			return function() {
				const jsArgs = Array.prototype.slice.call(arguments).map(fromJsValue);
				return makeDeferredPromise(engineRef._invokeCallable(val, jsArgs));
			};
		}
		return val;
	}

	function fromJsValue(val) {
		if (val === undefined || val === null) {
			return null;
		}
		if (val instanceof BopArray || val instanceof BopObject || val instanceof BopClosure || val instanceof BopResource || val instanceof BopHostObject) {
			return val;
		}
		if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
			return val;
		}
		if (Array.isArray(val)) {
			const arr = new BopArray();
			for (let i = 0; i < val.length; i++) {
				arr.push(fromJsValue(val[i]));
			}
			return arr;
		}
		if (typeof val === 'object') {
			const proto = Object.getPrototypeOf(val);
			if (proto === Object.prototype || proto === null) {
				const keys = Object.keys(val);
				const hasCallableMethod = Boolean(val.jquery) || keys.some(function(k) {
					return typeof val[k] === 'function';
				});
				if (!hasCallableMethod) {
					const arr = new BopArray();
					for (let i = 0; i < keys.length; i++) {
						arr.set(keys[i], fromJsValue(val[keys[i]]));
					}
					return arr;
				}
			}
			return new BopHostObject(val);
		}
		if (typeof val === 'function') {
			return new BopHostObject(val);
		}
		return val;
	}

	function bopStrictEq(a, b) {
		if (a === b) return true;
		if (a instanceof BopArray && b instanceof BopArray) {
			if (a.entries.length !== b.entries.length) return false;
			for (let i = 0; i < a.entries.length; i++) {
				const ea = a.entries[i];
				const eb = b.entries[i];
				if (ea.key !== eb.key || !bopStrictEq(ea.cell.value, eb.cell.value)) {
					return false;
				}
			}
			return true;
		}
		return false;
	}

	function bopLooseEq(a, b) {
		if (a === b) return true;
		if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
		if (a instanceof BopArray && b instanceof BopArray) {
			if (a.entries.length !== b.entries.length) return false;
			for (let i = 0; i < a.entries.length; i++) {
				const k = a.entries[i].key;
				if (!b.has(k) || !bopLooseEq(a.entries[i].cell.value, b.get(k))) {
					return false;
				}
			}
			return true;
		}
		if (a instanceof BopArray || b instanceof BopArray) return false;
		if (typeof a === 'boolean' || typeof b === 'boolean') {
			return toBool(a) === toBool(b);
		}
		if (a === null || b === null) {
			const other = a === null ? b : a;
			return other === '' || other === 0 || other === false;
		}
		if (typeof a === 'number' || typeof b === 'number') {
			if (typeof a === 'string' && !isNumericString(a)) return false;
			if (typeof b === 'string' && !isNumericString(b)) return false;
			return toNumber(a) == toNumber(b);
		}
		if (isNumericString(a) && isNumericString(b)) {
			return Number(a) === Number(b);
		}
		return String(a) === String(b);
	}

	function bopCompare(a, b) {
		if (bopLooseEq(a, b)) return 0;
		if (typeof a === 'boolean' || typeof b === 'boolean') {
			return toBool(a) < toBool(b) ? -1 : 1;
		}
		if (typeof a === 'number' || typeof b === 'number' || (isNumericString(a) && isNumericString(b))) {
			const na = toNumber(a);
			const nb = toNumber(b);
			return na < nb ? -1 : (na > nb ? 1 : 0);
		}
		const sa = toBopString(a);
		const sb = toBopString(b);
		return sa < sb ? -1 : (sa > sb ? 1 : 0);
	}

	// =========================================================================
	// 2. BOP Lexer (Tokenizer)
	// =========================================================================

	const KEYWORDS = new Set([
		'if', 'elseif', 'else', 'while', 'do', 'for', 'foreach', 'as',
		'switch', 'case', 'default', 'break', 'continue', 'return',
		'function', 'fn', 'use', 'global', 'static', 'const', 'class',
		'interface', 'abstract', 'final', 'extends', 'implements',
		'public', 'protected', 'private', 'new', 'clone', 'instanceof',
		'try', 'catch', 'finally', 'throw', 'echo', 'print',
		'include', 'include_once', 'require', 'require_once',
		'isset', 'empty', 'unset', 'list', 'array', 'eval',
		'die', 'exit', 'goto', 'and', 'or', 'xor', 'namespace',
		'true', 'false', 'null'
	]);

	function tokenizeBop(source) {
		const src = String(source ?? '');
		const len = src.length;
		const tokens = [];
		let i = 0;
		let line = 1;
		let inBop = false;

		function countNewlines(str) {
			let n = 0;
			for (let j = 0; j < str.length; j++) {
				if (str.charCodeAt(j) === 10) n++;
			}
			return n;
		}

		function emit(type, value, tokLine) {
			tokens.push({ type: type, value: value, line: tokLine });
		}

		function isIdentStart(ch) {
			return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch.charCodeAt(0) >= 128;
		}

		function isIdentPart(ch) {
			return isIdentStart(ch) || (ch >= '0' && ch <= '9');
		}

		function readSingleQuoted(startLine) {
			i++; // skip opening '
			let out = '';
			while (i < len) {
				const ch = src.charAt(i);
				if (ch === '\\' && i + 1 < len) {
					const next = src.charAt(i + 1);
					if (next === '\'' || next === '\\') {
						out += next;
						i += 2;
						continue;
					}
					out += '\\';
					i++;
					continue;
				}
				if (ch === '\'') {
					i++;
					emit('STRING', out, startLine);
					return;
				}
				if (ch === '\n') line++;
				out += ch;
				i++;
			}
			throw new SyntaxError('Unterminated single-quoted string starting at line ' + startLine);
		}

		function readDoubleQuoted(startLine) {
			i++; // skip opening "
			let raw = '';
			while (i < len) {
				const ch = src.charAt(i);
				if (ch === '\\' && i + 1 < len) {
					raw += ch + src.charAt(i + 1);
					if (src.charAt(i + 1) === '\n') line++;
					i += 2;
					continue;
				}
				if (ch === '"') {
					i++;
					emit('DSTRING', raw, startLine);
					return;
				}
				if (ch === '\n') line++;
				raw += ch;
				i++;
			}
			throw new SyntaxError('Unterminated double-quoted string starting at line ' + startLine);
		}

		function readHeredoc(startLine) {
			i += 3; // skip <<<
			while (i < len && (src.charAt(i) === ' ' || src.charAt(i) === '\t')) i++;
			let quoteChar = null;
			if (src.charAt(i) === '\'' || src.charAt(i) === '"') {
				quoteChar = src.charAt(i);
				i++;
			}
			let label = '';
			while (i < len && isIdentPart(src.charAt(i))) {
				label += src.charAt(i);
				i++;
			}
			if (!label) {
				throw new SyntaxError('Invalid heredoc/nowdoc delimiter at line ' + startLine);
			}
			if (quoteChar) {
				if (src.charAt(i) !== quoteChar) {
					throw new SyntaxError('Unterminated heredoc quote at line ' + startLine);
				}
				i++;
			}
			while (i < len && src.charAt(i) !== '\n') i++;
			if (i < len && src.charAt(i) === '\n') {
				i++;
				line++;
			}
			let body = '';
			while (i < len) {
				let lineEnd = src.indexOf('\n', i);
				if (lineEnd === -1) lineEnd = len;
				let curLine = src.slice(i, lineEnd);
				if (curLine.endsWith('\r')) curLine = curLine.slice(0, -1);
				const closeMatch = new RegExp('^\\s*' + label + '(?=;|$)').exec(curLine);
				if (closeMatch && curLine.slice(closeMatch[0].length).replace(/[ \t;]/g, '') === '') {
					i += closeMatch[0].length;
					if (body.endsWith('\n')) body = body.slice(0, -1);
					if (quoteChar === '\'') {
						emit('STRING', body, startLine);
					} else {
						emit('DSTRING', body, startLine);
					}
					return;
				}
				body += curLine + (lineEnd < len ? '\n' : '');
				i = lineEnd < len ? lineEnd + 1 : len;
				if (lineEnd < len) line++;
			}
			throw new SyntaxError('Unterminated heredoc <<<' + label + ' at line ' + startLine);
		}

		while (i < len) {
			if (!inBop) {
				const openIdx = src.indexOf('<?', i);
				if (openIdx === -1) {
					const tail = src.slice(i);
					if (tail.length > 0) {
						emit('INLINE', tail, line);
						line += countNewlines(tail);
					}
					break;
				}
				if (openIdx > i) {
					const chunk = src.slice(i, openIdx);
					emit('INLINE', chunk, line);
					line += countNewlines(chunk);
				}
				i = openIdx;
				if (src.slice(i, i + 5).toLowerCase() === '<?bop') {
					const after = src.charAt(i + 5);
					if (!after || /\s/.test(after) || (after === '?' && src.charAt(i + 6) === '>')) {
						i += 5;
						inBop = true;
						continue;
					}
				}
				if (src.slice(i, i + 3) === '<?=') {
					emit('SHORT_ECHO', '<?=', line);
					i += 3;
					inBop = true;
					continue;
				}
				// Plain literal '<?' text outside <?bop
				emit('INLINE', '<?', line);
				i += 2;
				continue;
			}

			// Inside BOP code
			const ch = src.charAt(i);
			if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
				if (ch === '\n') line++;
				i++;
				continue;
			}

			// Closing tag
			if (ch === '?' && src.charAt(i + 1) === '>') {
				emit('CLOSE_TAG', '?>', line);
				i += 2;
				if (src.charAt(i) === '\r' && src.charAt(i + 1) === '\n') {
					i += 2;
					line++;
				} else if (src.charAt(i) === '\n') {
					i++;
					line++;
				}
				inBop = false;
				continue;
			}

			// Line comments // or #
			if (ch === '#' || (ch === '/' && src.charAt(i + 1) === '/')) {
				i += (ch === '#') ? 1 : 2;
				while (i < len) {
					if (src.charAt(i) === '?' && src.charAt(i + 1) === '>') {
						break;
					}
					if (src.charAt(i) === '\n') {
						line++;
						i++;
						break;
					}
					i++;
				}
				continue;
			}

			// Block comment /* ... */
			if (ch === '/' && src.charAt(i + 1) === '*') {
				const startLine = line;
				i += 2;
				const endIdx = src.indexOf('*/', i);
				if (endIdx === -1) {
					throw new SyntaxError('Unterminated block comment at line ' + startLine);
				}
				line += countNewlines(src.slice(i, endIdx));
				i = endIdx + 2;
				continue;
			}

			// Binary string b"..." / b'...'
			if ((ch === 'b' || ch === 'B') && (src.charAt(i + 1) === '"' || src.charAt(i + 1) === '\'')) {
				const startLine = line;
				i++;
				if (src.charAt(i) === '\'') readSingleQuoted(startLine);
				else readDoubleQuoted(startLine);
				continue;
			}

			// Heredoc / Nowdoc <<<
			if (ch === '<' && src.charAt(i + 1) === '<' && src.charAt(i + 2) === '<') {
				readHeredoc(line);
				continue;
			}

			// Strings
			if (ch === '\'') {
				readSingleQuoted(line);
				continue;
			}
			if (ch === '"') {
				readDoubleQuoted(line);
				continue;
			}

			// Variables $name
			if (ch === '$') {
				const startLine = line;
				i++;
				let name = '';
				while (i < len && isIdentPart(src.charAt(i))) {
					name += src.charAt(i);
					i++;
				}
				if (name) {
					emit('VAR', name, startLine);
				} else {
					emit('OP', '$', startLine);
				}
				continue;
			}

			// Numbers
			if ((ch >= '0' && ch <= '9') || (ch === '.' && src.charAt(i + 1) >= '0' && src.charAt(i + 1) <= '9')) {
				const startLine = line;
				let m;
				if (ch === '0' && (src.charAt(i + 1) === 'x' || src.charAt(i + 1) === 'X')) {
					m = /^0[xX][0-9a-fA-F_]+/.exec(src.slice(i));
					i += m[0].length;
					emit('NUMBER', parseInt(m[0].replace(/_/g, ''), 16), startLine);
					continue;
				}
				if (ch === '0' && (src.charAt(i + 1) === 'b' || src.charAt(i + 1) === 'B')) {
					m = /^0[bB][01_]+/.exec(src.slice(i));
					i += m[0].length;
					emit('NUMBER', parseInt(m[0].slice(2).replace(/_/g, ''), 2), startLine);
					continue;
				}
				if (ch === '0' && (src.charAt(i + 1) === 'o' || src.charAt(i + 1) === 'O')) {
					m = /^0[oO][0-7_]+/.exec(src.slice(i));
					i += m[0].length;
					emit('NUMBER', parseInt(m[0].slice(2).replace(/_/g, ''), 8), startLine);
					continue;
				}
				m = /^(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?/.exec(src.slice(i));
				const rawNum = m[0].replace(/_/g, '');
				i += m[0].length;
				if (!/[.eE]/.test(rawNum) && rawNum.length > 1 && rawNum.startsWith('0') && /^[0-7]+$/.test(rawNum)) {
					emit('NUMBER', parseInt(rawNum, 8), startLine);
				} else {
					emit('NUMBER', Number(rawNum), startLine);
				}
				continue;
			}

			// Identifiers & Keywords
			if (isIdentStart(ch)) {
				const startLine = line;
				let word = '';
				while (i < len && isIdentPart(src.charAt(i))) {
					word += src.charAt(i);
					i++;
				}
				const lower = word.toLowerCase();
				if (KEYWORDS.has(lower)) {
					emit('KW', lower, startLine);
				} else {
					emit('IDENT', word, startLine);
				}
				continue;
			}

			// Multi-character operators
			const three = src.slice(i, i + 3);
			if (three === '===' || three === '!==' || three === '<=>' || three === '<<=' || three === '>>=' || three === '**=' || three === '??=') {
				emit('OP', three, line);
				i += 3;
				continue;
			}
			const two = src.slice(i, i + 2);
			if (
				two === '==' || two === '!=' || two === '<>' || two === '<=' || two === '>=' ||
				two === '&&' || two === '||' || two === '??' || two === '->' || two === '::' ||
				two === '=>' || two === '++' || two === '--' || two === '**' || two === '<<' ||
				two === '>>' || two === '+=' || two === '-=' || two === '*=' || two === '/=' ||
				two === '%=' || two === '.=' || two === '&=' || two === '|=' || two === '^='
			) {
				emit('OP', two === '<>' ? '!=' : two, line);
				i += 2;
				continue;
			}

			// Single character punctuation / operators
			emit('OP', ch, line);
			i++;
		}

		emit('EOF', '', line);
		return tokens;
	}

	// =========================================================================
	// 3. Interpolated Double-Quoted String Parser
	// =========================================================================

	function unescapeDoubleQuotedLiteral(raw) {
		let out = '';
		for (let i = 0; i < raw.length; i++) {
			const ch = raw.charAt(i);
			if (ch !== '\\' || i + 1 >= raw.length) {
				out += ch;
				continue;
			}
			const next = raw.charAt(i + 1);
			if (next === 'n') { out += '\n'; i++; }
			else if (next === 'r') { out += '\r'; i++; }
			else if (next === 't') { out += '\t'; i++; }
			else if (next === 'v') { out += '\v'; i++; }
			else if (next === 'f') { out += '\f'; i++; }
			else if (next === 'e') { out += '\x1b'; i++; }
			else if (next === '\\') { out += '\\'; i++; }
			else if (next === '"') { out += '"'; i++; }
			else if (next === '$') { out += '$'; i++; }
			else if (next === 'x') {
				const m = /^[0-9a-fA-F]{1,2}/.exec(raw.slice(i + 2));
				if (m) {
					out += String.fromCharCode(parseInt(m[0], 16));
					i += 1 + m[0].length;
				} else {
					out += '\\x';
					i++;
				}
			} else if (next === 'u' && raw.charAt(i + 2) === '{') {
				const m = /^\{([0-9a-fA-F]+)\}/.exec(raw.slice(i + 2));
				if (m) {
					out += String.fromCodePoint(parseInt(m[1], 16));
					i += 1 + m[0].length;
				} else {
					out += '\\u';
					i++;
				}
			} else if (next >= '0' && next <= '7') {
				const m = /^[0-7]{1,3}/.exec(raw.slice(i + 1));
				out += String.fromCharCode(parseInt(m[0], 8) & 255);
				i += m[0].length;
			} else {
				out += '\\' + next;
				i++;
			}
		}
		return out;
	}

	function parseDoubleStringParts(raw, startLine) {
		const parts = [];
		let buf = '';
		let i = 0;
		const len = raw.length;

		function flushBuf() {
			if (buf.length > 0) {
				parts.push({ type: 'Literal', value: unescapeDoubleQuotedLiteral(buf), line: startLine });
				buf = '';
			}
		}

		while (i < len) {
			const ch = raw.charAt(i);
			if (ch === '\\' && i + 1 < len) {
				buf += ch + raw.charAt(i + 1);
				i += 2;
				continue;
			}
			// Complex {$expr}
			if (ch === '{' && raw.charAt(i + 1) === '$') {
				flushBuf();
				let depth = 1;
				let j = i + 1;
				let quote = null;
				while (j < len && depth > 0) {
					const c = raw.charAt(j);
					if (quote) {
						if (c === '\\') { j += 2; continue; }
						if (c === quote) quote = null;
					} else {
						if (c === '\'' || c === '"') quote = c;
						else if (c === '{') depth++;
						else if (c === '}') depth--;
					}
					j++;
				}
				const exprSrc = raw.slice(i + 1, j - 1);
				const exprAst = parseBopExpressionString(exprSrc, startLine);
				parts.push(exprAst);
				i = j;
				continue;
			}
			// Simple $var, $var[k], $var->prop, ${var}
			if (ch === '$') {
				if (raw.charAt(i + 1) === '{') {
					const close = raw.indexOf('}', i + 2);
					if (close !== -1) {
						flushBuf();
						const inner = raw.slice(i + 2, close).trim();
						parts.push(parseBopExpressionString('$' + inner, startLine));
						i = close + 1;
						continue;
					}
				}
				const vm = /^([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/.exec(raw.slice(i + 1));
				if (vm) {
					flushBuf();
					let exprSrc = '$' + vm[1];
					let adv = 1 + vm[1].length;
					const rest = raw.slice(i + adv);
					const propM = /^->([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/.exec(rest);
					const idxM = /^\[([^\]]+)\]/.exec(rest);
					if (propM) {
						exprSrc += propM[0];
						adv += propM[0].length;
					} else if (idxM) {
						let idxKey = idxM[1].trim();
						if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(idxKey)) {
							idxKey = JSON.stringify(idxKey);
						}
						exprSrc += '[' + idxKey + ']';
						adv += idxM[0].length;
					}
					parts.push(parseBopExpressionString(exprSrc, startLine));
					i += adv;
					continue;
				}
			}
			buf += ch;
			i++;
		}
		flushBuf();
		if (parts.length === 0) {
			return { type: 'Literal', value: '', line: startLine };
		}
		if (parts.length === 1 && parts[0].type === 'Literal') {
			return parts[0];
		}
		return { type: 'InterpolatedString', parts: parts, line: startLine };
	}

	function parseBopExpressionString(exprSrc, line) {
		const toks = tokenizeBop('<?bop ' + exprSrc + ';');
		const p = new BopParser(toks, '<interp>');
		const stmts = p.parseProgram();
		if (stmts.body.length > 0 && stmts.body[0].type === 'ExprStmt') {
			return stmts.body[0].expr;
		}
		return { type: 'Literal', value: '', line: line };
	}

	// =========================================================================
	// 4. BOP Recursive-Descent Parser
	// =========================================================================

	const CAST_NAMES = new Set([
		'int', 'float', 'string', 'bool', 'array', 'object', 'unset'
	]);

	class BopParser {
		constructor(tokens, filePath = 'unknown') {
			this.tokens = tokens;
			this.pos = 0;
			this.filePath = filePath;
		}

		peek(offset = 0) {
			const idx = this.pos + offset;
			return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
		}

		advance() {
			const tok = this.peek();
			if (this.pos < this.tokens.length - 1) this.pos++;
			return tok;
		}

		match(type, value = null) {
			const tok = this.peek();
			if (tok.type !== type) return false;
			if (value !== null && tok.value !== value) return false;
			this.advance();
			return tok;
		}

		expect(type, value = null) {
			const tok = this.peek();
			if (tok.type !== type || (value !== null && tok.value !== value)) {
				const got = tok.type === 'EOF' ? 'end of input' : JSON.stringify(tok.value);
				const exp = value !== null ? JSON.stringify(value) : type;
				throw new SyntaxError(`BOP Parse error: syntax error, unexpected ${got}, expecting ${exp} in ${this.filePath} on line ${tok.line}`);
			}
			return this.advance();
		}

		check(type, value = null) {
			const tok = this.peek();
			if (tok.type !== type) return false;
			if (value !== null && tok.value !== value) return false;
			return true;
		}

		consumeStmtTerminator() {
			if (this.match('OP', ';')) return true;
			if (this.match('CLOSE_TAG')) return true;
			if (this.check('EOF')) return true;
			return false;
		}

		expectStmtTerminator() {
			if (this.consumeStmtTerminator()) return;
			const tok = this.peek();
			const got = tok.type === 'EOF' ? 'end of input' : JSON.stringify(tok.value);
			throw new SyntaxError(`BOP Parse error: syntax error, unexpected ${got}, expecting ";" in ${this.filePath} on line ${tok.line}`);
		}

		parseProgram() {
			const body = [];
			while (!this.check('EOF')) {
				if (this.match('CLOSE_TAG') || this.match('OP', ';')) {
					continue;
				}
				body.push(this.parseStatement());
			}
			return { type: 'Program', body: body, file: this.filePath };
		}

		parseBlock() {
			const tok = this.expect('OP', '{');
			const body = [];
			while (!this.check('EOF') && !this.check('OP', '}')) {
				if (this.match('CLOSE_TAG') || this.match('OP', ';')) {
					continue;
				}
				body.push(this.parseStatement());
			}
			this.expect('OP', '}');
			return { type: 'Block', body: body, line: tok.line };
		}

		parseStatement() {
			const tok = this.peek();

			if (tok.type === 'INLINE') {
				this.advance();
				return { type: 'InlineText', value: tok.value, line: tok.line };
			}

			if (tok.type === 'SHORT_ECHO') {
				this.advance();
				const exprs = [this.parseExpression()];
				while (this.match('OP', ',')) {
					exprs.push(this.parseExpression());
				}
				this.expectStmtTerminator();
				return { type: 'Echo', exprs: exprs, line: tok.line };
			}

			if (tok.type === 'CLOSE_TAG' || (tok.type === 'OP' && tok.value === ';')) {
				this.advance();
				return { type: 'EmptyStmt', line: tok.line };
			}

			if (tok.type === 'OP' && tok.value === '{') {
				return this.parseBlock();
			}

			if (tok.type === 'KW') {
				switch (tok.value) {
					case 'namespace': return this.parseNamespace();
					case 'use': return this.parseUse();
					case 'const': return this.parseConstDecl();
					case 'function': return this.parseFunctionDecl();
					case 'class':
					case 'abstract':
					case 'final':
						if (tok.value === 'class' || this.peek(1).value === 'class' || this.peek(2).value === 'class') {
							return this.parseClassDecl();
						}
						break;
					case 'interface': return this.parseInterfaceDecl();
					case 'if': return this.parseIf();
					case 'switch': return this.parseSwitch();
					case 'while': return this.parseWhile();
					case 'do': return this.parseDoWhile();
					case 'for': return this.parseFor();
					case 'foreach': return this.parseForeach();
					case 'break': return this.parseBreakContinue('Break');
					case 'continue': return this.parseBreakContinue('Continue');
					case 'return': return this.parseReturn();
					case 'throw': return this.parseThrow();
					case 'try': return this.parseTry();
					case 'goto': return this.parseGoto();
					case 'global': return this.parseGlobal();
					case 'static':
						if (this.peek(1).type === 'VAR') {
							return this.parseStaticVar();
						}
						break;
					case 'echo': return this.parseEcho();
					case 'unset': return this.parseUnset();
				}
			}

			// Label `label:`
			if (tok.type === 'IDENT' && this.peek(1).type === 'OP' && this.peek(1).value === ':') {
				this.advance();
				this.advance();
				return { type: 'Label', name: tok.value, line: tok.line };
			}

			const expr = this.parseExpression();
			this.expectStmtTerminator();
			return { type: 'ExprStmt', expr: expr, line: tok.line };
		}

		parseQualifiedName() {
			let leading = false;
			if (this.match('OP', '\\')) leading = true;
			const parts = [];
			const first = this.peek();
			if (first.type === 'IDENT' || first.type === 'KW') {
				parts.push(this.advance().value);
			} else {
				throw new SyntaxError(`BOP Parse error: expected identifier in ${this.filePath} on line ${first.line}`);
			}
			while (this.match('OP', '\\')) {
				const seg = this.peek();
				if (seg.type === 'IDENT' || seg.type === 'KW') {
					parts.push(this.advance().value);
				} else {
					break;
				}
			}
			return (leading ? '\\' : '') + parts.join('\\');
		}

		parseNamespace() {
			const tok = this.advance();
			let name = '';
			if (!this.check('OP', ';') && !this.check('OP', '{')) {
				name = this.parseQualifiedName();
			}
			if (this.check('OP', '{')) {
				const block = this.parseBlock();
				return { type: 'Namespace', name: name, body: block.body, line: tok.line };
			}
			this.expectStmtTerminator();
			return { type: 'Namespace', name: name, body: null, line: tok.line };
		}

		parseUse() {
			const tok = this.advance();
			const imports = [];
			do {
				const path = this.parseQualifiedName();
				let alias = null;
				if (this.match('KW', 'as')) {
					alias = this.expect('IDENT').value;
				} else {
					const segs = path.split('\\');
					alias = segs[segs.length - 1];
				}
				imports.push({ path: path, alias: alias });
			} while (this.match('OP', ','));
			this.expectStmtTerminator();
			return { type: 'Use', imports: imports, line: tok.line };
		}

		parseConstDecl() {
			const tok = this.advance();
			const items = [];
			do {
				const name = this.expect('IDENT').value;
				this.expect('OP', '=');
				const value = this.parseExpression();
				items.push({ name: name, value: value });
			} while (this.match('OP', ','));
			this.expectStmtTerminator();
			return { type: 'ConstDecl', items: items, line: tok.line };
		}

		parseFunctionParams() {
			this.expect('OP', '(');
			const params = [];
			while (!this.check('OP', ')') && !this.check('EOF')) {
				// Optional type hint (e.g., array, callable, int, ?Type, ClassName)
				if (this.check('OP', '?')) this.advance();
				if (!this.check('VAR') && !this.check('OP', '&')) {
					if (this.check('IDENT') || (this.check('KW') && (this.peek().value === 'array' || this.peek().value === 'callable'))) {
						this.parseQualifiedName();
					}
				}
				const byRef = Boolean(this.match('OP', '&'));
				const name = this.expect('VAR').value;
				let defaultExpr = null;
				if (this.match('OP', '=')) {
					defaultExpr = this.parseExpression();
				}
				params.push({ name: name, byRef: byRef, defaultExpr: defaultExpr });
				if (!this.match('OP', ',')) break;
			}
			this.expect('OP', ')');
			// Optional return type `: Type`
			if (this.match('OP', ':')) {
				if (this.check('OP', '?')) this.advance();
				this.parseQualifiedName();
			}
			return params;
		}

		parseFunctionDecl() {
			const tok = this.advance(); // 'function'
			const returnsRef = Boolean(this.match('OP', '&'));
			const name = this.expect('IDENT').value;
			const params = this.parseFunctionParams();
			const block = this.parseBlock();
			return {
				type: 'FunctionDecl',
				name: name,
				returnsRef: returnsRef,
				params: params,
				body: block,
				line: tok.line
			};
		}

		parseInterfaceDecl() {
			const tok = this.advance(); // 'interface'
			const name = this.expect('IDENT').value;
			const ext = [];
			if (this.match('KW', 'extends')) {
				do {
					ext.push(this.parseQualifiedName());
				} while (this.match('OP', ','));
			}
			this.expect('OP', '{');
			const constants = [];
			const methods = [];
			while (!this.check('OP', '}') && !this.check('EOF')) {
				if (this.match('OP', ';')) continue;
				while (this.check('KW', 'public') || this.check('KW', 'static') || this.check('KW', 'abstract')) {
					this.advance();
				}
				if (this.match('KW', 'const')) {
					const cname = this.expect('IDENT').value;
					this.expect('OP', '=');
					const cval = this.parseExpression();
					this.expect('OP', ';');
					constants.push({ name: cname, value: cval });
				} else if (this.match('KW', 'function')) {
					const returnsRef = Boolean(this.match('OP', '&'));
					const mname = this.expect('IDENT').value;
					const params = this.parseFunctionParams();
					this.expect('OP', ';');
					methods.push({ name: mname, returnsRef: returnsRef, params: params, isAbstract: true, visibility: 'public' });
				} else {
					this.advance();
				}
			}
			this.expect('OP', '}');
			return { type: 'InterfaceDecl', name: name, extends: ext, constants: constants, methods: methods, line: tok.line };
		}

		parseClassDecl() {
			const startTok = this.peek();
			let isAbstract = false;
			let isFinal = false;
			while (this.check('KW', 'abstract') || this.check('KW', 'final')) {
				const kw = this.advance().value;
				if (kw === 'abstract') isAbstract = true;
				if (kw === 'final') isFinal = true;
			}
			this.expect('KW', 'class');
			const name = this.expect('IDENT').value;
			let parent = null;
			if (this.match('KW', 'extends')) {
				parent = this.parseQualifiedName();
			}
			const interfaces = [];
			if (this.match('KW', 'implements')) {
				do {
					interfaces.push(this.parseQualifiedName());
				} while (this.match('OP', ','));
			}
			this.expect('OP', '{');
			const constants = [];
			const properties = [];
			const methods = [];

			while (!this.check('OP', '}') && !this.check('EOF')) {
				if (this.match('OP', ';')) continue;
				let visibility = 'public';
				let isStatic = false;
				let mAbstract = false;
				let mFinal = false;
				while (this.check('KW') && (
					this.peek().value === 'public' || this.peek().value === 'protected' ||
					this.peek().value === 'private' || this.peek().value === 'static' ||
					this.peek().value === 'abstract' || this.peek().value === 'final'
				)) {
					const mod = this.advance().value;
					if (mod === 'public' || mod === 'protected' || mod === 'private') visibility = mod;
					if (mod === 'static') isStatic = true;
					if (mod === 'abstract') mAbstract = true;
					if (mod === 'final') mFinal = true;
				}
				if (this.match('KW', 'const')) {
					do {
						const cname = this.expect('IDENT').value;
						this.expect('OP', '=');
						const cval = this.parseExpression();
						constants.push({ name: cname, value: cval });
					} while (this.match('OP', ','));
					this.expect('OP', ';');
				} else if (this.match('KW', 'function')) {
					const returnsRef = Boolean(this.match('OP', '&'));
					const mtok = this.peek();
					const mname = (mtok.type === 'IDENT' || mtok.type === 'KW') ? this.advance().value : this.expect('IDENT').value;
					const params = this.parseFunctionParams();
					let body = null;
					if (this.match('OP', ';')) {
						mAbstract = true;
					} else {
						body = this.parseBlock();
					}
					methods.push({
						name: mname,
						visibility: visibility,
						isStatic: isStatic,
						isAbstract: mAbstract,
						isFinal: mFinal,
						returnsRef: returnsRef,
						params: params,
						body: body
					});
				} else if (this.check('VAR')) {
					do {
						const pname = this.expect('VAR').value;
						let defaultExpr = null;
						if (this.match('OP', '=')) {
							defaultExpr = this.parseExpression();
						}
						properties.push({ name: pname, visibility: visibility, isStatic: isStatic, defaultExpr: defaultExpr });
					} while (this.match('OP', ','));
					this.expect('OP', ';');
				} else {
					throw new SyntaxError(`BOP Parse error: unexpected ${JSON.stringify(this.peek().value)} in class ${name} in ${this.filePath} on line ${this.peek().line}`);
				}
			}
			this.expect('OP', '}');
			return {
				type: 'ClassDecl',
				name: name,
				isAbstract: isAbstract,
				isFinal: isFinal,
				parent: parent,
				interfaces: interfaces,
				constants: constants,
				properties: properties,
				methods: methods,
				line: startTok.line
			};
		}

		parseIf() {
			const tok = this.advance(); // 'if'
			this.expect('OP', '(');
			const test = this.parseExpression();
			this.expect('OP', ')');
			const consequent = this.parseStatement();
			let alternate = null;
			if (this.check('KW', 'elseif')) {
				alternate = this.parseIf();
			} else if (this.match('KW', 'else')) {
				alternate = this.parseStatement();
			}
			return { type: 'If', test: test, consequent: consequent, alternate: alternate, line: tok.line };
		}

		parseSwitch() {
			const tok = this.advance();
			this.expect('OP', '(');
			const disc = this.parseExpression();
			this.expect('OP', ')');
			this.expect('OP', '{');
			const cases = [];
			while (!this.check('OP', '}') && !this.check('EOF')) {
				if (this.match('KW', 'case')) {
					const test = this.parseExpression();
					if (!this.match('OP', ':')) this.expect('OP', ';');
					const body = [];
					while (!this.check('KW', 'case') && !this.check('KW', 'default') && !this.check('OP', '}') && !this.check('EOF')) {
						body.push(this.parseStatement());
					}
					cases.push({ test: test, body: body });
				} else if (this.match('KW', 'default')) {
					if (!this.match('OP', ':')) this.expect('OP', ';');
					const body = [];
					while (!this.check('KW', 'case') && !this.check('KW', 'default') && !this.check('OP', '}') && !this.check('EOF')) {
						body.push(this.parseStatement());
					}
					cases.push({ test: null, body: body });
				} else {
					this.advance();
				}
			}
			this.expect('OP', '}');
			return { type: 'Switch', discriminant: disc, cases: cases, line: tok.line };
		}

		parseWhile() {
			const tok = this.advance();
			this.expect('OP', '(');
			const test = this.parseExpression();
			this.expect('OP', ')');
			const body = this.parseStatement();
			return { type: 'While', test: test, body: body, line: tok.line };
		}

		parseDoWhile() {
			const tok = this.advance();
			const body = this.parseStatement();
			this.expect('KW', 'while');
			this.expect('OP', '(');
			const test = this.parseExpression();
			this.expect('OP', ')');
			this.expectStmtTerminator();
			return { type: 'DoWhile', body: body, test: test, line: tok.line };
		}

		parseExprList() {
			if (this.check('OP', ';') || this.check('OP', ')')) return [];
			const list = [this.parseExpression()];
			while (this.match('OP', ',')) {
				list.push(this.parseExpression());
			}
			return list;
		}

		parseFor() {
			const tok = this.advance();
			this.expect('OP', '(');
			const init = this.parseExprList();
			this.expect('OP', ';');
			const test = this.parseExprList();
			this.expect('OP', ';');
			const update = this.parseExprList();
			this.expect('OP', ')');
			const body = this.parseStatement();
			return { type: 'For', init: init, test: test, update: update, body: body, line: tok.line };
		}

		parseForeach() {
			const tok = this.advance();
			this.expect('OP', '(');
			const iterable = this.parseExpression();
			this.expect('KW', 'as');
			let keyVar = null;
			let byRef = Boolean(this.match('OP', '&'));
			const firstVar = this.parsePostfixAssignable();
			let valueVar = firstVar;
			if (this.match('OP', '=>')) {
				if (byRef) {
					throw new SyntaxError(`BOP Parse error: key cannot be passed by reference in ${this.filePath} on line ${tok.line}`);
				}
				keyVar = firstVar;
				byRef = Boolean(this.match('OP', '&'));
				valueVar = this.parsePostfixAssignable();
			}
			this.expect('OP', ')');
			const body = this.parseStatement();
			return {
				type: 'Foreach',
				iterable: iterable,
				keyVar: keyVar,
				valueVar: valueVar,
				byRef: byRef,
				body: body,
				line: tok.line
			};
		}

		parseBreakContinue(kind) {
			const tok = this.advance();
			let levels = 1;
			if (!this.check('OP', ';') && !this.check('CLOSE_TAG') && !this.check('EOF')) {
				const expr = this.parseExpression();
				if (expr.type === 'Literal' && typeof expr.value === 'number') {
					levels = Math.max(1, Math.trunc(expr.value));
				}
			}
			this.expectStmtTerminator();
			return { type: kind, levels: levels, line: tok.line };
		}

		parseReturn() {
			const tok = this.advance();
			let argument = null;
			if (!this.check('OP', ';') && !this.check('CLOSE_TAG') && !this.check('EOF')) {
				argument = this.parseExpression();
			}
			this.expectStmtTerminator();
			return { type: 'Return', argument: argument, line: tok.line };
		}

		parseThrow() {
			const tok = this.advance();
			const argument = this.parseExpression();
			this.expectStmtTerminator();
			return { type: 'Throw', argument: argument, line: tok.line };
		}

		parseTry() {
			const tok = this.advance();
			const block = this.parseBlock();
			const catches = [];
			while (this.match('KW', 'catch')) {
				this.expect('OP', '(');
				const types = [this.parseQualifiedName()];
				while (this.match('OP', '|')) {
					types.push(this.parseQualifiedName());
				}
				const varName = this.expect('VAR').value;
				this.expect('OP', ')');
				const catchBlock = this.parseBlock();
				catches.push({ types: types, varName: varName, block: catchBlock });
			}
			let finalizer = null;
			if (this.match('KW', 'finally')) {
				finalizer = this.parseBlock();
			}
			return { type: 'Try', block: block, catches: catches, finalizer: finalizer, line: tok.line };
		}

		parseGoto() {
			const tok = this.advance();
			const label = this.expect('IDENT').value;
			this.expectStmtTerminator();
			return { type: 'Goto', label: label, line: tok.line };
		}

		parseGlobal() {
			const tok = this.advance();
			const vars = [];
			do {
				vars.push(this.expect('VAR').value);
			} while (this.match('OP', ','));
			this.expectStmtTerminator();
			return { type: 'Global', vars: vars, line: tok.line };
		}

		parseStaticVar() {
			const tok = this.advance(); // 'static'
			const items = [];
			do {
				const name = this.expect('VAR').value;
				let init = null;
				if (this.match('OP', '=')) {
					init = this.parseExpression();
				}
				items.push({ name: name, init: init });
			} while (this.match('OP', ','));
			this.expectStmtTerminator();
			return { type: 'StaticVar', items: items, line: tok.line };
		}

		parseEcho() {
			const tok = this.advance();
			const exprs = [this.parseExpression()];
			while (this.match('OP', ',')) {
				exprs.push(this.parseExpression());
			}
			this.expectStmtTerminator();
			return { type: 'Echo', exprs: exprs, line: tok.line };
		}

		parseUnset() {
			const tok = this.advance();
			this.expect('OP', '(');
			const targets = [];
			if (!this.check('OP', ')')) {
				do {
					targets.push(this.parseExpression());
				} while (this.match('OP', ','));
			}
			this.expect('OP', ')');
			this.expectStmtTerminator();
			return { type: 'Unset', targets: targets, line: tok.line };
		}

		// --- Expressions ---

		parseExpression() {
			return this.parseLogicalWordOr();
		}

		parseLogicalWordOr() {
			let left = this.parseLogicalWordXor();
			while (this.check('KW', 'or')) {
				const tok = this.advance();
				const right = this.parseLogicalWordXor();
				left = { type: 'Binary', op: '||', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseLogicalWordXor() {
			let left = this.parseLogicalWordAnd();
			while (this.check('KW', 'xor')) {
				const tok = this.advance();
				const right = this.parseLogicalWordAnd();
				left = { type: 'Binary', op: 'xor', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseLogicalWordAnd() {
			let left = this.parseAssignment();
			while (this.check('KW', 'and')) {
				const tok = this.advance();
				const right = this.parseAssignment();
				left = { type: 'Binary', op: '&&', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseAssignment() {
			const expr = this.parseTernary();
			const tok = this.peek();
			if (tok.type === 'OP' && (
				tok.value === '=' || tok.value === '+=' || tok.value === '-=' || tok.value === '*=' ||
				tok.value === '/=' || tok.value === '%=' || tok.value === '**=' || tok.value === '.=' ||
				tok.value === '&=' || tok.value === '|=' || tok.value === '^=' || tok.value === '<<=' ||
				tok.value === '>>=' || tok.value === '??='
			)) {
				this.advance();
				if (tok.value === '=' && this.match('OP', '&')) {
					const right = this.parseAssignment();
					return { type: 'AssignRef', left: expr, right: right, line: tok.line };
				}
				const right = this.parseAssignment();
				if (tok.value === '=') {
					return { type: 'Assign', left: expr, right: right, line: tok.line };
				}
				return { type: 'CompoundAssign', op: tok.value.slice(0, -1), left: expr, right: right, line: tok.line };
			}
			return expr;
		}

		parseTernary() {
			let expr = this.parseNullCoalesce();
			while (this.check('OP', '?')) {
				const tok = this.advance();
				let consequent = null;
				if (!this.check('OP', ':')) {
					consequent = this.parseExpression();
				}
				this.expect('OP', ':');
				const alternate = this.parseTernary();
				expr = { type: 'Conditional', test: expr, consequent: consequent, alternate: alternate, line: tok.line };
			}
			return expr;
		}

		parseNullCoalesce() {
			const left = this.parseLogicalOr();
			if (this.check('OP', '??')) {
				const tok = this.advance();
				const right = this.parseNullCoalesce();
				return { type: 'NullCoalesce', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseLogicalOr() {
			let left = this.parseLogicalAnd();
			while (this.check('OP', '||')) {
				const tok = this.advance();
				left = { type: 'Binary', op: '||', left: left, right: this.parseLogicalAnd(), line: tok.line };
			}
			return left;
		}

		parseLogicalAnd() {
			let left = this.parseBitOr();
			while (this.check('OP', '&&')) {
				const tok = this.advance();
				left = { type: 'Binary', op: '&&', left: left, right: this.parseBitOr(), line: tok.line };
			}
			return left;
		}

		parseBitOr() {
			let left = this.parseBitXor();
			while (this.check('OP', '|')) {
				const tok = this.advance();
				left = { type: 'Binary', op: '|', left: left, right: this.parseBitXor(), line: tok.line };
			}
			return left;
		}

		parseBitXor() {
			let left = this.parseBitAnd();
			while (this.check('OP', '^')) {
				const tok = this.advance();
				left = { type: 'Binary', op: '^', left: left, right: this.parseBitAnd(), line: tok.line };
			}
			return left;
		}

		parseBitAnd() {
			let left = this.parseEquality();
			while (this.check('OP', '&')) {
				const tok = this.advance();
				left = { type: 'Binary', op: '&', left: left, right: this.parseEquality(), line: tok.line };
			}
			return left;
		}

		parseEquality() {
			let left = this.parseRelational();
			while (this.check('OP', '==') || this.check('OP', '===') || this.check('OP', '!=') || this.check('OP', '!==') || this.check('OP', '<=>')) {
				const tok = this.advance();
				left = { type: 'Binary', op: tok.value, left: left, right: this.parseRelational(), line: tok.line };
			}
			return left;
		}

		parseRelational() {
			let left = this.parseShift();
			while (this.check('OP', '<') || this.check('OP', '<=') || this.check('OP', '>') || this.check('OP', '>=')) {
				const tok = this.advance();
				left = { type: 'Binary', op: tok.value, left: left, right: this.parseShift(), line: tok.line };
			}
			return left;
		}

		parseShift() {
			let left = this.parseAdditive();
			while (this.check('OP', '<<') || this.check('OP', '>>')) {
				const tok = this.advance();
				left = { type: 'Binary', op: tok.value, left: left, right: this.parseAdditive(), line: tok.line };
			}
			return left;
		}

		parseAdditive() {
			let left = this.parseMultiplicative();
			while (this.check('OP', '+') || this.check('OP', '-') || this.check('OP', '.')) {
				const tok = this.advance();
				left = { type: 'Binary', op: tok.value, left: left, right: this.parseMultiplicative(), line: tok.line };
			}
			return left;
		}

		parseMultiplicative() {
			let left = this.parseUnary();
			while (this.check('OP', '*') || this.check('OP', '/') || this.check('OP', '%')) {
				const tok = this.advance();
				left = { type: 'Binary', op: tok.value, left: left, right: this.parseUnary(), line: tok.line };
			}
			return left;
		}

		parseUnary() {
			const tok = this.peek();

			// Casts: (int), (string), etc.
			if (
				tok.type === 'OP' && tok.value === '(' &&
				(this.peek(1).type === 'IDENT' || this.peek(1).type === 'KW') &&
				CAST_NAMES.has(String(this.peek(1).value).toLowerCase()) &&
				this.peek(2).type === 'OP' && this.peek(2).value === ')'
			) {
				this.advance(); // (
				const castType = String(this.advance().value).toLowerCase();
				this.advance(); // )
				return { type: 'Cast', castType: castType, expr: this.parseUnary(), line: tok.line };
			}

			if (tok.type === 'OP' && (tok.value === '!' || tok.value === '~' || tok.value === '+' || tok.value === '-' || tok.value === '@')) {
				this.advance();
				return { type: 'Unary', op: tok.value, expr: this.parseUnary(), line: tok.line };
			}
			if (tok.type === 'OP' && (tok.value === '++' || tok.value === '--')) {
				this.advance();
				return { type: 'Update', op: tok.value, prefix: true, expr: this.parseUnary(), line: tok.line };
			}
			if (tok.type === 'KW' && tok.value === 'new') {
				return this.parseNew();
			}
			if (tok.type === 'KW' && tok.value === 'clone') {
				this.advance();
				return { type: 'Clone', expr: this.parseUnary(), line: tok.line };
			}
			if (tok.type === 'KW' && tok.value === 'print') {
				this.advance();
				return { type: 'Print', expr: this.parseAssignment(), line: tok.line };
			}
			if (tok.type === 'KW' && (tok.value === 'include' || tok.value === 'include_once' || tok.value === 'require' || tok.value === 'require_once')) {
				this.advance();
				const target = this.parseExpression();
				return {
					type: 'Include',
					once: tok.value.endsWith('_once'),
					isRequire: tok.value.startsWith('require'),
					expr: target,
					line: tok.line
				};
			}

			return this.parsePower();
		}

		parsePower() {
			let left = this.parseInstanceof();
			if (this.check('OP', '**')) {
				const tok = this.advance();
				const right = this.parseUnary();
				return { type: 'Binary', op: '**', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseInstanceof() {
			let left = this.parsePostfix();
			if (this.check('KW', 'instanceof')) {
				const tok = this.advance();
				let right;
				if (this.check('VAR')) {
					right = this.parsePrimary();
				} else {
					right = { type: 'ConstRef', name: this.parseQualifiedName(), line: tok.line };
				}
				return { type: 'Instanceof', left: left, right: right, line: tok.line };
			}
			return left;
		}

		parseNew() {
			const tok = this.advance(); // 'new'
			let classExpr;
			if (this.check('VAR')) {
				classExpr = this.parsePostfixAssignable();
			} else {
				const name = this.parseQualifiedName();
				classExpr = { type: 'ConstRef', name: name, line: tok.line };
			}
			let args = [];
			if (this.check('OP', '(')) {
				args = this.parseCallArgs();
			}
			return { type: 'New', classExpr: classExpr, args: args, line: tok.line };
		}

		parseCallArgs() {
			this.expect('OP', '(');
			const args = [];
			while (!this.check('OP', ')') && !this.check('EOF')) {
				args.push(this.parseExpression());
				if (!this.match('OP', ',')) break;
			}
			this.expect('OP', ')');
			return args;
		}

		parsePostfixAssignable() {
			let expr = this.parsePrimary();
			return this._parsePostfixLoop(expr, false);
		}

		parsePostfix() {
			let expr = this.parsePrimary();
			expr = this._parsePostfixLoop(expr, true);
			if (this.check('OP', '++') || this.check('OP', '--')) {
				const tok = this.advance();
				expr = { type: 'Update', op: tok.value, prefix: false, expr: expr, line: tok.line };
			}
			return expr;
		}

		_parsePostfixLoop(expr, allowCalls) {
			while (true) {
				if (allowCalls && this.check('OP', '(')) {
					const tok = this.peek();
					const args = this.parseCallArgs();
					expr = { type: 'Call', callee: expr, args: args, line: tok.line };
					continue;
				}
				if (this.check('OP', '[')) {
					const tok = this.advance();
					let index = null;
					if (!this.check('OP', ']')) {
						index = this.parseExpression();
					}
					this.expect('OP', ']');
					expr = { type: 'Subscript', target: expr, index: index, line: tok.line };
					continue;
				}
				if (this.check('OP', '->')) {
					const tok = this.advance();
					let prop;
					let dynamic = false;
					if (this.check('OP', '{')) {
						this.advance();
						prop = this.parseExpression();
						this.expect('OP', '}');
						dynamic = true;
					} else if (this.check('VAR')) {
						prop = this.parsePrimary();
						dynamic = true;
					} else {
						const id = this.peek();
						if (id.type === 'IDENT' || id.type === 'KW') {
							prop = this.advance().value;
						} else {
							throw new SyntaxError(`BOP Parse error: expected property name after -> in ${this.filePath} on line ${id.line}`);
						}
					}
					if (allowCalls && this.check('OP', '(')) {
						const args = this.parseCallArgs();
						expr = { type: 'MethodCall', object: expr, name: prop, dynamic: dynamic, args: args, line: tok.line };
					} else {
						expr = { type: 'MemberAccess', object: expr, name: prop, dynamic: dynamic, line: tok.line };
					}
					continue;
				}
				if (this.check('OP', '::')) {
					const tok = this.advance();
					if (this.check('KW', 'class')) {
						this.advance();
						expr = { type: 'ClassNameConst', target: expr, line: tok.line };
						continue;
					}
					if (this.check('VAR')) {
						const v = this.advance();
						expr = { type: 'StaticMember', target: expr, name: v.value, line: tok.line };
						continue;
					}
					const id = this.peek();
					let memberName;
					if (id.type === 'IDENT' || id.type === 'KW') {
						memberName = this.advance().value;
					} else {
						throw new SyntaxError(`BOP Parse error: expected static member after :: in ${this.filePath} on line ${id.line}`);
					}
					if (allowCalls && this.check('OP', '(')) {
						const args = this.parseCallArgs();
						expr = { type: 'StaticCall', target: expr, name: memberName, args: args, line: tok.line };
					} else {
						expr = { type: 'ClassConstAccess', target: expr, name: memberName, line: tok.line };
					}
					continue;
				}
				break;
			}
			return expr;
		}

		parseArrayItems(closeOp) {
			const items = [];
			while (!this.check('OP', closeOp) && !this.check('EOF')) {
				const byRef = Boolean(this.match('OP', '&'));
				const first = this.parseExpression();
				if (this.match('OP', '=>')) {
					const valRef = Boolean(this.match('OP', '&'));
					const val = this.parseExpression();
					items.push({ key: first, value: val, byRef: valRef });
				} else {
					items.push({ key: null, value: first, byRef: byRef });
				}
				if (!this.match('OP', ',')) break;
			}
			this.expect('OP', closeOp);
			return items;
		}

		parsePrimary() {
			const tok = this.peek();

			if (tok.type === 'NUMBER') {
				this.advance();
				return { type: 'Literal', value: tok.value, line: tok.line };
			}
			if (tok.type === 'STRING') {
				this.advance();
				return { type: 'Literal', value: tok.value, line: tok.line };
			}
			if (tok.type === 'DSTRING') {
				this.advance();
				return parseDoubleStringParts(tok.value, tok.line);
			}
			if (tok.type === 'VAR') {
				this.advance();
				return { type: 'Var', name: tok.value, line: tok.line };
			}
			// Dynamic variable variable $$var or ${expr}
			if (tok.type === 'OP' && tok.value === '$') {
				this.advance();
				let nameExpr;
				if (this.match('OP', '{')) {
					nameExpr = this.parseExpression();
					this.expect('OP', '}');
				} else if (this.check('VAR')) {
					nameExpr = this.parsePrimary();
				} else {
					nameExpr = this.parseUnary();
				}
				return { type: 'DynamicVar', nameExpr: nameExpr, line: tok.line };
			}
			if (tok.type === 'OP' && tok.value === '(') {
				this.advance();
				const expr = this.parseExpression();
				this.expect('OP', ')');
				return expr;
			}
			if (tok.type === 'OP' && tok.value === '[') {
				this.advance();
				return { type: 'ArrayLiteral', items: this.parseArrayItems(']'), line: tok.line };
			}
			if (tok.type === 'KW') {
				if (tok.value === 'true') { this.advance(); return { type: 'Literal', value: true, line: tok.line }; }
				if (tok.value === 'false') { this.advance(); return { type: 'Literal', value: false, line: tok.line }; }
				if (tok.value === 'null') { this.advance(); return { type: 'Literal', value: null, line: tok.line }; }
				if (tok.value === 'array') {
					this.advance();
					this.expect('OP', '(');
					return { type: 'ArrayLiteral', items: this.parseArrayItems(')'), line: tok.line };
				}
				if (tok.value === 'list') {
					this.advance();
					this.expect('OP', '(');
					const targets = [];
					while (!this.check('OP', ')') && !this.check('EOF')) {
						if (this.check('OP', ',')) {
							targets.push(null);
						} else {
							targets.push(this.parseExpression());
						}
						if (!this.match('OP', ',')) break;
					}
					this.expect('OP', ')');
					return { type: 'ListPattern', targets: targets, line: tok.line };
				}
				if (tok.value === 'isset') {
					this.advance();
					this.expect('OP', '(');
					const args = [];
					do {
						args.push(this.parseExpression());
					} while (this.match('OP', ','));
					this.expect('OP', ')');
					return { type: 'Isset', args: args, line: tok.line };
				}
				if (tok.value === 'empty') {
					this.advance();
					this.expect('OP', '(');
					const arg = this.parseExpression();
					this.expect('OP', ')');
					return { type: 'Empty', arg: arg, line: tok.line };
				}
				if (tok.value === 'eval') {
					this.advance();
					this.expect('OP', '(');
					const arg = this.parseExpression();
					this.expect('OP', ')');
					return { type: 'Eval', expr: arg, line: tok.line };
				}
				if (tok.value === 'die' || tok.value === 'exit') {
					this.advance();
					let arg = null;
					if (this.match('OP', '(')) {
						if (!this.check('OP', ')')) arg = this.parseExpression();
						this.expect('OP', ')');
					}
					return { type: 'Exit', expr: arg, line: tok.line };
				}
				if (tok.value === 'function') {
					this.advance();
					const returnsRef = Boolean(this.match('OP', '&'));
					const params = this.parseFunctionParams();
					const useVars = [];
					if (this.match('KW', 'use')) {
						this.expect('OP', '(');
						while (!this.check('OP', ')') && !this.check('EOF')) {
							const byRef = Boolean(this.match('OP', '&'));
							const name = this.expect('VAR').value;
							useVars.push({ name: name, byRef: byRef });
							if (!this.match('OP', ',')) break;
						}
						this.expect('OP', ')');
					}
					const body = this.parseBlock();
					return { type: 'Closure', returnsRef: returnsRef, params: params, useVars: useVars, body: body, line: tok.line };
				}
				if (tok.value === 'static' || tok.value === 'self' || tok.value === 'parent') {
					this.advance();
					return { type: 'ConstRef', name: tok.value, line: tok.line };
				}
			}

			if (tok.type === 'IDENT' || (tok.type === 'OP' && tok.value === '\\')) {
				const qname = this.parseQualifiedName();
				if (qname === '__LINE__' || qname === '__FILE__' || qname === '__DIR__' || qname === '__FUNCTION__' || qname === '__CLASS__' || qname === '__METHOD__' || qname === '__NAMESPACE__') {
					return { type: 'MagicConst', name: qname, line: tok.line };
				}
				return { type: 'ConstRef', name: qname, line: tok.line };
			}

			const got = tok.type === 'EOF' ? 'end of input' : JSON.stringify(tok.value);
			throw new SyntaxError(`BOP Parse error: syntax error, unexpected ${got} in ${this.filePath} on line ${tok.line}`);
		}
	}

	// =========================================================================
	// 5. Control Flow Signals & Runtime Errors
	// =========================================================================

	class ReturnSignal {
		constructor(value) { this.value = value; }
	}
	class BreakSignal {
		constructor(levels = 1) { this.levels = levels; }
	}
	class ContinueSignal {
		constructor(levels = 1) { this.levels = levels; }
	}
	class GotoSignal {
		constructor(label) { this.label = label; }
	}
	class ExitSignal {
		constructor(code = 0) { this.code = code; }
	}
	class BopThrownException {
		constructor(obj) { this.obj = obj; }
	}

	// =========================================================================
	// 6. Stream Emitter & Async Execute Wrapper
	// =========================================================================

	function createStream() {
		const listeners = [];
		return {
			on: function(ev, cb) {
				if (ev === 'data' && typeof cb === 'function') listeners.push(cb);
				return this;
			},
			write: function(text) {
				const str = String(text ?? '');
				for (let i = 0; i < listeners.length; i++) {
					listeners[i](str);
				}
			}
		};
	}

	function makeDeferredPromise(promise) {
		promise.fail = function(cb) {
			return makeDeferredPromise(promise.catch(cb));
		};
		promise.always = function(cb) {
			return makeDeferredPromise(promise.finally(cb));
		};
		return promise;
	}

	// =========================================================================
	// 7. Create BOP Engine
	// =========================================================================

	function createBopEngine(options) {
		const opts = options || {};
		const fileSystem = opts.fileSystem || null;
		const includeHandler = typeof opts.include === 'function' ? opts.include : null;

		const stdout = createStream();
		const stderr = createStream();
		const outputBuffers = [];

		// Namespace registry structure compatible with get_defined_functions() inspection
		const globalNamespace = {
			functions: Object.create(null),
			constants: Object.create(null),
			children: Object.create(null)
		};

		const internalFunctions = new Map();
		const userFunctions = new Map();
		const constants = new Map();
		const classes = new Map();
		const globalCells = new Map();
		const includedFiles = new Set();
		const autoloaders = [];
		const iniConfig = new Map([
			['display_errors', '1'],
			['include_path', '.'],
			['default_charset', 'UTF-8'],
			['precision', '14']
		]);
		const envVars = new Map();
		let errorReportingLevel = 32767;
		let suppressDepth = 0;

		function writeOutput(text) {
			const s = String(text ?? '');
			if (outputBuffers.length > 0) {
				outputBuffers[outputBuffers.length - 1] += s;
			} else {
				stdout.write(s);
			}
		}

		function emitWarning(msg, file, line) {
			if (suppressDepth > 0) return;
			const loc = file && file !== 'unknown' ? ` in ${file} on line ${line || 1}` : ` in unknown on line ${line || 1}`;
			stderr.write(`BOP Warning: ${msg}${loc}\n`);
		}

		function emitNotice(msg, file, line) {
			if (suppressDepth > 0 || !(errorReportingLevel & 8)) return;
			const loc = file && file !== 'unknown' ? ` in ${file} on line ${line || 1}` : ` in unknown on line ${line || 1}`;
			stderr.write(`BOP Notice: ${msg}${loc}\n`);
		}

		// --- ValueFactory / Environment Adapter for lib/vfs.js & lib/bop_bridge.js ---
		const valueFactory = {
			createInteger: function(n) { return Math.trunc(Number(n)) || 0; },
			createFloat: function(n) { return Number(n); },
			createBoolean: function(b) { return Boolean(b); },
			createString: function(s) { return String(s ?? ''); },
			createNull: function() { return null; },
			createArray: function(arr) { return fromJsValue(arr); },
			createResource: function(type, data) { return new BopResource(type, data); }
		};
		const futureFactory = {
			createPresent: function(v) { return v; }
		};

		function wrapNativeArgRef(val) {
			return {
				getValue: function() {
					return {
						getNative: function() { return toJsValue(val); },
						getType: function() {
							if (val === null || val === undefined) return 'null';
							if (val instanceof BopResource) return 'resource';
							if (val instanceof BopArray) return 'array';
							if (val instanceof BopObject || val instanceof BopHostObject) return 'object';
							return typeof val;
						},
						getResourceType: function() {
							return val instanceof BopResource ? val.resourceType : null;
						},
						getResource: function() {
							return val instanceof BopResource ? val.data : null;
						}
					};
				}
			};
		}

		function defineBuiltinFn(name, fn, isCoercing = true) {
			const lc = String(name).toLowerCase();
			internalFunctions.set(lc, { name: name, fn: fn, coercing: isCoercing });
			globalNamespace.functions[name] = fn;
		}

		function defineConstant(name, value) {
			constants.set(name, value);
			globalNamespace.constants[name] = {
				name: name,
				value: { getNative: function() { return value; } }
			};
		}

		// =====================================================================
		// 8. Built-in Classes: stdClass, Exception, Error
		// =====================================================================

		const stdClass = new BopClass('stdClass');
		classes.set('stdclass', stdClass);

		const exceptionClass = new BopClass('Exception');
		exceptionClass.propDefs.set('message', { visibility: 'protected', defaultExpr: { type: 'Literal', value: '' } });
		exceptionClass.propDefs.set('code', { visibility: 'protected', defaultExpr: { type: 'Literal', value: 0 } });
		exceptionClass.propDefs.set('file', { visibility: 'protected', defaultExpr: { type: 'Literal', value: 'unknown' } });
		exceptionClass.propDefs.set('line', { visibility: 'protected', defaultExpr: { type: 'Literal', value: 0 } });

		function addBuiltinMethod(klass, name, fn) {
			klass.methods.set(name.toLowerCase(), {
				name: name,
				visibility: 'public',
				isStatic: false,
				isAbstract: false,
				isFinal: false,
				returnsRef: false,
				builtinFn: fn
			});
		}

		addBuiltinMethod(exceptionClass, '__construct', function(obj, message = '', code = 0) {
			obj.props.set('message', new BopCell(toBopString(message)));
			obj.props.set('code', new BopCell(toInt(code)));
		});
		addBuiltinMethod(exceptionClass, 'getMessage', function(obj) {
			const c = obj.props.get('message');
			return c ? c.value : '';
		});
		addBuiltinMethod(exceptionClass, 'getCode', function(obj) {
			const c = obj.props.get('code');
			return c ? c.value : 0;
		});
		addBuiltinMethod(exceptionClass, 'getFile', function(obj) {
			const c = obj.props.get('file');
			return c ? c.value : 'unknown';
		});
		addBuiltinMethod(exceptionClass, 'getLine', function(obj) {
			const c = obj.props.get('line');
			return c ? c.value : 0;
		});
		addBuiltinMethod(exceptionClass, 'getTraceAsString', function() { return ''; });
		addBuiltinMethod(exceptionClass, '__toString', function(obj) {
			const msg = obj.props.get('message')?.value || '';
			return `${obj.klass.name}: ${msg}`;
		});
		classes.set('exception', exceptionClass);

		const errorClass = new BopClass('Error');
		errorClass.parent = exceptionClass;
		classes.set('error', errorClass);

		// =====================================================================
		// 9. Built-in Standard Constants & Functions
		// =====================================================================

		defineConstant('TRUE', true);
		defineConstant('FALSE', false);
		defineConstant('NULL', null);
		defineConstant('E_ERROR', 1);
		defineConstant('E_WARNING', 2);
		defineConstant('E_PARSE', 4);
		defineConstant('E_NOTICE', 8);
		defineConstant('E_CORE_ERROR', 16);
		defineConstant('E_USER_ERROR', 256);
		defineConstant('E_USER_WARNING', 512);
		defineConstant('E_USER_NOTICE', 1024);
		defineConstant('E_ALL', 32767);

		defineConstant('CASE_LOWER', 0);
		defineConstant('CASE_UPPER', 1);
		defineConstant('SORT_REGULAR', 0);
		defineConstant('SORT_NUMERIC', 1);
		defineConstant('SORT_STRING', 2);
		defineConstant('SORT_NATURAL', 6);
		defineConstant('SORT_ASC', 4);
		defineConstant('SORT_DESC', 3);

		defineConstant('BOP_EOL', '\n');
		defineConstant('BOP_INT_MAX', Number.MAX_SAFE_INTEGER || 2147483647);
		defineConstant('BOP_OS', 'Browser');
		defineConstant('BOP_SAPI', 'bop-cli');
		defineConstant('BOP_VERSION', '1.0.0-bop');
		defineConstant('BOP_VERSION_ID', 10000);
		defineConstant('BOP_OUTPUT_HANDLER_CLEANABLE', 16);
		defineConstant('BOP_OUTPUT_HANDLER_FLUSHABLE', 32);
		defineConstant('BOP_OUTPUT_HANDLER_REMOVABLE', 64);
		defineConstant('BOP_OUTPUT_HANDLER_STDFLAGS', 112);

		// --- String Built-ins ---
		defineBuiltinFn('len', s => toBopString(s).length);
		defineBuiltinFn('substr', function(s, start, length = null) {
			const str = toBopString(s);
			let st = toInt(start);
			if (st < 0) st = Math.max(0, str.length + st);
			if (st >= str.length) return '';
			if (length === null || length === undefined) return str.slice(st);
			let len = toInt(length);
			if (len < 0) {
				const end = Math.max(st, str.length + len);
				return str.slice(st, end);
			}
			return len <= 0 ? '' : str.slice(st, st + len);
		});
		defineBuiltinFn('trim', function(s, chars = null) {
			const str = toBopString(s);
			const ch = chars === null || chars === undefined ? ' \n\r\t\v\0' : toBopString(chars);
			let a = 0;
			let b = str.length;
			while (a < b && ch.indexOf(str.charAt(a)) !== -1) a++;
			while (b > a && ch.indexOf(str.charAt(b - 1)) !== -1) b--;
			return str.slice(a, b);
		});
		defineBuiltinFn('strpos', function(haystack, needle, offset = 0) {
			const h = toBopString(haystack);
			const n = toBopString(needle);
			let off = toInt(offset);
			if (off < 0) off = Math.max(0, h.length + off);
			const idx = h.indexOf(n, off);
			return idx === -1 ? false : idx;
		});
		defineBuiltinFn('strrpos', function(haystack, needle, offset = 0) {
			const h = toBopString(haystack);
			const n = toBopString(needle);
			const off = toInt(offset);
			const idx = off >= 0 ? h.lastIndexOf(n, h.length) : h.lastIndexOf(n, Math.max(0, h.length + off));
			if (idx === -1 || (off > 0 && idx < off)) return false;
			return idx;
		});
		defineBuiltinFn('strrchr', function(haystack, needle) {
			const h = toBopString(haystack);
			const n = toBopString(needle).charAt(0);
			if (!n) return false;
			const idx = h.lastIndexOf(n);
			return idx === -1 ? false : h.slice(idx);
		});
		defineBuiltinFn('substr_count', function(haystack, needle, offset = 0, length = null) {
			let h = toBopString(haystack);
			const n = toBopString(needle);
			if (!n) return 0;
			const off = toInt(offset);
			h = length !== null && length !== undefined ? h.slice(off, off + toInt(length)) : h.slice(off);
			let count = 0;
			let pos = 0;
			while ((pos = h.indexOf(n, pos)) !== -1) {
				count++;
				pos += n.length;
			}
			return count;
		});
		defineBuiltinFn('lower', s => toBopString(s).toLowerCase());
		defineBuiltinFn('upper', s => toBopString(s).toUpperCase());
		defineBuiltinFn('explode', function(delim, str, limit = null) {
			const d = toBopString(delim);
			const s = toBopString(str);
			if (d === '') return false;
			let parts = s.split(d);
			if (limit !== null && limit !== undefined) {
				let lim = toInt(limit);
				if (lim === 0) lim = 1;
				if (lim < 0) {
					parts = parts.slice(0, Math.max(0, parts.length + lim));
				} else if (parts.length > lim) {
					parts = parts.slice(0, lim - 1).concat([parts.slice(lim - 1).join(d)]);
				}
			}
			return fromJsValue(parts);
		});
		defineBuiltinFn('join', function(glue, pieces = null) {
			let g = '';
			let arr = pieces;
			if (pieces === null || pieces === undefined) {
				arr = glue;
			} else if (glue instanceof BopArray) {
				arr = glue;
				g = toBopString(pieces);
			} else {
				g = toBopString(glue);
			}
			if (!(arr instanceof BopArray)) return '';
			return arr.entries.map(e => toBopString(e.cell.value)).join(g);
		});
		defineBuiltinFn('str_replace', function(search, replace, subject) {
			if (subject instanceof BopArray) {
				const out = new BopArray();
				for (let i = 0; i < subject.entries.length; i++) {
					const e = subject.entries[i];
					out.set(e.key, internalFunctions.get('str_replace').fn(search, replace, e.cell.value));
				}
				return out;
			}
			let str = toBopString(subject);
			const searches = search instanceof BopArray ? search.entries.map(e => toBopString(e.cell.value)) : [toBopString(search)];
			const replaces = replace instanceof BopArray ? replace.entries.map(e => toBopString(e.cell.value)) : [toBopString(replace)];
			for (let i = 0; i < searches.length; i++) {
				const s = searches[i];
				if (s === '') continue;
				const r = replace instanceof BopArray ? (replaces[i] !== undefined ? replaces[i] : '') : replaces[0];
				str = str.split(s).join(r);
			}
			return str;
		});
		defineBuiltinFn('strtr', function(str, from, to = null) {
			let s = toBopString(str);
			if (from instanceof BopArray) {
				const pairs = from.entries.slice().sort((a, b) => String(b.key).length - String(a.key).length);
				for (let i = 0; i < pairs.length; i++) {
					s = s.split(String(pairs[i].key)).join(toBopString(pairs[i].cell.value));
				}
				return s;
			}
			const f = toBopString(from);
			const t = toBopString(to);
			const n = Math.min(f.length, t.length);
			let out = '';
			for (let i = 0; i < s.length; i++) {
				const ch = s.charAt(i);
				const idx = f.slice(0, n).indexOf(ch);
				out += idx !== -1 ? t.charAt(idx) : ch;
			}
			return out;
		});
		defineBuiltinFn('preg_quote', function(str, delim = null) {
			let out = toBopString(str).replace(/[.\\+*?[^\]$(){}=!<>|:#-]/g, '\\$&');
			if (delim !== null && delim !== undefined && String(delim).length > 0) {
				const d = String(delim).charAt(0).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				out = out.replace(new RegExp(d, 'g'), '\\' + String(delim).charAt(0));
			}
			return out;
		});
		defineBuiltinFn('htmlspecialchars', function(str) {
			return toBopString(str)
				.replace(/&/g, '&amp;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		});
		defineBuiltinFn('get_html_translation_table', function() {
			return fromJsValue({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' });
		});

		// --- Array Built-ins ---
		defineBuiltinFn('count', function(arr) {
			if (arr instanceof BopArray) return arr.length();
			if (arr === null || arr === undefined) return 0;
			return 1;
		});
		defineBuiltinFn('array_keys', function(arr, searchVal = null, strict = false) {
			if (!(arr instanceof BopArray)) return new BopArray();
			const out = new BopArray();
			const hasSearch = arguments.length >= 2;
			for (let i = 0; i < arr.entries.length; i++) {
				const e = arr.entries[i];
				if (!hasSearch || (strict ? bopStrictEq(e.cell.value, searchVal) : bopLooseEq(e.cell.value, searchVal))) {
					out.push(e.key);
				}
			}
			return out;
		});
		defineBuiltinFn('array_values', function(arr) {
			if (!(arr instanceof BopArray)) return new BopArray();
			const out = new BopArray();
			for (let i = 0; i < arr.entries.length; i++) {
				out.push(cloneBopValue(arr.entries[i].cell.value));
			}
			return out;
		});
		defineBuiltinFn('array_key_exists', function(key, arr) {
			if (!(arr instanceof BopArray)) return false;
			return arr.has(key);
		});
		defineBuiltinFn('in_array', function(needle, arr, strict = false) {
			if (!(arr instanceof BopArray)) return false;
			for (let i = 0; i < arr.entries.length; i++) {
				const v = arr.entries[i].cell.value;
				if (strict ? bopStrictEq(v, needle) : bopLooseEq(v, needle)) return true;
			}
			return false;
		});
		defineBuiltinFn('array_search', function(needle, arr, strict = false) {
			if (!(arr instanceof BopArray)) return false;
			for (let i = 0; i < arr.entries.length; i++) {
				const v = arr.entries[i].cell.value;
				if (strict ? bopStrictEq(v, needle) : bopLooseEq(v, needle)) return arr.entries[i].key;
			}
			return false;
		});
		defineBuiltinFn('reset', function(arr) {
			if (!(arr instanceof BopArray) || arr.entries.length === 0) return false;
			arr.pointer = 0;
			return arr.entries[0].cell.value;
		});
		defineBuiltinFn('current', function(arr) {
			if (!(arr instanceof BopArray) || arr.pointer < 0 || arr.pointer >= arr.entries.length) return false;
			return arr.entries[arr.pointer].cell.value;
		});
		defineBuiltinFn('key', function(arr) {
			if (!(arr instanceof BopArray) || arr.pointer < 0 || arr.pointer >= arr.entries.length) return null;
			return arr.entries[arr.pointer].key;
		});
		defineBuiltinFn('next', function(arr) {
			if (!(arr instanceof BopArray)) return false;
			arr.pointer++;
			if (arr.pointer >= arr.entries.length) return false;
			return arr.entries[arr.pointer].cell.value;
		});
		defineBuiltinFn('end', function(arr) {
			if (!(arr instanceof BopArray) || arr.entries.length === 0) return false;
			arr.pointer = arr.entries.length - 1;
			return arr.entries[arr.pointer].cell.value;
		});
		defineBuiltinFn('array_push', function(arr) {
			if (!(arr instanceof BopArray)) return 0;
			for (let i = 1; i < arguments.length; i++) {
				arr.push(cloneBopValue(arguments[i]));
			}
			return arr.length();
		});
		defineBuiltinFn('array_pop', function(arr) {
			if (!(arr instanceof BopArray) || arr.entries.length === 0) return null;
			const last = arr.entries.pop();
			arr._reindexMap();
			arr.pointer = 0;
			return last.cell.value;
		});
		defineBuiltinFn('array_shift', function(arr) {
			if (!(arr instanceof BopArray) || arr.entries.length === 0) return null;
			const first = arr.entries.shift();
			let nextNum = 0;
			for (let i = 0; i < arr.entries.length; i++) {
				if (typeof arr.entries[i].key === 'number') {
					arr.entries[i].key = nextNum++;
				}
			}
			arr.nextIntKey = nextNum;
			arr._reindexMap();
			arr.pointer = 0;
			return first.cell.value;
		});
		defineBuiltinFn('array_merge', function() {
			const out = new BopArray();
			for (let i = 0; i < arguments.length; i++) {
				const arr = arguments[i];
				if (!(arr instanceof BopArray)) continue;
				for (let j = 0; j < arr.entries.length; j++) {
					const e = arr.entries[j];
					if (typeof e.key === 'number') {
						out.push(cloneBopValue(e.cell.value));
					} else {
						out.set(e.key, cloneBopValue(e.cell.value));
					}
				}
			}
			return out;
		});
		defineBuiltinFn('array_unique', function(arr) {
			if (!(arr instanceof BopArray)) return new BopArray();
			const out = new BopArray();
			const seen = new Set();
			for (let i = 0; i < arr.entries.length; i++) {
				const e = arr.entries[i];
				const s = toBopString(e.cell.value);
				if (!seen.has(s)) {
					seen.add(s);
					out.set(e.key, cloneBopValue(e.cell.value));
				}
			}
			return out;
		});
		defineBuiltinFn('array_map', async function(cb) {
			const arrays = Array.prototype.slice.call(arguments, 1);
			if (arrays.length === 0 || !(arrays[0] instanceof BopArray)) return new BopArray();
			const out = new BopArray();
			const len = Math.max.apply(null, arrays.map(a => a instanceof BopArray ? a.entries.length : 0));
			for (let i = 0; i < len; i++) {
				const callArgs = arrays.map(a => (a instanceof BopArray && i < a.entries.length) ? a.entries[i].cell.value : null);
				const val = cb ? await engine._invokeCallable(cb, callArgs) : (callArgs.length === 1 ? callArgs[0] : fromJsValue(callArgs));
				if (arrays.length === 1) {
					out.set(arrays[0].entries[i].key, val);
				} else {
					out.push(val);
				}
			}
			return out;
		});
		defineBuiltinFn('array_filter', async function(arr, cb = null, mode = 0) {
			if (!(arr instanceof BopArray)) return new BopArray();
			const out = new BopArray();
			for (let i = 0; i < arr.entries.length; i++) {
				const e = arr.entries[i];
				let keep;
				if (!cb) {
					keep = toBool(e.cell.value);
				} else if (mode === 1) {
					keep = toBool(await engine._invokeCallable(cb, [e.cell.value, e.key]));
				} else if (mode === 2) {
					keep = toBool(await engine._invokeCallable(cb, [e.key]));
				} else {
					keep = toBool(await engine._invokeCallable(cb, [e.cell.value]));
				}
				if (keep) out.set(e.key, cloneBopValue(e.cell.value));
			}
			return out;
		});
		defineBuiltinFn('array_diff', function(arr) {
			if (!(arr instanceof BopArray)) return new BopArray();
			const others = Array.prototype.slice.call(arguments, 1);
			const out = new BopArray();
			for (let i = 0; i < arr.entries.length; i++) {
				const e = arr.entries[i];
				const sv = toBopString(e.cell.value);
				let found = false;
				for (let j = 0; j < others.length; j++) {
					const o = others[j];
					if (o instanceof BopArray && o.entries.some(oe => toBopString(oe.cell.value) === sv)) {
						found = true;
						break;
					}
				}
				if (!found) out.set(e.key, cloneBopValue(e.cell.value));
			}
			return out;
		});
		defineBuiltinFn('asort', function(arr) {
			if (!(arr instanceof BopArray)) return false;
			arr.entries.sort((a, b) => bopCompare(a.cell.value, b.cell.value));
			arr._reindexMap();
			arr.pointer = 0;
			return true;
		});
		defineBuiltinFn('krsort', function(arr) {
			if (!(arr instanceof BopArray)) return false;
			arr.entries.sort((a, b) => bopCompare(b.key, a.key));
			arr._reindexMap();
			arr.pointer = 0;
			return true;
		});

		// --- Math & Time Built-ins ---
		defineBuiltinFn('ceil', n => Math.ceil(toNumber(n)));
		defineBuiltinFn('dechex', n => (toInt(n) >>> 0).toString(16));
		defineBuiltinFn('time', () => Math.floor(Date.now() / 1000));
		defineBuiltinFn('microtime', function(asFloat = false) {
			const ms = Date.now();
			if (toBool(asFloat)) return ms / 1000;
			const sec = Math.floor(ms / 1000);
			const frac = ((ms % 1000) / 1000).toFixed(6).slice(1);
			return '0' + frac + ' ' + sec;
		});
		defineBuiltinFn('usleep', function(micro) {
			const ms = Math.max(0, Math.floor(toNumber(micro) / 1000));
			return new Promise(resolve => setTimeout(resolve, ms));
		});

		// --- ANSI C-Style Preprocessor Built-in ---
		defineBuiltinFn('preprocess', async function(codeVal, definesVal = null) {
			const src = toBopString(codeVal);
			if (typeof globalScope.preprocessBopSource !== 'function') {
				return src;
			}
			const defs = {};
			if (definesVal instanceof BopArray) {
				for (let i = 0; i < definesVal.entries.length; i++) {
					const e = definesVal.entries[i];
					const k = String(e.key);
					const v = e.cell.value;
					defs[k] = v === null || v === undefined ? '' : toBopString(v);
				}
			}
			return await globalScope.preprocessBopSource(src, {
				filePath: '<preprocess>',
				startInBop: !/<\?(?:bop|=)/i.test(src),
				defines: defs,
				loadFile: fetchIncludeSource,
				normalizePath: function(p) {
					return fileSystem ? fileSystem.normalizePath(p) : String(p || '');
				},
				onWarning: function(msg, f, ln) {
					emitWarning(msg, f, ln);
				}
			});
		});

		// --- VFS Checks & Basic Stream Support ---
		defineBuiltinFn('file_exists', function(p) {
			return fileSystem ? Boolean(fileSystem.exists(toBopString(p))) : false;
		});
		defineBuiltinFn('is_file', function(p) {
			return fileSystem ? Boolean(fileSystem.isFile(toBopString(p))) : false;
		});
		defineBuiltinFn('feof', function(res) {
			if (!(res instanceof BopResource) || res.resourceType !== 'stream') return true;
			const st = res.data.stream;
			if (typeof st.isEof === 'function') return Boolean(st.isEof());
			if (typeof st.eof === 'function') return Boolean(st.eof());
			return true;
		});
		defineBuiltinFn('fwrite', function(res, data, length = null) {
			if (!(res instanceof BopResource) || res.resourceType !== 'stream') return false;
			let str = toBopString(data);
			if (length !== null && length !== undefined) {
				str = str.slice(0, Math.max(0, toInt(length)));
			}
			const result = res.data.stream.write(str);
			return result === false ? false : result;
		});
		defineBuiltinFn('fclose', function(res) {
			if (!(res instanceof BopResource) || res.resourceType !== 'stream') return false;
			return Boolean(res.data.stream.close());
		});

		// --- Type & Introspection Built-ins ---
		defineBuiltinFn('gettype', function(v) {
			if (v === null || v === undefined) return 'NULL';
			if (typeof v === 'boolean') return 'boolean';
			if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'double';
			if (typeof v === 'string') return 'string';
			if (v instanceof BopArray) return 'array';
			if (v instanceof BopResource) return 'resource';
			if (v instanceof BopObject || v instanceof BopHostObject || v instanceof BopClosure) return 'object';
			return 'unknown type';
		});
		defineBuiltinFn('is_null', v => v === null || v === undefined);
		defineBuiltinFn('is_bool', v => typeof v === 'boolean');
		defineBuiltinFn('is_int', v => typeof v === 'number' && Number.isInteger(v));
		defineBuiltinFn('is_float', v => typeof v === 'number' && !Number.isInteger(v));
		defineBuiltinFn('is_numeric', v => typeof v === 'number' || isNumericString(v));
		defineBuiltinFn('is_string', v => typeof v === 'string');
		defineBuiltinFn('is_array', v => v instanceof BopArray);
		defineBuiltinFn('is_object', v => v instanceof BopObject || v instanceof BopHostObject || v instanceof BopClosure);
		defineBuiltinFn('is_resource', v => v instanceof BopResource);
		defineBuiltinFn('get_resource_type', v => v instanceof BopResource ? v.resourceType : false);
		defineBuiltinFn('is_callable', function(v) {
			if (v instanceof BopClosure) return true;
			if (typeof v === 'string') {
				const lc = v.toLowerCase();
				return internalFunctions.has(lc) || userFunctions.has(lc);
			}
			if (v instanceof BopArray && v.entries.length === 2) return true;
			if (v instanceof BopHostObject && typeof v.target === 'function') return true;
			return false;
		});

		function formatVarDump(val, indent = '') {
			if (val === null || val === undefined) return indent + 'NULL\n';
			if (typeof val === 'boolean') return indent + `bool(${val ? 'true' : 'false'})\n`;
			if (typeof val === 'number') {
				return Number.isInteger(val) ? indent + `int(${val})\n` : indent + `float(${val})\n`;
			}
			if (typeof val === 'string') return indent + `string(${val.length}) "${val}"\n`;
			if (val instanceof BopResource) return indent + `resource(1) of type (${val.resourceType})\n`;
			if (val instanceof BopArray) {
				let s = indent + `array(${val.entries.length}) {\n`;
				for (let i = 0; i < val.entries.length; i++) {
					const e = val.entries[i];
					const k = typeof e.key === 'number' ? `[${e.key}]` : `["${e.key}"]`;
					s += indent + '  ' + k + '=>\n' + formatVarDump(e.cell.value, indent + '  ');
				}
				return s + indent + '}\n';
			}
			if (val instanceof BopObject) {
				return indent + `object(${val.klass.name}) (${val.props.size}) {\n` + indent + '}\n';
			}
			return indent + String(val) + '\n';
		}

		function formatVarExport(val, indent = '') {
			if (val === null || val === undefined) return 'NULL';
			if (typeof val === 'boolean') return val ? 'true' : 'false';
			if (typeof val === 'number') return String(val);
			if (typeof val === 'string') {
				return "'" + val.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
			}
			if (val instanceof BopArray) {
				if (val.entries.length === 0) return 'array (\n)';
				let s = 'array (\n';
				for (let i = 0; i < val.entries.length; i++) {
					const e = val.entries[i];
					const k = typeof e.key === 'number' ? String(e.key) : ("'" + String(e.key).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'");
					s += indent + '  ' + k + ' => ' + formatVarExport(e.cell.value, indent + '  ') + ',\n';
				}
				return s + indent + ')';
			}
			return 'NULL';
		}

		defineBuiltinFn('var_dump', function(val) {
			writeOutput(formatVarDump(val));
		});
		defineBuiltinFn('var_export', function(val, ret = false) {
			const out = formatVarExport(val);
			if (toBool(ret)) return out;
			writeOutput(out);
			return null;
		});
		defineBuiltinFn('print_r', function(val, ret = false) {
			const out = val instanceof BopArray ? formatVarExport(val) : toBopString(val);
			if (toBool(ret)) return out;
			writeOutput(out);
			return true;
		});

		defineBuiltinFn('define', function(name, val) {
			const n = toBopString(name);
			if (constants.has(n)) return false;
			defineConstant(n, val);
			return true;
		});
		defineBuiltinFn('defined', name => constants.has(toBopString(name)));
		defineBuiltinFn('function_exists', function(name) {
			const lc = toBopString(name).replace(/^\\/, '').toLowerCase();
			return internalFunctions.has(lc) || userFunctions.has(lc);
		});
		defineBuiltinFn('class_exists', function(name) {
			const lc = toBopString(name).replace(/^\\/, '').toLowerCase();
			return classes.has(lc);
		});
		defineBuiltinFn('interface_exists', function(name) {
			const lc = toBopString(name).replace(/^\\/, '').toLowerCase();
			return classes.has(lc);
		});
		defineBuiltinFn('get_class', function(obj) {
			if (obj instanceof BopObject) return obj.klass.name;
			return false;
		});
		defineBuiltinFn('is_a', function(obj, className) {
			if (obj instanceof BopObject) return obj.klass.isSubclassOf(toBopString(className));
			return false;
		});
		defineBuiltinFn('get_defined_functions', function() {
			const internal = Array.from(internalFunctions.values()).map(f => f.name).sort();
			const user = Array.from(userFunctions.values()).map(f => f.name).sort();
			return fromJsValue({ internal: internal, user: user });
		});
		defineBuiltinFn('call_user_func', async function(cb) {
			const args = Array.prototype.slice.call(arguments, 1);
			return await engine._invokeCallable(cb, args);
		});
		defineBuiltinFn('call_user_func_array', async function(cb, argsArr) {
			const args = argsArr instanceof BopArray ? argsArr.entries.map(e => e.cell.value) : [];
			return await engine._invokeCallable(cb, args);
		});
		defineBuiltinFn('func_num_args', function() {
			return currentCallArgs ? currentCallArgs.length : 0;
		});
		defineBuiltinFn('func_get_args', function() {
			return fromJsValue(currentCallArgs ? currentCallArgs.slice() : []);
		});
		defineBuiltinFn('spl_autoload_register', function(cb = null) {
			if (cb) autoloaders.push(cb);
			return true;
		});
		defineBuiltinFn('spl_autoload_unregister', function(cb) {
			const idx = autoloaders.indexOf(cb);
			if (idx !== -1) { autoloaders.splice(idx, 1); return true; }
			return false;
		});
		defineBuiltinFn('spl_object_hash', function(obj) {
			if (obj instanceof BopObject) return obj.hashId;
			return '';
		});

		// --- Output Buffering ---
		defineBuiltinFn('ob_start', function() {
			outputBuffers.push('');
			return true;
		});
		defineBuiltinFn('ob_get_contents', function() {
			return outputBuffers.length > 0 ? outputBuffers[outputBuffers.length - 1] : false;
		});
		defineBuiltinFn('ob_get_clean', function() {
			if (outputBuffers.length === 0) return false;
			return outputBuffers.pop();
		});
		defineBuiltinFn('ob_get_flush', function() {
			if (outputBuffers.length === 0) return false;
			const buf = outputBuffers.pop();
			writeOutput(buf);
			return buf;
		});
		defineBuiltinFn('ob_clean', function() {
			if (outputBuffers.length === 0) return false;
			outputBuffers[outputBuffers.length - 1] = '';
			return true;
		});
		defineBuiltinFn('ob_end_clean', function() {
			if (outputBuffers.length === 0) return false;
			outputBuffers.pop();
			return true;
		});
		defineBuiltinFn('ob_flush', function() {
			if (outputBuffers.length === 0) return false;
			const buf = outputBuffers[outputBuffers.length - 1];
			outputBuffers[outputBuffers.length - 1] = '';
			if (outputBuffers.length > 1) {
				outputBuffers[outputBuffers.length - 2] += buf;
			} else {
				stdout.write(buf);
			}
			return true;
		});
		defineBuiltinFn('ob_end_flush', function() {
			if (outputBuffers.length === 0) return false;
			const buf = outputBuffers.pop();
			writeOutput(buf);
			return true;
		});
		defineBuiltinFn('ob_get_level', () => outputBuffers.length);

		// --- URLs, Config & BOP Runtime System Built-ins ---
		defineBuiltinFn('parse_url', function(url, component = -1) {
			try {
				const u = new URL(toBopString(url), 'http://localhost');
				const out = {};
				const raw = toBopString(url);
				if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) out.scheme = u.protocol.replace(/:$/, '');
				if (raw.indexOf('://') !== -1) {
					out.host = u.hostname;
					if (u.port) out.port = Number(u.port);
					if (u.username) out.user = u.username;
					if (u.password) out.pass = u.password;
				}
				if (u.pathname) out.path = u.pathname;
				if (u.search) out.query = u.search.slice(1);
				if (u.hash) out.fragment = u.hash.slice(1);
				if (toInt(component) >= 0) {
					const keys = ['scheme', 'host', 'port', 'user', 'pass', 'path', 'query', 'fragment'];
					return out[keys[toInt(component)]] ?? null;
				}
				return fromJsValue(out);
			} catch (_e) {
				return false;
			}
		});
		defineBuiltinFn('getenv', function(name = null) {
			if (arguments.length === 0 || name === null || name === undefined) {
				const out = new BopArray();
				envVars.forEach((v, k) => out.set(k, v));
				return out;
			}
			const key = toBopString(name);
			return envVars.has(key) ? envVars.get(key) : false;
		});
		defineBuiltinFn('putenv', function(setting) {
			const s = toBopString(setting);
			if (!s) return false;
			const eqIdx = s.indexOf('=');
			if (eqIdx === -1) {
				envVars.delete(s.trim());
				return true;
			}
			const key = s.slice(0, eqIdx).trim();
			if (!key) return false;
			envVars.set(key, s.slice(eqIdx + 1));
			return true;
		});

		// --- Cryptographic One-Way Hashing & Password Built-ins ---
		defineConstant('PASSWORD_DEFAULT', 'pbkdf2-sha256');
		defineConstant('PASSWORD_PBKDF2', 'pbkdf2-sha256');
		defineConstant('PASSWORD_BCRYPT', 'pbkdf2-sha256');

		const SHA256_K = new Uint32Array([
			0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
			0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
			0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
			0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
			0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
			0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
			0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
			0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
		]);

		function utf8ToBytes(str) {
			const s = String(str ?? '');
			if (typeof TextEncoder === 'function') {
				return new TextEncoder().encode(s);
			}
			const out = [];
			for (let i = 0; i < s.length; i++) {
				let c = s.charCodeAt(i);
				if (c < 0x80) {
					out.push(c);
				} else if (c < 0x800) {
					out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
				} else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
					const c2 = s.charCodeAt(++i);
					const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
					out.push(
						0xf0 | (cp >> 18),
						0x80 | ((cp >> 12) & 0x3f),
						0x80 | ((cp >> 6) & 0x3f),
						0x80 | (cp & 0x3f)
					);
				} else {
					out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
				}
			}
			return new Uint8Array(out);
		}

		function bytesToHex(bytes) {
			let hex = '';
			for (let i = 0; i < bytes.length; i++) {
				hex += bytes[i].toString(16).padStart(2, '0');
			}
			return hex;
		}

		function bytesToRawStr(bytes) {
			let out = '';
			for (let i = 0; i < bytes.length; i++) {
				out += String.fromCharCode(bytes[i]);
			}
			return out;
		}

		const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
		function bytesToB64(bytes) {
			let out = '';
			let i = 0;
			const len = bytes.length;
			while (i < len) {
				const b0 = bytes[i++];
				const has1 = i < len;
				const b1 = has1 ? bytes[i++] : 0;
				const has2 = i < len;
				const b2 = has2 ? bytes[i++] : 0;
				out += B64_CHARS.charAt(b0 >> 2);
				out += B64_CHARS.charAt(((b0 & 3) << 4) | (b1 >> 4));
				if (has1) out += B64_CHARS.charAt(((b1 & 15) << 2) | (b2 >> 6));
				if (has2) out += B64_CHARS.charAt(b2 & 63);
			}
			return out;
		}

		function b64ToBytes(str) {
			const clean = String(str || '').replace(/=+$/, '');
			const out = [];
			let i = 0;
			while (i < clean.length) {
				const c0 = B64_CHARS.indexOf(clean.charAt(i++));
				const c1 = i < clean.length ? B64_CHARS.indexOf(clean.charAt(i++)) : -1;
				const c2 = i < clean.length ? B64_CHARS.indexOf(clean.charAt(i++)) : -1;
				const c3 = i < clean.length ? B64_CHARS.indexOf(clean.charAt(i++)) : -1;
				if (c0 < 0 || c1 < 0) return null;
				out.push((c0 << 2) | (c1 >> 4));
				if (c2 >= 0) out.push(((c1 & 15) << 4) | (c2 >> 2));
				if (c3 >= 0) out.push(((c2 & 3) << 6) | c3);
			}
			return new Uint8Array(out);
		}

		function sha256Js(dataBytes) {
			const len = dataBytes.length;
			const bitLenHi = Math.floor(len / 0x20000000);
			const bitLenLo = (len << 3) >>> 0;
			const padLen = ((len + 9 + 63) >> 6) << 6;
			const buf = new Uint8Array(padLen);
			buf.set(dataBytes);
			buf[len] = 0x80;
			buf[padLen - 8] = (bitLenHi >>> 24) & 0xff;
			buf[padLen - 7] = (bitLenHi >>> 16) & 0xff;
			buf[padLen - 6] = (bitLenHi >>> 8) & 0xff;
			buf[padLen - 5] = bitLenHi & 0xff;
			buf[padLen - 4] = (bitLenLo >>> 24) & 0xff;
			buf[padLen - 3] = (bitLenLo >>> 16) & 0xff;
			buf[padLen - 2] = (bitLenLo >>> 8) & 0xff;
			buf[padLen - 1] = bitLenLo & 0xff;

			let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
			let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
			const w = new Uint32Array(64);

			for (let off = 0; off < padLen; off += 64) {
				for (let i = 0; i < 16; i++) {
					const j = off + (i << 2);
					w[i] = ((buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3]) >>> 0;
				}
				for (let i = 16; i < 64; i++) {
					const w15 = w[i - 15];
					const w2 = w[i - 2];
					const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
					const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
					w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
				}
				let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
				for (let i = 0; i < 64; i++) {
					const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
					const ch = (e & f) ^ (~e & g);
					const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
					const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
					const maj = (a & b) ^ (a & c) ^ (b & c);
					const t2 = (S0 + maj) >>> 0;
					h = g; g = f; f = e; e = (d + t1) >>> 0;
					d = c; c = b; b = a; a = (t1 + t2) >>> 0;
				}
				h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
				h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
			}

			const out = new Uint8Array(32);
			const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
			for (let i = 0; i < 8; i++) {
				out[i * 4] = (hs[i] >>> 24) & 0xff;
				out[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
				out[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
				out[i * 4 + 3] = hs[i] & 0xff;
			}
			return out;
		}

		function hmacSha256Js(keyBytes, msgBytes) {
			const k = keyBytes.length > 64 ? sha256Js(keyBytes) : keyBytes;
			const inner = new Uint8Array(64 + msgBytes.length);
			const outer = new Uint8Array(64 + 32);
			for (let i = 0; i < 64; i++) {
				const kb = i < k.length ? k[i] : 0;
				inner[i] = kb ^ 0x36;
				outer[i] = kb ^ 0x5c;
			}
			inner.set(msgBytes, 64);
			const innerHash = sha256Js(inner);
			outer.set(innerHash, 64);
			return sha256Js(outer);
		}

		function pbkdf2Sha256Js(passBytes, saltBytes, iterations) {
			const saltBlock = new Uint8Array(saltBytes.length + 4);
			saltBlock.set(saltBytes);
			saltBlock[saltBytes.length + 3] = 1; // Block index 1 (32 bytes output)
			let u = hmacSha256Js(passBytes, saltBlock);
			const dk = new Uint8Array(u);
			for (let iter = 1; iter < iterations; iter++) {
				u = hmacSha256Js(passBytes, u);
				for (let j = 0; j < 32; j++) dk[j] ^= u[j];
			}
			return dk;
		}

		function getSubtleCrypto() {
			const c = globalScope.crypto || (typeof crypto !== 'undefined' ? crypto : null);
			return c && c.subtle ? c.subtle : null;
		}

		function getRandomSalt(len) {
			const bytes = new Uint8Array(len);
			const c = globalScope.crypto || (typeof crypto !== 'undefined' ? crypto : null);
			if (c && typeof c.getRandomValues === 'function') {
				c.getRandomValues(bytes);
			} else {
				for (let i = 0; i < len; i++) {
					bytes[i] = Math.floor(Math.random() * 256);
				}
			}
			return bytes;
		}

		async function derivePbkdf2Sha256(passwordStr, saltBytes, iterations) {
			const passBytes = utf8ToBytes(passwordStr);
			const subtle = getSubtleCrypto();
			if (subtle) {
				try {
					const baseKey = await subtle.importKey('raw', passBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
					const bits = await subtle.deriveBits(
						{ name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' },
						baseKey,
						256
					);
					return new Uint8Array(bits);
				} catch (_e) {}
			}
			return pbkdf2Sha256Js(passBytes, saltBytes, iterations);
		}

		function constantTimeBytesEqual(a, b) {
			if (!a || !b || a.length !== b.length) return false;
			let diff = 0;
			for (let i = 0; i < a.length; i++) {
				diff |= (a[i] ^ b[i]);
			}
			return diff === 0;
		}

		defineBuiltinFn('hash_equals', function(known, user) {
			if (typeof known !== 'string' || typeof user !== 'string') return false;
			const a = utf8ToBytes(known);
			const b = utf8ToBytes(user);
			return constantTimeBytesEqual(a, b);
		});

		defineBuiltinFn('hash', async function(algo, data, binary = false) {
			const alg = toBopString(algo).toLowerCase().replace(/[^a-z0-9]/g, '');
			const subtleMap = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512', sha1: 'SHA-1' };
			const subtleAlg = subtleMap[alg];
			if (!subtleAlg) {
				throw new Error('hash(): Unsupported hashing algorithm "' + toBopString(algo) + '" (supported: sha256, sha384, sha512, sha1)');
			}
			const bytes = utf8ToBytes(toBopString(data));
			let digest = null;
			const subtle = getSubtleCrypto();
			if (subtle) {
				try {
					digest = new Uint8Array(await subtle.digest(subtleAlg, bytes));
				} catch (_e) {}
			}
			if (!digest) {
				if (alg === 'sha256') {
					digest = sha256Js(bytes);
				} else {
					throw new Error('hash(): Web Crypto subtle API is required for ' + alg);
				}
			}
			return toBool(binary) ? bytesToRawStr(digest) : bytesToHex(digest);
		});

		defineBuiltinFn('hash_hmac', async function(algo, data, key, binary = false) {
			const alg = toBopString(algo).toLowerCase().replace(/[^a-z0-9]/g, '');
			const subtleMap = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512', sha1: 'SHA-1' };
			const subtleAlg = subtleMap[alg];
			if (!subtleAlg) {
				throw new Error('hash_hmac(): Unsupported hashing algorithm "' + toBopString(algo) + '"');
			}
			const keyBytes = utf8ToBytes(toBopString(key));
			const msgBytes = utf8ToBytes(toBopString(data));
			let mac = null;
			const subtle = getSubtleCrypto();
			if (subtle) {
				try {
					const cryptoKey = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: subtleAlg }, false, ['sign']);
					mac = new Uint8Array(await subtle.sign('HMAC', cryptoKey, msgBytes));
				} catch (_e) {}
			}
			if (!mac) {
				if (alg === 'sha256') {
					mac = hmacSha256Js(keyBytes, msgBytes);
				} else {
					throw new Error('hash_hmac(): Web Crypto subtle API is required for ' + alg);
				}
			}
			return toBool(binary) ? bytesToRawStr(mac) : bytesToHex(mac);
		});

		defineBuiltinFn('password_hash', async function(password, algo = 'pbkdf2-sha256', options = null) {
			const alg = algo === null || algo === undefined ? 'pbkdf2-sha256' : toBopString(algo).toLowerCase();
			if (alg !== 'pbkdf2-sha256' && alg !== 'default' && alg !== 'bcrypt') {
				throw new Error('password_hash(): Unsupported password algorithm "' + alg + '"');
			}
			let iterations = 100000;
			if (options instanceof BopArray) {
				const rawIter = options.has('iterations') ? options.get('iterations') : (options.has('cost') ? options.get('cost') : null);
				if (rawIter !== null && rawIter !== undefined) {
					const n = toInt(rawIter);
					iterations = Math.max(10000, Math.min(1000000, n));
				}
			}
			const salt = getRandomSalt(16);
			const dk = await derivePbkdf2Sha256(toBopString(password), salt, iterations);
			return '$pbkdf2-sha256$i=' + iterations + '$' + bytesToB64(salt) + '$' + bytesToB64(dk);
		});

		defineBuiltinFn('password_verify', async function(password, hashStr) {
			const h = toBopString(hashStr);
			const m = /^\$pbkdf2-sha256\$i=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(h);
			if (!m) return false;
			const iterations = parseInt(m[1], 10);
			if (!Number.isFinite(iterations) || iterations < 1 || iterations > 2000000) return false;
			const salt = b64ToBytes(m[2]);
			const expected = b64ToBytes(m[3]);
			if (!salt || !expected || expected.length !== 32) return false;
			const derived = await derivePbkdf2Sha256(toBopString(password), salt, iterations);
			return constantTimeBytesEqual(derived, expected);
		});

		defineBuiltinFn('ini_get', opt => iniConfig.get(toBopString(opt)) ?? '');
		defineBuiltinFn('ini_set', function(opt, val) {
			const k = toBopString(opt);
			const prev = iniConfig.get(k) ?? '';
			iniConfig.set(k, toBopString(val));
			return prev;
		});
		defineBuiltinFn('get_cfg_var', opt => iniConfig.get(toBopString(opt)) ?? false);
		defineBuiltinFn('get_include_path', () => iniConfig.get('include_path') || '.');
		defineBuiltinFn('set_include_path', function(p) {
			const prev = iniConfig.get('include_path') || '.';
			iniConfig.set('include_path', toBopString(p));
			return prev;
		});
		defineBuiltinFn('get_loaded_extensions', () => fromJsValue(['Core', 'standard', 'SPL', 'BOP']));
		defineBuiltinFn('bopversion', () => '1.0.0-bop');
		defineBuiltinFn('zend_version', () => 'BOP-VM 1.0');
		defineBuiltinFn('bop_uname', (mode = 'a') => `BOP Browser (${toBopString(mode) || 'a'})`);
		defineBuiltinFn('error_reporting', function(level = null) {
			const prev = errorReportingLevel;
			if (level !== null && level !== undefined) errorReportingLevel = toInt(level);
			return prev;
		});
		defineBuiltinFn('trigger_error', function(msg, type = 1024) {
			const t = toInt(type);
			if (t === 256) {
				throw new Error(`BOP Fatal error: ${toBopString(msg)}`);
			} else if (t === 512) {
				emitWarning(toBopString(msg));
			} else {
				emitNotice(toBopString(msg));
			}
			return true;
		});

		// =====================================================================
		// 10. Scope & Evaluator
		// =====================================================================

		let currentCallArgs = null;
		let currentNamespace = '';
		const currentStaticBindings = new Map();

		function makeScope(parentScope = null, optionsObj = {}) {
			return {
				parent: parentScope,
				vars: optionsObj.isGlobal ? globalCells : new Map(),
				isGlobal: Boolean(optionsObj.isGlobal),
				file: optionsObj.file || 'unknown',
				funcName: optionsObj.funcName || '',
				thisObj: optionsObj.thisObj || null,
				classCtx: optionsObj.classCtx || null,
				staticClass: optionsObj.staticClass || optionsObj.classCtx || null,
				namespace: optionsObj.namespace || ''
			};
		}

		const rootScope = makeScope(null, { isGlobal: true, file: 'unknown' });

		function getVarCell(scope, name, create = true) {
			if (name === 'this' && scope.thisObj) {
				return new BopCell(scope.thisObj);
			}
			if (scope.vars.has(name)) {
				return scope.vars.get(name);
			}
			if (!create) return null;
			const cell = new BopCell(null);
			scope.vars.set(name, cell);
			return cell;
		}

		function resolveClassName(rawName, scope) {
			const lower = String(rawName).toLowerCase();
			if (lower === 'self') return scope.classCtx;
			if (lower === 'parent') return scope.classCtx ? scope.classCtx.parent : null;
			if (lower === 'static') return scope.staticClass || scope.classCtx;
			const clean = String(rawName).replace(/^\\/, '').toLowerCase();
			return classes.get(clean) || null;
		}

		async function fetchIncludeSource(pathStr) {
			const raw = String(pathStr || '');
			if (fileSystem && fileSystem.isFile(raw)) {
				return fileSystem.readFile(raw);
			}
			const isAbs = raw.charAt(0) === '/' || /^[a-zA-Z]+:\/\//.test(raw);
			const searchPaths = [];
			if (!isAbs) {
				const incPath = iniConfig.get('include_path') || '.';
				const dirs = incPath.split(':');
				for (let i = 0; i < dirs.length; i++) {
					const d = dirs[i].trim();
					if (!d || d === '.') continue;
					const joined = d.endsWith('/') ? (d + raw) : (d + '/' + raw);
					if (fileSystem && fileSystem.isFile(joined)) {
						return fileSystem.readFile(joined);
					}
					if (searchPaths.indexOf(joined) === -1) {
						searchPaths.push(joined);
					}
				}
			}
			if (includeHandler) {
				try {
					return await new Promise(function(resolve, reject) {
						includeHandler(raw, { resolve: resolve, reject: reject });
					});
				} catch (firstErr) {
					for (let i = 0; i < searchPaths.length; i++) {
						const cand = searchPaths[i];
						if (cand.charAt(0) === '/') continue;
						try {
							return await new Promise(function(resolve, reject) {
								includeHandler(cand, { resolve: resolve, reject: reject });
							});
						} catch (_nextErr) {}
					}
					throw firstErr;
				}
			}
			throw new Error('File not found: ' + pathStr);
		}

		async function hoistTopLevelDecls(stmts, scope) {
			for (let i = 0; i < stmts.length; i++) {
				const st = stmts[i];
				if (st.type === 'FunctionDecl') {
					const fnName = scope.namespace ? scope.namespace + '\\' + st.name : st.name;
					userFunctions.set(fnName.toLowerCase(), new BopClosure({
						name: fnName,
						params: st.params,
						body: st.body,
						returnsRef: st.returnsRef,
						file: scope.file,
						namespace: scope.namespace
					}));
				} else if (st.type === 'ClassDecl') {
					await evalClassDecl(st, scope);
				} else if (st.type === 'InterfaceDecl') {
					await evalInterfaceDecl(st, scope);
				}
			}
		}

		async function evalInterfaceDecl(st, scope) {
			const lc = st.name.toLowerCase();
			const iface = new BopClass(st.name);
			iface.isAbstract = true;
			for (let i = 0; i < st.extends.length; i++) {
				const p = resolveClassName(st.extends[i], scope);
				if (p) iface.interfaces.push(p);
			}
			for (let i = 0; i < st.constants.length; i++) {
				iface.constants.set(st.constants[i].name, await evalExpr(st.constants[i].value, scope));
			}
			for (let i = 0; i < st.methods.length; i++) {
				const m = st.methods[i];
				iface.methods.set(m.name.toLowerCase(), m);
			}
			classes.set(lc, iface);
		}

		async function evalClassDecl(st, scope) {
			const lc = st.name.toLowerCase();
			const klass = new BopClass(st.name);
			klass.isAbstract = st.isAbstract;
			klass.isFinal = st.isFinal;
			if (st.parent) {
				klass.parent = resolveClassName(st.parent, scope);
				if (!klass.parent) {
					throw new Error(`BOP Fatal error: Class '${st.parent}' not found in ${scope.file} on line ${st.line}`);
				}
			}
			for (let i = 0; i < st.interfaces.length; i++) {
				const iface = resolveClassName(st.interfaces[i], scope);
				if (iface) klass.interfaces.push(iface);
			}
			for (let i = 0; i < st.constants.length; i++) {
				const val = await evalExpr(st.constants[i].value, scope);
				klass.constants.set(st.constants[i].name, val);
			}
			for (let i = 0; i < st.properties.length; i++) {
				const prop = st.properties[i];
				const val = prop.defaultExpr ? await evalExpr(prop.defaultExpr, scope) : null;
				if (prop.isStatic) {
					klass.staticProps.set(prop.name, new BopCell(val));
				} else {
					klass.propDefs.set(prop.name, { visibility: prop.visibility, defaultExpr: prop.defaultExpr, defaultVal: val });
				}
			}
			for (let i = 0; i < st.methods.length; i++) {
				const m = st.methods[i];
				klass.methods.set(m.name.toLowerCase(), Object.assign({}, m, { file: scope.file, namespace: scope.namespace }));
			}
			classes.set(lc, klass);
		}

		function collectLabels(stmts, map = new Map()) {
			for (let i = 0; i < stmts.length; i++) {
				const st = stmts[i];
				if (st.type === 'Label') {
					map.set(st.name, i);
				}
			}
			return map;
		}

		async function execStmtList(stmts, scope) {
			const labelMap = collectLabels(stmts);
			let pc = 0;
			while (pc < stmts.length) {
				try {
					await execStmt(stmts[pc], scope);
					pc++;
				} catch (sig) {
					if (sig instanceof GotoSignal && labelMap.has(sig.label)) {
						pc = labelMap.get(sig.label) + 1;
						continue;
					}
					throw sig;
				}
			}
		}

		async function execStmt(st, scope) {
			if (!st) return;
			switch (st.type) {
				case 'EmptyStmt':
				case 'Label':
					return;
				case 'InlineText':
					writeOutput(st.value);
					return;
				case 'Block':
					return await execStmtList(st.body, scope);
				case 'Namespace':
					if (st.body !== null) {
						const subScope = makeScope(scope, {
							isGlobal: scope.isGlobal,
							file: scope.file,
							namespace: st.name
						});
						subScope.vars = scope.vars;
						await execStmtList(st.body, subScope);
					} else {
						scope.namespace = st.name;
						currentNamespace = st.name;
					}
					return;
				case 'Use':
					return;
				case 'ConstDecl':
					for (let i = 0; i < st.items.length; i++) {
						const val = await evalExpr(st.items[i].value, scope);
						defineConstant(st.items[i].name, val);
					}
					return;
				case 'FunctionDecl': {
					const fnName = scope.namespace ? scope.namespace + '\\' + st.name : st.name;
					userFunctions.set(fnName.toLowerCase(), new BopClosure({
						name: fnName,
						params: st.params,
						body: st.body,
						returnsRef: st.returnsRef,
						file: scope.file,
						namespace: scope.namespace
					}));
					return;
				}
				case 'ClassDecl':
					return await evalClassDecl(st, scope);
				case 'InterfaceDecl':
					return await evalInterfaceDecl(st, scope);
				case 'Echo':
					for (let i = 0; i < st.exprs.length; i++) {
						writeOutput(toBopString(await evalExpr(st.exprs[i], scope)));
					}
					return;
				case 'ExprStmt':
					await evalExpr(st.expr, scope);
					return;
				case 'If': {
					const cond = await evalExpr(st.test, scope);
					if (toBool(cond)) {
						await execStmt(st.consequent, scope);
					} else if (st.alternate) {
						await execStmt(st.alternate, scope);
					}
					return;
				}
				case 'Switch': {
					const disc = await evalExpr(st.discriminant, scope);
					let matched = false;
					let defaultIdx = -1;
					for (let i = 0; i < st.cases.length; i++) {
						const c = st.cases[i];
						if (c.test === null) {
							defaultIdx = i;
							continue;
						}
						const testVal = await evalExpr(c.test, scope);
						if (bopLooseEq(disc, testVal)) {
							matched = true;
							try {
								for (let j = i; j < st.cases.length; j++) {
									await execStmtList(st.cases[j].body, scope);
								}
							} catch (sig) {
								if (sig instanceof BreakSignal) {
									if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
									return;
								}
								if (sig instanceof ContinueSignal) {
									if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
									return;
								}
								throw sig;
							}
							return;
						}
					}
					if (!matched && defaultIdx !== -1) {
						try {
							for (let j = defaultIdx; j < st.cases.length; j++) {
								await execStmtList(st.cases[j].body, scope);
							}
						} catch (sig) {
							if (sig instanceof BreakSignal) {
								if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
								return;
							}
							if (sig instanceof ContinueSignal) {
								if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
								return;
							}
							throw sig;
						}
					}
					return;
				}
				case 'While':
					while (toBool(await evalExpr(st.test, scope))) {
						try {
							await execStmt(st.body, scope);
						} catch (sig) {
							if (sig instanceof BreakSignal) {
								if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
								break;
							}
							if (sig instanceof ContinueSignal) {
								if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
								continue;
							}
							throw sig;
						}
					}
					return;
				case 'DoWhile':
					do {
						try {
							await execStmt(st.body, scope);
						} catch (sig) {
							if (sig instanceof BreakSignal) {
								if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
								break;
							}
							if (sig instanceof ContinueSignal) {
								if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
								continue;
							}
							throw sig;
						}
					} while (toBool(await evalExpr(st.test, scope)));
					return;
				case 'For':
					for (let i = 0; i < st.init.length; i++) {
						await evalExpr(st.init[i], scope);
					}
					while (true) {
						if (st.test.length > 0) {
							let condVal = true;
							for (let i = 0; i < st.test.length; i++) {
								condVal = toBool(await evalExpr(st.test[i], scope));
							}
							if (!condVal) break;
						}
						try {
							await execStmt(st.body, scope);
						} catch (sig) {
							if (sig instanceof BreakSignal) {
								if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
								break;
							}
							if (sig instanceof ContinueSignal) {
								if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
								// fall through to update
							} else {
								throw sig;
							}
						}
						for (let i = 0; i < st.update.length; i++) {
							await evalExpr(st.update[i], scope);
						}
					}
					return;
				case 'Foreach': {
					const rawIter = await evalExpr(st.iterable, scope);
					if (!(rawIter instanceof BopArray)) return;
					const iterArr = st.byRef ? rawIter : rawIter.clone();
					const entries = iterArr.entries.slice();
					for (let i = 0; i < entries.length; i++) {
						const entry = entries[i];
						if (st.keyVar) {
							await assignTarget(st.keyVar, entry.key, scope);
						}
						if (st.byRef) {
							entry.cell.isRef = true;
							await assignTargetRef(st.valueVar, entry.cell, scope);
						} else {
							await assignTarget(st.valueVar, cloneBopValue(entry.cell.value), scope);
						}
						try {
							await execStmt(st.body, scope);
						} catch (sig) {
							if (sig instanceof BreakSignal) {
								if (sig.levels > 1) throw new BreakSignal(sig.levels - 1);
								break;
							}
							if (sig instanceof ContinueSignal) {
								if (sig.levels > 1) throw new ContinueSignal(sig.levels - 1);
								continue;
							}
							throw sig;
						}
					}
					return;
				}
				case 'Break':
					throw new BreakSignal(st.levels);
				case 'Continue':
					throw new ContinueSignal(st.levels);
				case 'Return': {
					const val = st.argument ? await evalExpr(st.argument, scope) : null;
					throw new ReturnSignal(val);
				}
				case 'Throw': {
					const exc = await evalExpr(st.argument, scope);
					throw new BopThrownException(exc);
				}
				case 'Try': {
					let pendingError = null;
					try {
						await execStmt(st.block, scope);
					} catch (err) {
						if (err instanceof BopThrownException) {
							let handled = false;
							for (let i = 0; i < st.catches.length; i++) {
								const c = st.catches[i];
								const matches = c.types.some(t =>
									err.obj instanceof BopObject && err.obj.klass.isSubclassOf(t)
								);
								if (matches) {
									getVarCell(scope, c.varName, true).value = err.obj;
									try {
										await execStmt(c.block, scope);
									} catch (innerErr) {
										pendingError = innerErr;
									}
									handled = true;
									break;
								}
							}
							if (!handled) pendingError = err;
						} else if (err instanceof Error && !(err instanceof ReturnSignal || err instanceof BreakSignal || err instanceof ContinueSignal || err instanceof GotoSignal || err instanceof ExitSignal)) {
							let handled = false;
							for (let i = 0; i < st.catches.length; i++) {
								const c = st.catches[i];
								if (c.types.some(t => t.toLowerCase() === 'exception' || t.toLowerCase() === 'throwable' || t.toLowerCase() === 'error')) {
									const excObj = new BopObject(exceptionClass);
									excObj.props.set('message', new BopCell(err.message));
									getVarCell(scope, c.varName, true).value = excObj;
									try {
										await execStmt(c.block, scope);
									} catch (innerErr) {
										pendingError = innerErr;
									}
									handled = true;
									break;
								}
							}
							if (!handled) pendingError = err;
						} else {
							pendingError = err;
						}
					}
					if (st.finalizer) {
						await execStmt(st.finalizer, scope);
					}
					if (pendingError) throw pendingError;
					return;
				}
				case 'Goto':
					throw new GotoSignal(st.label);
				case 'Global':
					for (let i = 0; i < st.vars.length; i++) {
						const name = st.vars[i];
						let gCell = globalCells.get(name);
						if (!gCell) {
							gCell = new BopCell(null);
							globalCells.set(name, gCell);
						}
						gCell.isRef = true;
						scope.vars.set(name, gCell);
					}
					return;
				case 'StaticVar': {
					const keyPrefix = (scope.funcName || scope.file) + ':';
					for (let i = 0; i < st.items.length; i++) {
						const item = st.items[i];
						const staticKey = keyPrefix + item.name;
						let cell = currentStaticBindings.get(staticKey);
						if (!cell) {
							const initVal = item.init ? await evalExpr(item.init, scope) : null;
							cell = new BopCell(initVal, true);
							currentStaticBindings.set(staticKey, cell);
						}
						scope.vars.set(item.name, cell);
					}
					return;
				}
				case 'Unset':
					for (let i = 0; i < st.targets.length; i++) {
						await unsetTarget(st.targets[i], scope);
					}
					return;
			}
		}

		// --- L-Value Cell & Assignment Resolution ---

		async function getLValueCell(expr, scope, create = true) {
			if (expr.type === 'Var') {
				return getVarCell(scope, expr.name, create);
			}
			if (expr.type === 'DynamicVar') {
				const name = toBopString(await evalExpr(expr.nameExpr, scope));
				return getVarCell(scope, name, create);
			}
			if (expr.type === 'Subscript') {
				const parentCell = await getLValueCell(expr.target, scope, create);
				if (!parentCell) return null;
				if (!(parentCell.value instanceof BopArray)) {
					if (!create) return null;
					parentCell.value = new BopArray();
				}
				const key = expr.index ? await evalExpr(expr.index, scope) : null;
				if (!create) return key === null ? null : parentCell.value.getCell(key);
				return parentCell.value.ensureCell(key);
			}
			if (expr.type === 'MemberAccess') {
				const obj = await evalExpr(expr.object, scope);
				const propName = expr.dynamic ? toBopString(await evalExpr(expr.name, scope)) : expr.name;
				if (obj instanceof BopObject) {
					let cell = obj.props.get(propName);
					if (!cell && create) {
						cell = new BopCell(null);
						obj.props.set(propName, cell);
					}
					return cell || null;
				}
				if (obj instanceof BopHostObject && obj.target) {
					return {
						get value() { return fromJsValue(obj.target[propName]); },
						set value(v) { obj.target[propName] = toJsValue(v, engine); }
					};
				}
			}
			if (expr.type === 'StaticMember') {
				const klass = resolveClassName(expr.target.name, scope);
				if (!klass) throw new Error(`BOP Fatal error: Class '${expr.target.name}' not found`);
				return klass.getStaticPropCell(expr.name);
			}
			return null;
		}

		async function assignTarget(expr, value, scope) {
			if (expr.type === 'ListPattern') {
				if (value instanceof BopArray) {
					for (let i = 0; i < expr.targets.length; i++) {
						if (expr.targets[i]) {
							const v = value.has(i) ? value.get(i) : null;
							await assignTarget(expr.targets[i], cloneBopValue(v), scope);
						}
					}
				}
				return value;
			}
			const cell = await getLValueCell(expr, scope, true);
			if (!cell) {
				throw new Error(`BOP Fatal error: Cannot assign to target on line ${expr.line}`);
			}
			cell.value = cloneBopValue(value);
			return value;
		}

		async function assignTargetRef(expr, refCell, scope) {
			refCell.isRef = true;
			if (expr.type === 'Var') {
				scope.vars.set(expr.name, refCell);
				return refCell.value;
			}
			if (expr.type === 'DynamicVar') {
				const name = toBopString(await evalExpr(expr.nameExpr, scope));
				scope.vars.set(name, refCell);
				return refCell.value;
			}
			if (expr.type === 'Subscript') {
				const parentCell = await getLValueCell(expr.target, scope, true);
				if (!(parentCell.value instanceof BopArray)) parentCell.value = new BopArray();
				const key = expr.index ? await evalExpr(expr.index, scope) : null;
				parentCell.value.setCell(key, refCell);
				return refCell.value;
			}
			if (expr.type === 'MemberAccess') {
				const obj = await evalExpr(expr.object, scope);
				const propName = expr.dynamic ? toBopString(await evalExpr(expr.name, scope)) : expr.name;
				if (obj instanceof BopObject) {
					obj.props.set(propName, refCell);
					return refCell.value;
				}
			}
			return await assignTarget(expr, refCell.value, scope);
		}

		async function unsetTarget(expr, scope) {
			if (expr.type === 'Var') {
				scope.vars.delete(expr.name);
				return;
			}
			if (expr.type === 'DynamicVar') {
				const name = toBopString(await evalExpr(expr.nameExpr, scope));
				scope.vars.delete(name);
				return;
			}
			if (expr.type === 'Subscript') {
				const parentCell = await getLValueCell(expr.target, scope, false);
				if (parentCell && parentCell.value instanceof BopArray && expr.index) {
					const k = await evalExpr(expr.index, scope);
					parentCell.value.delete(k);
				}
				return;
			}
			if (expr.type === 'MemberAccess') {
				const obj = await evalExpr(expr.object, scope);
				const propName = expr.dynamic ? toBopString(await evalExpr(expr.name, scope)) : expr.name;
				if (obj instanceof BopObject) obj.props.delete(propName);
			}
		}

		// --- Expression Evaluator ---

		async function evalExpr(expr, scope) {
			if (!expr) return null;
			switch (expr.type) {
				case 'Literal':
					return expr.value;
				case 'InterpolatedString': {
					let out = '';
					for (let i = 0; i < expr.parts.length; i++) {
						out += toBopString(await evalExpr(expr.parts[i], scope));
					}
					return out;
				}
				case 'MagicConst':
					if (expr.name === '__LINE__') return expr.line || 1;
					if (expr.name === '__FILE__') return scope.file;
					if (expr.name === '__DIR__') {
						const idx = scope.file.lastIndexOf('/');
						return idx <= 0 ? '/' : scope.file.slice(0, idx);
					}
					if (expr.name === '__FUNCTION__') return scope.funcName || '';
					if (expr.name === '__CLASS__') return scope.classCtx ? scope.classCtx.name : '';
					if (expr.name === '__METHOD__') return scope.classCtx && scope.funcName ? `${scope.classCtx.name}::${scope.funcName}` : (scope.funcName || '');
					if (expr.name === '__NAMESPACE__') return scope.namespace || '';
					return '';
				case 'Var': {
					if (expr.name === 'this') {
						if (!scope.thisObj) emitNotice('Undefined variable: this', scope.file, expr.line);
						return scope.thisObj;
					}
					const cell = scope.vars.get(expr.name);
					if (!cell) {
						emitNotice(`Undefined variable: ${expr.name}`, scope.file, expr.line);
						return null;
					}
					return cell.value;
				}
				case 'DynamicVar': {
					const name = toBopString(await evalExpr(expr.nameExpr, scope));
					const cell = scope.vars.get(name);
					return cell ? cell.value : null;
				}
				case 'ConstRef': {
					const name = expr.name;
					if (constants.has(name)) return constants.get(name);
					const clean = name.replace(/^\\/, '');
					if (constants.has(clean)) return constants.get(clean);
					return name;
				}
				case 'ArrayLiteral': {
					const arr = new BopArray();
					for (let i = 0; i < expr.items.length; i++) {
						const item = expr.items[i];
						const k = item.key ? await evalExpr(item.key, scope) : null;
						if (item.byRef) {
							const cell = await getLValueCell(item.value, scope, true);
							cell.isRef = true;
							arr.setCell(k, cell);
						} else {
							const v = await evalExpr(item.value, scope);
							arr.set(k, cloneBopValue(v));
						}
					}
					return arr;
				}
				case 'Subscript': {
					const target = await evalExpr(expr.target, scope);
					if (!expr.index) {
						throw new Error(`BOP Fatal error: Cannot use [] for reading on line ${expr.line}`);
					}
					const idx = await evalExpr(expr.index, scope);
					if (target instanceof BopArray) {
						return target.has(idx) ? target.get(idx) : null;
					}
					if (typeof target === 'string') {
						const n = toInt(idx);
						return n >= 0 && n < target.length ? target.charAt(n) : '';
					}
					if (target instanceof BopHostObject && target.target) {
						return fromJsValue(target.target[String(idx)]);
					}
					return null;
				}
				case 'Assign': {
					const val = await evalExpr(expr.right, scope);
					return await assignTarget(expr.left, val, scope);
				}
				case 'AssignRef': {
					const refCell = await getLValueCell(expr.right, scope, true);
					if (!refCell) return null;
					return await assignTargetRef(expr.left, refCell, scope);
				}
				case 'CompoundAssign': {
					const cell = await getLValueCell(expr.left, scope, true);
					if (!cell) {
						throw new Error(`BOP Fatal error: Can't use expression in write context in ${scope.file} on line ${expr.line}`);
					}
					if (expr.op === '??') {
						if (cell.value === null || cell.value === undefined) {
							cell.value = cloneBopValue(await evalExpr(expr.right, scope));
						}
						return cell.value;
					}
					const rhs = await evalExpr(expr.right, scope);
					cell.value = applyBinaryOp(expr.op, cell.value, rhs);
					return cell.value;
				}
				case 'Update': {
					const cell = await getLValueCell(expr.expr, scope, true);
					if (!cell) {
						throw new Error(`BOP Fatal error: Can't use expression in write context in ${scope.file} on line ${expr.line}`);
					}
					const oldVal = cell.value === null || cell.value === undefined ? 0 : cell.value;
					const delta = expr.op === '++' ? 1 : -1;
					const nextVal = toNumber(oldVal) + delta;
					cell.value = nextVal;
					return expr.prefix ? nextVal : oldVal;
				}
				case 'Unary': {
					if (expr.op === '@') {
						suppressDepth++;
						try {
							return await evalExpr(expr.expr, scope);
						} finally {
							suppressDepth--;
						}
					}
					const val = await evalExpr(expr.expr, scope);
					switch (expr.op) {
						case '!': return !toBool(val);
						case '~': return ~toInt(val);
						case '+': return toNumber(val);
						case '-': return -toNumber(val);
					}
					return val;
				}
				case 'Cast': {
					const v = await evalExpr(expr.expr, scope);
					switch (expr.castType) {
						case 'int': return toInt(v);
						case 'float': return toFloat(v);
						case 'string': return toBopString(v);
						case 'bool': return toBool(v);
						case 'array':
							if (v instanceof BopArray) return v.clone();
							if (v === null || v === undefined) return new BopArray();
							if (v instanceof BopObject) {
								const a = new BopArray();
								v.props.forEach((cell, k) => a.set(k, cloneBopValue(cell.value)));
								return a;
							}
							const single = new BopArray();
							single.push(v);
							return single;
						case 'object':
							if (v instanceof BopObject) return v;
							const obj = new BopObject(stdClass);
							if (v instanceof BopArray) {
								v.entries.forEach(e => obj.props.set(String(e.key), new BopCell(cloneBopValue(e.cell.value))));
							} else if (v !== null && v !== undefined) {
								obj.props.set('scalar', new BopCell(v));
							}
							return obj;
						case 'unset': return null;
					}
					return v;
				}
				case 'Binary': {
					if (expr.op === '&&') {
						const l = await evalExpr(expr.left, scope);
						if (!toBool(l)) return false;
						return toBool(await evalExpr(expr.right, scope));
					}
					if (expr.op === '||') {
						const l = await evalExpr(expr.left, scope);
						if (toBool(l)) return true;
						return toBool(await evalExpr(expr.right, scope));
					}
					const l = await evalExpr(expr.left, scope);
					const r = await evalExpr(expr.right, scope);
					return applyBinaryOp(expr.op, l, r);
				}
				case 'Conditional': {
					const cond = await evalExpr(expr.test, scope);
					if (expr.consequent === null) {
						return toBool(cond) ? cond : await evalExpr(expr.alternate, scope);
					}
					return toBool(cond) ? await evalExpr(expr.consequent, scope) : await evalExpr(expr.alternate, scope);
				}
				case 'NullCoalesce': {
					const l = await evalExpr(expr.left, scope);
					if (l !== null && l !== undefined) return l;
					return await evalExpr(expr.right, scope);
				}
				case 'Isset': {
					for (let i = 0; i < expr.args.length; i++) {
						const cell = await getLValueCell(expr.args[i], scope, false);
						if (!cell || cell.value === null || cell.value === undefined) return false;
					}
					return true;
				}
				case 'Empty': {
					const cell = await getLValueCell(expr.arg, scope, false);
					if (cell) return !toBool(cell.value);
					return !toBool(await evalExpr(expr.arg, scope));
				}
				case 'Print': {
					const v = await evalExpr(expr.expr, scope);
					writeOutput(toBopString(v));
					return 1;
				}
				case 'Clone': {
					const v = await evalExpr(expr.expr, scope);
					if (!(v instanceof BopObject)) return v;
					const copy = new BopObject(v.klass);
					v.props.forEach((c, k) => copy.props.set(k, new BopCell(cloneBopValue(c.value))));
					const cloneMethod = v.klass.getMethod('__clone');
					if (cloneMethod) {
						await invokeMethod(copy, v.klass, cloneMethod, []);
					}
					return copy;
				}
				case 'Instanceof': {
					const left = await evalExpr(expr.left, scope);
					if (!(left instanceof BopObject)) return false;
					let cname;
					if (expr.right.type === 'ConstRef') {
						cname = expr.right.name;
					} else {
						cname = toBopString(await evalExpr(expr.right, scope));
					}
					return left.klass.isSubclassOf(cname);
				}
				case 'Closure': {
					const useCells = new Map();
					for (let i = 0; i < expr.useVars.length; i++) {
						const uv = expr.useVars[i];
						const parentCell = getVarCell(scope, uv.name, true);
						if (uv.byRef) {
							parentCell.isRef = true;
							useCells.set(uv.name, parentCell);
						} else {
							useCells.set(uv.name, new BopCell(cloneBopValue(parentCell.value)));
						}
					}
					return new BopClosure({
						params: expr.params,
						body: expr.body,
						useCells: useCells,
						boundThis: scope.thisObj,
						boundClass: scope.classCtx,
						returnsRef: expr.returnsRef,
						file: scope.file,
						namespace: scope.namespace
					});
				}
				case 'Call': {
					return await evalCallExpr(expr, scope);
				}
				case 'New': {
					let klassName;
					if (expr.classExpr.type === 'ConstRef') {
						klassName = expr.classExpr.name;
					} else {
						klassName = toBopString(await evalExpr(expr.classExpr, scope));
					}
					const klass = resolveClassName(klassName, scope);
					if (!klass) {
						throw new Error(`BOP Fatal error: Class '${klassName}' not found in ${scope.file} on line ${expr.line}`);
					}
					if (klass.isAbstract) {
						throw new Error(`BOP Fatal error: Cannot instantiate abstract class ${klass.name}`);
					}
					const obj = new BopObject(klass);
					// Populate default properties along inheritance hierarchy
					const chain = [];
					for (let c = klass; c; c = c.parent) chain.unshift(c);
					for (let i = 0; i < chain.length; i++) {
						chain[i].propDefs.forEach((def, pname) => {
							obj.props.set(pname, new BopCell(cloneBopValue(def.defaultVal)));
						});
					}
					const ctor = klass.getMethod('__construct');
					if (ctor) {
						const args = await evalArgList(expr.args, scope);
						await invokeMethod(obj, klass, ctor, args);
					}
					return obj;
				}
				case 'MemberAccess': {
					const obj = await evalExpr(expr.object, scope);
					const propName = expr.dynamic ? toBopString(await evalExpr(expr.name, scope)) : expr.name;
					if (obj instanceof BopObject) {
						const cell = obj.props.get(propName);
						return cell ? cell.value : null;
					}
					if (obj instanceof BopHostObject && obj.target) {
						return fromJsValue(obj.target[propName]);
					}
					emitNotice(`Trying to get property '${propName}' of non-object`, scope.file, expr.line);
					return null;
				}
				case 'MethodCall': {
					const obj = await evalExpr(expr.object, scope);
					const mname = expr.dynamic ? toBopString(await evalExpr(expr.name, scope)) : expr.name;
					const args = await evalArgList(expr.args, scope);
					if (obj instanceof BopObject) {
						const found = obj.klass.getMethod(mname);
						if (!found) {
							throw new Error(`BOP Fatal error: Call to undefined method ${obj.klass.name}::${mname}() in ${scope.file} on line ${expr.line}`);
						}
						return await invokeMethod(obj, obj.klass, found, args);
					}
					if (obj instanceof BopHostObject && obj.target) {
						const fn = obj.target[mname];
						if (typeof fn !== 'function') {
							throw new Error(`BOP Fatal error: Call to undefined host method ${mname}() in ${scope.file} on line ${expr.line}`);
						}
						const jsArgs = args.map(a => toJsValue(a.value, engine));
						const res = fn.apply(obj.target, jsArgs);
						return await unwrapHostResult(res);
					}
					throw new Error(`BOP Fatal error: Call to a member function ${mname}() on non-object in ${scope.file} on line ${expr.line}`);
				}
				case 'ClassNameConst': {
					const k = expr.target.type === 'ConstRef'
						? resolveClassName(expr.target.name, scope)
						: null;
					return k ? k.name : '';
				}
				case 'ClassConstAccess': {
					const k = expr.target.type === 'ConstRef'
						? resolveClassName(expr.target.name, scope)
						: (await evalExpr(expr.target, scope))?.klass;
					if (!k) throw new Error(`BOP Fatal error: Class not found in ${scope.file} on line ${expr.line}`);
					const res = k.getConstant(expr.name);
					if (!res.found) throw new Error(`BOP Fatal error: Undefined class constant '${expr.name}'`);
					return res.value;
				}
				case 'StaticMember': {
					const k = expr.target.type === 'ConstRef'
						? resolveClassName(expr.target.name, scope)
						: null;
					if (!k) throw new Error(`BOP Fatal error: Class '${expr.target.name}' not found`);
					const cell = k.getStaticPropCell(expr.name);
					return cell ? cell.value : null;
				}
				case 'StaticCall': {
					const k = expr.target.type === 'ConstRef'
						? resolveClassName(expr.target.name, scope)
						: null;
					if (!k) throw new Error(`BOP Fatal error: Class '${expr.target.name}' not found`);
					const found = k.getMethod(expr.name);
					if (!found) {
						throw new Error(`BOP Fatal error: Call to undefined method ${k.name}::${expr.name}()`);
					}
					const args = await evalArgList(expr.args, scope);
					const staticCls = expr.target.name.toLowerCase() === 'static' ? (scope.staticClass || k) : k;
					return await invokeMethod(scope.thisObj, staticCls, found, args);
				}
				case 'Include': {
					const targetPath = toBopString(await evalExpr(expr.expr, scope));
					const normKey = fileSystem ? fileSystem.normalizePath(targetPath) : targetPath;
					if (expr.once && includedFiles.has(normKey)) {
						return true;
					}
					let srcCode;
					try {
						srcCode = await fetchIncludeSource(targetPath);
					} catch (err) {
						const reason = err && err.message ? err.message : String(err);
						if (expr.isRequire) {
							throw new Error(`BOP Fatal error: require(): Failed opening required '${targetPath}' (${reason}) in ${scope.file} on line ${expr.line}`);
						}
						emitWarning(`include(${targetPath}): failed to open stream: ${reason}`, scope.file, expr.line);
						emitWarning(`include(): Failed opening '${targetPath}' for inclusion`, scope.file, expr.line);
						return false;
					}
					includedFiles.add(normKey);
					return await executeSourceInternal(srcCode, targetPath, scope);
				}
				case 'Eval': {
					const rawCode = toBopString(await evalExpr(expr.expr, scope));
					return await executeSourceInternal('<?bop ' + rawCode, scope.file + ':eval', scope);
				}
				case 'Exit': {
					const v = expr.expr ? await evalExpr(expr.expr, scope) : 0;
					if (typeof v === 'string') writeOutput(v);
					throw new ExitSignal(typeof v === 'number' ? v : 0);
				}
			}
			return null;
		}

		function applyBinaryOp(op, l, r) {
			switch (op) {
				case '+': return toNumber(l) + toNumber(r);
				case '-': return toNumber(l) - toNumber(r);
				case '*': return toNumber(l) * toNumber(r);
				case '/': return toNumber(l) / toNumber(r);
				case '%': return toInt(l) % toInt(r);
				case '**': return Math.pow(toNumber(l), toNumber(r));
				case '.': return toBopString(l) + toBopString(r);
				case '&': return toInt(l) & toInt(r);
				case '|': return toInt(l) | toInt(r);
				case '^': return toInt(l) ^ toInt(r);
				case '<<': return toInt(l) << toInt(r);
				case '>>': return toInt(l) >> toInt(r);
				case '==': return bopLooseEq(l, r);
				case '!=': return !bopLooseEq(l, r);
				case '===': return bopStrictEq(l, r);
				case '!==': return !bopStrictEq(l, r);
				case '<': return bopCompare(l, r) < 0;
				case '<=': return bopCompare(l, r) <= 0;
				case '>': return bopCompare(l, r) > 0;
				case '>=': return bopCompare(l, r) >= 0;
				case '<=>': return bopCompare(l, r);
				case 'xor': return Boolean(toBool(l) !== toBool(r));
			}
			return null;
		}

		async function evalArgList(argExprs, scope) {
			const out = [];
			for (let i = 0; i < argExprs.length; i++) {
				const ae = argExprs[i];
				const cell = (ae.type === 'Var' || ae.type === 'DynamicVar' || ae.type === 'Subscript' || ae.type === 'MemberAccess')
					? await getLValueCell(ae, scope, false)
					: null;
				const value = cell ? cell.value : await evalExpr(ae, scope);
				out.push({ expr: ae, value: value, cell: cell, scope: scope });
			}
			return out;
		}

		async function unwrapHostResult(res) {
			if (res && typeof res === 'object' && res.__bopFFI && typeof res.asyncFn === 'function') {
				res = await res.asyncFn();
			}
			if (res && (typeof res === 'object' || typeof res === 'function') && typeof res.then === 'function' && !res.jquery) {
				res = await res;
			}
			return fromJsValue(res);
		}

		async function evalCallExpr(expr, scope) {
			const args = await evalArgList(expr.args, scope);
			let callee = null;

			if (expr.callee.type === 'ConstRef') {
				const name = expr.callee.name;
				const lc = name.replace(/^\\/, '').toLowerCase();
				if (userFunctions.has(lc)) {
					callee = userFunctions.get(lc);
				} else if (internalFunctions.has(lc)) {
					callee = internalFunctions.get(lc);
				} else {
					throw new Error(`BOP Fatal error: Uncaught Error: Call to undefined function ${name}() in ${scope.file} on line ${expr.line}`);
				}
			} else {
				callee = await evalExpr(expr.callee, scope);
			}

			return await invokeResolvedCallee(callee, args, scope, expr.line);
		}

		async function invokeResolvedCallee(callee, args, scope, line) {
			if (!callee) {
				throw new Error(`BOP Fatal error: Call to undefined function on line ${line || 1}`);
			}

			// Host JS function (e.g. $jQuery(...), $includeBop(...), $maskaan(...))
			if (callee instanceof BopHostObject && typeof callee.target === 'function') {
				const jsArgs = args.map(a => toJsValue(a.value, engine));
				const res = callee.target.apply(null, jsArgs);
				return await unwrapHostResult(res);
			}

			// String function name / Class::method
			if (typeof callee === 'string') {
				const lc = callee.replace(/^\\/, '').toLowerCase();
				if (userFunctions.has(lc)) callee = userFunctions.get(lc);
				else if (internalFunctions.has(lc)) callee = internalFunctions.get(lc);
				else throw new Error(`BOP Fatal error: Call to undefined function ${callee}()`);
			}

			// Array callable [$obj, 'method']
			if (callee instanceof BopArray && callee.entries.length === 2) {
				const target = callee.get(0);
				const method = toBopString(callee.get(1));
				if (target instanceof BopObject) {
					const found = target.klass.getMethod(method);
					return await invokeMethod(target, target.klass, found, args);
				}
				const klass = resolveClassName(toBopString(target), scope);
				if (klass) {
					const found = klass.getMethod(method);
					return await invokeMethod(null, klass, found, args);
				}
			}

			// Internal JS builtin
			if (callee && typeof callee.fn === 'function' && 'coercing' in callee) {
				if (callee.coercing) {
					const rawArgs = args.map(a => a.value);
					return await callee.fn.apply(null, rawArgs);
				} else {
					const refs = args.map(a => wrapNativeArgRef(a.value));
					return await callee.fn.apply(null, refs);
				}
			}

			// User BOP function / closure
			if (callee instanceof BopClosure) {
				const fnScope = makeScope(null, {
					isGlobal: false,
					file: callee.file,
					funcName: callee.name,
					thisObj: callee.boundThis,
					classCtx: callee.boundClass,
					staticClass: callee.boundClass,
					namespace: callee.namespace
				});
				callee.useCells.forEach((cell, name) => fnScope.vars.set(name, cell));

				for (let i = 0; i < callee.params.length; i++) {
					const param = callee.params[i];
					if (i < args.length) {
						const arg = args[i];
						if (param.byRef) {
							const targetCell = arg.cell || await getLValueCell(arg.expr, arg.scope, true);
							targetCell.isRef = true;
							fnScope.vars.set(param.name, targetCell);
						} else {
							fnScope.vars.set(param.name, new BopCell(cloneBopValue(arg.value)));
						}
					} else if (param.defaultExpr) {
						fnScope.vars.set(param.name, new BopCell(await evalExpr(param.defaultExpr, fnScope)));
					} else {
						fnScope.vars.set(param.name, new BopCell(null));
					}
				}

				const prevArgs = currentCallArgs;
				currentCallArgs = args.map(a => a.value);
				try {
					await execStmt(callee.body, fnScope);
					return null;
				} catch (sig) {
					if (sig instanceof ReturnSignal) {
						return sig.value;
					}
					throw sig;
				} finally {
					currentCallArgs = prevArgs;
				}
			}

			throw new Error(`BOP Fatal error: Object is not callable on line ${line || 1}`);
		}

		async function invokeMethod(thisObj, staticClass, methodEntry, args) {
			const m = methodEntry.method;
			if (m.builtinFn) {
				return await m.builtinFn.apply(null, [thisObj].concat(args.map(a => a.value)));
			}
			const fnScope = makeScope(null, {
				isGlobal: false,
				file: m.file || 'unknown',
				funcName: m.name,
				thisObj: m.isStatic ? null : thisObj,
				classCtx: methodEntry.owner,
				staticClass: staticClass,
				namespace: m.namespace || ''
			});
			for (let i = 0; i < m.params.length; i++) {
				const param = m.params[i];
				if (i < args.length) {
					const arg = args[i];
					if (param.byRef) {
						const targetCell = arg.cell || await getLValueCell(arg.expr, arg.scope, true);
						targetCell.isRef = true;
						fnScope.vars.set(param.name, targetCell);
					} else {
						fnScope.vars.set(param.name, new BopCell(cloneBopValue(arg.value)));
					}
				} else if (param.defaultExpr) {
					fnScope.vars.set(param.name, new BopCell(await evalExpr(param.defaultExpr, fnScope)));
				} else {
					fnScope.vars.set(param.name, new BopCell(null));
				}
			}
			const prevArgs = currentCallArgs;
			currentCallArgs = args.map(a => a.value);
			try {
				await execStmt(m.body, fnScope);
				return null;
			} catch (sig) {
				if (sig instanceof ReturnSignal) {
					return sig.value;
				}
				throw sig;
			} finally {
				currentCallArgs = prevArgs;
			}
		}

		async function executeSourceInternal(code, filePath, scopeOverride = null) {
			const processedCode = typeof globalScope.preprocessBopSource === 'function'
				? await globalScope.preprocessBopSource(code, {
					filePath: filePath || 'unknown',
					loadFile: fetchIncludeSource,
					normalizePath: function(p) {
						return fileSystem ? fileSystem.normalizePath(p) : String(p || '');
					},
					onWarning: function(msg, f, ln) {
						emitWarning(msg, f, ln);
					}
				})
				: code;
			const tokens = tokenizeBop(processedCode);
			const parser = new BopParser(tokens, filePath || 'unknown');
			const ast = parser.parseProgram();
			const execScope = scopeOverride || rootScope;
			if (!scopeOverride && filePath) {
				execScope.file = filePath;
			}
			await hoistTopLevelDecls(ast.body, execScope);
			try {
				await execStmtList(ast.body, execScope);
				return true;
			} catch (sig) {
				if (sig instanceof ReturnSignal) {
					return sig.value;
				}
				if (sig instanceof ExitSignal) {
					return null;
				}
				if (sig instanceof BopThrownException) {
					const msg = sig.obj instanceof BopObject && sig.obj.props.get('message')
						? sig.obj.props.get('message').value
						: String(sig.obj);
					const clsName = sig.obj instanceof BopObject ? sig.obj.klass.name : 'Exception';
					throw new Error(`BOP Fatal error: Uncaught ${clsName}: ${msg}`);
				}
				throw sig;
			}
		}

		// --- Engine Public Interface ---
		const engine = {
			_invokeCallable: async function(cb, rawArgs) {
				const args = rawArgs.map(v => ({ expr: null, value: v, cell: null, scope: rootScope }));
				return await invokeResolvedCallee(cb, args, rootScope, 1);
			},
			execute: function(code, filePath = 'unknown') {
				return makeDeferredPromise(executeSourceInternal(code, filePath, null));
			},
			expose: function(jsVal, name) {
				const wrapped = (typeof jsVal === 'object' && jsVal !== null) || typeof jsVal === 'function'
					? new BopHostObject(jsVal)
					: fromJsValue(jsVal);
				const cell = globalCells.get(name);
				if (cell) {
					cell.value = wrapped;
				} else {
					globalCells.set(name, new BopCell(wrapped));
				}
			},
			createFFIResult: function(_syncFn, asyncFn) {
				return { __bopFFI: true, asyncFn: asyncFn };
			},
			getStdout: function() { return stdout; },
			getStderr: function() { return stderr; },
			environment: {
				defineCoercingFunction: function(name, fn) {
					defineBuiltinFn(name, function() {
						const jsArgs = Array.prototype.slice.call(arguments).map(a => toJsValue(a, engine));
						const res = fn.apply(null, jsArgs);
						return fromJsValue(res);
					}, true);
				},
				defineFunction: function(name, factory) {
					let autoCoerce = true;
					const internals = {
						disableAutoCoercion: function() { autoCoerce = false; }
					};
					const impl = factory(internals);
					defineBuiltinFn(name, function() {
						if (!autoCoerce) {
							return impl.apply(null, arguments);
						}
						const jsArgs = Array.prototype.slice.call(arguments).map(a => toJsValue(a, engine));
						return fromJsValue(impl.apply(null, jsArgs));
					}, autoCoerce);
				},
				defineConstant: function(name, value) {
					defineConstant(name, value);
				},
				getState: function() {
					return {
						getValueFactory: function() { return valueFactory; },
						getFutureFactory: function() { return futureFactory; },
						getGlobalNamespace: function() { return globalNamespace; }
					};
				}
			}
		};

		return engine;
	}

	globalScope.createBopEngine = createBopEngine;
})(typeof window !== 'undefined' ? window : globalThis);
