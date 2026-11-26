(function(globalScope) {
	'use strict';

	function escapeHtml(str) {
		return String(str ?? '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function createBopEditor(options) {
		const opts = options || {};
		const vfs = opts.vfs;
		const fetchFn = typeof opts.fetch === 'function' ? opts.fetch : null;
		const getTerm = typeof opts.getTerm === 'function' ? opts.getTerm : function() { return null; };
		const onRunFile = typeof opts.onRunFile === 'function' ? opts.onRunFile : null;
		const getPrism = typeof opts.getPrism === 'function'
			? opts.getPrism
			: function() { return typeof globalScope.Prism !== 'undefined' ? globalScope.Prism : null; };

		const state = {
			active: false,
			headless: false,
			path: '/untitled.bop',
			rawPath: 'untitled.bop',
			sourceType: 'new', // 'vfs' | 'server' | 'new'
			content: '',
			savedContent: '',
			savedAtLeastOnce: false,
			dirty: false,
			message: '',
			messageIsError: false,
			pendingDiscardConfirm: false,
			_resolveOpen: null
		};

		let domBound = false;

		function getEl(id) {
			if (typeof document === 'undefined' || !document.getElementById) return null;
			return document.getElementById(id);
		}

		function normalizeTargetPath(inputPath) {
			const cleaned = String(inputPath ?? '').trim() || 'untitled.bop';
			if (vfs && typeof vfs.normalizePath === 'function') {
				return vfs.normalizePath(cleaned);
			}
			return cleaned.charAt(0) === '/' ? cleaned : '/' + cleaned;
		}

		function defaultTemplateFor(normPath) {
			if (/\.bop$/i.test(normPath) || normPath.indexOf('.') === -1) {
				return '<?bop\n\n';
			}
			return '';
		}

		async function loadInitialSource(rawPath, normPath) {
			if (vfs && vfs.isFile(normPath)) {
				return {
					content: vfs.readFile(normPath),
					sourceType: 'vfs'
				};
			}
			if (fetchFn) {
				const candidates = [String(rawPath || '').trim()];
				const stripped = normPath.replace(/^\/+/, '');
				if (stripped && candidates.indexOf(stripped) === -1) {
					candidates.push(stripped);
				}
				for (let i = 0; i < candidates.length; i++) {
					const url = candidates[i];
					if (!url) continue;
					try {
						const res = await fetchFn(url);
						if (!res || !res.ok) continue;
						const ct = (res.headers && res.headers.get('content-type')) || '';
						if (!/\.html?(\?|#|$)/i.test(url) && ct.toLowerCase().includes('text/html')) {
							continue;
						}
						const text = await res.text();
						return {
							content: text,
							sourceType: 'server'
						};
					} catch (_e) {}
				}
			}
			return {
				content: defaultTemplateFor(normPath),
				sourceType: 'new'
			};
		}

		function computeCursorStats(text, selStart) {
			const pos = Math.max(0, Math.min(text.length, Number(selStart) || 0));
			const before = text.slice(0, pos);
			const lines = before.split('\n');
			return {
				line: lines.length,
				col: lines[lines.length - 1].length + 1
			};
		}

		function highlightBop(code, filename) {
			const prism = getPrism();
			if (prism && typeof prism.highlight === 'function' && prism.languages) {
				let langKey = 'bop';
				let grammar = prism.languages.bop || prism.languages.php;
				if (/\.js$/i.test(filename) && prism.languages.javascript) {
					langKey = 'javascript';
					grammar = prism.languages.javascript;
				} else if (/\.css$/i.test(filename) && prism.languages.css) {
					langKey = 'css';
					grammar = prism.languages.css;
				} else if (/\.html?$/i.test(filename) && prism.languages.markup) {
					langKey = 'markup';
					grammar = prism.languages.markup;
				} else if (/\.md$/i.test(filename) && prism.languages.markdown) {
					langKey = 'markdown';
					grammar = prism.languages.markdown;
				}
				if (grammar) {
					try {
						return prism.highlight(code, grammar, langKey);
					} catch (_e) {}
				}
			}
			return escapeHtml(code);
		}

		function renderGutterAndHighlight() {
			const textarea = getEl('bop-editor-textarea');
			const pre = getEl('bop-editor-pre');
			const gutter = getEl('bop-editor-gutter');
			const cursorEl = getEl('bop-editor-cursor');
			if (!textarea) return;

			const code = textarea.value;
			state.content = code;
			state.dirty = code !== state.savedContent;

			if (pre) {
				const padded = code.endsWith('\n') ? code + ' ' : (code === '' ? ' ' : code);
				pre.innerHTML = highlightBop(padded, state.path);
			}

			const stats = computeCursorStats(code, textarea.selectionStart);
			if (gutter) {
				const totalLines = code === '' ? 1 : code.split('\n').length;
				const activeLine = stats.line;
				const parts = new Array(totalLines);
				for (let i = 1; i <= totalLines; i++) {
					parts[i - 1] = i === activeLine
						? '<div class="bop-ed-ln active">' + i + '</div>'
						: '<div class="bop-ed-ln">' + i + '</div>';
				}
				gutter.innerHTML = parts.join('');
			}

			if (cursorEl) {
				const totalLines = code === '' ? 1 : code.split('\n').length;
				cursorEl.textContent = 'Ln ' + stats.line + ', Col ' + stats.col + ' · ' + totalLines + ' lines · ' + code.length + ' B';
			}

			renderHeaderState();
		}

		function syncScroll() {
			const textarea = getEl('bop-editor-textarea');
			const pre = getEl('bop-editor-pre');
			const gutter = getEl('bop-editor-gutter');
			if (!textarea) return;
			if (pre) {
				pre.scrollTop = textarea.scrollTop;
				pre.scrollLeft = textarea.scrollLeft;
			}
			if (gutter) {
				gutter.scrollTop = textarea.scrollTop;
			}
		}

		function renderHeaderState() {
			const pathInput = getEl('bop-editor-path');
			const stateLabel = getEl('bop-editor-state');
			const msgEl = getEl('bop-editor-msg');
			const confirmBar = getEl('bop-editor-confirm');

			if (pathInput && document.activeElement !== pathInput) {
				pathInput.value = state.path;
			}
			if (stateLabel) {
				if (state.dirty) {
					stateLabel.textContent = 'Unsaved changes';
					stateLabel.className = 'bop-ed-meta dirty';
				} else if (state.sourceType === 'vfs') {
					stateLabel.textContent = 'VFS';
					stateLabel.className = 'bop-ed-meta saved';
				} else if (state.sourceType === 'server') {
					stateLabel.textContent = 'Loaded from server (unsaved in VFS)';
					stateLabel.className = 'bop-ed-meta';
				} else {
					stateLabel.textContent = 'New VFS file';
					stateLabel.className = 'bop-ed-meta';
				}
			}
			if (msgEl) {
				msgEl.textContent = state.message || '';
				msgEl.className = state.messageIsError ? 'bop-ed-msg error' : 'bop-ed-msg';
			}
			if (confirmBar) {
				if (state.pendingDiscardConfirm) {
					confirmBar.classList.add('visible');
				} else {
					confirmBar.classList.remove('visible');
				}
			}
		}

		function setMessage(msg, isErr) {
			state.message = String(msg || '');
			state.messageIsError = Boolean(isErr);
			renderHeaderState();
		}

		function syncOverlayVisibility() {
			const overlay = getEl('bop-editor-overlay');
			const term = getTerm();
			if (typeof document !== 'undefined' && document.body && document.body.dataset) {
				document.body.dataset.bopEditorOpen = state.active ? '1' : '0';
			}
			if (state.active) {
				if (term && typeof term.disable === 'function') {
					term.disable();
				}
				if (overlay && overlay.classList) {
					overlay.classList.add('active');
				}
				const textarea = getEl('bop-editor-textarea');
				if (textarea && typeof textarea.focus === 'function') {
					setTimeout(function() {
						textarea.focus();
						syncScroll();
					}, 0);
				}
			} else {
				if (overlay && overlay.classList) {
					overlay.classList.remove('active');
				}
				if (term) {
					if (typeof term.enable === 'function') {
						term.enable();
					}
					if (typeof term.focus === 'function') {
						term.focus(true);
					}
				}
			}
		}

		function save(targetPathOverride) {
			if (!vfs) {
				if (!state.headless) setMessage('VFS unavailable', true);
				return false;
			}
			const pathInput = state.headless ? null : getEl('bop-editor-path');
			const rawTarget = targetPathOverride !== undefined && targetPathOverride !== null
				? String(targetPathOverride)
				: (pathInput ? pathInput.value : state.path);
			const normTarget = normalizeTargetPath(rawTarget);
			if (normTarget === '/' || vfs.isDirectory(normTarget)) {
				if (!state.headless) setMessage('Cannot save over directory: ' + normTarget, true);
				return false;
			}
			const parent = typeof vfs.parentDir === 'function' ? vfs.parentDir(normTarget) : '/';
			if (parent && parent !== '/' && !vfs.isDirectory(parent)) {
				const made = vfs.mkdir(parent, true);
				if (!made) {
					if (!state.headless) setMessage('Cannot create parent directory: ' + parent, true);
					return false;
				}
			}
			const textarea = state.headless ? null : getEl('bop-editor-textarea');
			const code = textarea ? textarea.value : state.content;
			const bytes = vfs.writeFile(normTarget, code, false);
			if (bytes === false) {
				if (!state.headless) setMessage('Failed to write ' + normTarget + ' to VFS', true);
				return false;
			}
			state.path = normTarget;
			state.sourceType = 'vfs';
			state.content = code;
			state.savedContent = code;
			state.dirty = false;
			state.savedAtLeastOnce = true;
			state.pendingDiscardConfirm = false;
			if (!state.headless) {
				setMessage('Saved ' + normTarget + ' (' + bytes + ' B) to VFS', false);
			}
			return true;
		}

		function close(forceDiscard) {
			if (!state.active) return true;
			if (!forceDiscard && state.dirty && !state.pendingDiscardConfirm && !state.headless) {
				state.pendingDiscardConfirm = true;
				renderHeaderState();
				return false;
			}
			const wasHeadless = state.headless;
			state.active = false;
			state.headless = false;
			state.pendingDiscardConfirm = false;
			if (!wasHeadless) {
				syncOverlayVisibility();
			}
			const resolver = state._resolveOpen;
			state._resolveOpen = null;
			if (typeof resolver === 'function') {
				resolver(Boolean(state.savedAtLeastOnce));
			}
			return true;
		}

		function saveAndRun() {
			if (!save()) {
				return false;
			}
			const targetPath = state.path;
			close(true);
			if (onRunFile) {
				setTimeout(function() {
					onRunFile(targetPath);
				}, 0);
			}
			return true;
		}

		function handleTextareaKeydown(ev) {
			const textarea = getEl('bop-editor-textarea');
			if (!textarea) return;

			if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 's') {
				ev.preventDefault();
				ev.stopPropagation();
				save();
				return;
			}
			if (((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') || ev.key === 'F5') {
				ev.preventDefault();
				ev.stopPropagation();
				saveAndRun();
				return;
			}
			if (ev.key === 'Escape') {
				ev.preventDefault();
				ev.stopPropagation();
				close(false);
				return;
			}
			if (ev.key === 'Tab') {
				ev.preventDefault();
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				const val = textarea.value;
				if (start === end && !ev.shiftKey) {
					textarea.value = val.slice(0, start) + '\t' + val.slice(end);
					textarea.selectionStart = textarea.selectionEnd = start + 1;
					renderGutterAndHighlight();
					return;
				}
				const lineStart = val.lastIndexOf('\n', start - 1) + 1;
				const lineEndRaw = val.indexOf('\n', end);
				const lineEnd = lineEndRaw === -1 ? val.length : lineEndRaw;
				const block = val.slice(lineStart, lineEnd);
				const lines = block.split('\n');
				let deltaFirst = 0;
				let deltaTotal = 0;
				const updated = lines.map(function(ln, idx) {
					if (ev.shiftKey) {
						if (ln.startsWith('\t')) {
							if (idx === 0) deltaFirst = -1;
							deltaTotal -= 1;
							return ln.slice(1);
						}
						const spMatch = /^ {1,4}/.exec(ln);
						if (spMatch) {
							if (idx === 0) deltaFirst = -spMatch[0].length;
							deltaTotal -= spMatch[0].length;
							return ln.slice(spMatch[0].length);
						}
						return ln;
					}
					if (idx === 0) deltaFirst = 1;
					deltaTotal += 1;
					return '\t' + ln;
				});
				textarea.value = val.slice(0, lineStart) + updated.join('\n') + val.slice(lineEnd);
				textarea.selectionStart = Math.max(lineStart, start + deltaFirst);
				textarea.selectionEnd = Math.max(textarea.selectionStart, end + deltaTotal);
				renderGutterAndHighlight();
				return;
			}
			if (ev.key === 'Enter' && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				if (start === end) {
					const val = textarea.value;
					const lineStart = val.lastIndexOf('\n', start - 1) + 1;
					const curLine = val.slice(lineStart, start);
					const indentMatch = /^[\t ]+/.exec(curLine);
					if (indentMatch) {
						ev.preventDefault();
						const indent = indentMatch[0];
						textarea.value = val.slice(0, start) + '\n' + indent + val.slice(end);
						textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
						renderGutterAndHighlight();
						syncScroll();
					}
				}
			}
		}

		function bindDom() {
			if (domBound || typeof document === 'undefined' || !document.getElementById) {
				return;
			}
			const textarea = getEl('bop-editor-textarea');
			const saveBtn = getEl('bop-editor-save');
			const runBtn = getEl('bop-editor-run');
			const closeBtn = getEl('bop-editor-close');
			const discardBtn = getEl('bop-editor-discard');
			const cancelCloseBtn = getEl('bop-editor-cancel-close');
			const pathInput = getEl('bop-editor-path');

			if (!textarea) return;
			domBound = true;

			textarea.addEventListener('input', function() {
				state.pendingDiscardConfirm = false;
				renderGutterAndHighlight();
				syncScroll();
			});
			textarea.addEventListener('scroll', syncScroll);
			textarea.addEventListener('keydown', handleTextareaKeydown);
			textarea.addEventListener('keyup', function() {
				renderGutterAndHighlight();
			});
			textarea.addEventListener('click', function() {
				renderGutterAndHighlight();
			});

			if (pathInput) {
				pathInput.addEventListener('change', function() {
					const nextNorm = normalizeTargetPath(pathInput.value);
					if (nextNorm !== state.path) {
						state.path = nextNorm;
						state.dirty = true;
						renderHeaderState();
					}
				});
				pathInput.addEventListener('keydown', function(ev) {
					if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
						ev.preventDefault();
						save(pathInput.value);
					} else if (ev.key === 'Enter') {
						ev.preventDefault();
						const nextNorm = normalizeTargetPath(pathInput.value);
						state.path = nextNorm;
						textarea.focus();
						renderHeaderState();
					} else if (ev.key === 'Escape') {
						ev.preventDefault();
						close(false);
					}
				});
			}

			if (saveBtn) {
				saveBtn.addEventListener('click', function() { save(); });
			}
			if (runBtn) {
				runBtn.addEventListener('click', function() { saveAndRun(); });
			}
			if (closeBtn) {
				closeBtn.addEventListener('click', function() { close(false); });
			}
			if (discardBtn) {
				discardBtn.addEventListener('click', function() { close(true); });
			}
			if (cancelCloseBtn) {
				cancelCloseBtn.addEventListener('click', function() {
					state.pendingDiscardConfirm = false;
					renderHeaderState();
					textarea.focus();
				});
			}

			document.addEventListener('keydown', function(ev) {
				if (!state.active) return;
				if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && ev.key.toLowerCase() === 's') {
					ev.preventDefault();
					ev.stopPropagation();
					save();
				} else if (ev.key === 'Escape') {
					ev.preventDefault();
					ev.stopPropagation();
					close(false);
				}
			}, true);
		}

		async function open(rawPath, headless) {
			const isHeadless = Boolean(headless);
			if (!isHeadless) {
				bindDom();
			}
			const normPath = normalizeTargetPath(rawPath);
			if (normPath === '/' || (vfs && vfs.isDirectory(normPath))) {
				return false;
			}
			if (state.active) {
				close(true);
			}

			const loaded = await loadInitialSource(rawPath, normPath);
			state.active = true;
			state.headless = isHeadless;
			state.rawPath = String(rawPath || 'untitled.bop');
			state.path = normPath;
			state.sourceType = loaded.sourceType;
			state.content = loaded.content;
			state.savedContent = loaded.content;
			state.savedAtLeastOnce = false;
			state.dirty = false;
			state.pendingDiscardConfirm = false;
			state.message = loaded.sourceType === 'server'
				? 'Editing copy of server file (Save writes to VFS)'
				: '';
			state.messageIsError = false;

			if (isHeadless) {
				return true;
			}

			const textarea = getEl('bop-editor-textarea');
			if (textarea) {
				textarea.value = state.content;
				const pos = state.sourceType === 'new' ? state.content.length : 0;
				textarea.selectionStart = textarea.selectionEnd = pos;
				renderGutterAndHighlight();
			} else {
				renderHeaderState();
			}
			syncOverlayVisibility();

			if (typeof document === 'undefined' || !getEl('bop-editor-overlay')) {
				return true;
			}

			return new Promise(function(resolve) {
				state._resolveOpen = resolve;
			});
		}

		return {
			open: open,
			save: save,
			saveAndRun: saveAndRun,
			close: close,
			setContent: function(text) {
				const s = String(text ?? '');
				state.content = s;
				state.dirty = s !== state.savedContent;
				if (!state.headless) {
					const textarea = getEl('bop-editor-textarea');
					if (textarea) {
						textarea.value = s;
						renderGutterAndHighlight();
					}
				}
				return true;
			},
			isOpen: function() {
				return state.active;
			},
			getState: function() {
				return {
					active: state.active,
					headless: state.headless,
					path: state.path,
					sourceType: state.sourceType,
					content: state.content,
					savedContent: state.savedContent,
					dirty: state.dirty,
					savedAtLeastOnce: state.savedAtLeastOnce
				};
			}
		};
	}

	function createEditorBridgeHelpers(bopEditor, bop) {
		return {
			editorOpen: function(filename, headless) {
				if (bop && typeof bop.createFFIResult === 'function') {
					return bop.createFFIResult(
						function() {
							throw new Error('edit() requires BOP async mode');
						},
						function() {
							return bopEditor.open(filename, Boolean(headless));
						}
					);
				}
				return bopEditor.open(filename, Boolean(headless));
			},
			editorSave: function(targetPath) {
				return bopEditor.save(targetPath);
			},
			editorClose: function(forceDiscard) {
				return bopEditor.close(Boolean(forceDiscard));
			},
			editorSetContent: function(text) {
				return bopEditor.setContent(text);
			},
			editorState: function() {
				return bopEditor.getState();
			}
		};
	}

	globalScope.createBopEditor = createBopEditor;
	globalScope.createEditorBridgeHelpers = createEditorBridgeHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
