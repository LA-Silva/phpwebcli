### BOPWEBCLI

This mini proof-of-concept (POC) is a **client-side, browser-hosted interactive BOP (Browser-Oriented PHP) REPL** running entirely on a static web server without a backend runtime or build step. It pairs the **Uniter** runtime (`[https://github.com/asmblah/uniter](https://github.com/asmblah/uniter)`) with **jQuery Terminal** and **PrismJS** to execute BOP (`<?bop ... ?>`) statements in the browser and bridge JavaScript, DOM, VFS, SQLite/PDO, and 2D screen APIs into BOP code.

### Core Components & Architecture

* **BOP Runtime (`asmblah/uniter` + `bop_bridge.js`):** Instantiates a browser-side BOP engine that preprocesses `<?bop ... ?>` tags and evaluates snippets on the fly, preserves runtime state across commands, remaps system symbols (`bopversion()`, `bop_uname()`, `BOP_*`), and streams standard output (`getStdout()`) and errors (`getStderr()`) formatted as `BOP ...:` back to the UI.
* **Terminal UI & Syntax Highlighting (jQuery + jQuery Terminal + PrismJS):** Mounts an interactive `bop > ` prompt onto `<body>` with syntax highlighting via PrismJS (`$.terminal.syntax('bop')`), normalizes trailing semicolons/blocks for convenience, and handles execution promise errors.
* **JavaScript-to-BOP Bridge (`bop.expose`):** Exposes host objects and browser APIs into the BOP runtime as `$`-prefixed variables—such as `$term`, `$jQuery` (with a `$.fn.__toString` helper), `$includeBop` / `$include_remote` (remote `.bop` fetching and execution), `$bridge` (VFS, MiniSQL, Screen Buffer, Oracle dates, Cron, Math helpers), and `$io` (prompted line input via `term.read()` with `set_mask('*')` / `set_mask(false)` password masking).

### How the Pieces Fit Together

1. **Bootstrap:** The page loads jQuery, PrismJS, jQuery Terminal, Uniter's standalone browser bundle, and the modular runtime (`vfs.js`, `minisql.js`, `screen_buffer.js`, `bop_bridge.js`), then boots the `.bop` standard library modules (`strings.bop`, `dates.bop`, `cron.bop`, `files.bop`, `math.bop`, `arrays.bop`, `sqlite.bop`, `screen.bop`, `stdlib.bop`).
2. **Command Loop:** Each submitted line is preprocessed (`<?bop`) and passed to `bop.execute(...)`, routing output to the terminal or active 2D screen framebuffer and errors to `term.error()`.
3. **Host Interop:** Exposed JS objects let BOP scripts inspect or modify the page via jQuery, persist files and SQLite databases in `localStorage` (`bopwebcli_vfs_v1`), load external `.bop` files over `fetch()`, and prompt for standard or asterisk-masked input in the terminal.
