(function(globalScope) {
	'use strict';

	// Detect CPU endianness so Uint32Array writes match ImageData RGBA byte order
	const IS_LITTLE_ENDIAN = (function() {
		const buf = new ArrayBuffer(4);
		new Uint32Array(buf)[0] = 0x11223344;
		return new Uint8Array(buf)[0] === 0x44;
	})();

	function packRgba(r, g, b, a) {
		const cr = r & 255;
		const cg = g & 255;
		const cb = b & 255;
		const ca = (a === undefined ? 255 : a) & 255;
		if (IS_LITTLE_ENDIAN) {
			return ((ca << 24) | (cb << 16) | (cg << 8) | cr) >>> 0;
		}
		return ((cr << 24) | (cg << 16) | (cb << 8) | ca) >>> 0;
	}

	// Build classic 256-color VGA palette (0..15 CGA/VGA, 16..231 6x6x6 RGB cube, 232..255 grayscale)
	const VGA_16 = [
		[0x00, 0x00, 0x00], [0x00, 0x00, 0xAA], [0x00, 0xAA, 0x00], [0x00, 0xAA, 0xAA],
		[0xAA, 0x00, 0x00], [0xAA, 0x00, 0xAA], [0xAA, 0x55, 0x00], [0xAA, 0xAA, 0xAA],
		[0x55, 0x55, 0x55], [0x55, 0x55, 0xFF], [0x55, 0xFF, 0x55], [0x55, 0xFF, 0xFF],
		[0xFF, 0x55, 0x55], [0xFF, 0x55, 0xFF], [0xFF, 0xFF, 0x55], [0xFF, 0xFF, 0xFF]
	];
	const PALETTE_PACKED = new Uint32Array(256);
	const PACKED_TO_CODE = new Map();
	(function initPalette() {
		for (let i = 0; i < 16; i++) {
			const packed = packRgba(VGA_16[i][0], VGA_16[i][1], VGA_16[i][2], 255);
			PALETTE_PACKED[i] = packed;
			if (!PACKED_TO_CODE.has(packed)) PACKED_TO_CODE.set(packed, i);
		}
		const steps = [0x00, 0x5F, 0x87, 0xAF, 0xD7, 0xFF];
		for (let idx = 16; idx < 232; idx++) {
			const n = idx - 16;
			const r = steps[Math.floor(n / 36)];
			const g = steps[Math.floor((n % 36) / 6)];
			const b = steps[n % 6];
			const packed = packRgba(r, g, b, 255);
			PALETTE_PACKED[idx] = packed;
			if (!PACKED_TO_CODE.has(packed)) PACKED_TO_CODE.set(packed, idx);
		}
		for (let idx = 232; idx < 256; idx++) {
			const v = 8 + (idx - 232) * 10;
			const packed = packRgba(v, v, v, 255);
			PALETTE_PACKED[idx] = packed;
			if (!PACKED_TO_CODE.has(packed)) PACKED_TO_CODE.set(packed, idx);
		}
	})();

	function resolveColor(colorcode) {
		if (typeof colorcode === 'string') {
			const trimmed = colorcode.trim();
			let m = /^#([0-9a-f]{3})$/i.exec(trimmed);
			if (m) {
				const hex = m[1];
				const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
				const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
				const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
				return {
					code: '#' + (hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2)).toLowerCase(),
					packed: packRgba(r, g, b, 255)
				};
			}
			m = /^(?:#|0x)([0-9a-f]{6})$/i.exec(trimmed);
			if (m) {
				const hex6 = m[1];
				const r = parseInt(hex6.slice(0, 2), 16);
				const g = parseInt(hex6.slice(2, 4), 16);
				const b = parseInt(hex6.slice(4, 6), 16);
				return {
					code: '#' + hex6.toLowerCase(),
					packed: packRgba(r, g, b, 255)
				};
			}
		}
		const n = Math.trunc(Number(colorcode));
		const idx = Number.isFinite(n) ? (((n % 256) + 256) % 256) : 15;
		return {
			code: idx,
			packed: PALETTE_PACKED[idx]
		};
	}

	function unpackPackedToHex(packed) {
		let r, g, b;
		if (IS_LITTLE_ENDIAN) {
			r = packed & 0xFF;
			g = (packed >>> 8) & 0xFF;
			b = (packed >>> 16) & 0xFF;
		} else {
			r = (packed >>> 24) & 0xFF;
			g = (packed >>> 16) & 0xFF;
			b = (packed >>> 8) & 0xFF;
		}
		return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
	}

	// Compact 8x8 monochrome bitmap font for printable ASCII 0x20..0x7E
	const FONT_8X8 = {
		32: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
		33: [0x18, 0x3C, 0x3C, 0x18, 0x18, 0x00, 0x18, 0x00],
		34: [0x6C, 0x6C, 0x6C, 0x00, 0x00, 0x00, 0x00, 0x00],
		35: [0x6C, 0x6C, 0xFE, 0x6C, 0xFE, 0x6C, 0x6C, 0x00],
		36: [0x18, 0x7E, 0xC0, 0x7C, 0x06, 0xFC, 0x18, 0x00],
		37: [0x00, 0xC6, 0xCC, 0x18, 0x30, 0x66, 0xC6, 0x00],
		38: [0x38, 0x6C, 0x38, 0x76, 0xDC, 0xCC, 0x76, 0x00],
		39: [0x18, 0x18, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00],
		40: [0x18, 0x30, 0x60, 0x60, 0x60, 0x30, 0x18, 0x00],
		41: [0x60, 0x30, 0x18, 0x18, 0x18, 0x30, 0x60, 0x00],
		42: [0x00, 0x66, 0x3C, 0xFF, 0x3C, 0x66, 0x00, 0x00],
		43: [0x00, 0x18, 0x18, 0x7E, 0x18, 0x18, 0x00, 0x00],
		44: [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x30],
		45: [0x00, 0x00, 0x00, 0x7E, 0x00, 0x00, 0x00, 0x00],
		46: [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00],
		47: [0x06, 0x0C, 0x18, 0x30, 0x60, 0xC0, 0x80, 0x00],
		48: [0x7C, 0xC6, 0xCE, 0xD6, 0xE6, 0xC6, 0x7C, 0x00],
		49: [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x7E, 0x00],
		50: [0x7C, 0xC6, 0x06, 0x1C, 0x30, 0x60, 0xFE, 0x00],
		51: [0x7C, 0xC6, 0x06, 0x3C, 0x06, 0xC6, 0x7C, 0x00],
		52: [0x1C, 0x3C, 0x6C, 0xCC, 0xFE, 0x0C, 0x1E, 0x00],
		53: [0xFE, 0xC0, 0xFC, 0x06, 0x06, 0xC6, 0x7C, 0x00],
		54: [0x38, 0x60, 0xC0, 0xFC, 0xC6, 0xC6, 0x7C, 0x00],
		55: [0xFE, 0xC6, 0x0C, 0x18, 0x30, 0x30, 0x30, 0x00],
		56: [0x7C, 0xC6, 0xC6, 0x7C, 0xC6, 0xC6, 0x7C, 0x00],
		57: [0x7C, 0xC6, 0xC6, 0x7E, 0x06, 0x0C, 0x78, 0x00],
		58: [0x00, 0x18, 0x18, 0x00, 0x00, 0x18, 0x18, 0x00],
		59: [0x00, 0x18, 0x18, 0x00, 0x00, 0x18, 0x18, 0x30],
		60: [0x0C, 0x18, 0x30, 0x60, 0x30, 0x18, 0x0C, 0x00],
		61: [0x00, 0x00, 0x7E, 0x00, 0x7E, 0x00, 0x00, 0x00],
		62: [0x60, 0x30, 0x18, 0x0C, 0x18, 0x30, 0x60, 0x00],
		63: [0x7C, 0xC6, 0x0C, 0x18, 0x18, 0x00, 0x18, 0x00],
		64: [0x7C, 0xC6, 0xDE, 0xDE, 0xDE, 0xC0, 0x78, 0x00],
		65: [0x38, 0x6C, 0xC6, 0xFE, 0xC6, 0xC6, 0xC6, 0x00],
		66: [0xFC, 0x66, 0x66, 0x7C, 0x66, 0x66, 0xFC, 0x00],
		67: [0x3C, 0x66, 0xC0, 0xC0, 0xC0, 0x66, 0x3C, 0x00],
		68: [0xF8, 0x6C, 0x66, 0x66, 0x66, 0x6C, 0xF8, 0x00],
		69: [0xFE, 0x62, 0x68, 0x78, 0x68, 0x62, 0xFE, 0x00],
		70: [0xFE, 0x62, 0x68, 0x78, 0x68, 0x60, 0xF0, 0x00],
		71: [0x3C, 0x66, 0xC0, 0xC0, 0xCE, 0x66, 0x3E, 0x00],
		72: [0xC6, 0xC6, 0xC6, 0xFE, 0xC6, 0xC6, 0xC6, 0x00],
		73: [0x7E, 0x18, 0x18, 0x18, 0x18, 0x18, 0x7E, 0x00],
		74: [0x1E, 0x0C, 0x0C, 0x0C, 0xCC, 0xCC, 0x78, 0x00],
		75: [0xE6, 0x66, 0x6C, 0x78, 0x6C, 0x66, 0xE6, 0x00],
		76: [0xF0, 0x60, 0x60, 0x60, 0x62, 0x66, 0xFE, 0x00],
		77: [0xC6, 0xEE, 0xFE, 0xFE, 0xD6, 0xC6, 0xC6, 0x00],
		78: [0xC6, 0xE6, 0xF6, 0xDE, 0xCE, 0xC6, 0xC6, 0x00],
		79: [0x7C, 0xC6, 0xC6, 0xC6, 0xC6, 0xC6, 0x7C, 0x00],
		80: [0xFC, 0x66, 0x66, 0x7C, 0x60, 0x60, 0xF0, 0x00],
		81: [0x7C, 0xC6, 0xC6, 0xC6, 0xD6, 0xDC, 0x76, 0x00],
		82: [0xFC, 0x66, 0x66, 0x7C, 0x6C, 0x66, 0xE6, 0x00],
		83: [0x7C, 0xC6, 0x60, 0x38, 0x0C, 0xC6, 0x7C, 0x00],
		84: [0x7E, 0x5A, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00],
		85: [0xC6, 0xC6, 0xC6, 0xC6, 0xC6, 0xC6, 0x7C, 0x00],
		86: [0xC6, 0xC6, 0xC6, 0xC6, 0xC6, 0x6C, 0x38, 0x00],
		87: [0xC6, 0xC6, 0xC6, 0xD6, 0xFE, 0xEE, 0xC6, 0x00],
		88: [0xC6, 0x6C, 0x38, 0x38, 0x38, 0x6C, 0xC6, 0x00],
		89: [0x66, 0x66, 0x66, 0x3C, 0x18, 0x18, 0x3C, 0x00],
		90: [0xFE, 0xC6, 0x8C, 0x18, 0x32, 0x66, 0xFE, 0x00],
		91: [0x3C, 0x30, 0x30, 0x30, 0x30, 0x30, 0x3C, 0x00],
		92: [0xC0, 0x60, 0x30, 0x18, 0x0C, 0x06, 0x02, 0x00],
		93: [0x3C, 0x0C, 0x0C, 0x0C, 0x0C, 0x0C, 0x3C, 0x00],
		94: [0x10, 0x38, 0x6C, 0xC6, 0x00, 0x00, 0x00, 0x00],
		95: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF],
		96: [0x30, 0x18, 0x0C, 0x00, 0x00, 0x00, 0x00, 0x00],
		97: [0x00, 0x00, 0x78, 0x0C, 0x7C, 0xCC, 0x76, 0x00],
		98: [0xE0, 0x60, 0x60, 0x7C, 0x66, 0x66, 0xDC, 0x00],
		99: [0x00, 0x00, 0x7C, 0xC6, 0xC0, 0xC6, 0x7C, 0x00],
		100: [0x1C, 0x0C, 0x0C, 0x7C, 0xCC, 0xCC, 0x76, 0x00],
		101: [0x00, 0x00, 0x7C, 0xC6, 0xFE, 0xC0, 0x7C, 0x00],
		102: [0x3C, 0x66, 0x60, 0xF8, 0x60, 0x60, 0xF0, 0x00],
		103: [0x00, 0x00, 0x76, 0xCC, 0xCC, 0x7C, 0x0C, 0x78],
		104: [0xE0, 0x60, 0x7C, 0x66, 0x66, 0x66, 0xE6, 0x00],
		105: [0x18, 0x00, 0x38, 0x18, 0x18, 0x18, 0x3C, 0x00],
		106: [0x06, 0x00, 0x0E, 0x06, 0x06, 0x66, 0x66, 0x3C],
		107: [0xE0, 0x60, 0x66, 0x6C, 0x78, 0x6C, 0xE6, 0x00],
		108: [0x38, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3C, 0x00],
		109: [0x00, 0x00, 0xEC, 0xFE, 0xD6, 0xC6, 0xC6, 0x00],
		110: [0x00, 0x00, 0xDC, 0x66, 0x66, 0x66, 0x66, 0x00],
		111: [0x00, 0x00, 0x7C, 0xC6, 0xC6, 0xC6, 0x7C, 0x00],
		112: [0x00, 0x00, 0xDC, 0x66, 0x66, 0x7C, 0x60, 0xF0],
		113: [0x00, 0x00, 0x76, 0xCC, 0xCC, 0x7C, 0x0C, 0x1E],
		114: [0x00, 0x00, 0xDC, 0x76, 0x60, 0x60, 0xF0, 0x00],
		115: [0x00, 0x00, 0x7C, 0xC0, 0x7C, 0x06, 0xFC, 0x00],
		116: [0x30, 0x30, 0xFC, 0x30, 0x30, 0x36, 0x1C, 0x00],
		117: [0x00, 0x00, 0xCC, 0xCC, 0xCC, 0xCC, 0x76, 0x00],
		118: [0x00, 0x00, 0xC6, 0xC6, 0xC6, 0x6C, 0x38, 0x00],
		119: [0x00, 0x00, 0xC6, 0xC6, 0xD6, 0xFE, 0x6C, 0x00],
		120: [0x00, 0x00, 0xC6, 0x6C, 0x38, 0x6C, 0xC6, 0x00],
		121: [0x00, 0x00, 0xC6, 0xC6, 0xC6, 0x7E, 0x06, 0xFC],
		122: [0x00, 0x00, 0xFE, 0x8C, 0x18, 0x32, 0xFE, 0x00],
		123: [0x1C, 0x30, 0x30, 0xE0, 0x30, 0x30, 0x1C, 0x00],
		124: [0x18, 0x18, 0x18, 0x00, 0x18, 0x18, 0x18, 0x00],
		125: [0xE0, 0x30, 0x30, 0x1C, 0x30, 0x30, 0xE0, 0x00],
		126: [0x76, 0xDC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
	};

	function createScreenBuffer(options) {
		const opts = options || {};
		const getTerm = typeof opts.getTerm === 'function' ? opts.getTerm : function() { return null; };

		const screenBuffer = {
			active: false,
			mode: 'off', // 'off' | 'text' | '320x200' | '640x400'
			cols: 80,
			rows: 24,
			cursorRow: 1,
			cursorCol: 1,
			grid: [],
			pixelWidth: 0,
			pixelHeight: 0,
			charWidth: 8,
			charHeight: 8,
			vram: null, // Uint32Array hardware-style RGBA framebuffer
			_savedVram: null,
			penColorCode: 15,
			penColorPacked: PALETTE_PACKED[15],
			_canvas: null,
			_ctx: null,
			_imageData: null,
			_imageData32: null,
			_rafId: null,
			_dirty: false,
			_ansiBuf: '',
			_pendingWrap: false,
			_pressedKeys: new Set(),
			_keyQueue: [],

			isPixelMode: function() {
				return this.active && this.pixelWidth > 0 && this.pixelHeight > 0 && this.vram !== null;
			},
			getCols: function() {
				if (this.mode === '320x200') return 40;
				if (this.mode === '640x400') return 80;
				const term = getTerm();
				if (term && typeof term.cols === 'function') {
					const c = Math.trunc(Number(term.cols()));
					if (Number.isFinite(c) && c > 0) return c;
				}
				return 80;
			},
			getRows: function() {
				if (this.mode === '320x200' || this.mode === '640x400') return 25;
				const term = getTerm();
				if (term && typeof term.rows === 'function') {
					const r = Math.trunc(Number(term.rows()));
					if (Number.isFinite(r) && r > 0) return r;
				}
				return 24;
			},
			_initVram: function(width, height, charH) {
				this.pixelWidth = width;
				this.pixelHeight = height;
				this.charWidth = 8;
				this.charHeight = charH;
				this.vram = new Uint32Array(width * height);
				this.vram.fill(PALETTE_PACKED[0]);

				if (typeof document !== 'undefined' && document.getElementById) {
					const canvas = document.getElementById('screen-framebuffer-canvas');
					if (canvas && typeof canvas.getContext === 'function') {
						if (canvas.width !== width) canvas.width = width;
						if (canvas.height !== height) canvas.height = height;
						this._canvas = canvas;
						this._ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
						if (this._ctx && typeof this._ctx.createImageData === 'function') {
							this._imageData = this._ctx.createImageData(width, height);
							this._imageData32 = new Uint32Array(this._imageData.data.buffer);
						}
					}
				}
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
			_drawCharToVram: function(row0, col0, ch) {
				if (!this.isPixelMode()) return;
				const code = String(ch || ' ').charCodeAt(0);
				const glyph = FONT_8X8[code] || FONT_8X8[code >= 0x20 && code <= 0x7E ? code : 63] || FONT_8X8[32];
				const startX = col0 * this.charWidth;
				const startY = row0 * this.charHeight;
				const scaleY = this.charHeight === 16 ? 2 : 1;
				const fg = this.penColorPacked;
				const bg = PALETTE_PACKED[0];
				const w = this.pixelWidth;

				for (let gy = 0; gy < 8; gy++) {
					const bits = glyph[gy];
					for (let sy = 0; sy < scaleY; sy++) {
						const py = startY + gy * scaleY + sy;
						if (py < 0 || py >= this.pixelHeight) continue;
						const rowOffset = py * w + startX;
						for (let gx = 0; gx < 8; gx++) {
							if (startX + gx >= w) break;
							this.vram[rowOffset + gx] = (bits & (0x80 >> gx)) ? fg : bg;
						}
					}
				}
			},
			setScreen: function(modeOrWidth, height) {
				if (modeOrWidth === null || modeOrWidth === undefined) {
					return this.mode;
				}
				let target = null;
				if (typeof modeOrWidth === 'boolean') {
					target = modeOrWidth ? 'text' : 'off';
				} else if (typeof modeOrWidth === 'number') {
					const w = Math.trunc(modeOrWidth);
					if (w === 0) {
						target = 'off';
					} else if (w === 320 && (height === null || height === undefined || Math.trunc(Number(height)) === 200)) {
						target = '320x200';
					} else if (w === 640 && (height === null || height === undefined || Math.trunc(Number(height)) === 400)) {
						target = '640x400';
					}
				} else if (typeof modeOrWidth === 'string') {
					const s = modeOrWidth.trim().toLowerCase();
					if (s === 'off' || s === '0' || s === 'false' || s === 'none') {
						target = 'off';
					} else if (s === 'text' || s === 'true') {
						target = 'text';
					} else if (s === '320x200' || s === '320') {
						target = '320x200';
					} else if (s === '640x400' || s === '640') {
						target = '640x400';
					}
				}

				if (!target) {
					return false;
				}

				if (target === 'off') {
					this.mode = 'off';
					this.active = false;
					this._dirty = false;
					this._savedVram = null;
					this._pressedKeys.clear();
					this._keyQueue.length = 0;
					this._syncDomVisibility();
					return true;
				}

				if (target === 'text') {
					this.mode = 'text';
					this.active = true;
					this.pixelWidth = 0;
					this.pixelHeight = 0;
					this.vram = null;
					this._savedVram = null;
					this._ensureGrid(true);
					this.cursorRow = 1;
					this.cursorCol = 1;
					this._pendingWrap = false;
					this._ansiBuf = '';
					this._syncDomStyle();
					this._syncDomVisibility();
					this.render(true);
					return true;
				}

				this._savedVram = null;
				if (target === '320x200') {
					this.mode = '320x200';
					this.active = true;
					this._initVram(320, 200, 8);
				} else if (target === '640x400') {
					this.mode = '640x400';
					this.active = true;
					this._initVram(640, 400, 16);
				}

				this._ensureGrid(true);
				this.cursorRow = 1;
				this.cursorCol = 1;
				this._pendingWrap = false;
				this._ansiBuf = '';
				this._syncDomVisibility();
				this.render(true);
				return true;
			},
			setMode: function(enabled) {
				if (!enabled) {
					return !this.setScreen('off');
				}
				if (this.active && this.mode !== 'off') {
					this._syncDomVisibility();
					this.render(true);
					return true;
				}
				return this.setScreen('text');
			},
			setPenColor: function(colorcode) {
				if (colorcode === null || colorcode === undefined) {
					return this.penColorCode;
				}
				const resolved = resolveColor(colorcode);
				this.penColorCode = resolved.code;
				this.penColorPacked = resolved.packed;
				return true;
			},
			pixel: function(x, y, colorcode) {
				if (!this.isPixelMode()) {
					this.setScreen('320x200');
				}
				const ix = Math.trunc(Number(x));
				const iy = Math.trunc(Number(y));
				if (!Number.isFinite(ix) || !Number.isFinite(iy)) return false;
				if (ix < 0 || ix >= this.pixelWidth || iy < 0 || iy >= this.pixelHeight) {
					return false;
				}
				const packed = (colorcode !== null && colorcode !== undefined)
					? resolveColor(colorcode).packed
					: this.penColorPacked;
				this.vram[iy * this.pixelWidth + ix] = packed;
				this.render(false);
				return true;
			},
			getPixel: function(x, y) {
				if (!this.isPixelMode()) return false;
				const ix = Math.trunc(Number(x));
				const iy = Math.trunc(Number(y));
				if (!Number.isFinite(ix) || !Number.isFinite(iy) || ix < 0 || ix >= this.pixelWidth || iy < 0 || iy >= this.pixelHeight) {
					return false;
				}
				const packed = this.vram[iy * this.pixelWidth + ix];
				if (PACKED_TO_CODE.has(packed)) {
					return PACKED_TO_CODE.get(packed);
				}
				return unpackPackedToHex(packed);
			},
			line: function(x1, y1, x2, y2, colorcode) {
				if (!this.isPixelMode()) {
					this.setScreen('320x200');
				}
				let ix0 = Math.trunc(Number(x1));
				let iy0 = Math.trunc(Number(y1));
				const ix1 = Math.trunc(Number(x2));
				const iy1 = Math.trunc(Number(y2));
				if (!Number.isFinite(ix0) || !Number.isFinite(iy0) || !Number.isFinite(ix1) || !Number.isFinite(iy1)) {
					return false;
				}
				const packed = (colorcode !== null && colorcode !== undefined)
					? resolveColor(colorcode).packed
					: this.penColorPacked;

				const w = this.pixelWidth;
				const h = this.pixelHeight;
				const vram = this.vram;

				const dx = Math.abs(ix1 - ix0);
				const dy = -Math.abs(iy1 - iy0);
				const sx = ix0 < ix1 ? 1 : -1;
				const sy = iy0 < iy1 ? 1 : -1;
				let err = dx + dy;

				while (true) {
					if (ix0 >= 0 && ix0 < w && iy0 >= 0 && iy0 < h) {
						vram[iy0 * w + ix0] = packed;
					}
					if (ix0 === ix1 && iy0 === iy1) break;
					const e2 = 2 * err;
					if (e2 >= dy) {
						err += dy;
						ix0 += sx;
					}
					if (e2 <= dx) {
						err += dx;
						iy0 += sy;
					}
				}
				this.render(false);
				return true;
			},
			box: function(x1, y1, x2, y2, colorcode, fill) {
				if (!this.isPixelMode()) {
					this.setScreen('320x200');
				}
				const ax = Math.trunc(Number(x1));
				const ay = Math.trunc(Number(y1));
				const bx = Math.trunc(Number(x2));
				const by = Math.trunc(Number(y2));
				if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
					return false;
				}
				const packed = (colorcode !== null && colorcode !== undefined)
					? resolveColor(colorcode).packed
					: this.penColorPacked;
				const w = this.pixelWidth;
				const h = this.pixelHeight;
				const vram = this.vram;
				const lx = Math.max(0, Math.min(ax, bx));
				const rx = Math.min(w - 1, Math.max(ax, bx));
				const ty = Math.max(0, Math.min(ay, by));
				const botY = Math.min(h - 1, Math.max(ay, by));
				if (lx > rx || ty > botY) {
					return false;
				}
				if (fill) {
					for (let y = ty; y <= botY; y++) {
						const rowStart = y * w;
						vram.fill(packed, rowStart + lx, rowStart + rx + 1);
					}
				} else {
					const rawLx = Math.min(ax, bx);
					const rawRx = Math.max(ax, bx);
					const rawTy = Math.min(ay, by);
					const rawBy = Math.max(ay, by);
					if (rawTy >= 0 && rawTy < h) vram.fill(packed, rawTy * w + lx, rawTy * w + rx + 1);
					if (rawBy >= 0 && rawBy < h) vram.fill(packed, rawBy * w + lx, rawBy * w + rx + 1);
					for (let y = ty; y <= botY; y++) {
						const rowStart = y * w;
						if (rawLx >= 0 && rawLx < w) vram[rowStart + rawLx] = packed;
						if (rawRx >= 0 && rawRx < w) vram[rowStart + rawRx] = packed;
					}
				}
				this.render(false);
				return true;
			},
			circle: function(cx, cy, r, colorcode, fill) {
				if (!this.isPixelMode()) {
					this.setScreen('320x200');
				}
				const icx = Math.trunc(Number(cx));
				const icy = Math.trunc(Number(cy));
				const ir = Math.trunc(Number(r));
				if (!Number.isFinite(icx) || !Number.isFinite(icy) || !Number.isFinite(ir) || ir < 0) {
					return false;
				}
				const packed = (colorcode !== null && colorcode !== undefined)
					? resolveColor(colorcode).packed
					: this.penColorPacked;
				const w = this.pixelWidth;
				const h = this.pixelHeight;
				const vram = this.vram;
				const plotPt = function(px, py) {
					if (px >= 0 && px < w && py >= 0 && py < h) {
						vram[py * w + px] = packed;
					}
				};
				const spanRow = function(py, x0, x1) {
					if (py < 0 || py >= h) return;
					const lx = Math.max(0, x0);
					const rx = Math.min(w - 1, x1);
					if (lx <= rx) {
						vram.fill(packed, py * w + lx, py * w + rx + 1);
					}
				};
				if (ir === 0) {
					plotPt(icx, icy);
					this.render(false);
					return true;
				}
				if (fill) {
					const r2 = ir * ir;
					const y0 = Math.max(0, icy - ir);
					const y1 = Math.min(h - 1, icy + ir);
					for (let py = y0; py <= y1; py++) {
						const dy = py - icy;
						const dx = Math.floor(Math.sqrt(r2 - dy * dy));
						spanRow(py, icx - dx, icx + dx);
					}
				} else {
					let x = ir;
					let y = 0;
					let err = 1 - x;
					while (x >= y) {
						plotPt(icx + x, icy + y);
						plotPt(icx + y, icy + x);
						plotPt(icx - y, icy + x);
						plotPt(icx - x, icy + y);
						plotPt(icx - x, icy - y);
						plotPt(icx - y, icy - x);
						plotPt(icx + y, icy - x);
						plotPt(icx + x, icy - y);
						y++;
						if (err < 0) {
							err += 2 * y + 1;
						} else {
							x--;
							err += 2 * (y - x) + 1;
						}
					}
				}
				this.render(false);
				return true;
			},
			saveVram: function() {
				if (!this.isPixelMode()) {
					return false;
				}
				this._savedVram = new Uint32Array(this.vram);
				return true;
			},
			restoreVram: function(x1, y1, x2, y2) {
				if (!this.isPixelMode() || !this._savedVram || this._savedVram.length !== this.vram.length) {
					return false;
				}
				const w = this.pixelWidth;
				const h = this.pixelHeight;
				if (x1 === null || x1 === undefined) {
					this.vram.set(this._savedVram);
					this.render(false);
					return true;
				}
				const ax = Math.trunc(Number(x1));
				const ay = Math.trunc(Number(y1 === null || y1 === undefined ? 0 : y1));
				const bx = Math.trunc(Number(x2 === null || x2 === undefined ? w - 1 : x2));
				const by = Math.trunc(Number(y2 === null || y2 === undefined ? h - 1 : y2));
				if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
					return false;
				}
				const lx = Math.max(0, Math.min(ax, bx));
				const rx = Math.min(w - 1, Math.max(ax, bx));
				const ty = Math.max(0, Math.min(ay, by));
				const botY = Math.min(h - 1, Math.max(ay, by));
				if (lx > rx || ty > botY) {
					return false;
				}
				const vram = this.vram;
				const saved = this._savedVram;
				for (let y = ty; y <= botY; y++) {
					const start = y * w + lx;
					const end = y * w + rx + 1;
					vram.set(saved.subarray(start, end), start);
				}
				this.render(false);
				return true;
			},
			clear: function() {
				this._ensureGrid(true);
				if (this.isPixelMode()) {
					this.vram.fill(PALETTE_PACKED[0]);
				}
				this.cursorRow = 1;
				this.cursorCol = 1;
				this._pendingWrap = false;
				this._ansiBuf = '';
				this.render(!this.isPixelMode());
				return true;
			},
			inkey: function() {
				if (this._keyQueue.length === 0) {
					return '';
				}
				return this._keyQueue.shift();
			},
			isKeyDown: function(key) {
				if (key === null || key === undefined) {
					return Array.from(this._pressedKeys);
				}
				const norm = String(key).toLowerCase();
				if (norm === 'space') {
					return this._pressedKeys.has(' ') || this._pressedKeys.has('spacebar');
				}
				if (norm === 'left' || norm === 'right' || norm === 'up' || norm === 'down') {
					return this._pressedKeys.has('arrow' + norm);
				}
				return this._pressedKeys.has(norm);
			},
			pushKey: function(key, held) {
				const k = String(key ?? '');
				if (k !== '') {
					if (held === true) {
						this._pressedKeys.add(k.toLowerCase());
					} else if (held === false) {
						this._pressedKeys.delete(k.toLowerCase());
					} else {
						this._keyQueue.push(k);
						if (this._keyQueue.length > 64) {
							this._keyQueue.shift();
						}
					}
				}
				return true;
			},
			locate: function(row, col) {
				if (!this.active) {
					this.setScreen('text');
				} else {
					this._ensureGrid(false);
				}
				const r = Math.trunc(Number(row));
				const c = (col === null || col === undefined) ? 1 : Math.trunc(Number(col));
				this.cursorRow = Math.min(Math.max(1, Number.isFinite(r) ? r : 1), this.rows);
				this.cursorCol = Math.min(Math.max(1, Number.isFinite(c) ? c : 1), this.cols);
				this._pendingWrap = false;
				this.render(false);
				return true;
			},
			_scrollUp: function() {
				this.grid.shift();
				const blank = [];
				for (let c = 0; c < this.cols; c++) blank.push(' ');
				this.grid.push(blank);
				if (this.isPixelMode()) {
					const shiftPixels = this.charHeight * this.pixelWidth;
					this.vram.copyWithin(0, shiftPixels);
					this.vram.fill(PALETTE_PACKED[0], this.vram.length - shiftPixels);
				}
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

				const r0 = this.cursorRow - 1;
				const c0 = this.cursorCol - 1;
				this.grid[r0][c0] = ch;
				if (this.isPixelMode()) {
					this._drawCharToVram(r0, c0, ch);
				}
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
						if (this.isPixelMode()) {
							this.vram.fill(PALETTE_PACKED[0]);
						}
						this.cursorRow = 1;
						this.cursorCol = 1;
						this._pendingWrap = false;
					}
				} else if (cmd === 'K') {
					const rIdx = this.cursorRow - 1;
					for (let c = this.cursorCol - 1; c < this.cols; c++) {
						this.grid[rIdx][c] = ' ';
						if (this.isPixelMode()) {
							this._drawCharToVram(rIdx, c, ' ');
						}
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
				this.render(false);
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
				const term = getTerm();
				if (this.active) {
					if (term && typeof term.disable === 'function') {
						term.disable();
					}
				} else if (term) {
					if (typeof term.enable === 'function') {
						term.enable();
					}
					if (typeof term.focus === 'function') {
						term.focus(true);
					}
				}
				if (typeof document === 'undefined' || !document.getElementById) return;
				const wrap = document.getElementById('screen-framebuffer');
				if (wrap && wrap.classList) {
					if (this.active) {
						wrap.classList.add('active');
						if (this.isPixelMode()) {
							wrap.classList.add('pixel-mode');
						} else {
							wrap.classList.remove('pixel-mode');
						}
					} else {
						wrap.classList.remove('active');
						wrap.classList.remove('pixel-mode');
					}
				}
			},
			_flushCanvas: function() {
				this._dirty = false;
				if (!this.isPixelMode() || !this._ctx || !this._imageData || !this._imageData32) {
					return;
				}
				this._imageData32.set(this.vram);
				this._ctx.putImageData(this._imageData, 0, 0);
			},
			render: function(immediate) {
				if (!this.active) return;

				if (this.isPixelMode()) {
					if (!this._ctx || !this._imageData32) return;
					if (immediate || typeof requestAnimationFrame !== 'function') {
						if (this._rafId !== null && typeof cancelAnimationFrame === 'function') {
							cancelAnimationFrame(this._rafId);
							this._rafId = null;
						}
						this._flushCanvas();
						return;
					}
					this._dirty = true;
					if (this._rafId === null) {
						const self = this;
						this._rafId = requestAnimationFrame(function() {
							self._rafId = null;
							if (self._dirty && self.isPixelMode()) {
								self._flushCanvas();
							}
						});
					}
					return;
				}

				if (typeof document === 'undefined' || !document.getElementById) return;
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
				if (!screenBuffer.active) return;
				if (document.body && document.body.dataset && document.body.dataset.bopEditorOpen === '1') return;
				if (ev.key === 'Escape') {
					ev.preventDefault();
					ev.stopPropagation();
					screenBuffer.setMode(false);
					return;
				}
				if (ev.ctrlKey || ev.metaKey || ev.altKey) {
					return;
				}
				ev.preventDefault();
				ev.stopPropagation();
				const k = String(ev.key || '');
				if (k !== '') {
					screenBuffer._pressedKeys.add(k.toLowerCase());
					if (!ev.repeat) {
						screenBuffer._keyQueue.push(k);
						if (screenBuffer._keyQueue.length > 64) {
							screenBuffer._keyQueue.shift();
						}
					}
				}
			}, true);
			document.addEventListener('keyup', function(ev) {
				const k = String(ev.key || '');
				if (k !== '') {
					screenBuffer._pressedKeys.delete(k.toLowerCase());
				}
			}, true);
		}
		if (typeof window !== 'undefined' && window.addEventListener) {
			window.addEventListener('blur', function() {
				screenBuffer._pressedKeys.clear();
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
			screenSet: function(modeOrWidth, height) {
				return screenBuffer.setScreen(modeOrWidth, height);
			},
			screenWidth: function() {
				return screenBuffer.isPixelMode() ? screenBuffer.pixelWidth : 0;
			},
			screenHeight: function() {
				return screenBuffer.isPixelMode() ? screenBuffer.pixelHeight : 0;
			},
			screenPenColor: function(colorcode) {
				return screenBuffer.setPenColor(colorcode);
			},
			screenPixel: function(x, y, colorcode) {
				return screenBuffer.pixel(x, y, colorcode);
			},
			screenGetPixel: function(x, y) {
				return screenBuffer.getPixel(x, y);
			},
			screenDrawLine: function(x1, y1, x2, y2, colorcode) {
				return screenBuffer.line(x1, y1, x2, y2, colorcode);
			},
			screenBox: function(x1, y1, x2, y2, colorcode, fill) {
				return screenBuffer.box(x1, y1, x2, y2, colorcode, fill);
			},
			screenCircle: function(cx, cy, r, colorcode, fill) {
				return screenBuffer.circle(cx, cy, r, colorcode, fill);
			},
			screenSave: function() {
				return screenBuffer.saveVram();
			},
			screenRestore: function(x1, y1, x2, y2) {
				return screenBuffer.restoreVram(x1, y1, x2, y2);
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
			},
			screenInkey: function() {
				return screenBuffer.inkey();
			},
			screenKeyDown: function(key) {
				return screenBuffer.isKeyDown(key);
			},
			screenPushKey: function(key, held) {
				return screenBuffer.pushKey(key, held);
			}
		};
	}

	globalScope.createScreenBuffer = createScreenBuffer;
	globalScope.createScreenBridgeHelpers = createScreenBridgeHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
