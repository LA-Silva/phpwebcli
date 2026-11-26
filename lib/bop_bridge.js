(function(globalScope) {
	'use strict';

	function preprocessBopTags(code) {
		return String(code ?? '');
	}

	function formatBopError(text) {
		return String(text ?? '')
			.replace(/\bPHP (Warning|Fatal error|Parse error|Notice|Deprecated|Strict Standards|Catchable fatal error):/g, 'BOP $1:');
	}

	function createBopBridge(deps) {
		const opts = deps || {};
		const $fn = opts.$ || (typeof globalScope.$ === 'function' ? globalScope.$ : null);
		const fetchFn = opts.fetch || (typeof globalScope.fetch === 'function' ? globalScope.fetch : null);
		const bop = opts.bop || opts.php;
		const vfs = opts.vfs;
		const miniSql = opts.miniSql;
		const screenBuffer = opts.screenBuffer;
		const adlib = opts.adlib;
		const bopEditor = opts.bopEditor;
		const getTerm = typeof opts.getTerm === 'function' ? opts.getTerm : function() { return null; };
		const onReboot = typeof opts.onReboot === 'function' ? opts.onReboot : null;
		let currentPrompt = 'bop > ';

		const bridge = {
			version: '1.0.0',

			// DOM & network helpers
			getStyle: function(selector, prop) {
				return $fn ? $fn(selector).css(prop) : '';
			},
			setText: function(selector, text) {
				if (!$fn) return 0;
				const matches = $fn(selector);
				matches.text(text);
				return matches.length;
			},
			fetchText: function(url, phpCallback) {
				if (!fetchFn) return;
				fetchFn(url)
					.then(function(res) { return res.text(); })
					.then(function(body) {
						if (typeof phpCallback === 'function') {
							phpCallback(body);
						}
					})
					.catch(function(err) {
						const term = getTerm();
						if (term && typeof term.error === 'function') {
							term.error(err.message || String(err));
						}
					});
			},

			// String & Perl split helpers
			fromCharCode: function(code) {
				return String.fromCharCode(Number(code) & 255);
			},
			strcmp: function(a, b) {
				const sa = String(a ?? '');
				const sb = String(b ?? '');
				return sa === sb ? 0 : (sa < sb ? -1 : 1);
			},
			perlSplit: function(pattern, str, limit) {
				let pat = pattern;
				let target;
				if (str === null || str === undefined) {
					target = String(pat ?? '');
					pat = ' ';
				} else {
					target = String(str);
				}

				const lim = (limit === null || limit === undefined) ? 0 : (Math.trunc(Number(limit)) || 0);
				if (lim === 1) {
					return [target];
				}

				let regexBody = null;
				let regexFlags = '';
				let isSpaceMode = false;

				const patStr = String(pat ?? '');
				if (patStr === ' ') {
					isSpaceMode = true;
					target = target.replace(/^\s+/, '');
					if (target === '') {
						return [];
					}
					regexBody = '\\s+';
				} else {
					const delimMatch = /^([/#~])([\s\S]*)\1([imsux]*)$/i.exec(patStr);
					if (delimMatch) {
						regexBody = delimMatch[2];
						const rawFlags = delimMatch[3].toLowerCase();
						for (let i = 0; i < rawFlags.length; i++) {
							const ch = rawFlags.charAt(i);
							if ((ch === 'i' || ch === 'm' || ch === 's' || ch === 'u') && regexFlags.indexOf(ch) === -1) {
								regexFlags += ch;
							}
						}
					} else {
						regexBody = patStr;
					}
				}

				if (regexBody === '') {
					const chars = [];
					if (lim > 1) {
						const maxSplits = lim - 1;
						let i = 0;
						while (i < target.length && chars.length < maxSplits) {
							chars.push(target.charAt(i));
							i++;
						}
						chars.push(target.slice(i));
						return chars;
					}
					if (target === '') {
						return lim < 0 ? [''] : [];
					}
					for (let i = 0; i < target.length; i++) {
						chars.push(target.charAt(i));
					}
					return chars;
				}

				let re;
				try {
					re = new RegExp(regexBody, regexFlags + 'g');
				} catch (_e) {
					const escaped = regexBody.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					re = new RegExp(escaped, regexFlags + 'g');
				}

				const out = [];
				let lastIdx = 0;
				let splitCount = 0;
				const maxSplits = lim > 1 ? lim - 1 : Infinity;

				while (splitCount < maxSplits) {
					const m = re.exec(target);
					if (!m) {
						break;
					}
					if (m[0].length === 0 && m.index === lastIdx) {
						if (re.lastIndex >= target.length) {
							break;
						}
						re.lastIndex = m.index + 1;
						continue;
					}
					out.push(target.slice(lastIdx, m.index));
					for (let g = 1; g < m.length; g++) {
						out.push(m[g] === undefined ? '' : m[g]);
					}
					lastIdx = m.index + m[0].length;
					splitCount++;
					if (m[0].length === 0) {
						re.lastIndex = lastIdx + 1;
					}
				}

				out.push(target.slice(lastIdx));

				if (lim === 0 || (isSpaceMode && lim === 0)) {
					while (out.length > 0 && out[out.length - 1] === '') {
						out.pop();
					}
				}

				return out;
			},

			// Oracle-like date & number functions
			sysdate: function(format) {
				const now = new Date();
				return format ? this._formatOracleDate(now, String(format)) : this._toIsoDateTime(now);
			},
			toDate: function(str, format) {
				const input = String(str ?? '').trim();
				if (!input) {
					throw new Error('ORA-01840: input value not long enough for date format');
				}
				let parsed;
				if (format !== undefined && format !== null && String(format).trim() !== '') {
					parsed = this._parseOracleDate(input, String(format));
				} else {
					const defaults = [
						'YYYY-MM-DD HH24:MI:SS',
						'YYYY-MM-DD',
						'YYYY/MM/DD HH24:MI:SS',
						'YYYY/MM/DD',
						'DD-MON-YYYY HH24:MI:SS',
						'DD-MON-YYYY',
						'DD-MON-RR HH24:MI:SS',
						'DD-MON-RR',
						'MM/DD/YYYY HH24:MI:SS',
						'MM/DD/YYYY'
					];
					for (let i = 0; i < defaults.length; i++) {
						try {
							parsed = this._parseOracleDate(input, defaults[i]);
							if (parsed) {
								break;
							}
						} catch (_e) {}
					}
					if (!parsed) {
						const fallback = new Date(input);
						if (!Number.isNaN(fallback.getTime())) {
							parsed = fallback;
						}
					}
				}
				if (!parsed || Number.isNaN(parsed.getTime())) {
					throw new Error('ORA-01861: literal does not match format string');
				}
				return this._toIsoDateTime(parsed);
			},
			toChar: function(value, format) {
				const hasFormat = format !== undefined && format !== null && String(format) !== '';
				const fmt = hasFormat ? String(format) : '';
				const isNumberFormat = hasFormat && /^(?:FM)?[\s$+\-]*[09,]+(?:\.[09]+)?$/i.test(fmt.trim());

				if (typeof value === 'number' && !Number.isNaN(value)) {
					if (!hasFormat) {
						return String(value);
					}
					if (isNumberFormat) {
						return this._formatOracleNumber(value, fmt);
					}
					return this._formatOracleDate(new Date(value * 1000), fmt);
				}

				if (isNumberFormat && value !== null && value !== undefined && String(value).trim() !== '' && !Number.isNaN(Number(value))) {
					return this._formatOracleNumber(Number(value), fmt);
				}

				const isoOrDateStr = String(value ?? '').trim();
				if (!isoOrDateStr) {
					return '';
				}

				let dateObj;
				const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/.exec(isoOrDateStr);
				if (isoMatch) {
					dateObj = new Date(
						parseInt(isoMatch[1], 10),
						parseInt(isoMatch[2], 10) - 1,
						parseInt(isoMatch[3], 10),
						isoMatch[4] ? parseInt(isoMatch[4], 10) : 0,
						isoMatch[5] ? parseInt(isoMatch[5], 10) : 0,
						isoMatch[6] ? parseInt(isoMatch[6], 10) : 0
					);
				} else {
					const parsedIso = this.toDate(isoOrDateStr);
					const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(parsedIso);
					dateObj = new Date(
						parseInt(m[1], 10),
						parseInt(m[2], 10) - 1,
						parseInt(m[3], 10),
						parseInt(m[4], 10),
						parseInt(m[5], 10),
						parseInt(m[6], 10)
					);
				}

				return hasFormat ? this._formatOracleDate(dateObj, fmt) : this._toIsoDateTime(dateObj);
			},
			dateToNumber: function(str, format) {
				const iso = this.toDate(str, format);
				const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(iso);
				if (!m) {
					throw new Error('ORA-01861: literal does not match format string');
				}
				const d = new Date(
					parseInt(m[1], 10),
					parseInt(m[2], 10) - 1,
					parseInt(m[3], 10),
					parseInt(m[4], 10),
					parseInt(m[5], 10),
					parseInt(m[6], 10)
				);
				return Math.floor(d.getTime() / 1000);
			},
			numberToDate: function(num, format) {
				if (num === null || num === undefined || num === '' || typeof num === 'boolean') {
					throw new Error('Invalid numeric timestamp');
				}
				const ts = Number(num);
				if (!Number.isFinite(ts)) {
					throw new Error('Invalid numeric timestamp');
				}
				const d = new Date(Math.trunc(ts) * 1000);
				if (Number.isNaN(d.getTime())) {
					throw new Error('Numeric timestamp out of range');
				}
				const hasFormat = format !== undefined && format !== null && String(format) !== '';
				return hasFormat ? this._formatOracleDate(d, String(format)) : this._toIsoDateTime(d);
			},
			_toIsoDateTime: function(d) {
				const pad = function(n) { return String(n).padStart(2, '0'); };
				return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
					' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
			},
			_tokenizeOracleDateFormat: function(format) {
				const tokenRe = /"([^"]*)"|(YYYY|RRRR|MONTH|MON|MM|DAY|DY|DDD|DD|HH24|HH12|HH|MI|SS|RR|YY|A\.M\.|P\.M\.|AM|PM|FM)/gi;
				const tokens = [];
				let lastIndex = 0;
				let match;
				while ((match = tokenRe.exec(format)) !== null) {
					if (match.index > lastIndex) {
						tokens.push({ type: 'literal', value: format.slice(lastIndex, match.index) });
					}
					if (match[1] !== undefined) {
						tokens.push({ type: 'literal', value: match[1] });
					} else {
						tokens.push({ type: 'token', raw: match[2], upper: match[2].toUpperCase() });
					}
					lastIndex = tokenRe.lastIndex;
				}
				if (lastIndex < format.length) {
					tokens.push({ type: 'literal', value: format.slice(lastIndex) });
				}
				return tokens;
			},
			_formatOracleDate: function(d, format) {
				const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
				const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
				const daysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
				const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

				function matchCase(text, template) {
					if (template === template.toUpperCase()) {
						return text.toUpperCase();
					}
					if (template === template.toLowerCase()) {
						return text.toLowerCase();
					}
					return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
				}

				const tokens = this._tokenizeOracleDateFormat(format);
				const year = d.getFullYear();
				const month = d.getMonth() + 1;
				const day = d.getDate();
				const hours = d.getHours();
				const minutes = d.getMinutes();
				const seconds = d.getSeconds();
				const startOfYear = new Date(year, 0, 1);
				const dayOfYear = Math.floor((new Date(year, d.getMonth(), day) - startOfYear) / 86400000) + 1;

				let fillMode = false;
				let out = '';
				for (let i = 0; i < tokens.length; i++) {
					const tok = tokens[i];
					if (tok.type === 'literal') {
						out += tok.value;
						continue;
					}
					const u = tok.upper;
					if (u === 'FM') {
						fillMode = !fillMode;
						continue;
					}
					const pad2 = function(n) { return fillMode ? String(n) : String(n).padStart(2, '0'); };
					if (u === 'YYYY' || u === 'RRRR') {
						out += String(year).padStart(4, '0');
					} else if (u === 'YY' || u === 'RR') {
						out += String(year % 100).padStart(2, '0');
					} else if (u === 'MONTH') {
						out += matchCase(monthsFull[d.getMonth()], tok.raw);
					} else if (u === 'MON') {
						out += matchCase(monthsShort[d.getMonth()], tok.raw);
					} else if (u === 'MM') {
						out += pad2(month);
					} else if (u === 'DAY') {
						out += matchCase(daysFull[d.getDay()], tok.raw);
					} else if (u === 'DY') {
						out += matchCase(daysShort[d.getDay()], tok.raw);
					} else if (u === 'DDD') {
						out += fillMode ? String(dayOfYear) : String(dayOfYear).padStart(3, '0');
					} else if (u === 'DD') {
						out += pad2(day);
					} else if (u === 'HH24') {
						out += pad2(hours);
					} else if (u === 'HH12' || u === 'HH') {
						out += pad2(hours % 12 || 12);
					} else if (u === 'MI') {
						out += pad2(minutes);
					} else if (u === 'SS') {
						out += pad2(seconds);
					} else if (u === 'AM' || u === 'PM') {
						const ampm = hours >= 12 ? 'PM' : 'AM';
						out += tok.raw === tok.raw.toLowerCase() ? ampm.toLowerCase() : ampm;
					} else if (u === 'A.M.' || u === 'P.M.') {
						const ampm = hours >= 12 ? 'P.M.' : 'A.M.';
						out += tok.raw === tok.raw.toLowerCase() ? ampm.toLowerCase() : ampm;
					}
				}
				return out;
			},
			_parseOracleDate: function(input, format) {
				const monthsFull = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
				const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
				const tokens = this._tokenizeOracleDateFormat(format);
				let regexStr = '^';
				const captureKinds = [];

				for (let i = 0; i < tokens.length; i++) {
					const tok = tokens[i];
					if (tok.type === 'literal') {
						if (/^\s+$/.test(tok.value)) {
							regexStr += '\\s+';
						} else {
							regexStr += tok.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						}
						continue;
					}
					const u = tok.upper;
					if (u === 'FM') {
						continue;
					}
					captureKinds.push(u);
					if (u === 'YYYY' || u === 'RRRR') {
						regexStr += '(\\d{4})';
					} else if (u === 'YY' || u === 'RR') {
						regexStr += '(\\d{2})';
					} else if (u === 'DDD') {
						regexStr += '(\\d{1,3})';
					} else if (u === 'MM' || u === 'DD' || u === 'HH24' || u === 'HH12' || u === 'HH' || u === 'MI' || u === 'SS') {
						regexStr += '(\\d{1,2})';
					} else if (u === 'MONTH' || u === 'DAY') {
						regexStr += '([A-Za-z]+)';
					} else if (u === 'MON' || u === 'DY') {
						regexStr += '([A-Za-z]{3})';
					} else if (u === 'AM' || u === 'PM' || u === 'A.M.' || u === 'P.M.') {
						regexStr += '(A\\.?M\\.?|P\\.?M\\.?)';
					}
				}
				regexStr += '$';

				const m = new RegExp(regexStr, 'i').exec(input);
				if (!m) {
					return null;
				}

				const now = new Date();
				let year = now.getFullYear();
				let month = 1;
				let day = 1;
				let dayOfYear = null;
				let hour = 0;
				let is12Hour = false;
				let meridiem = null;
				let minute = 0;
				let second = 0;

				for (let i = 0; i < captureKinds.length; i++) {
					const kind = captureKinds[i];
					const raw = m[i + 1];
					if (kind === 'YYYY' || kind === 'RRRR') {
						year = parseInt(raw, 10);
					} else if (kind === 'YY') {
						year = Math.floor(now.getFullYear() / 100) * 100 + parseInt(raw, 10);
					} else if (kind === 'RR') {
						const yy = parseInt(raw, 10);
						year = yy >= 50 ? 1900 + yy : 2000 + yy;
					} else if (kind === 'MM') {
						month = parseInt(raw, 10);
					} else if (kind === 'MON') {
						const idx = monthsShort.indexOf(raw.toUpperCase());
						if (idx === -1) return null;
						month = idx + 1;
					} else if (kind === 'MONTH') {
						const idx = monthsFull.indexOf(raw.toUpperCase());
						if (idx === -1) return null;
						month = idx + 1;
					} else if (kind === 'DD') {
						day = parseInt(raw, 10);
					} else if (kind === 'DDD') {
						dayOfYear = parseInt(raw, 10);
					} else if (kind === 'HH24') {
						hour = parseInt(raw, 10);
						if (hour > 23) return null;
					} else if (kind === 'HH12' || kind === 'HH') {
						hour = parseInt(raw, 10);
						is12Hour = true;
						if (hour < 1 || hour > 12) return null;
					} else if (kind === 'MI') {
						minute = parseInt(raw, 10);
						if (minute > 59) return null;
					} else if (kind === 'SS') {
						second = parseInt(raw, 10);
						if (second > 59) return null;
					} else if (kind === 'AM' || kind === 'PM' || kind === 'A.M.' || kind === 'P.M.') {
						meridiem = raw.toUpperCase().replace(/\./g, '');
					}
				}

				if (is12Hour) {
					if (meridiem === 'PM' && hour < 12) {
						hour += 12;
					} else if (meridiem === 'AM' && hour === 12) {
						hour = 0;
					}
				}

				let result;
				if (dayOfYear !== null) {
					if (dayOfYear < 1 || dayOfYear > 366) return null;
					result = new Date(year, 0, dayOfYear, hour, minute, second);
					if (result.getFullYear() !== year) return null;
				} else {
					if (month < 1 || month > 12 || day < 1 || day > 31) return null;
					result = new Date(year, month - 1, day, hour, minute, second);
					if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day) {
						return null;
					}
				}
				return result;
			},
			_formatOracleNumber: function(num, format) {
				let fmt = format.trim().replace(/^FM/i, '');
				let currency = '';
				if (fmt.indexOf('$') !== -1) {
					currency = '$';
					fmt = fmt.replace(/\$/g, '');
				}
				const parts = fmt.split('.');
				const intFmt = parts[0] || '';
				const decFmt = parts[1] || '';
				const decPlaces = decFmt.replace(/[^09]/g, '').length;
				const hasGrouping = intFmt.indexOf(',') !== -1;
				const minZeroMatch = /0+$/.exec(intFmt.replace(/,/g, ''));
				const minZeros = minZeroMatch ? minZeroMatch[0].length : 1;

				const sign = num < 0 ? '-' : '';
				const fixed = Math.abs(num).toFixed(decPlaces);
				const fixedParts = fixed.split('.');
				let intPart = fixedParts[0];
				if (intPart.length < minZeros) {
					intPart = intPart.padStart(minZeros, '0');
				}
				if (hasGrouping) {
					intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
				}
				const decPart = decPlaces > 0 ? '.' + (fixedParts[1] || '') : '';
				return sign + currency + intPart + decPart;
			},

			// Background crontab scheduler
			_cronJobs: new Map(),
			_cronTimer: null,
			_cronMinuteKey: function(d) {
				const pad = function(n) { return String(n).padStart(2, '0'); };
				return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
					' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
			},
			_parseCronField: function(field, min, max, nameMap) {
				const trimmed = String(field).trim().toUpperCase();
				if (!trimmed) {
					throw new Error('Empty cron field');
				}
				const isWildcard = trimmed === '*';
				const values = new Set();
				const parts = trimmed.split(',');

				for (let i = 0; i < parts.length; i++) {
					const part = parts[i].trim();
					if (!part) {
						throw new Error('Invalid cron list item in "' + field + '"');
					}
					const slashParts = part.split('/');
					if (slashParts.length > 2) {
						throw new Error('Invalid cron step syntax in "' + part + '"');
					}
					const hasStep = slashParts.length === 2;
					const step = hasStep ? parseInt(slashParts[1], 10) : 1;
					if (hasStep && (!/^\d+$/.test(slashParts[1]) || step < 1)) {
						throw new Error('Invalid cron step "' + slashParts[1] + '"');
					}

					let base = slashParts[0];
					if (nameMap) {
						Object.keys(nameMap).forEach(function(name) {
							base = base.replace(new RegExp('\\b' + name + '\\b', 'g'), String(nameMap[name]));
						});
					}

					let start;
					let end;
					if (base === '*') {
						start = min;
						end = max;
					} else if (base.indexOf('-') !== -1) {
						const rangeParts = base.split('-');
						if (rangeParts.length !== 2 || !/^\d+$/.test(rangeParts[0]) || !/^\d+$/.test(rangeParts[1])) {
							throw new Error('Invalid cron range "' + base + '"');
						}
						start = parseInt(rangeParts[0], 10);
						end = parseInt(rangeParts[1], 10);
					} else if (/^\d+$/.test(base)) {
						start = parseInt(base, 10);
						end = hasStep ? max : start;
					} else {
						throw new Error('Invalid cron value "' + base + '"');
					}

					if (start < min || end > max || start > end) {
						throw new Error('Cron value out of range [' + min + '-' + max + ']: "' + part + '"');
					}

					for (let v = start; v <= end; v += step) {
						values.add(max === 7 && v === 7 ? 0 : v);
					}
				}

				return { isWildcard: isWildcard, values: values };
			},
			_parseCronExpression: function(expr) {
				const aliases = {
					'@yearly': '0 0 1 1 *',
					'@monthly': '0 0 1 * *',
					'@weekly': '0 0 * * 0',
					'@daily': '0 0 * * *',
					'@hourly': '0 * * * *'
				};
				let normalized = String(expr ?? '').trim();
				const alias = aliases[normalized.toLowerCase()];
				if (alias) {
					normalized = alias;
				}
				const fields = normalized.split(/\s+/);
				if (fields.length !== 5) {
					throw new Error('Invalid crontab expression "' + expr + '": expected 5 fields (min hour dom month dow)');
				}

				const monthNames = {
					JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
					JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
				};
				const dayNames = {
					SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
				};

				return {
					minute: this._parseCronField(fields[0], 0, 59),
					hour: this._parseCronField(fields[1], 0, 23),
					dom: this._parseCronField(fields[2], 1, 31),
					month: this._parseCronField(fields[3], 1, 12, monthNames),
					dow: this._parseCronField(fields[4], 0, 7, dayNames)
				};
			},
			_cronMatchesDate: function(parsed, d) {
				const minMatch = parsed.minute.values.has(d.getMinutes());
				const hourMatch = parsed.hour.values.has(d.getHours());
				const monthMatch = parsed.month.values.has(d.getMonth() + 1);
				if (!minMatch || !hourMatch || !monthMatch) {
					return false;
				}
				const domMatch = parsed.dom.values.has(d.getDate());
				const dowMatch = parsed.dow.values.has(d.getDay());
				if (!parsed.dom.isWildcard && !parsed.dow.isWildcard) {
					return domMatch || dowMatch;
				}
				return domMatch && dowMatch;
			},
			_runCronJob: function(job) {
				if (job.running) {
					return;
				}
				job.running = true;
				const logErr = function(err) {
					const term = getTerm();
					if (term && typeof term.error === 'function') {
						term.error('Cron #' + job.id + ': ' + (err.message || String(err)));
					}
				};
				try {
					if (typeof job.code === 'function') {
						const res = job.code();
						if (res && typeof res.fail === 'function') {
							res.fail(logErr);
						}
						if (res && typeof res.always === 'function') {
							res.always(function() { job.running = false; });
						} else {
							job.running = false;
						}
					} else {
						bop.execute('<?bop ' + job.code)
							.fail(logErr)
							.always(function() { job.running = false; });
					}
				} catch (err) {
					job.running = false;
					logErr(err);
				}
			},
			_tickCronJobs: function(dateObj) {
				const now = dateObj instanceof Date ? dateObj : new Date();
				const minuteKey = this._cronMinuteKey(now);
				const self = this;
				this._cronJobs.forEach(function(job) {
					if (job.lastRunMinuteKey === minuteKey) {
						return;
					}
					if (self._cronMatchesDate(job.parsed, now)) {
						job.lastRunMinuteKey = minuteKey;
						self._runCronJob(job);
					}
				});
			},
			_ensureCronTimer: function() {
				const self = this;
				if (this._cronJobs.size === 0) {
					if (this._cronTimer !== null) {
						clearInterval(this._cronTimer);
						this._cronTimer = null;
					}
					return;
				}
				if (this._cronTimer === null) {
					this._cronTimer = setInterval(function() {
						self._tickCronJobs(new Date());
					}, 1000);
				}
			},
			cronSet: function(id, schedule, code) {
				if (id === null || id === undefined || String(id).trim() === '') {
					throw new Error('Cron job ID cannot be empty');
				}
				const key = String(id);
				if (
					(schedule === null || schedule === undefined || schedule === false || String(schedule).trim() === '') &&
					(code === null || code === undefined)
				) {
					return this.cronDelete(key);
				}
				const parsed = this._parseCronExpression(schedule);

				let normalizedCode;
				if (typeof code === 'function') {
					normalizedCode = code;
				} else {
					let body = String(code ?? '').replace(/^\s*<\?(?:bop)?/i, '').trim();
					if (!body) {
						throw new Error('Cron job code cannot be empty');
					}
					if (!body.endsWith(';') && !body.endsWith('}')) {
						body += ';';
					}
					normalizedCode = body;
				}

				this._cronJobs.set(key, {
					id: key,
					schedule: String(schedule).trim(),
					parsed: parsed,
					code: normalizedCode,
					lastRunMinuteKey: this._cronMinuteKey(new Date()),
					running: false
				});
				this._ensureCronTimer();
				return true;
			},
			cronDelete: function(id) {
				if (id === null || id === undefined) {
					return false;
				}
				const existed = this._cronJobs.delete(String(id));
				this._ensureCronTimer();
				return existed;
			},
			cronList: function() {
				const list = [];
				this._cronJobs.forEach(function(job) {
					list.push([
						job.id,
						job.schedule,
						typeof job.code === 'function' ? '[Closure]' : job.code
					]);
				});
				return list;
			},
			cronMatches: function(schedule, dateStr) {
				const parsed = this._parseCronExpression(schedule);
				const iso = this.toDate(dateStr);
				const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(iso);
				const d = new Date(
					parseInt(m[1], 10),
					parseInt(m[2], 10) - 1,
					parseInt(m[3], 10),
					parseInt(m[4], 10),
					parseInt(m[5], 10),
					parseInt(m[6], 10)
				);
				return this._cronMatchesDate(parsed, d);
			},

			// Standard PHP math helpers backed by JS Math
			_rngState: null,
			_nextRandom: function() {
				if (this._rngState === null) {
					return Math.random();
				}
				let t = this._rngState += 0x6D2B79F5;
				t = Math.imul(t ^ (t >>> 15), t | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			},
			mathSrand: function(seed) {
				if (seed === null || seed === undefined) {
					this._rngState = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
				} else {
					this._rngState = (Math.trunc(Number(seed)) >>> 0);
				}
			},
			mathRand: function(min, max) {
				const rMax = 2147483647;
				const lo = (min === null || min === undefined) ? 0 : Math.trunc(Number(min));
				const hi = (max === null || max === undefined) ? rMax : Math.trunc(Number(max));
				const low = Math.min(lo, hi);
				const high = Math.max(lo, hi);
				return low + Math.floor(this._nextRandom() * (high - low + 1));
			},
			mathRound: function(val, precision, mode) {
				const num = Number(val);
				const prec = precision === null || precision === undefined ? 0 : Math.trunc(Number(precision));
				const m = mode === null || mode === undefined ? 1 : Math.trunc(Number(mode));
				if (!Number.isFinite(num)) {
					return num;
				}
				const factor = Math.pow(10, prec);
				const scaled = Number((num * factor).toPrecision(15));
				const sign = scaled < 0 ? -1 : 1;
				const absScaled = Math.abs(scaled);
				const floorAbs = Math.floor(absScaled);
				const frac = absScaled - floorAbs;

				let roundedAbs;
				if (Math.abs(frac - 0.5) < 1e-12) {
					if (m === 2) {
						roundedAbs = floorAbs;
					} else if (m === 3) {
						roundedAbs = (floorAbs % 2 === 0) ? floorAbs : floorAbs + 1;
					} else if (m === 4) {
						roundedAbs = (floorAbs % 2 === 1) ? floorAbs : floorAbs + 1;
					} else {
						roundedAbs = floorAbs + 1;
					}
				} else {
					roundedAbs = Math.round(absScaled);
				}
				const res = (sign * roundedAbs) / factor;
				return res === 0 ? 0 : res;
			},
			mathUnary: function(op, x) {
				const n = Number(x);
				switch (op) {
					case 'abs': return Math.abs(n);
					case 'floor': return Math.floor(n);
					case 'sqrt': return Math.sqrt(n);
					case 'exp': return Math.exp(n);
					case 'expm1': return Math.expm1(n);
					case 'log10': return Math.log10(n);
					case 'log1p': return Math.log1p(n);
					case 'sin': return Math.sin(n);
					case 'cos': return Math.cos(n);
					case 'tan': return Math.tan(n);
					case 'asin': return Math.asin(n);
					case 'acos': return Math.acos(n);
					case 'atan': return Math.atan(n);
					case 'sinh': return Math.sinh(n);
					case 'cosh': return Math.cosh(n);
					case 'tanh': return Math.tanh(n);
					case 'asinh': return Math.asinh(n);
					case 'acosh': return Math.acosh(n);
					case 'atanh': return Math.atanh(n);
					case 'deg2rad': return n * (Math.PI / 180);
					case 'rad2deg': return n * (180 / Math.PI);
					default: throw new Error('Unknown math op: ' + op);
				}
			},
			mathBinary: function(op, a, b) {
				const x = Number(a);
				const y = Number(b);
				switch (op) {
					case 'pow': return Math.pow(x, y);
					case 'atan2': return Math.atan2(x, y);
					case 'hypot': return Math.hypot(x, y);
					case 'fmod': return x % y;
					case 'fdiv': return x / y;
					case 'intdiv':
						if (Math.trunc(y) === 0) {
							throw new Error('Division by zero');
						}
						return Math.trunc(Math.trunc(x) / Math.trunc(y));
					default: throw new Error('Unknown math op: ' + op);
				}
			},
			mathLog: function(num, base) {
				const x = Number(num);
				if (base === null || base === undefined) {
					return Math.log(x);
				}
				const b = Number(base);
				if (b <= 0 || b === 1) {
					return NaN;
				}
				return Math.log(x) / Math.log(b);
			},
			mathIsNan: function(x) { return Number.isNaN(Number(x)); },
			mathIsFinite: function(x) { return Number.isFinite(Number(x)); },
			mathIsInfinite: function(x) { return Number(x) === Infinity || Number(x) === -Infinity; },
			mathInf: function() { return Infinity; },
			mathNan: function() { return NaN; },
			mathBaseConvert: function(numStr, fromBase, toBase) {
				const fb = Math.trunc(Number(fromBase));
				const tb = Math.trunc(Number(toBase));
				if (fb < 2 || fb > 36 || tb < 2 || tb > 36) {
					throw new Error('Invalid base for base_convert (must be 2..36)');
				}
				const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
				const cleaned = String(numStr ?? '').trim().toLowerCase();
				let value = 0n;
				const bigFrom = BigInt(fb);
				for (let i = 0; i < cleaned.length; i++) {
					const d = digits.indexOf(cleaned.charAt(i));
					if (d !== -1 && d < fb) {
						value = value * bigFrom + BigInt(d);
					}
				}
				return value.toString(tb);
			},
			mathFromBase: function(str, base) {
				const b = Math.trunc(Number(base));
				const cleaned = String(str ?? '').trim().toLowerCase().replace(/^0[bx]/, '');
				const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
				let out = 0;
				for (let i = 0; i < cleaned.length; i++) {
					const d = digits.indexOf(cleaned.charAt(i));
					if (d !== -1 && d < b) {
						out = out * b + d;
					}
				}
				return out;
			},
			mathToBase: function(num, base) {
				const b = Math.trunc(Number(base));
				const n = (Math.trunc(Number(num)) >>> 0);
				return n.toString(b);
			},

			// Pure-JS SQLite/PDO engine bridge helpers
			sqlOpen: function(filename) { return miniSql.open(filename); },
			sqlClose: function(connId) { return miniSql.close(connId); },
			sqlExec: function(connId, sql) { return miniSql.exec(connId, sql); },
			sqlQuery: function(connId, sql, posParams, namedParams) {
				return miniSql.query(connId, sql, posParams, namedParams);
			},
			sqlLastInsertRowId: function(connId) { return miniSql.lastInsertRowId(connId); },
			sqlChanges: function(connId) { return miniSql.changes(connId); },
			sqlEscape: function(str) { return miniSql.escapeString(str); },

			// Read a text file from VFS first, falling back to static server HTTP fetch
			readTextFile: function(filePath) {
				const p = String(filePath ?? '').trim();
				if (!p) {
					return false;
				}
				if (vfs && vfs.isFile(p)) {
					return vfs.readFile(p);
				}
				if (vfs && vfs.isDirectory(p)) {
					return false;
				}
				if (!fetchFn) {
					return false;
				}
				return fetchFn(p)
					.then(function(res) {
						if (!res || !res.ok) {
							return false;
						}
						const contentType = (res.headers && res.headers.get('content-type')) || '';
						if (!/\.html?(\?|#|$)/i.test(p) && contentType.toLowerCase().includes('text/html')) {
							return false;
						}
						return res.text();
					})
					.catch(function() {
						return false;
					});
			},

			// Shell prompt & MS-DOS style reboot helpers
			getPrompt: function() {
				const term = getTerm();
				if (term && typeof term.get_prompt === 'function') {
					const p = term.get_prompt();
					if (typeof p === 'string') return p;
				}
				return currentPrompt;
			},
			setPrompt: function(text) {
				const next = String(text ?? 'bop > ');
				currentPrompt = next;
				const term = getTerm();
				if (term && typeof term.set_prompt === 'function') {
					term.set_prompt(next);
				}
				return currentPrompt;
			},
			reboot: function() {
				if (onReboot) {
					return onReboot();
				}
				return false;
			}
		};

		if (vfs && typeof globalScope.createVfsBridgeHelpers === 'function') {
			Object.assign(bridge, globalScope.createVfsBridgeHelpers(vfs));
		}
		if (screenBuffer && typeof globalScope.createScreenBridgeHelpers === 'function') {
			Object.assign(bridge, globalScope.createScreenBridgeHelpers(screenBuffer, getTerm));
		}
		if (adlib && typeof globalScope.createSoundBridgeHelpers === 'function') {
			Object.assign(bridge, globalScope.createSoundBridgeHelpers(adlib));
		}
		if (bopEditor && typeof globalScope.createEditorBridgeHelpers === 'function') {
			Object.assign(bridge, globalScope.createEditorBridgeHelpers(bopEditor, bop));
		}

		return bridge;
	}

	function registerBopEngineExtensions(bop) {
		// Register sprintf with support for %f, %x, %X, %o, %b, %c, %u, %e, %E, %g, %G, width, precision, and positional args
		bop.environment.defineCoercingFunction('sprintf', function(format) {
			const args = Array.prototype.slice.call(arguments, 1);
			let argIndex = 0;

			function padValue(str, width, padChar, leftAlign) {
				if (!width || str.length >= width) {
					return str;
				}
				return leftAlign ? str.padEnd(width, padChar) : str.padStart(width, padChar);
			}

			return String(format ?? '').replace(
				/%%|%(\d+\$)?(\+)?(0|'.)?(-)?(\d+)?(?:\.(\d+))?([bcdeEfFgGosxXu])/g,
				function(match, posSpec, plusFlag, padSpec, minusFlag, widthSpec, precSpec, type) {
					if (match === '%%') {
						return '%';
					}
					const idx = posSpec ? parseInt(posSpec, 10) - 1 : argIndex++;
					const rawVal = args[idx];
					const padChar = padSpec ? (padSpec.charAt(0) === "'" ? padSpec.charAt(1) : padSpec) : ' ';
					const leftAlign = Boolean(minusFlag);
					const width = widthSpec ? parseInt(widthSpec, 10) : 0;
					const precision = precSpec !== undefined ? parseInt(precSpec, 10) : null;
					const showPlus = Boolean(plusFlag);

					if (type === 's') {
						let out = rawVal === undefined || rawVal === null ? '' : String(rawVal);
						if (precision !== null) {
							out = out.slice(0, precision);
						}
						return padValue(out, width, padChar, leftAlign);
					}

					if (type === 'c') {
						return padValue(String.fromCharCode(Number(rawVal) & 255), width, padChar, leftAlign);
					}

					if (type === 'd' || type === 'i') {
						const num = Math.trunc(Number(rawVal)) || 0;
						const sign = num < 0 ? '-' : (showPlus ? '+' : '');
						const body = String(Math.abs(num));
						if (padChar === '0' && !leftAlign && width > sign.length) {
							return sign + body.padStart(width - sign.length, '0');
						}
						return padValue(sign + body, width, padChar, leftAlign);
					}

					if (type === 'u') {
						return padValue(String(Number(rawVal) >>> 0), width, padChar, leftAlign);
					}

					if (type === 'b') {
						return padValue((Number(rawVal) >>> 0).toString(2), width, padChar, leftAlign);
					}

					if (type === 'o') {
						return padValue((Number(rawVal) >>> 0).toString(8), width, padChar, leftAlign);
					}

					if (type === 'x') {
						return padValue((Number(rawVal) >>> 0).toString(16), width, padChar, leftAlign);
					}

					if (type === 'X') {
						return padValue((Number(rawVal) >>> 0).toString(16).toUpperCase(), width, padChar, leftAlign);
					}

					const num = Number(rawVal) || 0;
					const sign = num < 0 ? '-' : (showPlus ? '+' : '');
					let body;
					if (type === 'f' || type === 'F') {
						body = Math.abs(num).toFixed(precision !== null ? precision : 6);
					} else if (type === 'e' || type === 'E') {
						body = Math.abs(num).toExponential(precision !== null ? precision : 6);
						if (type === 'E') {
							body = body.toUpperCase();
						}
					} else {
						body = String(Number(Math.abs(num).toPrecision(precision !== null ? Math.max(1, precision) : 6)));
						if (type === 'G') {
							body = body.toUpperCase();
						}
					}

					if (padChar === '0' && !leftAlign && width > sign.length) {
						return sign + body.padStart(width - sign.length, '0');
					}
					return padValue(sign + body, width, padChar, leftAlign);
				}
			);
		});

	}

	globalScope.preprocessBopTags = preprocessBopTags;
	globalScope.formatBopError = formatBopError;
	globalScope.createBopBridge = createBopBridge;
	globalScope.registerBopEngineExtensions = registerBopEngineExtensions;
})(typeof window !== 'undefined' ? window : globalThis);
