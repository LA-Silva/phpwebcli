(function(globalScope) {
	'use strict';

	function createLocalStorageVfs(storageKey) {
		const memFallback = { cwd: '/', entries: {} };

		function nowSec() {
			return Math.floor(Date.now() / 1000);
		}

		function loadState() {
			let raw = null;
			try {
				if (typeof localStorage !== 'undefined' && localStorage) {
					raw = localStorage.getItem(storageKey);
				}
			} catch (_e) {}
			let parsed = null;
			if (raw) {
				try {
					parsed = JSON.parse(raw);
				} catch (_e) {}
			}
			if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
				parsed = { cwd: '/', entries: {} };
			}
			if (!parsed.entries['/'] || parsed.entries['/'].type !== 'dir') {
				parsed.entries['/'] = { type: 'dir', mtime: nowSec() };
			}
			if (!parsed.entries['/tmp']) {
				parsed.entries['/tmp'] = { type: 'dir', mtime: nowSec() };
			}
			if (typeof parsed.cwd !== 'string' || !parsed.entries[parsed.cwd] || parsed.entries[parsed.cwd].type !== 'dir') {
				parsed.cwd = '/';
			}
			return parsed;
		}

		let state = loadState();

		function saveState() {
			memFallback.cwd = state.cwd;
			memFallback.entries = state.entries;
			try {
				if (typeof localStorage !== 'undefined' && localStorage) {
					localStorage.setItem(storageKey, JSON.stringify(state));
				}
			} catch (_e) {}
		}

		saveState();

		function normalizePath(rawPath) {
			let p = String(rawPath ?? '').replace(/\\/g, '/').trim();
			if (!p) {
				return state.cwd || '/';
			}
			if (p.charAt(0) !== '/') {
				p = (state.cwd === '/' ? '' : state.cwd) + '/' + p;
			}
			const parts = p.split('/');
			const stack = [];
			for (let i = 0; i < parts.length; i++) {
				const seg = parts[i];
				if (!seg || seg === '.') {
					continue;
				}
				if (seg === '..') {
					if (stack.length > 0) {
						stack.pop();
					}
				} else {
					stack.push(seg);
				}
			}
			return '/' + stack.join('/');
		}

		function parentDir(normPath) {
			if (normPath === '/') {
				return '/';
			}
			const idx = normPath.lastIndexOf('/');
			return idx <= 0 ? '/' : normPath.slice(0, idx);
		}

		function baseName(normPath) {
			if (normPath === '/') {
				return '';
			}
			const idx = normPath.lastIndexOf('/');
			return normPath.slice(idx + 1);
		}

		function isFile(path) {
			const norm = normalizePath(path);
			const entry = state.entries[norm];
			return Boolean(entry && entry.type === 'file');
		}

		function isDirectory(path) {
			const norm = normalizePath(path);
			const entry = state.entries[norm];
			return Boolean(entry && entry.type === 'dir');
		}

		function exists(path) {
			const norm = normalizePath(path);
			return Boolean(state.entries[norm]);
		}

		function realPath(path) {
			const norm = normalizePath(path);
			return state.entries[norm] ? norm : false;
		}

		function getcwd() {
			return state.cwd;
		}

		function chdir(path) {
			const norm = normalizePath(path);
			if (!isDirectory(norm)) {
				return false;
			}
			state.cwd = norm;
			saveState();
			return true;
		}

		function readFile(path) {
			const norm = normalizePath(path);
			const entry = state.entries[norm];
			if (!entry || entry.type !== 'file') {
				return null;
			}
			return String(entry.content ?? '');
		}

		function writeFile(path, data, append) {
			const norm = normalizePath(path);
			if (norm === '/') {
				return false;
			}
			const existing = state.entries[norm];
			if (existing && existing.type === 'dir') {
				return false;
			}
			const parent = parentDir(norm);
			if (!isDirectory(parent)) {
				return false;
			}
			const chunk = String(data ?? '');
			const content = append && existing ? String(existing.content ?? '') + chunk : chunk;
			state.entries[norm] = {
				type: 'file',
				content: content,
				mtime: nowSec()
			};
			saveState();
			return chunk.length;
		}

		function unlink(path) {
			const norm = normalizePath(path);
			const entry = state.entries[norm];
			if (!entry || entry.type !== 'file') {
				return false;
			}
			delete state.entries[norm];
			saveState();
			return true;
		}

		function mkdir(path, recursive) {
			const norm = normalizePath(path);
			if (state.entries[norm]) {
				return false;
			}
			if (!recursive) {
				const parent = parentDir(norm);
				if (!isDirectory(parent)) {
					return false;
				}
				state.entries[norm] = { type: 'dir', mtime: nowSec() };
				saveState();
				return true;
			}
			const segments = norm.split('/').filter(Boolean);
			let cur = '';
			for (let i = 0; i < segments.length; i++) {
				cur += '/' + segments[i];
				if (state.entries[cur]) {
					if (state.entries[cur].type !== 'dir') {
						return false;
					}
				} else {
					state.entries[cur] = { type: 'dir', mtime: nowSec() };
				}
			}
			saveState();
			return true;
		}

		function rmdir(path) {
			const norm = normalizePath(path);
			if (norm === '/') {
				return false;
			}
			const entry = state.entries[norm];
			if (!entry || entry.type !== 'dir') {
				return false;
			}
			const prefix = norm + '/';
			const keys = Object.keys(state.entries);
			for (let i = 0; i < keys.length; i++) {
				if (keys[i].indexOf(prefix) === 0) {
					return false;
				}
			}
			delete state.entries[norm];
			if (state.cwd === norm) {
				state.cwd = '/';
			}
			saveState();
			return true;
		}

		function scandir(path, sortingOrder) {
			const norm = normalizePath(path);
			if (!isDirectory(norm)) {
				return false;
			}
			const prefix = norm === '/' ? '/' : norm + '/';
			const children = [];
			const keys = Object.keys(state.entries);
			for (let i = 0; i < keys.length; i++) {
				const k = keys[i];
				if (k === norm || k.indexOf(prefix) !== 0) {
					continue;
				}
				const rest = k.slice(prefix.length);
				if (rest && rest.indexOf('/') === -1) {
					children.push(rest);
				}
			}
			const order = Number(sortingOrder) || 0;
			const items = ['.', '..'].concat(children);
			if (order === 0) {
				items.sort();
			} else if (order === 1) {
				items.sort().reverse();
			}
			return items;
		}

		function rename(oldPath, newPath) {
			const src = normalizePath(oldPath);
			const dst = normalizePath(newPath);
			if (src === '/' || dst === '/' || !state.entries[src]) {
				return false;
			}
			if (src === dst) {
				return true;
			}
			const dstParent = parentDir(dst);
			if (!isDirectory(dstParent)) {
				return false;
			}
			const srcEntry = state.entries[src];
			if (srcEntry.type === 'file') {
				if (isDirectory(dst)) {
					return false;
				}
				state.entries[dst] = {
					type: 'file',
					content: srcEntry.content,
					mtime: nowSec()
				};
				delete state.entries[src];
				saveState();
				return true;
			}
			if (dst.indexOf(src + '/') === 0 || isFile(dst)) {
				return false;
			}
			const srcPrefix = src + '/';
			const dstPrefix = dst + '/';
			const toMove = Object.keys(state.entries).filter(function(k) {
				return k === src || k.indexOf(srcPrefix) === 0;
			});
			for (let i = 0; i < toMove.length; i++) {
				const oldKey = toMove[i];
				const newKey = oldKey === src ? dst : dstPrefix + oldKey.slice(srcPrefix.length);
				state.entries[newKey] = state.entries[oldKey];
				delete state.entries[oldKey];
			}
			if (state.cwd === src || state.cwd.indexOf(srcPrefix) === 0) {
				state.cwd = state.cwd === src ? dst : dstPrefix + state.cwd.slice(srcPrefix.length);
			}
			saveState();
			return true;
		}

		function copy(srcPath, dstPath) {
			const src = normalizePath(srcPath);
			const dst = normalizePath(dstPath);
			if (!isFile(src) || isDirectory(dst)) {
				return false;
			}
			return writeFile(dst, readFile(src), false) !== false;
		}

		function filesize(path) {
			const content = readFile(path);
			return content === null ? false : content.length;
		}

		function filemtime(path) {
			const norm = normalizePath(path);
			const entry = state.entries[norm];
			return entry ? (entry.mtime || 0) : false;
		}

		function touch(path, mtime) {
			const norm = normalizePath(path);
			if (norm === '/') {
				return false;
			}
			const ts = mtime !== null && mtime !== undefined ? Math.trunc(Number(mtime)) : nowSec();
			const existing = state.entries[norm];
			if (existing) {
				existing.mtime = ts;
				saveState();
				return true;
			}
			const parent = parentDir(norm);
			if (!isDirectory(parent)) {
				return false;
			}
			state.entries[norm] = { type: 'file', content: '', mtime: ts };
			saveState();
			return true;
		}

		function glob(pattern) {
			const patStr = String(pattern ?? '').trim();
			if (!patStr) {
				return [];
			}
			const hasSlash = patStr.indexOf('/') !== -1 || patStr.indexOf('\\') !== -1;
			const normPat = hasSlash
				? normalizePath(patStr)
				: ((state.cwd === '/' ? '' : state.cwd) + '/' + patStr);
			const regexStr = '^' + normPat.replace(/[.+^${}()|[\]\\]/g, '\\$&')
				.replace(/\*/g, '[^/]*')
				.replace(/\?/g, '[^/]') + '$';
			const re = new RegExp(regexStr);
			const matches = Object.keys(state.entries).filter(function(k) {
				return k !== '/' && re.test(k);
			});
			matches.sort();
			if (!hasSlash) {
				const prefix = state.cwd === '/' ? '/' : state.cwd + '/';
				return matches.map(function(m) {
					return m.indexOf(prefix) === 0 ? m.slice(prefix.length) : m;
				});
			}
			return matches;
		}

		function reset() {
			state = {
				cwd: '/',
				entries: {
					'/': { type: 'dir', mtime: nowSec() },
					'/tmp': { type: 'dir', mtime: nowSec() }
				}
			};
			saveState();
			return true;
		}

		return {
			normalizePath: normalizePath,
			parentDir: parentDir,
			baseName: baseName,
			isFile: isFile,
			isDirectory: isDirectory,
			exists: exists,
			realPath: realPath,
			getcwd: getcwd,
			chdir: chdir,
			readFile: readFile,
			writeFile: writeFile,
			unlink: unlink,
			mkdir: mkdir,
			rmdir: rmdir,
			scandir: scandir,
			rename: rename,
			copy: copy,
			filesize: filesize,
			filemtime: filemtime,
			touch: touch,
			glob: glob,
			reset: reset
		};
	}

	function createVfsBridgeHelpers(vfs) {
		return {
			vfsGetCwd: function() { return vfs.getcwd(); },
			vfsChdir: function(path) { return vfs.chdir(path); },
			vfsReadFile: function(path) {
				const content = vfs.readFile(path);
				return content === null ? false : content;
			},
			vfsWriteFile: function(path, data, append) {
				return vfs.writeFile(path, data, Boolean(append));
			},
			vfsUnlink: function(path) { return vfs.unlink(path); },
			vfsMkdir: function(path, recursive) { return vfs.mkdir(path, Boolean(recursive)); },
			vfsRmdir: function(path) { return vfs.rmdir(path); },
			vfsIsDir: function(path) { return vfs.isDirectory(path); },
			vfsFilesize: function(path) { return vfs.filesize(path); },
			vfsFilemtime: function(path) { return vfs.filemtime(path); },
			vfsTouch: function(path, mtime) { return vfs.touch(path, mtime); },
			vfsScandir: function(path, order) { return vfs.scandir(path, order); },
			vfsRename: function(oldPath, newPath) { return vfs.rename(oldPath, newPath); },
			vfsCopy: function(srcPath, dstPath) { return vfs.copy(srcPath, dstPath); },
			vfsRealpath: function(path) { return vfs.realPath(path); },
			vfsGlob: function(pattern) { return vfs.glob(pattern); },
			vfsReset: function() { return vfs.reset(); }
		};
	}

	function registerBopStreamFunctions(bop, vfs) {
		const bopState = bop.environment.getState();
		const vf = bopState.getValueFactory();
		const ff = bopState.getFutureFactory();

		const fsConstants = {
			SEEK_SET: 0,
			SEEK_CUR: 1,
			SEEK_END: 2,
			FILE_APPEND: 8,
			FILE_IGNORE_NEW_LINES: 2,
			FILE_SKIP_EMPTY_LINES: 4,
			LOCK_EX: 2,
			SCANDIR_SORT_ASCENDING: 0,
			SCANDIR_SORT_DESCENDING: 1,
			SCANDIR_SORT_NONE: 2,
			DIRECTORY_SEPARATOR: '/',
			BOP_EOL: '\n'
		};
		Object.keys(fsConstants).forEach(function(constName) {
			try {
				bop.environment.defineConstant(constName, fsConstants[constName]);
			} catch (_e) {}
		});

		function getStream(ref) {
			const val = ref ? ref.getValue() : null;
			if (!val || val.getType() !== 'resource' || val.getResourceType() !== 'stream') {
				return null;
			}
			return val.getResource().stream;
		}

		bop.environment.defineFunction('fopen', function(internals) {
			internals.disableAutoCoercion();
			return function(pathRef, modeRef) {
				const rawPath = String(pathRef.getValue().getNative() ?? '');
				const rawMode = String(modeRef.getValue().getNative() ?? 'r').replace(/[bt]/gi, '');
				const norm = vfs.normalizePath(rawPath);
				if (norm === '/' || vfs.isDirectory(norm)) {
					return vf.createBoolean(false);
				}

				const plus = rawMode.indexOf('+') !== -1;
				const baseMode = rawMode.replace(/\+/g, '');
				const exists = vfs.isFile(norm);
				const parentOk = vfs.isDirectory(vfs.parentDir(norm));

				let canRead = plus;
				let canWrite = plus;
				let appendOnly = false;
				let buffer = '';
				let pos = 0;

				if (baseMode === 'r') {
					if (!exists) return vf.createBoolean(false);
					canRead = true;
					buffer = vfs.readFile(norm);
				} else if (baseMode === 'w') {
					if (!parentOk) return vf.createBoolean(false);
					canWrite = true;
					buffer = '';
					if (vfs.writeFile(norm, '', false) === false) return vf.createBoolean(false);
				} else if (baseMode === 'a') {
					if (!parentOk) return vf.createBoolean(false);
					canWrite = true;
					appendOnly = true;
					buffer = exists ? vfs.readFile(norm) : '';
					if (!exists && vfs.writeFile(norm, '', false) === false) return vf.createBoolean(false);
					pos = plus ? 0 : buffer.length;
				} else if (baseMode === 'x') {
					if (exists || !parentOk) return vf.createBoolean(false);
					canWrite = true;
					buffer = '';
					if (vfs.writeFile(norm, '', false) === false) return vf.createBoolean(false);
				} else if (baseMode === 'c') {
					if (!parentOk) return vf.createBoolean(false);
					canWrite = true;
					buffer = exists ? vfs.readFile(norm) : '';
					if (!exists && vfs.writeFile(norm, '', false) === false) return vf.createBoolean(false);
				} else {
					return vf.createBoolean(false);
				}

				let closed = false;
				const stream = {
					isEof: function() {
						return vf.createBoolean(closed || pos >= buffer.length);
					},
					close: function() {
						closed = true;
						return vf.createBoolean(true);
					},
					write: function(data) {
						if (closed || !canWrite) {
							return ff.createPresent(vf.createBoolean(false));
						}
						const str = String(data ?? '');
						if (appendOnly) {
							pos = buffer.length;
							buffer = buffer + str;
							pos = buffer.length;
						} else {
							const head = pos > buffer.length
								? buffer.padEnd(pos, '\0')
								: buffer.slice(0, pos);
							const tail = buffer.slice(pos + str.length);
							buffer = head + str + tail;
							pos += str.length;
						}
						vfs.writeFile(norm, buffer, false);
						return ff.createPresent(vf.createInteger(str.length));
					},
					read: function(length) {
						if (closed || !canRead) return false;
						const n = Math.trunc(Number(length));
						if (n <= 0) return '';
						if (pos >= buffer.length) return '';
						const out = buffer.slice(pos, pos + n);
						pos += out.length;
						return out;
					},
					gets: function(length) {
						if (closed || !canRead || pos >= buffer.length) return false;
						const limit = length !== null && length !== undefined
							? Math.max(0, Math.trunc(Number(length)) - 1)
							: Infinity;
						const nlIdx = buffer.indexOf('\n', pos);
						let end = nlIdx === -1 ? buffer.length : nlIdx + 1;
						if (end - pos > limit) {
							end = pos + limit;
						}
						const line = buffer.slice(pos, end);
						pos = end;
						return line;
					},
					getc: function() {
						if (closed || !canRead || pos >= buffer.length) return false;
						const ch = buffer.charAt(pos);
						pos++;
						return ch;
					},
					seek: function(offset, whence) {
						if (closed) return -1;
						const off = Math.trunc(Number(offset)) || 0;
						const w = whence === undefined || whence === null ? 0 : Math.trunc(Number(whence));
						let nextPos = pos;
						if (w === 0) nextPos = off;
						else if (w === 1) nextPos = pos + off;
						else if (w === 2) nextPos = buffer.length + off;
						else return -1;
						if (nextPos < 0) return -1;
						pos = nextPos;
						return 0;
					},
					tell: function() {
						return closed ? false : pos;
					},
					truncate: function(size) {
						if (closed || !canWrite) return false;
						const sz = Math.max(0, Math.trunc(Number(size)) || 0);
						if (sz < buffer.length) {
							buffer = buffer.slice(0, sz);
						} else if (sz > buffer.length) {
							buffer = buffer.padEnd(sz, '\0');
						}
						vfs.writeFile(norm, buffer, false);
						return true;
					},
					flush: function() {
						if (closed) return false;
						if (canWrite) vfs.writeFile(norm, buffer, false);
						return true;
					},
					passthru: function() {
						if (closed || !canRead) return false;
						const rest = buffer.slice(pos);
						pos = buffer.length;
						return rest;
					}
				};

				return vf.createResource('stream', { stream: stream });
			};
		});

		bop.environment.defineFunction('fread', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef, lenRef) {
				const st = getStream(resRef);
				if (!st || !lenRef) return vf.createBoolean(false);
				const out = st.read(lenRef.getValue().getNative());
				return out === false ? vf.createBoolean(false) : vf.createString(out);
			};
		});

		bop.environment.defineFunction('fgets', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef, lenRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				const len = lenRef ? lenRef.getValue().getNative() : null;
				const line = st.gets(len);
				return line === false ? vf.createBoolean(false) : vf.createString(line);
			};
		});

		bop.environment.defineFunction('fgetc', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				const ch = st.getc();
				return ch === false ? vf.createBoolean(false) : vf.createString(ch);
			};
		});

		bop.environment.defineFunction('fputs', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef, dataRef, lenRef) {
				const st = getStream(resRef);
				if (!st || !dataRef) return vf.createBoolean(false);
				let str = String(dataRef.getValue().getNative() ?? '');
				if (lenRef) {
					const len = lenRef.getValue().getNative();
					if (len !== null && len !== undefined) {
						str = str.substring(0, Math.max(0, Math.trunc(Number(len))));
					}
				}
				return st.write(str);
			};
		});

		bop.environment.defineFunction('fseek', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef, offsetRef, whenceRef) {
				const st = getStream(resRef);
				if (!st || !offsetRef) return vf.createInteger(-1);
				const offset = offsetRef.getValue().getNative();
				const whence = whenceRef ? whenceRef.getValue().getNative() : 0;
				return vf.createInteger(st.seek(offset, whence));
			};
		});

		bop.environment.defineFunction('ftell', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				const pos = st.tell();
				return pos === false ? vf.createBoolean(false) : vf.createInteger(pos);
			};
		});

		bop.environment.defineFunction('rewind', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				return vf.createBoolean(st.seek(0, 0) === 0);
			};
		});

		bop.environment.defineFunction('ftruncate', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef, sizeRef) {
				const st = getStream(resRef);
				if (!st || !sizeRef) return vf.createBoolean(false);
				return vf.createBoolean(st.truncate(sizeRef.getValue().getNative()));
			};
		});

		bop.environment.defineFunction('fflush', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				return vf.createBoolean(st.flush());
			};
		});

		bop.environment.defineFunction('fpassthru', function(internals) {
			internals.disableAutoCoercion();
			return function(resRef) {
				const st = getStream(resRef);
				if (!st) return vf.createBoolean(false);
				const rest = st.passthru();
				if (rest === false) return vf.createBoolean(false);
				bop.getStdout().write(rest);
				return vf.createInteger(rest.length);
			};
		});
	}

	globalScope.createLocalStorageVfs = createLocalStorageVfs;
	globalScope.createVfsBridgeHelpers = createVfsBridgeHelpers;
	globalScope.registerBopStreamFunctions = registerBopStreamFunctions;
})(typeof window !== 'undefined' ? window : globalThis);
