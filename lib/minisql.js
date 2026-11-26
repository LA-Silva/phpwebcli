(function(globalScope) {
	'use strict';

	function createMiniSqlEngine(vfs) {
		const connections = new Map();
		let nextConnId = 1;

		function cloneJson(obj) {
			return JSON.parse(JSON.stringify(obj));
		}

		function tokenize(sql) {
			const tokens = [];
			const src = String(sql || '');
			let i = 0;
			const len = src.length;

			while (i < len) {
				const ch = src.charAt(i);
				if (/\s/.test(ch)) {
					i++;
					continue;
				}
				// Line comment --
				if (ch === '-' && src.charAt(i + 1) === '-') {
					i += 2;
					while (i < len && src.charAt(i) !== '\n') i++;
					continue;
				}
				// Block comment /* ... */
				if (ch === '/' && src.charAt(i + 1) === '*') {
					i += 2;
					while (i < len && !(src.charAt(i) === '*' && src.charAt(i + 1) === '/')) i++;
					i += 2;
					continue;
				}
				// Single-quoted string
				if (ch === "'") {
					let val = '';
					i++;
					while (i < len) {
						if (src.charAt(i) === "'" && src.charAt(i + 1) === "'") {
							val += "'";
							i += 2;
						} else if (src.charAt(i) === "'") {
							i++;
							break;
						} else {
							val += src.charAt(i++);
						}
					}
					tokens.push({ type: 'string', value: val });
					continue;
				}
				// Double-quoted or backtick or bracket identifier
				if (ch === '"' || ch === '`' || ch === '[') {
					const endCh = ch === '[' ? ']' : ch;
					let val = '';
					i++;
					while (i < len && src.charAt(i) !== endCh) {
						val += src.charAt(i++);
					}
					if (src.charAt(i) === endCh) i++;
					tokens.push({ type: 'ident', value: val, quoted: true });
					continue;
				}
				// Placeholder ?
				if (ch === '?') {
					tokens.push({ type: 'param', value: '?' });
					i++;
					continue;
				}
				// Named placeholder :name or $name
				if ((ch === ':' || ch === '$') && /[A-Za-z_0-9]/.test(src.charAt(i + 1))) {
					let j = i + 1;
					while (j < len && /[A-Za-z_0-9]/.test(src.charAt(j))) j++;
					tokens.push({ type: 'param', value: src.slice(i, j) });
					i = j;
					continue;
				}
				// Numbers
				if (/\d/.test(ch) || (ch === '.' && /\d/.test(src.charAt(i + 1)))) {
					let j = i;
					let hasDot = false;
					while (j < len && (/\d/.test(src.charAt(j)) || (!hasDot && src.charAt(j) === '.'))) {
						if (src.charAt(j) === '.') hasDot = true;
						j++;
					}
					const rawNum = src.slice(i, j);
					tokens.push({ type: 'number', value: hasDot ? parseFloat(rawNum) : parseInt(rawNum, 10) });
					i = j;
					continue;
				}
				// Two-char operators
				const two = src.slice(i, i + 2);
				if (two === '<=' || two === '>=' || two === '!=' || two === '<>' || two === '==' || two === '||') {
					tokens.push({ type: 'op', value: two });
					i += 2;
					continue;
				}
				// Single-char punct / op
				if ('(),.;=<>+-*/%'.indexOf(ch) !== -1) {
					tokens.push({ type: ch === ';' ? 'semi' : (/[(),.]/.test(ch) ? 'punct' : 'op'), value: ch });
					i++;
					continue;
				}
				// Word / keyword / identifier
				if (/[A-Za-z_]/.test(ch)) {
					let j = i;
					while (j < len && /[A-Za-z_0-9]/.test(src.charAt(j))) j++;
					const word = src.slice(i, j);
					tokens.push({ type: 'word', value: word, upper: word.toUpperCase() });
					i = j;
					continue;
				}
				throw new Error('SQL syntax error near "' + src.slice(i, i + 12) + '"');
			}
			return tokens;
		}

		function splitStatements(tokens) {
			const stmts = [];
			let cur = [];
			for (let i = 0; i < tokens.length; i++) {
				if (tokens[i].type === 'semi') {
					if (cur.length > 0) stmts.push(cur);
					cur = [];
				} else {
					cur.push(tokens[i]);
				}
			}
			if (cur.length > 0) stmts.push(cur);
			return stmts;
		}

		function valueToToken(val) {
			if (val === null || val === undefined) {
				return { type: 'word', value: 'NULL', upper: 'NULL' };
			}
			if (typeof val === 'boolean') {
				return { type: 'number', value: val ? 1 : 0 };
			}
			if (typeof val === 'number' && Number.isFinite(val)) {
				return { type: 'number', value: val };
			}
			return { type: 'string', value: String(val) };
		}

		function bindTokens(tokens, positional, named) {
			let posIdx = 0;
			return tokens.map(function(tok) {
				if (tok.type !== 'param') return tok;
				if (tok.value === '?') {
					if (posIdx >= positional.length) {
						throw new Error('Missing bound parameter at index ' + (posIdx + 1));
					}
					return valueToToken(positional[posIdx++]);
				}
				const keyWithPrefix = tok.value;
				const keyBare = tok.value.slice(1);
				if (Object.prototype.hasOwnProperty.call(named, keyWithPrefix)) {
					return valueToToken(named[keyWithPrefix]);
				}
				if (Object.prototype.hasOwnProperty.call(named, keyBare)) {
					return valueToToken(named[keyBare]);
				}
				if (Object.prototype.hasOwnProperty.call(named, ':' + keyBare)) {
					return valueToToken(named[':' + keyBare]);
				}
				throw new Error('Missing bound parameter "' + tok.value + '"');
			});
		}

		function findTableName(db, name) {
			const lower = String(name).toLowerCase();
			const keys = Object.keys(db.tables);
			for (let i = 0; i < keys.length; i++) {
				if (keys[i].toLowerCase() === lower) return keys[i];
			}
			return null;
		}

		function loadConnDb(conn) {
			if (conn.isMemory) {
				return conn.data;
			}
			const raw = vfs.readFile(conn.filename);
			if (raw !== null && raw !== '') {
				try {
					const parsed = JSON.parse(raw);
					if (parsed && typeof parsed === 'object' && parsed.tables) {
						conn.data = parsed;
						return conn.data;
					}
				} catch (_e) {}
			}
			if (!conn.data) {
				conn.data = { tables: {} };
			}
			return conn.data;
		}

		function persistConnDb(conn) {
			if (conn.isMemory || conn.txBackup !== null) {
				return;
			}
			vfs.writeFile(conn.filename, JSON.stringify(conn.data), false);
		}

		function likeMatch(text, pattern) {
			const regexStr = '^' + String(pattern)
				.replace(/[.+^${}()|[\]\\]/g, '\\$&')
				.replace(/%/g, '.*')
				.replace(/_/g, '.') + '$';
			return new RegExp(regexStr, 'is').test(String(text));
		}

		function compareSql(a, b) {
			if (a === null || a === undefined) {
				return (b === null || b === undefined) ? 0 : -1;
			}
			if (b === null || b === undefined) return 1;
			if (typeof a === 'number' && typeof b === 'number') {
				return a === b ? 0 : (a < b ? -1 : 1);
			}
			const sa = String(a);
			const sb = String(b);
			return sa === sb ? 0 : (sa < sb ? -1 : 1);
		}

		function isWord(tok, word) {
			return tok && tok.type === 'word' && tok.upper === word;
		}

		function isOp(tok, op) {
			return tok && tok.type === 'op' && tok.value === op;
		}

		function isPunct(tok, p) {
			return tok && tok.type === 'punct' && tok.value === p;
		}

		// Recursive-descent SQL expression parser & evaluator
		function parseExpression(tokens, startPos) {
			let pos = startPos;

			function peek() { return tokens[pos]; }
			function next() { return tokens[pos++]; }

			function parseOr() {
				let node = parseAnd();
				while (isWord(peek(), 'OR')) {
					next();
					const right = parseAnd();
					node = { kind: 'or', left: node, right: right };
				}
				return node;
			}

			function parseAnd() {
				let node = parseNot();
				while (isWord(peek(), 'AND')) {
					next();
					const right = parseNot();
					node = { kind: 'and', left: node, right: right };
				}
				return node;
			}

			function parseNot() {
				if (isWord(peek(), 'NOT')) {
					next();
					return { kind: 'not', expr: parseNot() };
				}
				return parseComparison();
			}

			function parseComparison() {
				let left = parseConcat();
				const t = peek();
				if (!t) return left;

				if (isWord(t, 'IS')) {
					next();
					let negated = false;
					if (isWord(peek(), 'NOT')) {
						negated = true;
						next();
					}
					if (!isWord(peek(), 'NULL')) {
						throw new Error('Expected NULL after IS');
					}
					next();
					return { kind: 'isnull', expr: left, negated: negated };
				}

				let negated = false;
				if (isWord(peek(), 'NOT')) {
					const after = tokens[pos + 1];
					if (isWord(after, 'LIKE') || isWord(after, 'IN') || isWord(after, 'BETWEEN')) {
						negated = true;
						next();
					}
				}

				if (isWord(peek(), 'LIKE')) {
					next();
					const pat = parseConcat();
					return { kind: 'like', left: left, right: pat, negated: negated };
				}

				if (isWord(peek(), 'IN')) {
					next();
					if (!isPunct(peek(), '(')) throw new Error('Expected ( after IN');
					next();
					const items = [];
					if (!isPunct(peek(), ')')) {
						items.push(parseOr());
						while (isPunct(peek(), ',')) {
							next();
							items.push(parseOr());
						}
					}
					if (!isPunct(peek(), ')')) throw new Error('Expected ) after IN list');
					next();
					return { kind: 'in', expr: left, items: items, negated: negated };
				}

				if (isWord(peek(), 'BETWEEN')) {
					next();
					const low = parseConcat();
					if (!isWord(peek(), 'AND')) throw new Error('Expected AND in BETWEEN');
					next();
					const high = parseConcat();
					return { kind: 'between', expr: left, low: low, high: high, negated: negated };
				}

				if (t.type === 'op' && ['=', '==', '!=', '<>', '<', '<=', '>', '>='].indexOf(t.value) !== -1) {
					next();
					const right = parseConcat();
					return { kind: 'cmp', op: t.value, left: left, right: right };
				}

				return left;
			}

			function parseConcat() {
				let node = parseAdd();
				while (isOp(peek(), '||')) {
					next();
					node = { kind: 'concat', left: node, right: parseAdd() };
				}
				return node;
			}

			function parseAdd() {
				let node = parseMul();
				while (isOp(peek(), '+') || isOp(peek(), '-')) {
					const op = next().value;
					node = { kind: 'arith', op: op, left: node, right: parseMul() };
				}
				return node;
			}

			function parseMul() {
				let node = parseUnary();
				while (isOp(peek(), '*') || isOp(peek(), '/') || isOp(peek(), '%')) {
					const op = next().value;
					node = { kind: 'arith', op: op, left: node, right: parseUnary() };
				}
				return node;
			}

			function parseUnary() {
				if (isOp(peek(), '-')) {
					next();
					return { kind: 'neg', expr: parseUnary() };
				}
				if (isOp(peek(), '+')) {
					next();
					return parseUnary();
				}
				return parsePrimary();
			}

			function parsePrimary() {
				const t = peek();
				if (!t) throw new Error('Unexpected end of SQL expression');

				if (isPunct(t, '(')) {
					next();
					const inner = parseOr();
					if (!isPunct(peek(), ')')) throw new Error('Expected closing )');
					next();
					return inner;
				}
				if (t.type === 'number') {
					next();
					return { kind: 'lit', value: t.value };
				}
				if (t.type === 'string') {
					next();
					return { kind: 'lit', value: t.value };
				}
				if (isOp(t, '*')) {
					next();
					return { kind: 'star' };
				}
				if (t.type === 'word') {
					if (t.upper === 'NULL') { next(); return { kind: 'lit', value: null }; }
					if (t.upper === 'TRUE') { next(); return { kind: 'lit', value: 1 }; }
					if (t.upper === 'FALSE') { next(); return { kind: 'lit', value: 0 }; }

					const name = next().value;
					if (isPunct(peek(), '(')) {
						next();
						let distinct = false;
						if (isWord(peek(), 'DISTINCT')) {
							distinct = true;
							next();
						}
						const args = [];
						if (!isPunct(peek(), ')')) {
							args.push(parseOr());
							while (isPunct(peek(), ',')) {
								next();
								args.push(parseOr());
							}
						}
						if (!isPunct(peek(), ')')) throw new Error('Expected ) after function arguments');
						next();
						return { kind: 'call', name: name.toUpperCase(), distinct: distinct, args: args };
					}
					if (isPunct(peek(), '.')) {
						next();
						const colTok = next();
						if (!colTok) throw new Error('Expected column name after .');
						if (isOp(colTok, '*')) {
							return { kind: 'qualstar', table: name };
						}
						return { kind: 'col', table: name, name: colTok.value };
					}
					return { kind: 'col', table: null, name: name };
				}
				if (t.type === 'ident') {
					const name = next().value;
					if (isPunct(peek(), '.')) {
						next();
						const colTok = next();
						return { kind: 'col', table: name, name: colTok.value };
					}
					return { kind: 'col', table: null, name: name };
				}
				throw new Error('Unexpected SQL token "' + t.value + '"');
			}

			const ast = parseOr();
			return { ast: ast, nextPos: pos };
		}

		function hasAggregate(node) {
			if (!node) return false;
			if (node.kind === 'call' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].indexOf(node.name) !== -1) {
				return true;
			}
			return hasAggregate(node.left) || hasAggregate(node.right) || hasAggregate(node.expr) ||
				hasAggregate(node.low) || hasAggregate(node.high) ||
				(node.args && node.args.some(hasAggregate)) ||
				(node.items && node.items.some(hasAggregate));
		}

		function resolveColumn(row, tableAlias, colName) {
			const lowerCol = String(colName).toLowerCase();
			if (tableAlias) {
				const lowerTbl = String(tableAlias).toLowerCase();
				if (row._qualified) {
					const tblMap = row._qualified[lowerTbl];
					if (tblMap && Object.prototype.hasOwnProperty.call(tblMap, lowerCol)) {
						return tblMap[lowerCol];
					}
				}
			}
			if (row._flat && Object.prototype.hasOwnProperty.call(row._flat, lowerCol)) {
				return row._flat[lowerCol];
			}
			return null;
		}

		function evalAst(node, row, groupRows) {
			if (!node) return null;
			switch (node.kind) {
				case 'lit':
					return node.value;
				case 'col':
					return resolveColumn(row, node.table, node.name);
				case 'neg': {
					const v = evalAst(node.expr, row, groupRows);
					return v === null ? null : -Number(v);
				}
				case 'concat': {
					const l = evalAst(node.left, row, groupRows);
					const r = evalAst(node.right, row, groupRows);
					if (l === null || r === null) return null;
					return String(l) + String(r);
				}
				case 'arith': {
					const l = evalAst(node.left, row, groupRows);
					const r = evalAst(node.right, row, groupRows);
					if (l === null || r === null) return null;
					const a = Number(l), b = Number(r);
					if (node.op === '+') return a + b;
					if (node.op === '-') return a - b;
					if (node.op === '*') return a * b;
					if (node.op === '/') return b === 0 ? null : a / b;
					if (node.op === '%') return b === 0 ? null : a % b;
					return null;
				}
				case 'and': {
					const l = evalAst(node.left, row, groupRows);
					if (!l) return 0;
					return evalAst(node.right, row, groupRows) ? 1 : 0;
				}
				case 'or': {
					const l = evalAst(node.left, row, groupRows);
					if (l) return 1;
					return evalAst(node.right, row, groupRows) ? 1 : 0;
				}
				case 'not':
					return evalAst(node.expr, row, groupRows) ? 0 : 1;
				case 'isnull': {
					const v = evalAst(node.expr, row, groupRows);
					const isN = (v === null || v === undefined);
					return (node.negated ? !isN : isN) ? 1 : 0;
				}
				case 'like': {
					const l = evalAst(node.left, row, groupRows);
					const r = evalAst(node.right, row, groupRows);
					if (l === null || r === null) return 0;
					const matched = likeMatch(l, r);
					return (node.negated ? !matched : matched) ? 1 : 0;
				}
				case 'in': {
					const v = evalAst(node.expr, row, groupRows);
					let found = false;
					for (let i = 0; i < node.items.length; i++) {
						const itemVal = evalAst(node.items[i], row, groupRows);
						if (compareSql(v, itemVal) === 0 && v !== null && itemVal !== null) {
							found = true;
							break;
						}
					}
					return (node.negated ? !found : found) ? 1 : 0;
				}
				case 'between': {
					const v = evalAst(node.expr, row, groupRows);
					const lo = evalAst(node.low, row, groupRows);
					const hi = evalAst(node.high, row, groupRows);
					if (v === null || lo === null || hi === null) return 0;
					const ok = compareSql(v, lo) >= 0 && compareSql(v, hi) <= 0;
					return (node.negated ? !ok : ok) ? 1 : 0;
				}
				case 'cmp': {
					const l = evalAst(node.left, row, groupRows);
					const r = evalAst(node.right, row, groupRows);
					if (l === null || r === null) return 0;
					const c = compareSql(l, r);
					if (node.op === '=' || node.op === '==') return c === 0 ? 1 : 0;
					if (node.op === '!=' || node.op === '<>') return c !== 0 ? 1 : 0;
					if (node.op === '<') return c < 0 ? 1 : 0;
					if (node.op === '<=') return c <= 0 ? 1 : 0;
					if (node.op === '>') return c > 0 ? 1 : 0;
					if (node.op === '>=') return c >= 0 ? 1 : 0;
					return 0;
				}
				case 'call': {
					const fn = node.name;
					if (fn === 'COUNT' || fn === 'SUM' || fn === 'AVG' || fn === 'MIN' || fn === 'MAX') {
						const rows = groupRows || (row ? [row] : []);
						if (fn === 'COUNT') {
							if (node.args.length === 0 || (node.args[0] && node.args[0].kind === 'star')) {
								return rows.length;
							}
							const vals = [];
							const seen = new Set();
							for (let i = 0; i < rows.length; i++) {
								const v = evalAst(node.args[0], rows[i], null);
								if (v !== null && v !== undefined) {
									if (node.distinct) {
										const k = JSON.stringify(v);
										if (!seen.has(k)) { seen.add(k); vals.push(v); }
									} else {
										vals.push(v);
									}
								}
							}
							return vals.length;
						}
						const vals = [];
						for (let i = 0; i < rows.length; i++) {
							const v = evalAst(node.args[0], rows[i], null);
							if (v !== null && v !== undefined) vals.push(v);
						}
						if (vals.length === 0) return fn === 'SUM' ? null : null;
						if (fn === 'SUM') {
							let s = 0;
							for (let i = 0; i < vals.length; i++) s += Number(vals[i]);
							return s;
						}
						if (fn === 'AVG') {
							let s = 0;
							for (let i = 0; i < vals.length; i++) s += Number(vals[i]);
							return s / vals.length;
						}
						if (fn === 'MIN') {
							let best = vals[0];
							for (let i = 1; i < vals.length; i++) if (compareSql(vals[i], best) < 0) best = vals[i];
							return best;
						}
						if (fn === 'MAX') {
							let best = vals[0];
							for (let i = 1; i < vals.length; i++) if (compareSql(vals[i], best) > 0) best = vals[i];
							return best;
						}
					}
					const evalArgs = node.args.map(function(a) { return evalAst(a, row, groupRows); });
					if (fn === 'SQLITE_VERSION') return '3.45.0-js';
					if (fn === 'LOWER') return evalArgs[0] === null ? null : String(evalArgs[0]).toLowerCase();
					if (fn === 'UPPER') return evalArgs[0] === null ? null : String(evalArgs[0]).toUpperCase();
					if (fn === 'LENGTH') return evalArgs[0] === null ? null : String(evalArgs[0]).length;
					if (fn === 'ABS') return evalArgs[0] === null ? null : Math.abs(Number(evalArgs[0]));
					if (fn === 'ROUND') {
						if (evalArgs[0] === null) return null;
						const p = evalArgs[1] !== undefined ? Number(evalArgs[1]) : 0;
						const f = Math.pow(10, p);
						return Math.round(Number(evalArgs[0]) * f) / f;
					}
					if (fn === 'COALESCE' || fn === 'IFNULL') {
						for (let i = 0; i < evalArgs.length; i++) {
							if (evalArgs[i] !== null && evalArgs[i] !== undefined) return evalArgs[i];
						}
						return null;
					}
					throw new Error('Unsupported SQL function "' + fn + '"');
				}
			}
			return null;
		}

		function makeRowEnv(tablesWithAliases) {
			// tablesWithAliases: [{ alias, columns, rowObj }]
			const _flat = {};
			const _qualified = {};
			const _orderedCols = [];
			for (let t = 0; t < tablesWithAliases.length; t++) {
				const item = tablesWithAliases[t];
				const tblLower = item.alias.toLowerCase();
				if (!_qualified[tblLower]) _qualified[tblLower] = {};
				for (let c = 0; c < item.columns.length; c++) {
					const colName = item.columns[c].name;
					const colLower = colName.toLowerCase();
					const val = item.rowObj ? item.rowObj[colName] : null;
					_qualified[tblLower][colLower] = val === undefined ? null : val;
					if (!Object.prototype.hasOwnProperty.call(_flat, colLower)) {
						_flat[colLower] = val === undefined ? null : val;
					}
					_orderedCols.push({ table: tblLower, name: colName, value: val === undefined ? null : val });
				}
			}
			return { _flat: _flat, _qualified: _qualified, _orderedCols: _orderedCols };
		}

		function getVirtualOrTable(db, name) {
			if (String(name).toLowerCase() === 'sqlite_master') {
				const tblNames = Object.keys(db.tables);
				const rows = tblNames.map(function(tn) {
					const t = db.tables[tn];
					const colDefs = t.columns.map(function(c) { return c.name + (c.type ? ' ' + c.type : ''); }).join(', ');
					return {
						type: 'table',
						name: tn,
						tbl_name: tn,
						sql: 'CREATE TABLE ' + tn + ' (' + colDefs + ')'
					};
				});
				return {
					name: 'sqlite_master',
					columns: [
						{ name: 'type', type: 'TEXT' },
						{ name: 'name', type: 'TEXT' },
						{ name: 'tbl_name', type: 'TEXT' },
						{ name: 'sql', type: 'TEXT' }
					],
					rows: rows
				};
			}
			const realName = findTableName(db, name);
			if (!realName) return null;
			return Object.assign({ name: realName }, db.tables[realName]);
		}

		function parseLiteral(tok) {
			if (!tok) return null;
			if (tok.type === 'number') return tok.value;
			if (tok.type === 'string') return tok.value;
			if (isWord(tok, 'NULL')) return null;
			if (isWord(tok, 'TRUE')) return 1;
			if (isWord(tok, 'FALSE')) return 0;
			return tok.value;
		}

		function executeCreateTable(conn, db, tokens) {
			let pos = 2; // after CREATE TABLE
			let ifNotExists = false;
			if (isWord(tokens[pos], 'IF') && isWord(tokens[pos + 1], 'NOT') && isWord(tokens[pos + 2], 'EXISTS')) {
				ifNotExists = true;
				pos += 3;
			}
			const tblTok = tokens[pos++];
			if (!tblTok) throw new Error('Expected table name in CREATE TABLE');
			const tblName = tblTok.value;
			const existing = findTableName(db, tblName);
			if (existing) {
				if (ifNotExists) return { columns: [], rows: [], changes: 0 };
				throw new Error('Table "' + tblName + '" already exists');
			}
			if (!isPunct(tokens[pos], '(')) throw new Error('Expected ( in CREATE TABLE');
			pos++;

			const columns = [];
			while (pos < tokens.length && !isPunct(tokens[pos], ')')) {
				// Skip table-level PRIMARY KEY (...) / UNIQUE (...) / FOREIGN KEY (...) constraints gracefully
				if (isWord(tokens[pos], 'PRIMARY') || isWord(tokens[pos], 'UNIQUE') || isWord(tokens[pos], 'FOREIGN') || isWord(tokens[pos], 'CONSTRAINT') || isWord(tokens[pos], 'CHECK')) {
					let depth = 0;
					while (pos < tokens.length) {
						if (isPunct(tokens[pos], '(')) depth++;
						else if (isPunct(tokens[pos], ')')) {
							if (depth === 0) break;
							depth--;
						} else if (isPunct(tokens[pos], ',') && depth === 0) {
							pos++;
							break;
						}
						pos++;
					}
					continue;
				}
				const colName = tokens[pos++].value;
				let colType = '';
				if (tokens[pos] && tokens[pos].type === 'word' && ['PRIMARY', 'NOT', 'NULL', 'UNIQUE', 'DEFAULT', 'AUTOINCREMENT'].indexOf(tokens[pos].upper) === -1) {
					colType = tokens[pos++].upper;
					if (isPunct(tokens[pos], '(')) {
						while (pos < tokens.length && !isPunct(tokens[pos], ')')) pos++;
						if (isPunct(tokens[pos], ')')) pos++;
					}
				}
				let pk = false, autoInc = false, notNull = false, unique = false, hasDefault = false, defaultVal = null;
				while (pos < tokens.length && !isPunct(tokens[pos], ',') && !isPunct(tokens[pos], ')')) {
					if (isWord(tokens[pos], 'PRIMARY') && isWord(tokens[pos + 1], 'KEY')) {
						pk = true;
						pos += 2;
						if (colType === 'INTEGER' || colType === 'INT') autoInc = true;
					} else if (isWord(tokens[pos], 'AUTOINCREMENT')) {
						autoInc = true;
						pos++;
					} else if (isWord(tokens[pos], 'NOT') && isWord(tokens[pos + 1], 'NULL')) {
						notNull = true;
						pos += 2;
					} else if (isWord(tokens[pos], 'NULL')) {
						pos++;
					} else if (isWord(tokens[pos], 'UNIQUE')) {
						unique = true;
						pos++;
					} else if (isWord(tokens[pos], 'DEFAULT')) {
						pos++;
						hasDefault = true;
						if (isOp(tokens[pos], '-') && tokens[pos + 1] && tokens[pos + 1].type === 'number') {
							defaultVal = -tokens[pos + 1].value;
							pos += 2;
						} else {
							defaultVal = parseLiteral(tokens[pos++]);
						}
					} else {
						pos++;
					}
				}
				if (isPunct(tokens[pos], ',')) pos++;
				columns.push({
					name: colName,
					type: colType,
					pk: pk,
					autoInc: autoInc,
					notNull: notNull,
					unique: unique,
					hasDefault: hasDefault,
					defaultVal: defaultVal
				});
			}
			db.tables[tblName] = { columns: columns, nextRowId: 1, rows: [] };
			persistConnDb(conn);
			return { columns: [], rows: [], changes: 0 };
		}

		function executeDropTable(conn, db, tokens) {
			let pos = 2;
			let ifExists = false;
			if (isWord(tokens[pos], 'IF') && isWord(tokens[pos + 1], 'EXISTS')) {
				ifExists = true;
				pos += 2;
			}
			const tblName = tokens[pos].value;
			const realName = findTableName(db, tblName);
			if (!realName) {
				if (ifExists) return { columns: [], rows: [], changes: 0 };
				throw new Error('No such table: ' + tblName);
			}
			delete db.tables[realName];
			persistConnDb(conn);
			return { columns: [], rows: [], changes: 0 };
		}

		function executeAlterTable(conn, db, tokens) {
			const tblName = tokens[2].value;
			const realName = findTableName(db, tblName);
			if (!realName) throw new Error('No such table: ' + tblName);
			const tbl = db.tables[realName];
			let pos = 3;
			if (isWord(tokens[pos], 'RENAME') && isWord(tokens[pos + 1], 'TO')) {
				const newName = tokens[pos + 2].value;
				db.tables[newName] = tbl;
				delete db.tables[realName];
				persistConnDb(conn);
				return { columns: [], rows: [], changes: 0 };
			}
			if (isWord(tokens[pos], 'ADD')) {
				pos++;
				if (isWord(tokens[pos], 'COLUMN')) pos++;
				const colName = tokens[pos++].value;
				let colType = '';
				if (tokens[pos] && tokens[pos].type === 'word' && tokens[pos].upper !== 'DEFAULT') {
					colType = tokens[pos++].upper;
				}
				let defaultVal = null;
				if (isWord(tokens[pos], 'DEFAULT')) {
					defaultVal = parseLiteral(tokens[pos + 1]);
				}
				tbl.columns.push({ name: colName, type: colType, pk: false, autoInc: false, notNull: false, unique: false, hasDefault: defaultVal !== null, defaultVal: defaultVal });
				for (let i = 0; i < tbl.rows.length; i++) {
					tbl.rows[i][colName] = defaultVal;
				}
				persistConnDb(conn);
				return { columns: [], rows: [], changes: 0 };
			}
			throw new Error('Unsupported ALTER TABLE syntax');
		}

		function executeInsert(conn, db, tokens) {
			let pos = 1;
			let conflictMode = null;
			if (isWord(tokens[pos], 'OR')) {
				conflictMode = tokens[pos + 1] ? tokens[pos + 1].upper : null;
				pos += 2;
			}
			if (!isWord(tokens[pos], 'INTO')) throw new Error('Expected INTO in INSERT');
			pos++;
			const tblName = tokens[pos++].value;
			const realName = findTableName(db, tblName);
			if (!realName) throw new Error('No such table: ' + tblName);
			const tbl = db.tables[realName];

			let targetCols = null;
			if (isPunct(tokens[pos], '(')) {
				pos++;
				targetCols = [];
				while (pos < tokens.length && !isPunct(tokens[pos], ')')) {
					const colReq = tokens[pos++].value;
					const matchedCol = tbl.columns.find(function(c) { return c.name.toLowerCase() === colReq.toLowerCase(); });
					if (!matchedCol) throw new Error('Table ' + realName + ' has no column named ' + colReq);
					targetCols.push(matchedCol.name);
					if (isPunct(tokens[pos], ',')) pos++;
				}
				pos++; // )
			} else {
				targetCols = tbl.columns.map(function(c) { return c.name; });
			}

			if (!isWord(tokens[pos], 'VALUES')) throw new Error('Expected VALUES in INSERT');
			pos++;

			let inserted = 0;
			let lastId = conn.lastInsertRowId || 0;

			while (pos < tokens.length) {
				if (!isPunct(tokens[pos], '(')) throw new Error('Expected ( in VALUES');
				pos++;
				const rowVals = [];
				if (!isPunct(tokens[pos], ')')) {
					const parsed = parseExpression(tokens, pos);
					rowVals.push(evalAst(parsed.ast, makeRowEnv([]), null));
					pos = parsed.nextPos;
					while (isPunct(tokens[pos], ',')) {
						pos++;
						const p2 = parseExpression(tokens, pos);
						rowVals.push(evalAst(p2.ast, makeRowEnv([]), null));
						pos = p2.nextPos;
					}
				}
				if (!isPunct(tokens[pos], ')')) throw new Error('Expected ) after VALUES');
				pos++;

				if (rowVals.length !== targetCols.length) {
					throw new Error('Column count (' + targetCols.length + ') does not match value count (' + rowVals.length + ')');
				}

				const newRow = {};
				for (let c = 0; c < tbl.columns.length; c++) {
					const colDef = tbl.columns[c];
					const idx = targetCols.indexOf(colDef.name);
					if (idx !== -1) {
						newRow[colDef.name] = rowVals[idx];
					} else if (colDef.hasDefault) {
						newRow[colDef.name] = colDef.defaultVal;
					} else {
						newRow[colDef.name] = null;
					}
				}

				const assignedRowId = tbl.nextRowId++;
				for (let c = 0; c < tbl.columns.length; c++) {
					const colDef = tbl.columns[c];
					if (colDef.pk && colDef.autoInc && (newRow[colDef.name] === null || newRow[colDef.name] === undefined)) {
						newRow[colDef.name] = assignedRowId;
					} else if (colDef.pk && typeof newRow[colDef.name] === 'number' && newRow[colDef.name] >= tbl.nextRowId) {
						tbl.nextRowId = newRow[colDef.name] + 1;
					}
				}

				// Check PK/UNIQUE/NOT NULL
				let conflictIndex = -1;
				for (let c = 0; c < tbl.columns.length; c++) {
					const colDef = tbl.columns[c];
					const v = newRow[colDef.name];
					if (colDef.notNull && (v === null || v === undefined)) {
						if (conflictMode === 'IGNORE') { conflictIndex = -2; break; }
						throw new Error('NOT NULL constraint failed: ' + realName + '.' + colDef.name);
					}
					if ((colDef.pk || colDef.unique) && v !== null && v !== undefined) {
						for (let r = 0; r < tbl.rows.length; r++) {
							if (compareSql(tbl.rows[r][colDef.name], v) === 0) {
								conflictIndex = r;
								break;
							}
						}
						if (conflictIndex !== -1) {
							if (conflictMode === 'IGNORE') {
								conflictIndex = -2;
								break;
							} else if (conflictMode === 'REPLACE') {
								break;
							}
							throw new Error('UNIQUE constraint failed: ' + realName + '.' + colDef.name);
						}
					}
				}

				if (conflictIndex === -2) {
					// ignored
				} else if (conflictIndex >= 0 && conflictMode === 'REPLACE') {
					tbl.rows[conflictIndex] = newRow;
					inserted++;
					const pkCol = tbl.columns.find(function(c) { return c.pk; });
					lastId = pkCol ? newRow[pkCol.name] : assignedRowId;
				} else {
					tbl.rows.push(newRow);
					inserted++;
					const pkCol = tbl.columns.find(function(c) { return c.pk; });
					lastId = pkCol ? newRow[pkCol.name] : assignedRowId;
				}

				if (isPunct(tokens[pos], ',')) pos++;
				else break;
			}

			conn.lastInsertRowId = lastId;
			conn.changes = inserted;
			persistConnDb(conn);
			return { columns: [], rows: [], changes: inserted, lastInsertRowId: lastId };
		}

		function executeUpdate(conn, db, tokens) {
			const tblName = tokens[1].value;
			const realName = findTableName(db, tblName);
			if (!realName) throw new Error('No such table: ' + tblName);
			const tbl = db.tables[realName];
			let pos = 2;
			if (!isWord(tokens[pos], 'SET')) throw new Error('Expected SET in UPDATE');
			pos++;

			const assignments = [];
			while (pos < tokens.length && !isWord(tokens[pos], 'WHERE')) {
				const colReq = tokens[pos++].value;
				const matchedCol = tbl.columns.find(function(c) { return c.name.toLowerCase() === colReq.toLowerCase(); });
				if (!matchedCol) throw new Error('No such column: ' + colReq);
				if (!isOp(tokens[pos], '=')) throw new Error('Expected = in SET');
				pos++;
				const parsed = parseExpression(tokens, pos);
				assignments.push({ col: matchedCol.name, ast: parsed.ast });
				pos = parsed.nextPos;
				if (isPunct(tokens[pos], ',')) pos++;
			}

			let whereAst = null;
			if (isWord(tokens[pos], 'WHERE')) {
				const wp = parseExpression(tokens, pos + 1);
				whereAst = wp.ast;
			}

			let updated = 0;
			for (let r = 0; r < tbl.rows.length; r++) {
				const rowEnv = makeRowEnv([{ alias: realName, columns: tbl.columns, rowObj: tbl.rows[r] }]);
				if (!whereAst || evalAst(whereAst, rowEnv, null)) {
					for (let a = 0; a < assignments.length; a++) {
						tbl.rows[r][assignments[a].col] = evalAst(assignments[a].ast, rowEnv, null);
					}
					updated++;
				}
			}

			conn.changes = updated;
			persistConnDb(conn);
			return { columns: [], rows: [], changes: updated };
		}

		function executeDelete(conn, db, tokens) {
			let pos = 1;
			if (!isWord(tokens[pos], 'FROM')) throw new Error('Expected FROM in DELETE');
			pos++;
			const tblName = tokens[pos++].value;
			const realName = findTableName(db, tblName);
			if (!realName) throw new Error('No such table: ' + tblName);
			const tbl = db.tables[realName];

			let whereAst = null;
			if (isWord(tokens[pos], 'WHERE')) {
				const wp = parseExpression(tokens, pos + 1);
				whereAst = wp.ast;
			}

			const before = tbl.rows.length;
			if (!whereAst) {
				tbl.rows = [];
			} else {
				tbl.rows = tbl.rows.filter(function(rowObj) {
					const rowEnv = makeRowEnv([{ alias: realName, columns: tbl.columns, rowObj: rowObj }]);
					return !evalAst(whereAst, rowEnv, null);
				});
			}
			const deleted = before - tbl.rows.length;
			conn.changes = deleted;
			persistConnDb(conn);
			return { columns: [], rows: [], changes: deleted };
		}

		function executeSelect(conn, db, tokens) {
			let pos = 1;
			let distinct = false;
			if (isWord(tokens[pos], 'DISTINCT')) {
				distinct = true;
				pos++;
			}

			// Parse select expressions until FROM or end
			const selectItems = [];
			while (pos < tokens.length && !isWord(tokens[pos], 'FROM') && !isWord(tokens[pos], 'WHERE') && !isWord(tokens[pos], 'ORDER') && !isWord(tokens[pos], 'LIMIT')) {
				const startTok = tokens[pos];
				const parsed = parseExpression(tokens, pos);
				pos = parsed.nextPos;
				let alias = null;
				if (isWord(tokens[pos], 'AS')) {
					pos++;
					alias = tokens[pos++].value;
				} else if (tokens[pos] && tokens[pos].type === 'word' && ['FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT'].indexOf(tokens[pos].upper) === -1) {
					alias = tokens[pos++].value;
				}
				if (!alias) {
					if (parsed.ast.kind === 'col') alias = parsed.ast.name;
					else alias = tokens.slice(startTok ? tokens.indexOf(startTok) : 0, pos).map(function(t) { return t.value; }).join('');
				}
				selectItems.push({ ast: parsed.ast, alias: alias });
				if (isPunct(tokens[pos], ',')) pos++;
				else break;
			}

			let workingRows = [makeRowEnv([])];
			let hasFrom = false;
			if (isWord(tokens[pos], 'FROM')) {
				hasFrom = true;
				pos++;
				const baseTblName = tokens[pos++].value;
				const baseTbl = getVirtualOrTable(db, baseTblName);
				if (!baseTbl) throw new Error('No such table: ' + baseTblName);
				let baseAlias = baseTbl.name;
				if (isWord(tokens[pos], 'AS')) {
					pos++;
					baseAlias = tokens[pos++].value;
				} else if (tokens[pos] && tokens[pos].type === 'word' && ['INNER', 'LEFT', 'JOIN', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT'].indexOf(tokens[pos].upper) === -1) {
					baseAlias = tokens[pos++].value;
				}

				let joined = baseTbl.rows.map(function(r) {
					return [{ alias: baseAlias, columns: baseTbl.columns, rowObj: r }];
				});

				while (isWord(tokens[pos], 'INNER') || isWord(tokens[pos], 'LEFT') || isWord(tokens[pos], 'JOIN')) {
					let joinType = 'INNER';
					if (isWord(tokens[pos], 'LEFT')) {
						joinType = 'LEFT';
						pos++;
						if (isWord(tokens[pos], 'OUTER')) pos++;
					} else if (isWord(tokens[pos], 'INNER')) {
						pos++;
					}
					if (!isWord(tokens[pos], 'JOIN')) throw new Error('Expected JOIN');
					pos++;
					const joinTblName = tokens[pos++].value;
					const joinTbl = getVirtualOrTable(db, joinTblName);
					if (!joinTbl) throw new Error('No such table: ' + joinTblName);
					let joinAlias = joinTbl.name;
					if (isWord(tokens[pos], 'AS')) {
						pos++;
						joinAlias = tokens[pos++].value;
					} else if (tokens[pos] && tokens[pos].type === 'word' && ['ON', 'WHERE', 'INNER', 'LEFT', 'JOIN', 'GROUP', 'HAVING', 'ORDER', 'LIMIT'].indexOf(tokens[pos].upper) === -1) {
						joinAlias = tokens[pos++].value;
					}
					let onAst = null;
					if (isWord(tokens[pos], 'ON')) {
						const op = parseExpression(tokens, pos + 1);
						onAst = op.ast;
						pos = op.nextPos;
					}
					const nextJoined = [];
					for (let i = 0; i < joined.length; i++) {
						let matchedAny = false;
						for (let j = 0; j < joinTbl.rows.length; j++) {
							const combined = joined[i].concat([{ alias: joinAlias, columns: joinTbl.columns, rowObj: joinTbl.rows[j] }]);
							const env = makeRowEnv(combined);
							if (!onAst || evalAst(onAst, env, null)) {
								nextJoined.push(combined);
								matchedAny = true;
							}
						}
						if (!matchedAny && joinType === 'LEFT') {
							nextJoined.push(joined[i].concat([{ alias: joinAlias, columns: joinTbl.columns, rowObj: null }]));
						}
					}
					joined = nextJoined;
				}

				workingRows = joined.map(makeRowEnv);
			}

			// WHERE
			if (isWord(tokens[pos], 'WHERE')) {
				const wp = parseExpression(tokens, pos + 1);
				pos = wp.nextPos;
				workingRows = workingRows.filter(function(r) {
					return Boolean(evalAst(wp.ast, r, null));
				});
			}

			// GROUP BY
			const groupExprs = [];
			if (isWord(tokens[pos], 'GROUP') && isWord(tokens[pos + 1], 'BY')) {
				pos += 2;
				while (pos < tokens.length) {
					const gp = parseExpression(tokens, pos);
					groupExprs.push(gp.ast);
					pos = gp.nextPos;
					if (isPunct(tokens[pos], ',')) pos++;
					else break;
				}
			}

			// HAVING
			let havingAst = null;
			if (isWord(tokens[pos], 'HAVING')) {
				const hp = parseExpression(tokens, pos + 1);
				havingAst = hp.ast;
				pos = hp.nextPos;
			}

			// ORDER BY
			const orderItems = [];
			if (isWord(tokens[pos], 'ORDER') && isWord(tokens[pos + 1], 'BY')) {
				pos += 2;
				while (pos < tokens.length) {
					const op = parseExpression(tokens, pos);
					pos = op.nextPos;
					let dir = 'ASC';
					if (isWord(tokens[pos], 'ASC') || isWord(tokens[pos], 'DESC')) {
						dir = tokens[pos++].upper;
					}
					orderItems.push({ ast: op.ast, dir: dir });
					if (isPunct(tokens[pos], ',')) pos++;
					else break;
				}
			}

			// LIMIT & OFFSET
			let limitCount = null;
			let offsetCount = 0;
			if (isWord(tokens[pos], 'LIMIT')) {
				pos++;
				const lp = parseExpression(tokens, pos);
				limitCount = Math.max(0, Math.trunc(Number(evalAst(lp.ast, makeRowEnv([]), null))));
				pos = lp.nextPos;
				if (isWord(tokens[pos], 'OFFSET')) {
					pos++;
					const op = parseExpression(tokens, pos);
					offsetCount = Math.max(0, Math.trunc(Number(evalAst(op.ast, makeRowEnv([]), null))));
					pos = op.nextPos;
				}
			}

			// Expand * or tbl.* into columns list
			const usesAggregate = groupExprs.length > 0 || selectItems.some(function(it) { return hasAggregate(it.ast); });
			let groups;
			if (usesAggregate) {
				if (groupExprs.length === 0) {
					groups = workingRows.length > 0 || hasFrom ? [{ rep: workingRows[0] || makeRowEnv([]), rows: workingRows }] : [{ rep: makeRowEnv([]), rows: [] }];
				} else {
					const map = new Map();
					for (let i = 0; i < workingRows.length; i++) {
						const keyVals = groupExprs.map(function(g) { return evalAst(g, workingRows[i], null); });
						const keyStr = JSON.stringify(keyVals);
						if (!map.has(keyStr)) map.set(keyStr, { rep: workingRows[i], rows: [] });
						map.get(keyStr).rows.push(workingRows[i]);
					}
					groups = Array.from(map.values());
				}
				if (havingAst) {
					groups = groups.filter(function(g) { return Boolean(evalAst(havingAst, g.rep, g.rows)); });
				}
			} else {
				groups = workingRows.map(function(r) { return { rep: r, rows: [r] }; });
			}

			// Sort groups/rows if ORDER BY
			if (orderItems.length > 0) {
				groups.sort(function(ga, gb) {
					for (let i = 0; i < orderItems.length; i++) {
						const va = evalAst(orderItems[i].ast, ga.rep, ga.rows);
						const vb = evalAst(orderItems[i].ast, gb.rep, gb.rows);
						const cmp = compareSql(va, vb);
						if (cmp !== 0) return orderItems[i].dir === 'DESC' ? -cmp : cmp;
					}
					return 0;
				});
			}

			// Build final columns & rows
			let outColumns = [];
			const outRows = [];
			const sampleRow = groups[0] ? groups[0].rep : (workingRows[0] || null);

			// Determine output column headers
			for (let s = 0; s < selectItems.length; s++) {
				const item = selectItems[s];
				if (item.ast.kind === 'star') {
					if (sampleRow && sampleRow._orderedCols.length > 0) {
						sampleRow._orderedCols.forEach(function(oc) { outColumns.push(oc.name); });
					}
				} else if (item.ast.kind === 'qualstar') {
					if (sampleRow) {
						const tLower = item.ast.table.toLowerCase();
						sampleRow._orderedCols.forEach(function(oc) {
							if (oc.table === tLower) outColumns.push(oc.name);
						});
					}
				} else {
					outColumns.push(item.alias);
				}
			}

			const seenDistinct = new Set();
			for (let g = 0; g < groups.length; g++) {
				const grp = groups[g];
				const rowVals = [];
				for (let s = 0; s < selectItems.length; s++) {
					const item = selectItems[s];
					if (item.ast.kind === 'star') {
						grp.rep._orderedCols.forEach(function(oc) { rowVals.push(oc.value); });
					} else if (item.ast.kind === 'qualstar') {
						const tLower = item.ast.table.toLowerCase();
						grp.rep._orderedCols.forEach(function(oc) {
							if (oc.table === tLower) rowVals.push(oc.value);
						});
					} else {
						rowVals.push(evalAst(item.ast, grp.rep, grp.rows));
					}
				}
				if (distinct) {
					const sig = JSON.stringify(rowVals);
					if (seenDistinct.has(sig)) continue;
					seenDistinct.add(sig);
				}
				outRows.push(rowVals);
			}

			const sliced = limitCount !== null
				? outRows.slice(offsetCount, offsetCount + limitCount)
				: (offsetCount > 0 ? outRows.slice(offsetCount) : outRows);

			return { columns: outColumns, rows: sliced, changes: 0 };
		}

		function executeSingle(conn, tokens) {
			const db = loadConnDb(conn);
			const head = tokens[0] ? tokens[0].upper : '';

			if (head === 'BEGIN') {
				if (conn.txBackup === null) {
					conn.txBackup = cloneJson(db);
				}
				return { columns: [], rows: [], changes: 0 };
			}
			if (head === 'COMMIT' || head === 'END') {
				conn.txBackup = null;
				persistConnDb(conn);
				return { columns: [], rows: [], changes: 0 };
			}
			if (head === 'ROLLBACK') {
				if (conn.txBackup !== null) {
					conn.data = conn.txBackup;
					conn.txBackup = null;
					persistConnDb(conn);
				}
				return { columns: [], rows: [], changes: 0 };
			}
			if (head === 'CREATE' && isWord(tokens[1], 'TABLE')) {
				return executeCreateTable(conn, db, tokens);
			}
			if (head === 'CREATE' && (isWord(tokens[1], 'INDEX') || (isWord(tokens[1], 'UNIQUE') && isWord(tokens[2], 'INDEX')))) {
				return { columns: [], rows: [], changes: 0 };
			}
			if (head === 'DROP' && isWord(tokens[1], 'TABLE')) {
				return executeDropTable(conn, db, tokens);
			}
			if (head === 'ALTER' && isWord(tokens[1], 'TABLE')) {
				return executeAlterTable(conn, db, tokens);
			}
			if (head === 'INSERT') {
				return executeInsert(conn, db, tokens);
			}
			if (head === 'UPDATE') {
				return executeUpdate(conn, db, tokens);
			}
			if (head === 'DELETE') {
				return executeDelete(conn, db, tokens);
			}
			if (head === 'SELECT') {
				return executeSelect(conn, db, tokens);
			}
			throw new Error('Unsupported SQL statement starting with "' + (tokens[0] ? tokens[0].value : '') + '"');
		}

		function open(filename) {
			let raw = String(filename ?? ':memory:').trim();
			if (raw.toLowerCase().indexOf('sqlite:') === 0) {
				raw = raw.slice(7) || ':memory:';
			}
			const isMemory = raw === '' || raw === ':memory:';
			const norm = isMemory ? ':memory:' : vfs.normalizePath(raw);
			const connId = nextConnId++;
			const conn = {
				id: connId,
				filename: norm,
				isMemory: isMemory,
				data: { tables: {} },
				txBackup: null,
				lastInsertRowId: 0,
				changes: 0
			};
			if (!isMemory) {
				loadConnDb(conn);
				if (!vfs.isFile(norm)) {
					vfs.writeFile(norm, JSON.stringify(conn.data), false);
				}
			}
			connections.set(connId, conn);
			return connId;
		}

		function close(connId) {
			return connections.delete(Number(connId));
		}

		function exec(connId, sql) {
			const conn = connections.get(Number(connId));
			if (!conn) throw new Error('Database connection is closed');
			const tokens = tokenize(sql);
			const stmts = splitStatements(tokens);
			let totalChanges = 0;
			for (let i = 0; i < stmts.length; i++) {
				const res = executeSingle(conn, stmts[i]);
				totalChanges += res.changes || 0;
			}
			conn.changes = totalChanges;
			return true;
		}

		function query(connId, sql, positionalParams, namedParams) {
			const conn = connections.get(Number(connId));
			if (!conn) throw new Error('Database connection is closed');
			let tokens = tokenize(sql);
			const stmts = splitStatements(tokens);
			if (stmts.length === 0) {
				return { columns: [], rows: [], changes: 0, lastInsertRowId: conn.lastInsertRowId };
			}
			const posArr = Array.isArray(positionalParams) ? positionalParams : [];
			const namedObj = (namedParams && typeof namedParams === 'object') ? namedParams : {};
			let lastRes = { columns: [], rows: [], changes: 0 };
			for (let i = 0; i < stmts.length; i++) {
				const bound = bindTokens(stmts[i], i === 0 ? posArr : [], namedObj);
				lastRes = executeSingle(conn, bound);
			}
			return {
				columns: lastRes.columns || [],
				rows: lastRes.rows || [],
				changes: conn.changes || 0,
				lastInsertRowId: conn.lastInsertRowId || 0
			};
		}

		function lastInsertRowId(connId) {
			const conn = connections.get(Number(connId));
			return conn ? (conn.lastInsertRowId || 0) : 0;
		}

		function changes(connId) {
			const conn = connections.get(Number(connId));
			return conn ? (conn.changes || 0) : 0;
		}

		function escapeString(str) {
			return String(str ?? '').replace(/'/g, "''");
		}

		return {
			open: open,
			close: close,
			exec: exec,
			query: query,
			lastInsertRowId: lastInsertRowId,
			changes: changes,
			escapeString: escapeString
		};
	}

	globalScope.createMiniSqlEngine = createMiniSqlEngine;
})(typeof window !== 'undefined' ? window : globalThis);
