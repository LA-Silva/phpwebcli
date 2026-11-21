

- [X] Implement something like include(url)
- [X] function for input text from command line using php construct
- [ ] function for input masked text from web based command line 
- [ ] implement local storage of some kind.

## Implemented PHP Language Constructs

### Tags & Output
- [x] `<?php ... ?>` open/close tags
- [x] `<?=` short echo tag
- [x] `echo`
- [x] `print`
- [x] Inline HTML outside PHP tags

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
- [x] Type casts: `(int)`/`(integer)`, `(float)`/`(double)`, `(string)`, `(bool)`/`(boolean)`, `(array)`, `(object)`, `(binary)`, `(unset)`

### Operators & Expressions
- [x] Arithmetic (`+`, `-`, `*`, `/`, `%`), string concatenation (`.`), bitwise (`&`, `|`, `^`, `~`, `<<`, `>>`), increment/decrement (`++`, `--`)
- [x] Comparison (`==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`)
- [x] Logical (`&&`, `||`, `!`, `and`, `or`, `xor`)
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
- [x] `function` declarations (default values, by-reference params, variadic `...$args`, type hints: `array`, `callable`, `iterable`, `void`, class/interface types)
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

