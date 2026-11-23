(function(globalScope) {
	'use strict';

	function createScreenBuffer(options) {
		const opts = options || {};
		const getTerm = typeof opts.getTerm === 'function' ? opts.getTerm : function() { return null; };

		const screenBuffer = {
			active: false,
			cols: 80,
			rows: 24,
			cursorRow: 1,
			cursorCol: 1,
			grid: [],
			_ansiBuf: '',
			_pendingWrap: false,

			getCols: function() {
				const term = getTerm();
				if (term && typeof term.cols === 'function') {
					const c = Math.trunc(Number(term.cols()));
					if (Number.isFinite(c) && c > 0) return c;
				}
				return 80;
			},
			getRows: function() {
				const term = getTerm();
				if (term && typeof term.rows === 'function') {
					const r = Math.trunc(Number(term.rows()));
					if (Number.isFinite(r) && r > 0) return r;
				}
				return 24;
			},
			_ensureGrid: function(resetAll) {
				const nextCols = this.getCols();
				const nextRows = this.getRows();
				if (resetAll || this.grid.length !== nextRows || (this.grid[0] && this.grid[0].length !== nextCols)) {
					const nextGrid = [];
					for (let r = 0; r < nextRows; r++) {
						const rowArr = [];
						for (let c = 0; c < nextCols; c++) {
							rowArr.push(!resetAll && this.grid[r] && this.grid[r][c] ? this.grid[r][c] : ' ');
						}
						nextGrid.push(rowArr);
					}
					this.grid = nextGrid;
					this.cols = nextCols;
					this.rows = nextRows;
					this.cursorRow = Math.min(Math.max(1, this.cursorRow), nextRows);
					this.cursorCol = Math.min(Math.max(1, this.cursorCol), nextCols);
					this._pendingWrap = false;
				}
			},
			setMode: function(enabled) {
				const next = Boolean(enabled);
				this.active = next;
				if (next) {
					this._ensureGrid(this.grid.length === 0);
					this._syncDomStyle();
				}
				this._syncDomVisibility();
				this.render();
				return this.active;
			},
			clear: function() {
				this._ensureGrid(true);
				this.cursorRow = 1;
				this.cursorCol = 1;
				this._pendingWrap = false;
				this._ansiBuf = '';
				this.render();
				return true;
			},
			locate: function(row, col) {
				if (!this.active) {
					this.setMode(true);
				} else {
					this._ensureGrid(false);
				}
				const r = Math.trunc(Number(row));
				const c = (col === null || col === undefined) ? 1 : Math.trunc(Number(col));
				this.cursorRow = Math.min(Math.max(1, Number.isFinite(r) ? r : 1), this.rows);
				this.cursorCol = Math.min(Math.max(1, Number.isFinite(c) ? c : 1), this.cols);
				this._pendingWrap = false;
				this.render();
				return true;
			},
			_scrollUp: function() {
				this.grid.shift();
				const blank = [];
				for (let c = 0; c < this.cols; c++) blank.push(' ');
				this.grid.push(blank);
			},
			_newline: function() {
				this.cursorCol = 1;
				this._pendingWrap = false;
				if (this.cursorRow < this.rows) {
					this.cursorRow++;
				} else {
					this._scrollUp();
				}
			},
			_putChar: function(ch) {
				if (this._pendingWrap) {
					this._newline();
				}
				if (this.cursorRow < 1) this.cursorRow = 1;
				if (this.cursorRow > this.rows) this.cursorRow = this.rows;
				if (this.cursorCol < 1) this.cursorCol = 1;
				if (this.cursorCol > this.cols) this.cursorCol = this.cols;

				this.grid[this.cursorRow - 1][this.cursorCol - 1] = ch;
				if (this.cursorCol >= this.cols) {
					this._pendingWrap = true;
				} else {
					this.cursorCol++;
				}
			},
			_handleCsi: function(paramsStr, cmd) {
				const parts = paramsStr === '' ? [] : paramsStr.split(';').map(function(s) {
					return s === '' ? 0 : (parseInt(s, 10) || 0);
				});
				if (cmd === 'H' || cmd === 'f') {
					const r = parts[0] > 0 ? parts[0] : 1;
					const c = parts[1] > 0 ? parts[1] : 1;
					this.cursorRow = Math.min(Math.max(1, r), this.rows);
					this.cursorCol = Math.min(Math.max(1, c), this.cols);
					this._pendingWrap = false;
				} else if (cmd === 'A') {
					const n = parts[0] > 0 ? parts[0] : 1;
					this.cursorRow = Math.max(1, this.cursorRow - n);
					this._pendingWrap = false;
				} else if (cmd === 'B') {
					const n = parts[0] > 0 ? parts[0] : 1;
					this.cursorRow = Math.min(this.rows, this.cursorRow + n);
					this._pendingWrap = false;
				} else if (cmd === 'C') {
					const n = parts[0] > 0 ? parts[0] : 1;
					this.cursorCol = Math.min(this.cols, this.cursorCol + n);
					this._pendingWrap = false;
				} else if (cmd === 'D') {
					const n = parts[0] > 0 ? parts[0] : 1;
					this.cursorCol = Math.max(1, this.cursorCol - n);
					this._pendingWrap = false;
				} else if (cmd === 'J') {
					const mode = parts[0] || 0;
					if (mode === 2) {
						this._ensureGrid(true);
						this.cursorRow = 1;
						this.cursorCol = 1;
						this._pendingWrap = false;
					}
				} else if (cmd === 'K') {
					const rIdx = this.cursorRow - 1;
					for (let c = this.cursorCol - 1; c < this.cols; c++) {
						this.grid[rIdx][c] = ' ';
					}
				}
			},
			write: function(text) {
				this._ensureGrid(false);
				const str = this._ansiBuf + String(text ?? '');
				this._ansiBuf = '';
				let i = 0;
				while (i < str.length) {
					const ch = str.charAt(i);
					if (ch === '\x1b') {
						if (i + 1 >= str.length) {
							this._ansiBuf = '\x1b';
							break;
						}
						if (str.charAt(i + 1) === '[') {
							const rest = str.slice(i + 2);
							const m = /^([0-9;]*)([A-Za-z])/.exec(rest);
							if (!m) {
								if (rest.length < 16 && /^[0-9;]*$/.test(rest)) {
									this._ansiBuf = str.slice(i);
									break;
								}
								i++;
								continue;
							}
							this._handleCsi(m[1], m[2]);
							i += 2 + m[0].length;
							continue;
						}
						i++;
						continue;
					}
					if (ch === '\r') {
						this.cursorCol = 1;
						this._pendingWrap = false;
					} else if (ch === '\n') {
						this._newline();
					} else if (ch === '\t') {
						const nextTab = Math.min(this.cols + 1, this.cursorCol + (4 - ((this.cursorCol - 1) % 4)));
						while (this.cursorCol < nextTab) {
							this._putChar(' ');
							if (this._pendingWrap) break;
						}
					} else if (ch === '\b') {
						this.cursorCol = Math.max(1, this.cursorCol - 1);
						this._pendingWrap = false;
					} else {
						this._putChar(ch);
					}
					i++;
				}
				this.render();
			},
			getLine: function(row) {
				this._ensureGrid(false);
				const idx = Math.trunc(Number(row)) - 1;
				if (idx < 0 || idx >= this.grid.length) return '';
				return this.grid[idx].join('');
			},
			getLines: function() {
				this._ensureGrid(false);
				return this.grid.map(function(rowArr) { return rowArr.join(''); });
			},
			_syncDomStyle: function() {
				if (typeof document === 'undefined' || !document.getElementById) return;
				const pre = document.getElementById('screen-framebuffer-pre');
				const termEl = document.querySelector ? document.querySelector('.terminal') : null;
				if (pre && termEl && typeof window !== 'undefined' && window.getComputedStyle) {
					const cs = window.getComputedStyle(termEl);
					pre.style.fontFamily = cs.fontFamily;
					pre.style.fontSize = cs.fontSize;
					pre.style.lineHeight = cs.lineHeight;
					pre.style.color = cs.color;
					pre.style.backgroundColor = cs.backgroundColor;
					pre.style.padding = cs.padding;
				}
			},
			_syncDomVisibility: function() {
				if (typeof document === 'undefined' || !document.getElementById) return;
				const wrap = document.getElementById('screen-framebuffer');
				if (wrap) {
					if (this.active) {
						wrap.classList.add('active');
					} else {
						wrap.classList.remove('active');
						const term = getTerm();
						if (term && typeof term.focus === 'function') {
							term.focus(true);
						}
					}
				}
			},
			render: function() {
				if (!this.active || typeof document === 'undefined' || !document.getElementById) return;
				const pre = document.getElementById('screen-framebuffer-pre');
				if (!pre) return;
				function escHtml(s) {
					return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}
				const cr = this.cursorRow - 1;
				const cc = this.cursorCol - 1;
				const parts = [];
				for (let r = 0; r < this.grid.length; r++) {
					const rowArr = this.grid[r];
					if (r === cr) {
						const left = escHtml(rowArr.slice(0, cc).join(''));
						const cell = escHtml(rowArr[cc] || ' ');
						const right = escHtml(rowArr.slice(cc + 1).join(''));
						parts.push(left + '<span class="screen-cursor">' + cell + '</span>' + right);
					} else {
						parts.push(escHtml(rowArr.join('')));
					}
				}
				pre.innerHTML = parts.join('\n');
			}
		};

		if (typeof document !== 'undefined' && document.addEventListener) {
			const exitBtn = document.getElementById('screen-exit-btn');
			if (exitBtn) {
				exitBtn.addEventListener('click', function() {
					screenBuffer.setMode(false);
				});
			}
			document.addEventListener('keydown', function(ev) {
				if (screenBuffer.active && ev.key === 'Escape') {
					ev.preventDefault();
					screenBuffer.setMode(false);
				}
			});
		}

		return screenBuffer;
	}

	function createScreenBridgeHelpers(screenBuffer, getTerm) {
		return {
			screenColumns: function() {
				return screenBuffer.getCols();
			},
			screenLines: function() {
				return screenBuffer.getRows();
			},
			screenClear: function() {
				if (screenBuffer.active) {
					screenBuffer.clear();
					return true;
				}
				const term = typeof getTerm === 'function' ? getTerm() : null;
				if (term && typeof term.clear === 'function') {
					term.clear();
					return true;
				}
				return false;
			},
			screenMode: function(enabled) {
				if (enabled === null || enabled === undefined) {
					return screenBuffer.active;
				}
				return screenBuffer.setMode(Boolean(enabled));
			},
			screenLocate: function(row, col) {
				return screenBuffer.locate(row, col);
			},
			screenCursor: function() {
				return { row: screenBuffer.cursorRow, col: screenBuffer.cursorCol };
			},
			screenLine: function(row) {
				return screenBuffer.getLine(row);
			},
			screenSnapshot: function() {
				return screenBuffer.getLines();
			}
		};
	}

	globalScope.createScreenBuffer = createScreenBuffer;
	globalScope.createScreenBridgeHelpers = createScreenBridgeHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
