

- [X] Implement something like include(url)
- [X] function for input text from command line using bop construct
- [X] function for input masked text from web based command line (`myinput($prompt, true)` / `$io->read($prompt, true)` with `$secret` flag)
- [X] implement local storage of some kind.

## Implemented BOP Language Constructs

### Tags & Output
- [x] `<?bop ... ?>` open/close tags
- [x] `<?=` short echo tag
- [x] `echo`
- [x] `print`
- [x] Inline text/HTML outside BOP tags

### Variables, Scope & Constants
- [x] Variables (`$var`) and variable variables (`$$var`)
- [x] Assignment operators (`=`, `+=`, `-=`, `*=`, `/=`, `%=`, `.=`, `&=`, `|=`, `^=`, `<<=`, `>>=`)
- [x] References (`&$var`, pass-by-reference, return-by-reference)
- [x] `global`
- [x] `static` variables
- [x] `isset()`
- [x] `empty()`
- [x] `unset()`
- [x] `const` constants
- [x] Magic constants (`__LINE__`, `__FILE__`, `__DIR__`, `__FUNCTION__`, `__CLASS__`, `__METHOD__`, `__NAMESPACE__`)

### Data Types, Literals & Casting
- [x] Scalars: integers, floats, booleans (`true` / `false`), `null`
- [x] Single-quoted and double-quoted strings (with simple & complex `{...}` variable interpolation)
- [x] Binary string literals (`b"..."`)
- [x] Heredoc (`<<<`) and Nowdoc (`<<<'...'`)
- [x] Arrays (`array(...)` and short syntax `[...]`), key-value pairs (`=>`), indexing (`$arr[$key]`), append (`$arr[] = ...`)
- [x] `list(...)` destructuring
- [x] Type casts: `(int)`, `(float)`, `(string)`, `(bool)`, `(array)`, `(object)`, `(unset)`

### Operators & Expressions
- [x] Arithmetic (`+`, `-`, `*`, `/`, `%`), string concatenation (`.`), bitwise (`&`, `|`, `^`, `~`, `<<`, `>>`), increment/decrement (`++`, `--`)
- [x] Comparison (`==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`)
- [x] Logical (`&&`, `||`, `!`, `and`, `or`)
- [x] Ternary operator (`?:` and shorthand `?:`)
- [x] Null coalescing operator (`??`)
- [x] Error control / suppression operator (`@`)
- [x] `instanceof`
- [x] `clone`

### Control Flow & Error Handling
- [x] `if` / `elseif` / `else`
- [x] `switch` / `case` / `default`
- [x] `while`
- [x] `do ... while`
- [x] `for`
- [x] `foreach` (`as $val`, `as $key => $val`, and by-reference `&$val`)
- [x] `break` and `continue` (including numeric levels)
- [x] `goto` and labels (`label:`)
- [x] `try` / `catch` / `finally`
- [x] `throw`
- [x] `return`
- [x] `exit` / `die`

### Functions & Closures
- [x] `function` declarations (default values, by-reference params, `func_get_args()`, type hints: `array`, `callable`, `iterable`, `void`, class/interface types)
- [x] Anonymous functions / closures (`function (...) use (...) { ... }`)
- [x] Dynamic function calls (`$fn(...)`)

### Classes, Interfaces & OOP
- [x] `class` declarations (`abstract`, `final`, `extends`, `implements`)
- [x] `interface` declarations
- [x] Properties (instance and `static`) and class constants (`const`)
- [x] Methods (instance, `static`, `abstract`) with visibility (`public`, `protected`, `private`)
- [x] `new` instantiation (including `new $class()`, `new self()`, `new static()`)
- [x] Object member access (`->`), static member access (`::`), `self`, `parent`, `static`

### Namespaces, Includes & Runtime Evaluation
- [x] `namespace` (semicolon and braced forms) and `use` imports/aliases
- [x] `include` / `include_once`
- [x] `require` / `require_once`
- [x] `eval()`
- [x] Clean missing-file errors (`File not found`) on HTTP 404 or HTML fallback in `include` / `require` and `$includeBop()` (`server.js`, `index.html`)

## Implemented Runtime, Standard Library & Tools

### Browser Runtime & Interactive Shell
- [x] Standalone pure-JS BOP lexer, parser & async interpreter (`bop_engine.js`) replacing Uniter
- [x] Modular JS runtime architecture (`bop_engine.js`, `vfs.js`, `minisql.js`, `screen_buffer.js`, `bop_bridge.js`)
- [x] Serialized interactive terminal input queue (`$io->read()`, `$io->readline()`, `myinput($prompt, $secret)`)
- [x] Terminal masking helpers (`$maskaan()`, `$maskuit()`) and exposed globals (`$term`, `$jQuery`, `$bridge`, `$meta`, `$includeBop()`)
- [x] BOP-only engine branding (`bopversion()`, `bop_uname()`, `BOP_*` constants, `bop >` prompt, `.bop` extensions, `bopwebcli_vfs_v1`)
- [x] `get_defined_functions()` accurately distinguishing `internal` vs `user` functions

### Strings & Formatting (`lib/strings.bop`, `bop_bridge.js`)
- [x] BASIC/Perl-style string helpers: `len()`, `left()`, `right()`, `mid()`, `instr()`, `lower()`, `upper()`, `chr()`, `val()`, `ltrim()`, `rtrim()`, `strcmp()`, `stricmp()`, `space()`, `split()`
- [x] Unix-style horizontal 6x6 uppercase pure-ASCII art command: `banner($text, $return = false)`
- [x] Upgraded `sprintf()` with `%f`/`%F`, `%e`/`%E`, `%g`/`%G`, `%x`/`%X`, `%o`, `%b`, `%c`, `%u`, padding, precision, and positional `%1$s` arguments

### Dates, Times & Oracle Formatters (`lib/dates.bop`)
- [x] `sysdate()`, `to_date()`, `to_char()` (Oracle date & numeric format masks), `date_to_number()`, `number_to_date()`

### Cron Scheduling (`lib/cron.bop`)
- [x] Browser cron job manager (`cron()`) supporting 5-field schedules, `@hourly`/`@daily`/`@weekly`/`@monthly`/`@yearly` aliases, overrides, and deletions

### Virtual Filesystem & BOP Streams (`lib/files.bop`, `vfs.js`)
- [x] Persistent `localStorage` VFS with `file_get_contents()`, `file_put_contents()`, `file()`, `unlink()`, `rename()`, `copy()`, `mkdir()`, `rmdir()`, `is_dir()`, `filesize()`, `filemtime()`, `touch()`, `scandir()`, `glob()`, `basename()`, `realpath()`
- [x] Scriptable bash-style BOP helpers: `pwd()`, `cd($dir = '/')`, `ls($path = null, $long = false)`
- [x] Low-level BOP stream resources: `fopen()`, `fread()`, `fwrite()`, `fgets()`, `fgetc()`, `fseek()`, `ftell()`, `rewind()`, `feof()`, `ftruncate()`, `fflush()`, `fpassthru()`, `fclose()`
- [x] Filesystem constants (`SEEK_*`, `FILE_APPEND`, `FILE_IGNORE_NEW_LINES`, `FILE_SKIP_EMPTY_LINES`, `LOCK_EX`, `SCANDIR_*`, `DIRECTORY_SEPARATOR`, `BOP_EOL`)

### Math, Trigonometry, PRNG & Base Conversion (`lib/math.bop`)
- [x] Arithmetic, powers, logs & checks: `pi()`, `abs()`, `floor()`, `round()`, `min()`, `max()`, `pow()`, `sqrt()`, `exp()`, `expm1()`, `log()`, `log10()`, `log1p()`, `hypot()`, `fmod()`, `fdiv()`, `intdiv()`, `is_nan()`, `is_finite()`, `is_infinite()`
- [x] Trigonometry & hyperbolic: `deg2rad()`, `rad2deg()`, `sin()`, `cos()`, `tan()`, `asin()`, `acos()`, `atan()`, `atan2()`, `sinh()`, `cosh()`, `tanh()`, `asinh()`, `acosh()`, `atanh()`
- [x] Deterministic Mulberry32 PRNG: `srand()`, `rand()`, `getrandmax()`
- [x] Base conversion & math constants: `bindec()`, `octdec()`, `hexdec()`, `decbin()`, `decoct()`, `base_convert()`, `M_*`, `BOP_ROUND_HALF_*`, `INF`, `NAN`

### Arrays & Sorting (`lib/arrays.bop`)
- [x] Creation & manipulation: `range()`, `array_fill()`, `array_fill_keys()`, `array_combine()`, `array_slice()`, `array_splice()`, `array_chunk()`, `array_column()`, `array_pad()`, `array_unshift()`, `array_replace()`, `array_replace_recursive()`, `array_merge_recursive()`
- [x] Inspection, math & sets: `array_reverse()`, `array_flip()`, `array_change_key_case()`, `array_sum()`, `array_product()`, `array_reduce()`, `array_walk()`, `array_count_values()`, `array_intersect()`, `array_intersect_key()`, `array_diff_key()`, `array_key_first()`, `array_key_last()`
- [x] Sorting & shuffling: `sort()`, `rsort()`, `arsort()`, `ksort()`, `usort()`, `uasort()`, `uksort()`, `shuffle()`, `array_rand()`, plus `CASE_*` and `SORT_*` constants

### Screen, Terminal & Cursor Control (`lib/screen.bop`, `screen_buffer.js`, `screen_demo.bop`)
- [x] Screen dimension wrappers: `screen_columns()` and `screen_lines()`
- [x] Option 2 2D character framebuffer overlay: `screen_mode()`, `cls()`, `locate()`, `cursor_row()`, `cursor_col()`, `screen_line()` with blinking cursor, VT100 deferred wrap, `Escape`/exit button, and ANSI CSI escapes (`ESC[H`, `ESC[A/B/C/D`, `ESC[2J`, `ESC[K`)
- [x] Interactive demo script (`screen_demo.bop` / `screen_demo()`)

### SQLite3 & PDO Databases (`lib/sqlite.bop`, `minisql.js`)
- [x] Zero-WASM pure-JS SQL engine with `:memory:` and persistent `localStorage` VFS database files
- [x] `SQLite3`, `SQLite3Stmt`, `SQLite3Result`, `PDO`, `PDOStatement`, and `PDOException` classes with prepared statements, `JOIN`, `GROUP BY`, aggregates, transactions (`BEGIN`/`COMMIT`/`ROLLBACK`), `sqlite_master`, and `SQLITE3_*` / `PDO::*` constants

### Documentation, Examples & Standalone Unit Tests
- [x] Interactive feature showcase in `example.bop`
- [x] Complete grouped command reference with explanations and examples in `LANGUAGE.md`
- [x] Standalone memory-clean unit test scripts (`test/unit_test_string.bop`, `test/unit_test_date.bop`, `test/unit_test_cron.bop`, `test/unit_test_file.bop`, `test/unit_test_math.bop`, `test/unit_test_array.bop`, `test/unit_test_sqlite.bop`, `test/unit_test_screen.bop`)
