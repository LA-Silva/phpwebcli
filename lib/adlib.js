(function(globalScope) {
	'use strict';

	const CHANNEL_COUNT = 9;

	const PRESETS = {
		lead: {
			name: 'lead',
			modWave: 'sine',
			carWave: 'halfsine',
			modMult: 2,
			carMult: 1,
			modIndex: 2.6,
			modDecay: 0.25,
			attack: 0.01,
			decay: 0.18,
			sustain: 0.55,
			release: 0.14,
			slide: 1,
			noise: 0
		},
		bass: {
			name: 'bass',
			modWave: 'sine',
			carWave: 'sine',
			modMult: 1,
			carMult: 0.5,
			modIndex: 3.4,
			modDecay: 0.16,
			attack: 0.008,
			decay: 0.22,
			sustain: 0.4,
			release: 0.1,
			slide: 1,
			noise: 0
		},
		brass: {
			name: 'brass',
			modWave: 'sine',
			carWave: 'abssine',
			modMult: 1,
			carMult: 1,
			modIndex: 3.0,
			modDecay: 0.35,
			attack: 0.045,
			decay: 0.2,
			sustain: 0.7,
			release: 0.15,
			slide: 1,
			noise: 0
		},
		organ: {
			name: 'organ',
			modWave: 'sine',
			carWave: 'pulsesine',
			modMult: 3,
			carMult: 1,
			modIndex: 1.5,
			modDecay: 0.4,
			attack: 0.015,
			decay: 0.08,
			sustain: 0.85,
			release: 0.12,
			slide: 1,
			noise: 0
		},
		bell: {
			name: 'bell',
			modWave: 'sine',
			carWave: 'sine',
			modMult: 3.5,
			carMult: 1,
			modIndex: 4.2,
			modDecay: 0.65,
			attack: 0.005,
			decay: 0.65,
			sustain: 0.05,
			release: 0.35,
			slide: 1,
			noise: 0
		},
		strings: {
			name: 'strings',
			modWave: 'sine',
			carWave: 'halfsine',
			modMult: 1,
			carMult: 1,
			modIndex: 1.2,
			modDecay: 0.6,
			attack: 0.12,
			decay: 0.25,
			sustain: 0.78,
			release: 0.28,
			slide: 1,
			noise: 0
		},
		laser: {
			name: 'laser',
			modWave: 'sawtooth',
			carWave: 'square',
			modMult: 2,
			carMult: 1,
			modIndex: 3.8,
			modDecay: 0.12,
			attack: 0.003,
			decay: 0.11,
			sustain: 0.1,
			release: 0.06,
			slide: 0.28,
			noise: 0
		},
		boom: {
			name: 'boom',
			modWave: 'square',
			carWave: 'triangle',
			modMult: 0.7,
			carMult: 0.5,
			modIndex: 5.5,
			modDecay: 0.35,
			attack: 0.005,
			decay: 0.36,
			sustain: 0.05,
			release: 0.22,
			slide: 0.45,
			noise: 0.65
		},
		chomp: {
			name: 'chomp',
			modWave: 'sine',
			carWave: 'triangle',
			modMult: 1.5,
			carMult: 1,
			modIndex: 2.2,
			modDecay: 0.08,
			attack: 0.004,
			decay: 0.07,
			sustain: 0.2,
			release: 0.04,
			slide: 1.45,
			noise: 0
		},
		coin: {
			name: 'coin',
			modWave: 'sine',
			carWave: 'square',
			modMult: 2,
			carMult: 1,
			modIndex: 1.8,
			modDecay: 0.15,
			attack: 0.004,
			decay: 0.16,
			sustain: 0.25,
			release: 0.08,
			slide: 1,
			noise: 0
		},
		beep: {
			name: 'beep',
			modWave: 'sine',
			carWave: 'square',
			modMult: 1,
			carMult: 1,
			modIndex: 0.4,
			modDecay: 0.2,
			attack: 0.004,
			decay: 0.05,
			sustain: 0.9,
			release: 0.03,
			slide: 1,
			noise: 0
		},
		sine: {
			name: 'sine',
			modWave: 'sine',
			carWave: 'sine',
			modMult: 1,
			carMult: 1,
			modIndex: 0,
			modDecay: 0.2,
			attack: 0.008,
			decay: 0.06,
			sustain: 0.9,
			release: 0.06,
			slide: 1,
			noise: 0
		}
	};

	const NOTE_SEMITONES = {
		C: 0,
		D: 2,
		E: 4,
		F: 5,
		G: 7,
		A: 9,
		B: 11
	};

	function clonePatch(p) {
		return Object.assign({}, p);
	}

	function createOplWave(ctx, kind) {
		const size = 2048;
		const real = new Float32Array(32);
		const imag = new Float32Array(32);
		if (kind === 'halfsine') {
			// Positive half-wave rectified sine (OPL2 waveform 1)
			const samples = 256;
			for (let k = 1; k < 24; k++) {
				let a = 0;
				let b = 0;
				for (let n = 0; n < samples; n++) {
					const t = (2 * Math.PI * n) / samples;
					const y = Math.sin(t) > 0 ? Math.sin(t) : 0;
					a += y * Math.cos(k * t);
					b += y * Math.sin(k * t);
				}
				real[k] = (2 * a) / samples;
				imag[k] = (2 * b) / samples;
			}
			return ctx.createPeriodicWave(real, imag);
		}
		if (kind === 'abssine') {
			// Full-wave rectified sine (OPL2 waveform 2)
			const samples = 256;
			for (let k = 1; k < 24; k++) {
				let a = 0;
				let b = 0;
				for (let n = 0; n < samples; n++) {
					const t = (2 * Math.PI * n) / samples;
					const y = Math.abs(Math.sin(t));
					a += y * Math.cos(k * t);
					b += y * Math.sin(k * t);
				}
				real[k] = (2 * a) / samples;
				imag[k] = (2 * b) / samples;
			}
			return ctx.createPeriodicWave(real, imag);
		}
		if (kind === 'pulsesine') {
			// Quarter-period pulse sine (OPL2 waveform 3)
			const samples = 256;
			for (let k = 1; k < 24; k++) {
				let a = 0;
				let b = 0;
				for (let n = 0; n < samples; n++) {
					const t = (2 * Math.PI * n) / samples;
					const phase = t % (2 * Math.PI);
					const y = (phase < Math.PI * 0.5 || (phase >= Math.PI && phase < Math.PI * 1.5))
						? Math.abs(Math.sin(t))
						: 0;
					a += y * Math.cos(k * t);
					b += y * Math.sin(k * t);
				}
				real[k] = (2 * a) / samples;
				imag[k] = (2 * b) / samples;
			}
			return ctx.createPeriodicWave(real, imag);
		}
		void size;
		return null;
	}

	function createAdlibSynth() {
		const channelPatches = [];
		const activeVoices = new Array(CHANNEL_COUNT).fill(null);
		for (let i = 0; i < CHANNEL_COUNT; i++) {
			channelPatches.push(clonePatch(PRESETS.lead));
		}

		let audioCtx = null;
		let masterGain = null;
		let noiseBuffer = null;
		let waveCache = {};
		let masterVolume = 80;
		const scheduledHandles = new Set();
		const pendingWaits = new Set();
		let unlockBound = false;

		function getAudioContextClass() {
			return globalScope.AudioContext || globalScope.webkitAudioContext || null;
		}

		function ensureAudio() {
			const Ctor = getAudioContextClass();
			if (!Ctor) {
				return null;
			}
			if (!audioCtx) {
				try {
					audioCtx = new Ctor();
					masterGain = audioCtx.createGain();
					masterGain.gain.value = (masterVolume / 100) * 0.35;
					masterGain.connect(audioCtx.destination);
					waveCache = {};
					noiseBuffer = null;
				} catch (_e) {
					audioCtx = null;
					masterGain = null;
					return null;
				}
			}
			if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
				try {
					const p = audioCtx.resume();
					if (p && typeof p.catch === 'function') p.catch(function() {});
				} catch (_e) {}
			}
			return audioCtx;
		}

		function bindUnlock() {
			if (unlockBound) {
				return;
			}
			const target = typeof window !== 'undefined' && window.addEventListener
				? window
				: (typeof document !== 'undefined' && document.addEventListener ? document : null);
			if (!target) {
				return;
			}
			unlockBound = true;
			const unlock = function() {
				const ctx = ensureAudio();
				if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
					try {
						const p = ctx.resume();
						if (p && typeof p.catch === 'function') p.catch(function() {});
					} catch (_e) {}
				}
			};
			target.addEventListener('pointerdown', unlock, true);
			target.addEventListener('mousedown', unlock, true);
			target.addEventListener('keydown', unlock, true);
			target.addEventListener('touchstart', unlock, true);
			target.addEventListener('click', unlock, true);
		}
		bindUnlock();

		function getNoiseBuffer(ctx) {
			if (noiseBuffer) return noiseBuffer;
			const len = Math.floor(ctx.sampleRate * 0.5);
			const buf = ctx.createBuffer(1, len, ctx.sampleRate);
			const data = buf.getChannelData(0);
			for (let i = 0; i < len; i++) {
				data[i] = Math.random() * 2 - 1;
			}
			noiseBuffer = buf;
			return buf;
		}

		function applyWaveform(ctx, osc, waveName) {
			const w = String(waveName || 'sine').toLowerCase();
			if (w === 'sine' || w === 'square' || w === 'triangle' || w === 'sawtooth') {
				osc.type = w;
				return;
			}
			if (typeof ctx.createPeriodicWave === 'function') {
				if (!waveCache[w]) {
					waveCache[w] = createOplWave(ctx, w);
				}
				if (waveCache[w]) {
					osc.setPeriodicWave(waveCache[w]);
					return;
				}
			}
			osc.type = 'sine';
		}

		function normChannel(ch) {
			if (ch === null || ch === undefined) return 0;
			const n = Math.trunc(Number(ch));
			if (!Number.isFinite(n)) return 0;
			return Math.max(0, Math.min(CHANNEL_COUNT - 1, n));
		}

		function noteToFreq(noteOrHz) {
			if (noteOrHz === null || noteOrHz === undefined) return 0;
			if (typeof noteOrHz === 'number') {
				return Number.isFinite(noteOrHz) && noteOrHz > 0 ? noteOrHz : 0;
			}
			const raw = String(noteOrHz).trim();
			if (!raw) return 0;
			if (/^\d+(?:\.\d+)?$/.test(raw)) {
				const hz = Number(raw);
				return Number.isFinite(hz) && hz > 0 ? hz : 0;
			}
			const m = /^([A-Ga-g])([#+\-b]?)(\d)$/.exec(raw);
			if (!m) {
				return 0;
			}
			const letter = m[1].toUpperCase();
			const acc = m[2];
			const octave = parseInt(m[3], 10);
			let semi = NOTE_SEMITONES[letter];
			if (acc === '#' || acc === '+') semi += 1;
			else if (acc === '-' || acc === 'b') semi -= 1;
			const midi = (octave + 1) * 12 + semi;
			return 440 * Math.pow(2, (midi - 69) / 12);
		}

		function parseMml(mmlStr) {
			const src = String(mmlStr ?? '');
			let tempo = 120;
			let octave = 4;
			let defaultLen = 4;
			let articulation = 0.875;
			let pos = 0;
			let timeMs = 0;
			const events = [];

			function readDigits() {
				const start = pos;
				while (pos < src.length && src.charAt(pos) >= '0' && src.charAt(pos) <= '9') {
					pos++;
				}
				return pos > start ? parseInt(src.slice(start, pos), 10) : null;
			}

			function readDotsMultiplier() {
				let mult = 1;
				let add = 0.5;
				while (pos < src.length && src.charAt(pos) === '.') {
					mult += add;
					add *= 0.5;
					pos++;
				}
				return mult;
			}

			while (pos < src.length) {
				const ch = src.charAt(pos).toUpperCase();
				if (/\s/.test(ch)) {
					pos++;
					continue;
				}
				if (ch === 'T') {
					pos++;
					const val = readDigits();
					if (val !== null) {
						tempo = Math.max(32, Math.min(300, val));
					}
					continue;
				}
				if (ch === 'O') {
					pos++;
					const val = readDigits();
					if (val !== null) {
						octave = Math.max(0, Math.min(8, val));
					}
					continue;
				}
				if (ch === '>') {
					pos++;
					octave = Math.min(8, octave + 1);
					continue;
				}
				if (ch === '<') {
					pos++;
					octave = Math.max(0, octave - 1);
					continue;
				}
				if (ch === 'L') {
					pos++;
					const val = readDigits();
					if (val !== null && val >= 1 && val <= 64) {
						defaultLen = val;
					}
					continue;
				}
				if (ch === 'M') {
					pos++;
					const sub = pos < src.length ? src.charAt(pos).toUpperCase() : '';
					if (sub === 'L') {
						articulation = 1.0;
						pos++;
					} else if (sub === 'S') {
						articulation = 0.65;
						pos++;
					} else if (sub === 'N') {
						articulation = 0.875;
						pos++;
					}
					continue;
				}
				if (ch === 'R' || ch === 'P') {
					pos++;
					const lenVal = readDigits();
					const len = (lenVal !== null && lenVal >= 1 && lenVal <= 64) ? lenVal : defaultLen;
					const dots = readDotsMultiplier();
					const durMs = (60000 / tempo) * (4 / len) * dots;
					events.push({ type: 'rest', freq: 0, startMs: timeMs, gateMs: 0, durMs: durMs, note: 'R' });
					timeMs += durMs;
					continue;
				}
				if (ch === 'N') {
					pos++;
					const midi = readDigits();
					const dots = readDotsMultiplier();
					const durMs = (60000 / tempo) * (4 / defaultLen) * dots;
					if (midi === null || midi <= 0) {
						events.push({ type: 'rest', freq: 0, startMs: timeMs, gateMs: 0, durMs: durMs, note: 'N0' });
					} else {
						const freq = 440 * Math.pow(2, (midi - 69) / 12);
						events.push({
							type: 'note',
							freq: freq,
							startMs: timeMs,
							gateMs: durMs * articulation,
							durMs: durMs,
							note: 'N' + midi
						});
					}
					timeMs += durMs;
					continue;
				}
				if (NOTE_SEMITONES[ch] !== undefined) {
					pos++;
					let acc = 0;
					let accStr = '';
					if (pos < src.length) {
						const nextCh = src.charAt(pos);
						if (nextCh === '#' || nextCh === '+') {
							acc = 1;
							accStr = '#';
							pos++;
						} else if (nextCh === '-') {
							acc = -1;
							accStr = '-';
							pos++;
						}
					}
					const lenVal = readDigits();
					const len = (lenVal !== null && lenVal >= 1 && lenVal <= 64) ? lenVal : defaultLen;
					const dots = readDotsMultiplier();
					const durMs = (60000 / tempo) * (4 / len) * dots;
					const midi = (octave + 1) * 12 + NOTE_SEMITONES[ch] + acc;
					const freq = 440 * Math.pow(2, (midi - 69) / 12);
					events.push({
						type: 'note',
						freq: freq,
						startMs: timeMs,
						gateMs: durMs * articulation,
						durMs: durMs,
						note: ch + accStr + octave
					});
					timeMs += durMs;
					continue;
				}
				pos++;
			}

			return { totalMs: timeMs, events: events };
		}

		function spawnFmVoice(ch, freq, startTimeSec, gateSecOrNull, velocity) {
			const ctx = ensureAudio();
			const patch = channelPatches[ch];
			const velGain = Math.max(0, Math.min(1, (velocity === null || velocity === undefined ? 100 : Number(velocity)) / 100));

			if (!ctx || !masterGain) {
				const virtualHandle = {
					channel: ch,
					freq: freq,
					patch: patch.name,
					stopped: false,
					setFreq: function(nextFreq) {
						if (this.stopped || !(nextFreq > 0)) return false;
						this.freq = nextFreq;
						return true;
					},
					stopAt: function() {
						this.stopped = true;
						scheduledHandles.delete(this);
						if (activeVoices[ch] === this) activeVoices[ch] = null;
					}
				};
				scheduledHandles.add(virtualHandle);
				activeVoices[ch] = virtualHandle;
				if (gateSecOrNull !== null && gateSecOrNull !== undefined) {
					const tid = setTimeout(function() {
						virtualHandle.stopAt();
					}, Math.max(1, Math.round(gateSecOrNull * 1000)));
					if (typeof tid.unref === 'function') tid.unref();
				}
				return virtualHandle;
			}

			const now = Math.max(ctx.currentTime, startTimeSec || ctx.currentTime);
			const modOsc = ctx.createOscillator();
			const carOsc = ctx.createOscillator();
			const modGain = ctx.createGain();
			const carGain = ctx.createGain();

			applyWaveform(ctx, modOsc, patch.modWave);
			applyWaveform(ctx, carOsc, patch.carWave);

			const carFreq = Math.max(20, freq * patch.carMult);
			const modFreq = Math.max(10, freq * patch.modMult);
			const peakModDepth = carFreq * patch.modIndex;

			modOsc.frequency.setValueAtTime(modFreq, now);
			carOsc.frequency.setValueAtTime(carFreq, now);
			if (patch.slide && patch.slide !== 1) {
				const slideDur = gateSecOrNull !== null && gateSecOrNull !== undefined ? Math.max(0.03, gateSecOrNull) : 0.18;
				carOsc.frequency.exponentialRampToValueAtTime(Math.max(20, carFreq * patch.slide), now + slideDur);
				modOsc.frequency.exponentialRampToValueAtTime(Math.max(10, modFreq * patch.slide), now + slideDur);
			}

			modGain.gain.setValueAtTime(peakModDepth, now);
			if (patch.modDecay > 0) {
				modGain.gain.exponentialRampToValueAtTime(Math.max(0.01, peakModDepth * 0.2), now + patch.modDecay);
			}

			const rawAtk = Math.max(0.002, patch.attack);
			const rawDec = Math.max(0.005, patch.decay);
			const hasGate = gateSecOrNull !== null && gateSecOrNull !== undefined;
			const gateSec = hasGate ? Math.max(0.01, gateSecOrNull) : 0;
			const atk = hasGate ? Math.min(rawAtk, gateSec * 0.35) : rawAtk;
			const dec = hasGate ? Math.min(rawDec, Math.max(0.004, gateSec - atk)) : rawDec;
			const sus = Math.max(0.001, Math.min(1, patch.sustain));
			const rel = Math.max(0.01, patch.release);

			carGain.gain.setValueAtTime(0.0001, now);
			carGain.gain.linearRampToValueAtTime(velGain, now + atk);
			carGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velGain * sus), now + atk + dec);

			let noiseSrc = null;
			let noiseGain = null;
			if (patch.noise > 0) {
				noiseSrc = ctx.createBufferSource();
				noiseSrc.buffer = getNoiseBuffer(ctx);
				noiseSrc.loop = true;
				noiseGain = ctx.createGain();
				noiseGain.gain.setValueAtTime(patch.noise * velGain, now);
				if (hasGate) {
					noiseGain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.02, gateSec));
				} else {
					noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.002, patch.noise * velGain * sus * 0.45), now + Math.max(0.05, rawDec));
				}
				noiseSrc.connect(noiseGain);
				noiseGain.connect(masterGain);
			}

			modOsc.connect(modGain);
			modGain.connect(carOsc.frequency);
			carOsc.connect(carGain);
			carGain.connect(masterGain);

			modOsc.start(now);
			carOsc.start(now);
			if (noiseSrc) noiseSrc.start(now);

			const handle = {
				channel: ch,
				freq: freq,
				patch: patch.name,
				stopped: false,
				setFreq: function(nextFreq, glideMs) {
					if (this.stopped || !(nextFreq > 0)) return false;
					this.freq = nextFreq;
					const t = ctx.currentTime;
					const tc = Math.max(0.005, (Number(glideMs) || 25) / 1000);
					const nextCar = Math.max(20, nextFreq * patch.carMult);
					const nextMod = Math.max(10, nextFreq * patch.modMult);
					try {
						if (typeof carOsc.frequency.setTargetAtTime === 'function') {
							carOsc.frequency.setTargetAtTime(nextCar, t, tc);
							modOsc.frequency.setTargetAtTime(nextMod, t, tc);
							modGain.gain.setTargetAtTime(nextCar * patch.modIndex, t, tc);
						} else {
							carOsc.frequency.setValueAtTime(nextCar, t);
							modOsc.frequency.setValueAtTime(nextMod, t);
							modGain.gain.setValueAtTime(nextCar * patch.modIndex, t);
						}
					} catch (_e) {}
					return true;
				},
				stopAt: function(whenSec, fast) {
					if (this.stopped) return;
					this.stopped = true;
					const t = Math.max(ctx.currentTime, whenSec !== undefined ? whenSec : ctx.currentTime);
					const r = fast ? 0.012 : rel;
					try {
						if (typeof carGain.gain.cancelAndHoldAtTime === 'function') {
							carGain.gain.cancelAndHoldAtTime(t);
						} else {
							carGain.gain.cancelScheduledValues(t);
							carGain.gain.setValueAtTime(Math.max(0.0001, carGain.gain.value || velGain * sus), t);
						}
						carGain.gain.exponentialRampToValueAtTime(0.0001, t + r);
						if (noiseGain) {
							if (typeof noiseGain.gain.cancelAndHoldAtTime === 'function') {
								noiseGain.gain.cancelAndHoldAtTime(t);
							} else {
								noiseGain.gain.cancelScheduledValues(t);
							}
							noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + r);
						}
						carOsc.stop(t + r + 0.02);
						modOsc.stop(t + r + 0.02);
						if (noiseSrc) noiseSrc.stop(t + r + 0.02);
					} catch (_e) {}
					scheduledHandles.delete(this);
					if (activeVoices[ch] === this) {
						activeVoices[ch] = null;
					}
				}
			};

			scheduledHandles.add(handle);
			activeVoices[ch] = handle;

			if (hasGate) {
				const releaseAt = now + gateSec;
				try {
					carGain.gain.setValueAtTime(Math.max(0.0001, velGain * sus), releaseAt);
					carGain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + rel);
					carOsc.stop(releaseAt + rel + 0.02);
					modOsc.stop(releaseAt + rel + 0.02);
					if (noiseSrc) noiseSrc.stop(releaseAt + rel + 0.02);
				} catch (_e) {}
				const tid = setTimeout(function() {
					handle.stopped = true;
					scheduledHandles.delete(handle);
					if (activeVoices[ch] === handle) activeVoices[ch] = null;
				}, Math.max(10, Math.round((releaseAt - ctx.currentTime + rel + 0.05) * 1000)));
				if (typeof tid.unref === 'function') tid.unref();
			}

			return handle;
		}

		return {
			CHANNEL_COUNT: CHANNEL_COUNT,
			getPresetNames: function() {
				return Object.keys(PRESETS);
			},
			noteToFreq: noteToFreq,
			parseMml: parseMml,
			voice: function(channel, presetOrParams) {
				if (channel === null || channel === undefined) {
					return Object.keys(PRESETS);
				}
				const ch = normChannel(channel);
				if (presetOrParams === null || presetOrParams === undefined) {
					return channelPatches[ch].name;
				}
				if (typeof presetOrParams === 'string') {
					const key = presetOrParams.trim().toLowerCase();
					if (!PRESETS[key]) {
						return false;
					}
					channelPatches[ch] = clonePatch(PRESETS[key]);
					return true;
				}
				if (typeof presetOrParams === 'object') {
					const merged = clonePatch(channelPatches[ch]);
					Object.keys(presetOrParams).forEach(function(k) {
						if (presetOrParams[k] !== undefined && presetOrParams[k] !== null) {
							merged[k] = presetOrParams[k];
						}
					});
					if (!merged.name || merged.name === channelPatches[ch].name) {
						merged.name = 'custom';
					}
					channelPatches[ch] = merged;
					return true;
				}
				return false;
			},
			volume: function(level) {
				if (level === null || level === undefined) {
					return masterVolume;
				}
				const v = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
				masterVolume = v;
				if (audioCtx && masterGain) {
					masterGain.gain.setTargetAtTime((v / 100) * 0.35, audioCtx.currentTime, 0.015);
				}
				return true;
			},
			noteOn: function(channel, noteOrFreq, velocity) {
				const ch = normChannel(channel);
				const freq = noteToFreq(noteOrFreq);
				if (!(freq > 0)) {
					return false;
				}
				if (activeVoices[ch]) {
					activeVoices[ch].stopAt(undefined, true);
				}
				spawnFmVoice(ch, freq, undefined, null, velocity);
				return true;
			},
			noteOff: function(channel) {
				if (channel === null || channel === undefined) {
					for (let i = 0; i < CHANNEL_COUNT; i++) {
						if (activeVoices[i]) activeVoices[i].stopAt(undefined, false);
					}
					return true;
				}
				const ch = normChannel(channel);
				if (activeVoices[ch]) {
					activeVoices[ch].stopAt(undefined, false);
				}
				return true;
			},
			setFreq: function(channel, noteOrFreq, glideMs) {
				const ch = normChannel(channel);
				const freq = noteToFreq(noteOrFreq);
				if (!(freq > 0)) {
					return false;
				}
				if (activeVoices[ch] && !activeVoices[ch].stopped && typeof activeVoices[ch].setFreq === 'function') {
					return activeVoices[ch].setFreq(freq, glideMs);
				}
				spawnFmVoice(ch, freq, undefined, null, 85);
				return true;
			},
			sound: function(noteOrFreq, durationMs, channel, wait) {
				const ch = normChannel(channel);
				const freq = noteToFreq(noteOrFreq);
				if (!(freq > 0)) {
					return false;
				}
				const ms = Math.max(10, Math.min(10000, Number(durationMs === null || durationMs === undefined ? 200 : durationMs) || 200));
				if (activeVoices[ch]) {
					activeVoices[ch].stopAt(undefined, true);
				}
				spawnFmVoice(ch, freq, undefined, ms / 1000, 100);
				if (wait) {
					return new Promise(function(resolve) {
						const entry = { timer: null, resolve: resolve };
						entry.timer = setTimeout(function() {
							pendingWaits.delete(entry);
							resolve(true);
						}, ms);
						pendingWaits.add(entry);
					});
				}
				return true;
			},
			play: function(mml, channel, wait) {
				const ch = normChannel(channel);
				const parsed = parseMml(mml);
				const ctx = ensureAudio();
				const baseTime = ctx ? ctx.currentTime + 0.01 : 0;

				if (activeVoices[ch]) {
					activeVoices[ch].stopAt(undefined, true);
				}

				for (let i = 0; i < parsed.events.length; i++) {
					const ev = parsed.events[i];
					if (ev.type === 'note' && ev.freq > 0) {
						if (ctx) {
							spawnFmVoice(ch, ev.freq, baseTime + ev.startMs / 1000, ev.gateMs / 1000, 100);
						} else {
							const virtualOnly = {
								channel: ch,
								freq: ev.freq,
								patch: channelPatches[ch].name,
								stopped: false,
								stopAt: function() { this.stopped = true; scheduledHandles.delete(this); }
							};
							scheduledHandles.add(virtualOnly);
							activeVoices[ch] = virtualOnly;
						}
					}
				}

				const shouldWait = wait === null || wait === undefined ? true : Boolean(wait);
				if (shouldWait && parsed.totalMs > 0) {
					return new Promise(function(resolve) {
						const entry = { timer: null, resolve: resolve };
						entry.timer = setTimeout(function() {
							pendingWaits.delete(entry);
							resolve(true);
						}, Math.ceil(parsed.totalMs));
						pendingWaits.add(entry);
					});
				}
				return true;
			},
			stop: function() {
				const list = Array.from(scheduledHandles);
				for (let i = 0; i < list.length; i++) {
					list[i].stopAt(undefined, true);
				}
				scheduledHandles.clear();
				for (let i = 0; i < CHANNEL_COUNT; i++) {
					activeVoices[i] = null;
				}
				const waits = Array.from(pendingWaits);
				for (let i = 0; i < waits.length; i++) {
					clearTimeout(waits[i].timer);
					pendingWaits.delete(waits[i]);
					waits[i].resolve(true);
				}
				return true;
			},
			getState: function() {
				return {
					volume: masterVolume,
					channels: channelPatches.map(function(p, idx) {
						return {
							channel: idx,
							voice: p.name,
							active: Boolean(activeVoices[idx] && !activeVoices[idx].stopped),
							freq: activeVoices[idx] ? activeVoices[idx].freq : 0
						};
					})
				};
			}
		};
	}

	function createSoundBridgeHelpers(adlib) {
		return {
			soundPlayTone: function(freqOrNote, durationMs, channel, wait) {
				return adlib.sound(freqOrNote, durationMs, channel, wait);
			},
			soundPlayMml: function(mml, channel, wait) {
				return adlib.play(mml, channel, wait);
			},
			soundVoice: function(channel, presetOrParams) {
				return adlib.voice(channel, presetOrParams);
			},
			soundNoteOn: function(channel, noteOrFreq, velocity) {
				return adlib.noteOn(channel, noteOrFreq, velocity);
			},
			soundNoteOff: function(channel) {
				return adlib.noteOff(channel);
			},
			soundFreq: function(channel, noteOrFreq, glideMs) {
				return adlib.setFreq(channel, noteOrFreq, glideMs);
			},
			soundStop: function() {
				return adlib.stop();
			},
			soundVolume: function(level) {
				return adlib.volume(level);
			},
			soundNoteFreq: function(noteOrHz) {
				return adlib.noteToFreq(noteOrHz);
			},
			soundParseMml: function(mml) {
				return adlib.parseMml(mml);
			},
			soundState: function() {
				return adlib.getState();
			}
		};
	}

	globalScope.createAdlibSynth = createAdlibSynth;
	globalScope.createSoundBridgeHelpers = createSoundBridgeHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
