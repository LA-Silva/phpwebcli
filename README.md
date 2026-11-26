### BOPWEBCLI

This mini proof-of-concept (POC) is a **client-side, browser-hosted interactive BOP (Browser-Oriented PHP) REPL** running entirely on a static web server without a backend runtime or build step. It pairs a standalone pure-JavaScript **BOP Engine** (`lib/bop_engine.js`) with **jQuery Terminal** and **PrismJS** to execute BOP (`<?bop ... ?>`) statements natively in the browser and bridge JavaScript, DOM, VFS, SQLite/PDO, and 2D screen APIs into BOP code.

### Core Components & Architecture

* **Standalone BOP Parser & Engine (`lib/bop_engine.js` + `lib/bop_bridge.js`):** Implements a self-contained lexer, recursive-descent parser, and async tree-walking interpreter that parses `<?bop ... ?>` and `<?= ... ?>` natively, preserves runtime state across commands, provides BOP system symbols (`bopversion()`, `bop_uname()`, `BOP_*`), and streams standard output (`getStdout()`) and errors (`getStderr()`) back to the UI.
* **Terminal UI & Syntax Highlighting (jQuery + jQuery Terminal + PrismJS):** Mounts an interactive `bop > ` prompt onto `<body>` with syntax highlighting via PrismJS (`$.terminal.syntax('bop')`), normalizes trailing semicolons/blocks for convenience, and handles execution promise errors.
* **JavaScript-to-BOP Bridge (`bop.expose`):** Exposes host objects and browser APIs into the BOP runtime as `$`-prefixed variables—such as `$term`, `$jQuery` (with a `$.fn.__toString` helper), `$includeBop` (remote `.bop` fetching and execution), `$bridge` (VFS, MiniSQL, Screen Buffer, Oracle dates, Cron, Math helpers), and `$io` (prompted line input via `term.read()` with `set_mask('*')` / `set_mask(false)` password masking).

### How the Pieces Fit Together

1. **Bootstrap:** The page loads jQuery, PrismJS, jQuery Terminal, the standalone `lib/bop_engine.js` runtime, and the modular runtime (`lib/vfs.js`, `lib/minisql.js`, `lib/screen_buffer.js`, `lib/adlib.js`, `lib/bop_bridge.js`), then boots the `.bop` standard library modules (`lib/strings.bop`, `lib/dates.bop`, `lib/cron.bop`, `lib/files.bop`, `lib/math.bop`, `lib/arrays.bop`, `lib/sqlite.bop`, `lib/screen.bop`, `lib/sound.bop`, `lib/stdlib.bop`).
2. **Command Loop:** Each submitted snippet is passed to `bop.execute(...)`, routing output to the terminal or active 2D screen framebuffer and errors to `term.error()`.
3. **Host Interop:** Exposed JS objects let BOP scripts inspect or modify the page via jQuery, persist files and SQLite databases in `localStorage` (`bopwebcli_vfs_v1`), synthesize 9-channel AdLib-style FM audio via Web Audio, load external `.bop` files over `fetch()`, and prompt for standard or asterisk-masked input in the terminal.
