### PHPWEBCLI 

This mini proof-of-concept (POC) is a **client-side, browser-hosted interactive PHP REPL** running entirely on a static web server without a backend PHP runtime or Node.js build step. It pairs the **Uniter** PHP-to-JavaScript runtime (`[https://github.com/asmblah/uniter](https://github.com/asmblah/uniter)`) with **jQuery Terminal** and **PrismJS** to execute PHP statements in the browser and bridge JavaScript/DOM APIs into PHP code.

### Core Components & Architecture

* **PHP Runtime (`asmblah/uniter`):** Instantiates a browser-side PHP engine (`uniter.createEngine('PHP')`) that parses and evaluates `<?php ... ?>` snippets on the fly, preserves runtime state across commands, and streams standard output (`getStdout()`) and errors (`getStderr()`) back to the UI.
* **Terminal UI & Syntax Highlighting (jQuery + jQuery Terminal + PrismJS):** Mounts an interactive `php > ` prompt onto `<body>` with PHP syntax highlighting via PrismJS (`$.terminal.syntax('php')`), normalizes trailing semicolons/blocks for convenience, and handles execution promise errors.
* **JavaScript-to-PHP Bridge (`php.expose`):** Exposes host objects and browser APIs into the PHP runtime as `$`-prefixed variables—such as `$term`, `$jQuery` (with a `$.fn.__toString` helper), `$storage` (`window.localStorage` `get`/`set`/`remove`), `$host`/`$bridge` (remote `.php` fetching/execution and DOM/HTTP helpers), and `$io` (prompted line input via `term.read()` with `set_mask('*')` / `set_mask(false)` password masking).

### How the Pieces Fit Together

1. **Bootstrap:** The page loads jQuery, PrismJS (including PHP language support), jQuery Terminal, and Uniter's standalone browser bundle, then initializes the PHP engine and terminal inside a DOM-ready handler.
2. **Command Loop:** Each submitted line is wrapped in `<?php ... ?>` and passed to `php.execute(...)`, routing output to `term.echo()` and errors to `term.error()`.
3. **Host Interop:** Exposed JS objects let PHP scripts inspect or modify the page via jQuery, persist data in `localStorage`, load external `.php` files over `fetch()`, and prompt for standard or asterisk-masked input in the terminal.
