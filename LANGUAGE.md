# PHP Web CLI Language Reference

Complete enumeration of all PHP language constructs, built-in functions, standard library extensions, database classes, screen controls, terminal/bridge helpers, constants, and standalone scripts available in this browser-hosted Uniter PHP environment.

---

## Table of Contents

1. [Core Language Constructs & Include Statements](#1-core-language-constructs--include-statements)
2. [Strings & Text Formatting](#2-strings--text-formatting)
3. [Arrays & Sorting](#3-arrays--sorting)
4. [Math, Trigonometry, Randomness & Base Conversion](#4-math-trigonometry-randomness--base-conversion)
5. [Dates, Times & Oracle-Style Formatters](#5-dates-times--oracle-style-formatters)
6. [Files, Directories & Streams (`localStorage` VFS)](#6-files-directories--streams-localstorage-vfs)
7. [Screen, Terminal & Cursor Control (2D Framebuffer)](#7-screen-terminal--cursor-control-2d-framebuffer)
8. [SQLite3 & PDO Databases (Zero-WASM MiniSQL)](#8-sqlite3--pdo-databases-zero-wasm-minisql)
9. [Cron Scheduling](#9-cron-scheduling)
10. [Interactive I/O, Terminal & Browser Bridge Helpers](#10-interactive-io-terminal--browser-bridge-helpers)
11. [Types, Introspection, Reflection & Callables](#11-types-introspection-reflection--callables)
12. [Output Buffering](#12-output-buffering)
13. [URLs, Environment, Runtime Config & Errors](#13-urls-environment-runtime-config--errors)
14. [Constants Reference](#14-constants-reference)
15. [Standalone Scripts & Unit Tests](#15-standalone-scripts--unit-tests)

---

## 1. Core Language Constructs & Include Statements

Standard PHP syntax supported by the Uniter engine in the `php >` REPL.

| Construct | Description | Example |
|---|---|---|
| `echo $expr` | Outputs one or more strings or values to the terminal or active screen buffer. | `echo "Hello, world!\n";` |
| `print $expr` | Outputs a single string or value and returns `1`. | `print "Done\n";` |
| `include 'file.php'` | Loads and executes a PHP file from VFS or server; emits a warning if missing and continues. | `include 'screen_demo.php';` |
| `include_once 'file.php'` | Same as `include`, but loads the file only once per session. | `include_once 'unit_test_math.php';` |
| `require 'file.php'` | Loads and executes a PHP file; throws a fatal error if missing. | `require 'strings.php';` |
| `require_once 'file.php'` | Same as `require`, but loads the file only once per session. | `require_once 'dates.php';` |
| `isset($var)` | Returns `true` if a variable or array key exists and is not `null`. | `if (isset($name)) echo $name;` |
| `empty($var)` | Returns `true` if a variable does not exist or evaluates to false/empty (`""`, `0`, `[]`, `null`). | `if (empty($items)) echo "None";` |
| `unset($var)` | Destroys a variable or removes an array element. | `unset($temp);` |
| `list($a, $b) = $arr` | Unpacks indexed array elements into variables in one statement. | `list($x, $y) = [10, 20];` |
| `die($msg)` / `exit($code)` | Terminates current script execution immediately. | `if (!$ok) die("Stopped\n");` |
| `return $val` | Returns a value from a function, closure, or included PHP file. | `return $total * 1.1;` |
| `function name($args) {}` | Defines a named or anonymous function (closures with `use (...)` are supported). | `$fn = function($x) { return $x * 2; };` |
| `class Name {}` | Defines classes with properties, constants, inheritance (`extends`), visibility, and magic methods. | `class Box { public $v = 1; }` |
| `try {} catch (Exception $e) {} finally {}` | Structured exception handling. | `try { throw new Exception("Oops"); } catch (Exception $e) { echo $e->getMessage(); }` |

> **Uniter Notes:** `var_dump()` accepts one argument per call, `xor` is not supported, `...$args` variadic syntax is unsupported (use `func_get_args()`), and method default parameters cannot reference class constants directly.

---

## 2. Strings & Text Formatting

Includes Uniter built-ins, `php_bridge.js` upgrades (`sprintf`), and BASIC/Perl-style helpers in `strings.php`.

### Length, Substrings & Trimming

| Command | Description | Example |
|---|---|---|
| `strlen($str)` | Returns the character length of a string. | `echo strlen("hello"); // 5` |
| `len($str)` | BASIC-style alias for `strlen()`. | `echo len("hello"); // 5` |
| `substr($str, $start, $len = null)` | Extracts a portion of a string; negative offsets count from the end. | `echo substr("abcdef", 2, 3); // "cde"` |
| `left($str, $length)` | Returns the leftmost `$length` characters (BASIC `LEFT$`). | `echo left("hello", 2); // "he"` |
| `right($str, $length)` | Returns the rightmost `$length` characters (BASIC `RIGHT$`). | `echo right("hello", 2); // "lo"` |
| `mid($str, $start, $length = null)` | Extracts substring using 1-based `$start` (BASIC `MID$`). | `echo mid("abcdef", 3, 2); // "cd"` |
| `trim($str, $chars = ...)` | Strips whitespace (or specified characters) from both ends of a string. | `echo trim("  hi  "); // "hi"` |
| `ltrim($str, $chars = null)` | Strips whitespace or specified characters from the start of a string. | `echo ltrim("00042", "0"); // "42"` |
| `rtrim($str, $chars = null)` | Strips whitespace or specified characters from the end of a string. | `echo rtrim("hi...", "."); // "hi"` |
| `space($count)` | Returns a string of `$count` spaces (BASIC `SPACE$`). | `echo "[" . space(4) . "]"; // "[    ]"` |

### Searching, Comparing & Counting

| Command | Description | Example |
|---|---|---|
| `strpos($haystack, $needle, $offset = 0)` | Returns 0-based index of first occurrence, or `false` if not found. | `echo strpos("hello world", "world"); // 6` |
| `strrpos($haystack, $needle, $offset = 0)` | Returns 0-based index of last occurrence, or `false`. | `echo strrpos("banana", "na"); // 4` |
| `strrchr($haystack, $needle)` | Returns the substring from the last occurrence of `$needle` to the end. | `echo strrchr("/a/b/c.txt", "/"); // "/c.txt"` |
| `instr($arg1, $arg2, $arg3 = null)` | BASIC-style 1-based search (`0` if not found). Supports `instr($str, $find, $start)` and `instr($start, $str, $find)`. | `echo instr(4, "banana", "na"); // 5` |
| `substr_count($haystack, $needle, ...)` | Counts how many times a substring occurs. | `echo substr_count("banana", "a"); // 3` |
| `strcmp($str1, $str2)` | Case-sensitive binary string comparison (`<0`, `0`, `>0`). | `echo strcmp("a", "b"); // -1` |
| `stricmp($str1, $str2)` | Case-insensitive string comparison (`<0`, `0`, `>0`). | `echo stricmp("Hello", "hello"); // 0` |

### Case, Conversion & Character Codes

| Command | Description | Example |
|---|---|---|
| `strtolower($str)` | Converts ASCII letters to lowercase. | `echo strtolower("HeLLo"); // "hello"` |
| `lower($str)` | Alias for `strtolower()`. | `echo lower("WORLD"); // "world"` |
| `strtoupper($str)` | Converts ASCII letters to uppercase. | `echo strtoupper("hello"); // "HELLO"` |
| `upper($str)` | Alias for `strtoupper()`. | `echo upper("hello"); // "HELLO"` |
| `chr($code)` | Returns the single-byte character for ASCII code `0..255` (`$code & 255`). | `echo chr(65); // "A"` |
| `val($str)` | Parses leading integer or float value from a string (BASIC `VAL`), or `0`. | `echo val(" -3.14px"); // -3.14` |

### Splitting, Joining, Replacing & Formatting

| Command | Description | Example |
|---|---|---|
| `explode($delim, $str, $limit = ...)` | Splits a string by a fixed delimiter into an array. | `$parts = explode(",", "a,b,c");` |
| `implode($glue, $pieces)` | Joins array elements into a string using `$glue`. | `echo implode("-", ["a", "b"]); // "a-b"` |
| `join($glue, $pieces)` | Alias for `implode()`. | `echo join(",", [1, 2, 3]); // "1,2,3"` |
| `split($pattern, $str = null, $limit = 0)` | Perl-style split supporting 1-arg whitespace mode, fixed delimiter, or delimited regex `/.../`. | `$words = split("  foo   bar ");` |
| `str_replace($search, $replace, $subj)` | Replaces all occurrences of `$search` (string or array) with `$replace`. | `echo str_replace("world", "PHP", "hello world");` |
| `strtr($str, $from, $to = null)` | Translates characters or replaces pairs from an associative array. | `echo strtr("aba", "ab", "xy"); // "xyx"` |
| `preg_quote($str, $delim = null)` | Escapes regular expression special characters. | `echo preg_quote("a+b?", "/"); // "a\+b\?"` |
| `sprintf($format, ...$args)` | Formats values using `%s`, `%d`, `%i`, `%u`, `%f`, `%F`, `%e`, `%E`, `%g`, `%G`, `%x`, `%X`, `%o`, `%b`, `%c`, padding, precision, and positional `%1$s`. | `echo sprintf("%s-%04d-%.2f", "ID", 7, 3.1415);` |
| `htmlspecialchars($str, ...)` | Converts `&`, `"`, `'`, `<`, `>` into HTML entities. | `echo htmlspecialchars("<b>hi</b>");` |
| `htmlentities($str, ...)` | Converts all applicable characters into HTML entities. | `echo htmlentities("<a>");` |
| `get_html_translation_table(...)` | Returns the translation table used by `htmlspecialchars`/`htmlentities`. | `$tbl = get_html_translation_table();` |
| `hello123()` | Sample greeting function from `strings.php` returning `"123hello world"`. | `echo hello123();` |

---

## 3. Arrays & Sorting

Combines Uniter built-ins with `arrays.php` extensions.

### Creation, Inspection & Access

| Command | Description | Example |
|---|---|---|
| `range($start, $end, $step = 1)` | Creates an array containing an ascending/descending range of numbers or characters. | `$nums = range(1, 5); // [1,2,3,4,5]` |
| `array_fill($start, $count, $val)` | Fills an array with `$count` entries of `$val` starting at index `$start`. | `$a = array_fill(2, 3, "x");` |
| `array_fill_keys($keys, $val)` | Creates an array using `$keys` as keys, all assigned `$val`. | `$a = array_fill_keys(["a", "b"], 0);` |
| `array_combine($keys, $values)` | Creates an associative array using `$keys` for keys and `$values` for values. | `$a = array_combine(["x", "y"], [1, 2]);` |
| `count($arr)` / `sizeof($arr)` | Returns the number of elements in an array. | `echo count([10, 20, 30]); // 3` |
| `array_keys($arr, ...)` | Returns all keys (or keys matching a search value) of an array. | `$k = array_keys(["a" => 1, "b" => 2]);` |
| `array_values($arr)` | Re-indexes and returns all values of an array as a 0-based list. | `$v = array_values([2 => "x", 5 => "y"]);` |
| `array_key_exists($key, $arr)` | Checks whether a key or index exists in an array (even if its value is `null`). | `if (array_key_exists("id", $row)) echo "ok";` |
| `array_key_first($arr)` | Returns the first key of an array, or `null` if empty. | `echo array_key_first(["a" => 1, "b" => 2]);` |
| `array_key_last($arr)` | Returns the last key of an array, or `null` if empty. | `echo array_key_last(["a" => 1, "b" => 2]);` |
| `in_array($needle, $arr, $strict = false)` | Checks if a value exists inside an array. | `if (in_array("red", ["red", "blue"])) echo "yes";` |
| `array_search($needle, $arr, $strict = false)` | Searches for a value and returns its first matching key, or `false`. | `$k = array_search(20, ["a" => 10, "b" => 20]);` |
| `array_column($arr, $col, $index = null)` | Extracts values from a single column of a 2D array, optionally re-keyed by `$index`. | `$names = array_column($users, "name", "id");` |

### Array Pointer Traversal

| Command | Description | Example |
|---|---|---|
| `reset(&$arr)` | Rewinds internal array pointer to the first element and returns its value. | `$first = reset($arr);` |
| `current($arr)` | Returns the current element value without advancing the pointer. | `echo current($arr);` |
| `key($arr)` | Returns the index/key of the current array element. | `echo key($arr);` |
| `next(&$arr)` | Advances internal pointer by one and returns the new current element. | `$second = next($arr);` |
| `end(&$arr)` | Moves internal pointer to the last element and returns its value. | `$last = end($arr);` |

### Modification, Slicing & Combining

| Command | Description | Example |
|---|---|---|
| `array_push(&$arr, ...$vals)` | Pushes one or more values onto the end of an array and returns new length. | `array_push($stack, "a", "b");` |
| `array_pop(&$arr)` | Pops and returns the last element of an array. | `$top = array_pop($stack);` |
| `array_unshift(&$arr, ...$vals)` | Prepends one or more elements to the beginning of an array and returns new count. | `array_unshift($queue, "first");` |
| `array_shift(&$arr)` | Removes and returns the first element of an array. | `$head = array_shift($queue);` |
| `array_slice($arr, $off, $len = null, $preserve = false)` | Extracts a slice of an array without mutating it. | `$sub = array_slice([1, 2, 3, 4], 1, 2);` |
| `array_splice(&$arr, $off, $len = null, $repl = [])` | Removes and/or replaces a portion of an array in place, returning removed items. | `$cut = array_splice($a, 1, 2, ["x", "y"]);` |
| `array_chunk($arr, $size, $preserve = false)` | Splits an array into chunks of `$size` elements. | `$pages = array_chunk([1,2,3,4,5], 2);` |
| `array_pad($arr, $size, $value)` | Pads an array to `$size` with `$value` (negative `$size` pads on the left). | `$p = array_pad([1, 2], -4, 0); // [0,0,1,2]` |
| `array_merge(...$arrays)` | Merges arrays (overwrites matching string keys, appends numeric keys). | `$all = array_merge([1, 2], [3, 4]);` |
| `array_merge_recursive(...$arrays)` | Recursively merges arrays into nested arrays when keys collide. | `$m = array_merge_recursive($a, $b);` |
| `array_replace($arr, ...$repl)` | Replaces elements from later arrays into the first array by key. | `$r = array_replace(["a" => 1], ["a" => 9]);` |
| `array_replace_recursive($arr, ...$repl)` | Recursively replaces values in nested arrays by key. | `$r = array_replace_recursive($cfg, $override);` |
| `array_reverse($arr, $preserve = false)` | Returns an array with elements in reverse order. | `$rev = array_reverse([1, 2, 3]);` |
| `array_flip($arr)` | Exchanges all keys with their associated values. | `$flipped = array_flip(["a" => 1, "b" => 2]);` |
| `array_change_key_case($arr, $case = CASE_LOWER)` | Converts all keys to lowercase (`CASE_LOWER`) or uppercase (`CASE_UPPER`). | `$up = array_change_key_case(["Foo" => 1], CASE_UPPER);` |
| `array_unique($arr)` | Removes duplicate values from an array. | `$u = array_unique([1, 2, 2, 3]);` |

### Functional, Math & Set Operations

| Command | Description | Example |
|---|---|---|
| `array_map($cb, $arr, ...)` | Applies callback to elements of one or more arrays and returns a new array. | `$sq = array_map(function($n){ return $n*$n; }, [1,2,3]);` |
| `array_filter($arr, $cb = null, $mode = 0)` | Filters elements using a callback (or drops falsy values if no callback). | `$ev = array_filter([1,2,3,4], function($n){ return $n%2===0; });` |
| `array_reduce($arr, $cb, $init = null)` | Reduces an array to a single value via `$cb($carry, $item)`. | `$s = array_reduce([1,2,3], function($c,$x){ return $c+$x; }, 0);` |
| `array_walk(&$arr, $cb, $userdata = null)` | Applies `$cb(&$val, $key, $userdata)` to every element in place. | `array_walk($items, function(&$v, $k){ $v *= 2; });` |
| `array_sum($arr)` | Returns the sum of numeric values in an array. | `echo array_sum([1, 2, 3, 4]); // 10` |
| `array_product($arr)` | Returns the product of numeric values in an array. | `echo array_product([2, 3, 4]); // 24` |
| `array_count_values($arr)` | Counts occurrences of every value in an array. | `$freq = array_count_values(["a", "b", "a"]);` |
| `array_diff($arr, ...$others)` | Returns values from `$arr` not present in any of `$others`. | `$d = array_diff([1, 2, 3], [2]);` |
| `array_diff_key($arr, ...$others)` | Returns entries from `$arr` whose keys do not exist in `$others`. | `$d = array_diff_key(["a" => 1, "b" => 2], ["b" => 0]);` |
| `array_intersect($arr, ...$others)` | Returns values from `$arr` that also exist in all `$others`. | `$i = array_intersect([1, 2, 3], [2, 3, 4]);` |
| `array_intersect_key($arr, ...$others)` | Returns entries from `$arr` whose keys exist in all `$others`. | `$i = array_intersect_key(["a" => 1, "b" => 2], ["b" => 9]);` |

### Sorting & Randomization

| Command | Description | Example |
|---|---|---|
| `sort(&$arr, $flags = SORT_REGULAR)` | Sorts array values ascending and re-indexes numerically. | `sort($nums);` |
| `rsort(&$arr, $flags = SORT_REGULAR)` | Sorts array values descending and re-indexes numerically. | `rsort($nums);` |
| `asort(&$arr)` | Sorts associative array ascending by value, preserving keys. | `asort($scores);` |
| `arsort(&$arr, $flags = SORT_REGULAR)` | Sorts associative array descending by value, preserving keys. | `arsort($scores);` |
| `ksort(&$arr, $flags = SORT_REGULAR)` | Sorts array ascending by key. | `ksort($map);` |
| `krsort(&$arr)` | Sorts array descending by key. | `krsort($map);` |
| `usort(&$arr, $cmp)` | Sorts array values using custom comparator `$cmp($a, $b)` and re-indexes keys. | `usort($words, function($a,$b){ return strlen($a)-strlen($b); });` |
| `uasort(&$arr, $cmp)` | Sorts array values using custom comparator while preserving keys. | `uasort($map, function($a,$b){ return $a <=> $b; });` |
| `uksort(&$arr, $cmp)` | Sorts array keys using custom comparator. | `uksort($map, function($a,$b){ return strlen($a)-strlen($b); });` |
| `shuffle(&$arr)` | Randomly shuffles array elements in place (uses `rand`/`srand` state) and re-indexes. | `shuffle($deck);` |
| `array_rand($arr, $num = 1)` | Picks one random key (or array of `$num` random keys) from `$arr`. | `$k = array_rand(["a" => 1, "b" => 2]);` |

*(Internal sorting/merge helpers `__array_cmp_values`, `__array_merge_recursive_two`, and `__array_replace_recursive_two` also live in `arrays.php`.)*

---

## 4. Math, Trigonometry, Randomness & Base Conversion

Combines Uniter core (`ceil`, `dechex`) with `math.php`.

### Basic Arithmetic & Rounding

| Command | Description | Example |
|---|---|---|
| `abs($num)` | Returns the absolute value of a number. | `echo abs(-42); // 42` |
| `ceil($num)` | Rounds a number up to the nearest integer (as float). | `echo ceil(3.1); // 4` |
| `floor($num)` | Rounds a number down to the nearest integer (as float). | `echo floor(3.9); // 3` |
| `round($num, $prec = 0, $mode = PHP_ROUND_HALF_UP)` | Rounds a number to `$prec` decimal places (supports negative precision and `PHP_ROUND_HALF_*` modes). | `echo round(3.14159, 2); // 3.14` |
| `min($val, ...)` / `min($arr)` | Returns the lowest value among arguments or inside an array. | `echo min(5, 2, 9); // 2` |
| `max($val, ...)` / `max($arr)` | Returns the highest value among arguments or inside an array. | `echo max([1, 8, 3]); // 8` |
| `intdiv($a, $b)` | Integer division truncating toward zero. | `echo intdiv(17, 5); // 3` |
| `fdiv($a, $b)` | IEEE-754 floating-point division (returns `INF`/`NAN` instead of error on divide by zero). | `echo fdiv(10, 4); // 2.5` |
| `fmod($a, $b)` | Returns floating-point remainder of `$a / $b`. | `echo fmod(5.7, 1.3); // 0.5` |

### Powers, Logs & Constants

| Command | Description | Example |
|---|---|---|
| `pi()` | Returns `3.1415926535898` (`Math.PI`). | `echo pi();` |
| `pow($base, $exp)` | Raises `$base` to `$exp` power. | `echo pow(2, 10); // 1024` |
| `sqrt($num)` | Returns the square root of `$num`. | `echo sqrt(81); // 9` |
| `hypot($x, $y)` | Computes Euclidean hypotenuse $\sqrt{x^2 + y^2}$. | `echo hypot(3, 4); // 5` |
| `exp($num)` | Computes $e^{\text{num}}$. | `echo exp(1); // 2.71828...` |
| `expm1($num)` | Computes $e^{\text{num}} - 1$ accurately near 0. | `echo expm1(0.001);` |
| `log($num, $base = null)` | Natural logarithm (base $e$), or logarithm to `$base` if provided. | `echo log(8, 2); // 3` |
| `log10($num)` | Base-10 logarithm. | `echo log10(1000); // 3` |
| `log1p($num)` | Computes $\ln(1 + \text{num})$ accurately near 0. | `echo log1p(0.001);` |

### Trigonometry & Hyperbolic Functions

| Command | Description | Example |
|---|---|---|
| `deg2rad($deg)` | Converts degrees to radians. | `echo deg2rad(180); // 3.14159...` |
| `rad2deg($rad)` | Converts radians to degrees. | `echo rad2deg(pi()); // 180` |
| `sin($rad)` / `cos($rad)` / `tan($rad)` | Sine, cosine, and tangent (input in radians). | `echo sin(deg2rad(90)); // 1` |
| `asin($x)` / `acos($x)` / `atan($x)` | Inverse trig functions returning radians. | `echo rad2deg(asin(1)); // 90` |
| `atan2($y, $x)` | Quadrant-aware arc tangent of `$y / $x` in radians. | `echo rad2deg(atan2(1, 1)); // 45` |
| `sinh($x)` / `cosh($x)` / `tanh($x)` | Hyperbolic sine, cosine, and tangent. | `echo cosh(0); // 1` |
| `asinh($x)` / `acosh($x)` / `atanh($x)` | Inverse hyperbolic functions. | `echo asinh(0); // 0` |

### Floating-Point Checks

| Command | Description | Example |
|---|---|---|
| `is_nan($num)` | Returns `true` if `$num` is Not-a-Number (`NAN`). | `var_dump(is_nan(NAN));` |
| `is_finite($num)` | Returns `true` if `$num` is finite (not `INF` or `NAN`). | `var_dump(is_finite(42.5));` |
| `is_infinite($num)` | Returns `true` if `$num` is positive or negative infinity (`INF`). | `var_dump(is_infinite(INF));` |

### Random Numbers & Base Conversion

| Command | Description | Example |
|---|---|---|
| `srand($seed = null)` / `mt_srand($seed = null)` | Seeds the deterministic Mulberry32 PRNG used by `rand()`, `mt_rand()`, `shuffle()`, and `array_rand()`. | `srand(12345);` |
| `rand($min = null, $max = null)` / `mt_rand(...)` | Generates a random integer in `[0, 2147483647]` or `[$min, $max]`. | `echo rand(1, 100);` |
| `getrandmax()` / `mt_getrandmax()` | Returns the largest possible value from `rand()` / `mt_rand()` (`2147483647`). | `echo getrandmax();` |
| `bindec($bin)` | Converts a binary string to decimal integer. | `echo bindec("101010"); // 42` |
| `octdec($oct)` | Converts an octal string to decimal integer. | `echo octdec("755"); // 493` |
| `hexdec($hex)` | Converts a hexadecimal string to decimal integer. | `echo hexdec("ff"); // 255` |
| `decbin($num)` | Converts an integer to a binary string. | `echo decbin(42); // "101010"` |
| `decoct($num)` | Converts an integer to an octal string. | `echo decoct(493); // "755"` |
| `dechex($num)` | Converts an integer to a hexadecimal string. | `echo dechex(255); // "ff"` |
| `base_convert($num, $from, $to)` | Converts a number string arbitrarily between bases 2 and 36 (uses `BigInt` precision). | `echo base_convert("ff", 16, 2); // "11111111"` |

---

## 5. Dates, Times & Oracle-Style Formatters

Combines Uniter core time functions with Oracle-compatible date/number helpers in `dates.php`.

| Command | Description | Example |
|---|---|---|
| `time()` | Returns the current Unix timestamp in whole seconds. | `echo time();` |
| `microtime($as_float = false)` | Returns current Unix timestamp with microseconds (string or float if `$as_float = true`). | `$t0 = microtime(true);` |
| `usleep($microseconds)` | Delays execution asynchronously for the specified number of microseconds. | `usleep(250000); // 0.25s` |
| `sysdate($format = null)` | Returns current local date/time formatted with an Oracle date mask (defaults to `YYYY-MM-DD HH24:MI:SS`). | `echo sysdate("DD-MON-YYYY HH24:MI");` |
| `to_date($str, $format = null)` | Parses a date string using an Oracle format (`DD`, `MON`, `MONTH`, `YYYY`, `RR`, `HH12`, `HH24`, `MI`, `SS`, `AM`/`PM`) and normalizes to `YYYY-MM-DD HH24:MI:SS`. | `echo to_date("21-NOV-2026", "DD-MON-YYYY");` |
| `to_char($val, $format = null)` | Formats either a date string or a number using Oracle masks (`YYYY-MM-DD HH24:MI:SS`, `Day, Month DD`, `9,999.99`, `00000`, `$999.99`). | `echo to_char(1234.5, "9,999.99"); // "1,234.50"` |
| `date_to_number($str, $format = null)` | Converts a date string into numeric Unix seconds (integer). | `$ts = date_to_number("2026-11-22 12:00:00");` |
| `number_to_date($num, $format = null)` | Converts numeric Unix seconds back into an Oracle-formatted date string. | `echo number_to_date($ts, "DD-MON-YYYY HH24:MI:SS");` |

---

## 6. Files, Directories & Streams (`localStorage` VFS)

Persistent browser filesystem backed by `localStorage` (`vfs.js` + `files.php` + Uniter core checks).

### High-Level File & Path Helpers

| Command | Description | Example |
|---|---|---|
| `file_get_contents($file)` | Reads entire file contents into a string, or `false` if missing. | `$txt = file_get_contents("/tmp/note.txt");` |
| `file_put_contents($file, $data, $flags = 0)` | Writes a string (or array of strings) to a file; pass `FILE_APPEND` to append. Returns byte count. | `file_put_contents("/tmp/note.txt", "Hi\n", FILE_APPEND);` |
| `file($file, $flags = 0)` | Reads a file into an array of lines (supports `FILE_IGNORE_NEW_LINES \| FILE_SKIP_EMPTY_LINES`). | `$lines = file("/tmp/note.txt", FILE_IGNORE_NEW_LINES);` |
| `file_exists($path)` | Returns `true` if a file or directory exists in VFS. | `if (file_exists("/tmp/note.txt")) echo "Exists";` |
| `is_file($path)` | Returns `true` if path exists and is a regular file. | `var_dump(is_file("/tmp/note.txt"));` |
| `is_dir($path)` | Returns `true` if path exists and is a directory. | `var_dump(is_dir("/tmp"));` |
| `filesize($file)` | Returns size in bytes of a VFS file, or `false`. | `echo filesize("/tmp/note.txt");` |
| `filemtime($file)` | Returns last modification Unix timestamp (seconds) of a file or directory. | `echo filemtime("/tmp/note.txt");` |
| `touch($file, $mtime = null)` | Creates an empty file if missing and updates its modification timestamp. | `touch("/tmp/stamp.txt");` |
| `copy($src, $dest)` | Copies a file from `$src` to `$dest` in VFS. | `copy("/tmp/a.txt", "/tmp/b.txt");` |
| `rename($old, $new)` | Moves or renames a file or directory in VFS. | `rename("/tmp/b.txt", "/tmp/c.txt");` |
| `unlink($file)` | Deletes a file from VFS. | `unlink("/tmp/c.txt");` |

### Directories & Paths

| Command | Description | Example |
|---|---|---|
| `mkdir($dir, $perm = 0777, $recursive = false)` | Creates a directory; set `$recursive = true` to create parent directories. | `mkdir("/tmp/app/logs", 0777, true);` |
| `rmdir($dir)` | Removes an empty directory. | `rmdir("/tmp/app/logs");` |
| `scandir($dir, $order = 0)` | Lists `.` , `..`, and entries inside `$dir` (`1` sorts descending, `2` unsorted). | `$entries = scandir("/tmp");` |
| `glob($pattern)` | Finds paths matching wildcards (`*`, `?`, `[abc]`). | `$logs = glob("/tmp/*.txt");` |
| `getcwd()` | Returns the current working VFS directory. | `echo getcwd(); // "/"` |
| `pwd()` | Bash-style alias for `getcwd()`. | `echo pwd(); // "/"` |
| `chdir($dir)` | Changes the current working VFS directory. | `chdir("/tmp");` |
| `cd($dir = "/")` | Bash-style wrapper for `chdir()`; defaults to `"/"` when called with no arguments. | `cd("/tmp"); cd("..");` |
| `ls($path = null, $long = false)` | Lists entries in `$path` (defaults to `getcwd()`, omitting `.` and `..`; supports glob patterns and `$long = true` metadata arrays). | `var_export(ls("/tmp"));` or `foreach (ls() as $f) echo "$f\n";` |
| `realpath($path)` | Resolves `.` / `..` / relative paths to a canonical VFS path, or `false` if nonexistent. | `echo realpath("../tmp/note.txt");` |
| `basename($path, $suffix = "")` | Returns the trailing filename component (optionally stripping `$suffix`). | `echo basename("/var/log/app.log", ".log"); // "app"` |
| `dirname($path)` | Returns the parent directory portion of a path. | `echo dirname("/var/log/app.log"); // "/var/log"` |

### Low-Level File Streams

| Command | Description | Example |
|---|---|---|
| `fopen($file, $mode)` | Opens a VFS file stream (`r`, `r+`, `w`, `w+`, `a`, `a+`, `x`, `x+`, `c`, `c+`). | `$fp = fopen("/tmp/data.txt", "w+");` |
| `fwrite($fp, $str, $len = null)` | Writes string data to stream at current pointer and returns bytes written. | `fwrite($fp, "alpha\nbeta\n");` |
| `fputs($fp, $str, $len = null)` | Alias for `fwrite()`. | `fputs($fp, "gamma\n");` |
| `fread($fp, $length)` | Reads up to `$length` bytes from stream. | `$chunk = fread($fp, 5);` |
| `fgets($fp, $length = null)` | Reads one line (up to `\n` or EOF) from stream. | `$line = fgets($fp);` |
| `fgetc($fp)` | Reads a single character from stream, or `false` at EOF. | `$ch = fgetc($fp);` |
| `fseek($fp, $offset, $whence = SEEK_SET)` | Moves stream file pointer (`SEEK_SET`, `SEEK_CUR`, `SEEK_END`). Returns `0` on success. | `fseek($fp, 0, SEEK_SET);` |
| `ftell($fp)` | Returns the current byte offset of the stream pointer. | `echo ftell($fp);` |
| `rewind($fp)` | Resets stream pointer back to byte `0`. | `rewind($fp);` |
| `feof($fp)` | Returns `true` if stream pointer is at or past end-of-file. | `while (!feof($fp)) { echo fgets($fp); }` |
| `ftruncate($fp, $size)` | Truncates or null-pads an open writable stream to `$size` bytes. | `ftruncate($fp, 10);` |
| `fflush($fp)` | Flushes stream buffer to `localStorage` VFS. | `fflush($fp);` |
| `fpassthru($fp)` | Outputs all remaining data from current position to EOF and returns byte count. | `fpassthru($fp);` |
| `fclose($fp)` | Closes an open stream resource. | `fclose($fp);` |

---

## 7. Screen, Terminal & Cursor Control (2D Framebuffer)

Provides terminal geometry queries and an Option 2 2D character grid framebuffer overlay (`screen.php` + `screen_buffer.js`). Supports cursor positioning, `cls()`, and ANSI escape codes (`ESC[H`, `ESC[row;colH`, `ESC[A/B/C/D`, `ESC[2J`, `ESC[K`). Press **ESC** or call `screen_mode(false)` to return to the normal REPL.

| Command | Description | Example |
|---|---|---|
| `screen_columns()` | Returns terminal width in character columns. | `echo screen_columns();` |
| `screen_lines()` | Returns terminal height in character rows. | `echo screen_lines();` |
| `screen_mode($enabled = null)` | Gets active mode (`bool`) when called with no args, or switches between 2D framebuffer (`true`) and normal REPL (`false`). | `screen_mode(true);` |
| `cls()` | Clears the 2D screen framebuffer (and resets cursor to `(1, 1)`) or clears the jQuery Terminal in REPL mode. | `cls();` |
| `locate($row, $col = 1)` | Activates 2D screen mode if needed and moves cursor to 1-based `($row, $col)`. | `locate(5, 10); echo "Menu";` |
| `gotoxy($x, $y)` | Alias for `locate($y, $x)` taking `(column, row)` order like Turbo Pascal / C `conio`. | `gotoxy(10, 5); echo "Here";` |
| `cursor_row()` | Returns the current 1-based cursor row inside the screen framebuffer. | `echo cursor_row();` |
| `cursor_col()` | Returns the current 1-based cursor column inside the screen framebuffer. | `echo cursor_col();` |
| `screen_line($row)` | Returns the plain text contents currently rendered on 1-based `$row`. | `echo trim(screen_line(5));` |

---

## 8. SQLite3 & PDO Databases (Zero-WASM MiniSQL)

In-memory (`:memory:`) or `localStorage`-VFS-persisted relational SQL engine implemented in pure JavaScript (`minisql.js`) and exposed via PHP `SQLite3` and `PDO` classes (`sqlite.php`). Supports `CREATE TABLE`, `DROP TABLE`, `ALTER TABLE`, `INSERT`, `SELECT` (`JOIN`, `WHERE`, `LIKE`, `IN`, `BETWEEN`, `IS NULL`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, aggregates `COUNT`/`SUM`/`AVG`/`MIN`/`MAX`), `UPDATE`, `DELETE`, `BEGIN TRANSACTION`/`COMMIT`/`ROLLBACK`, and `sqlite_master`.

### `SQLite3` Class

| Method | Description | Example |
|---|---|---|
| `new SQLite3($filename = ':memory:')` | Opens or creates an in-memory or VFS-backed SQLite database. | `$db = new SQLite3('/tmp/app.db');` |
| `$db->open($filename = ':memory:')` | Reopens or switches to another database file. | `$db->open(':memory:');` |
| `$db->close()` | Closes the database connection and flushes VFS state. | `$db->close();` |
| `$db->exec($query)` | Executes non-SELECT SQL (`CREATE`, `INSERT`, `UPDATE`, `DELETE`) and returns boolean success. | `$db->exec("CREATE TABLE t (id INT PRIMARY KEY, name TEXT)");` |
| `$db->query($query)` | Executes a SQL query and returns a `SQLite3Result` object. | `$res = $db->query("SELECT * FROM t");` |
| `$db->querySingle($query, $entire_row = false)` | Returns first column of first row, or associative row if `$entire_row = true`. | `$cnt = $db->querySingle("SELECT COUNT(*) FROM t");` |
| `$db->prepare($query)` | Compiles a parameterized statement returning `SQLite3Stmt`. | `$stmt = $db->prepare("SELECT * FROM t WHERE id = :id");` |
| `$db->lastInsertRowID()` | Returns the row ID inserted by the most recent `INSERT`. | `$id = $db->lastInsertRowID();` |
| `$db->changes()` | Returns the number of rows modified by the most recent `INSERT`/`UPDATE`/`DELETE`. | `echo $db->changes();` |

### `SQLite3Stmt` & `SQLite3Result` Methods

| Method | Description | Example |
|---|---|---|
| `$stmt->bindValue($param, $val, $type = null)` | Binds a value to a named (`:name`) or positional (`?` 1-based) placeholder. | `$stmt->bindValue(':id', 1);` |
| `$stmt->bindParam($param, &$var, $type = null)` | Binds a variable/value to a placeholder. | `$stmt->bindParam(1, $name);` |
| `$stmt->execute()` | Executes the prepared statement and returns a `SQLite3Result`. | `$res = $stmt->execute();` |
| `$stmt->clear()` / `reset()` / `close()` | Clears bound parameters, resets execution, or closes the statement. | `$stmt->close();` |
| `$res->fetchArray($mode = SQLITE3_BOTH)` | Fetches next row (`SQLITE3_ASSOC`, `SQLITE3_NUM`, `SQLITE3_BOTH`) or `false`. | `while ($row = $res->fetchArray(SQLITE3_ASSOC)) { ... }` |
| `$res->numColumns()` | Returns number of columns in the result set. | `echo $res->numColumns();` |
| `$res->columnName($i)` | Returns the column name at 0-based index `$i`. | `echo $res->columnName(0);` |
| `$res->reset()` / `finalize()` | Resets result cursor to row 0 or frees the result set. | `$res->finalize();` |

### `PDO` & `PDOStatement` Classes (`PDOException` extends `Exception`)

| Method | Description | Example |
|---|---|---|
| `new PDO($dsn, ...)` | Opens a SQLite connection (e.g. `'sqlite:/tmp/app.db'` or `'sqlite::memory:'`). | `$pdo = new PDO('sqlite:/tmp/app.db');` |
| `$pdo->exec($sql)` | Executes a SQL statement and returns number of affected rows. | `$n = $pdo->exec("DELETE FROM t WHERE id = 1");` |
| `$pdo->query($sql, $mode = null)` | Executes a query and returns a `PDOStatement`. | `$stmt = $pdo->query("SELECT name FROM t");` |
| `$pdo->prepare($sql, $opts = [])` | Prepares a parameterized SQL statement returning `PDOStatement`. | `$st = $pdo->prepare("INSERT INTO t (name) VALUES (?)");` |
| `$pdo->beginTransaction()` / `commit()` / `rollBack()` | Starts, commits, or rolls back a transaction. | `$pdo->beginTransaction(); $pdo->rollBack();` |
| `$pdo->lastInsertId($name = null)` | Returns the last inserted row ID as a string. | `$id = $pdo->lastInsertId();` |
| `$pdo->quote($str, $type = PDO::PARAM_STR)` | Quotes and escapes a string literal for SQL. | `echo $pdo->quote("O'Reilly");` |
| `$st->bindValue(...)` / `bindParam(...)` | Binds parameters by 1-based `?` index or `:name`. | `$st->bindValue(':name', 'Alice');` |
| `$st->execute($params = null)` | Executes a prepared `PDOStatement` (optionally passing parameter array). | `$st->execute(['Alice']);` |
| `$st->fetch($mode = PDO::FETCH_BOTH)` | Fetches next row (`PDO::FETCH_ASSOC`, `NUM`, `BOTH`, `COLUMN`), or `false`. | `$row = $st->fetch(PDO::FETCH_ASSOC);` |
| `$st->fetchAll($mode = null)` | Returns an array of all remaining rows. | `$rows = $st->fetchAll(PDO::FETCH_ASSOC);` |
| `$st->fetchColumn($col = 0)` | Returns a single column from the next row, or `false`. | `$cnt = (int) $st->fetchColumn();` |
| `$st->rowCount()` / `columnCount()` / `closeCursor()` | Returns affected/result row count, column count, or resets/closes cursor. | `echo $st->rowCount();` |

---

## 9. Cron Scheduling

Browser-hosted minute-level PHP job scheduler (`cron.php` + `php_bridge.js`).

| Command | Description | Example |
|---|---|---|
| `cron()` | Lists all currently scheduled cron jobs as an associative array keyed by job ID. | `var_export(cron());` |
| `cron($id, $schedule, $code)` | Registers or updates a job with a 5-field cron schedule (or `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`) and PHP code string or closure. | `cron(1, "* * * * *", "echo sysdate() . \"\\n\";");` |
| `cron($id)` | Deletes the scheduled job with ID `$id`; returns `true` if deleted, `false` if missing. | `cron(1);` |

---

## 10. Interactive I/O, Terminal & Browser Bridge Helpers

Special PHP variables exposed by `index.html` and `stdlib.php` to connect PHP directly to jQuery Terminal, interactive prompts, DOM/CSS, HTTP fetch, and dynamic includes.

| Command / Global | Description | Example |
|---|---|---|
| `$io->read($prompt, $secret = false)` | Prompts the user for terminal input synchronously in async Uniter mode; masks with `*` if `$secret` is `true`. | `$name = $io->read("Name: ");` |
| `$io->readline($prompt, $cb = null, $secret = false)` | Non-blocking or promise-based line reader with optional callback `function($line)`. | `$io->readline("Cmd: ", function($s){ echo $s; });` |
| `myinput($prompt, $secret = false)` | Convenience wrapper around `$io->read()` defined in `stdlib.php`. | `$pw = myinput("Password: ", true);` |
| `$maskaan($arg)` / `$maskuit($arg)` | Enables (`*`) or disables jQuery Terminal input masking (`stdlib` helpers). | `$maskaan(true);` |
| `$term` | Exposed jQuery Terminal instance (`cols()`, `rows()`, `echo()`, `clear()`, `geometry()`, etc.). | `echo $term->cols() . "x" . $term->rows();` |
| `$jQuery` | Exposed browser jQuery (`$`) function for DOM querying and CSS styling. | `$jQuery("body")->css("color", "#0f0");` |
| `$includePhp($url)` | Fetches a PHP file over HTTP, strips leading `<?php`, and executes it in the active engine. | `$includePhp("screen_demo.php");` |
| `$include_remote($url)` | Alias for `$includePhp()`. | `$include_remote("example.php");` |
| `$bridge` | Underlying JS runtime bridge (`version`, `getStyle`, `setText`, `fetchText`, `cronMatches`, VFS, SQL, Screen helpers). | `$bridge->setText("title", "My PHP App");` |
| `$meta` | Runtime metadata object (`engine => 'Uniter'`, `environment => 'browser'`). | `echo $meta->engine;` |

---

## 11. Types, Introspection, Reflection & Callables

Core Uniter functions plus the enhanced `get_defined_functions()` registered in `php_bridge.js`.

### Type Checking & Debugging

| Command | Description | Example |
|---|---|---|
| `gettype($var)` | Returns type name (`"integer"`, `"double"`, `"string"`, `"boolean"`, `"array"`, `"object"`, `"resource"`, `"NULL"`). | `echo gettype(3.14); // "double"` |
| `is_null($var)` | Checks if `$var === null`. | `var_dump(is_null(null));` |
| `is_bool($var)` | Checks if value is boolean. | `var_dump(is_bool(true));` |
| `is_int($var)` / `is_integer($var)` | Checks if value is an integer. | `var_dump(is_int(42));` |
| `is_float($var)` | Checks if value is a floating-point number. | `var_dump(is_float(1.5));` |
| `is_numeric($var)` | Checks if value is a number or numeric string. | `var_dump(is_numeric("42.5"));` |
| `is_string($var)` | Checks if value is a string. | `var_dump(is_string("abc"));` |
| `is_array($var)` | Checks if value is an array. | `var_dump(is_array([1, 2]));` |
| `is_object($var)` | Checks if value is an object instance. | `var_dump(is_object(new stdClass()));` |
| `is_resource($var)` | Checks if value is an open resource (such as a file stream). | `var_dump(is_resource($fp));` |
| `get_resource_type($res)` | Returns resource type string (e.g., `"stream"`). | `echo get_resource_type($fp);` |
| `is_callable($var)` | Checks if variable is a valid function/closure/method callable. | `var_dump(is_callable("strlen"));` |
| `var_dump($var)` | Prints type and structured representation of a single variable. | `var_dump(["a" => 1]);` |
| `var_export($var, $return = false)` | Outputs or returns valid PHP code representing `$var`. | `$s = var_export([1, 2], true);` |

### Symbols, Classes, Constants & Callables

| Command | Description | Example |
|---|---|---|
| `define($name, $val)` | Defines a global runtime constant at execution time. | `define("APP_ENV", "dev");` |
| `defined($name)` | Returns `true` if a named constant has been defined. | `if (defined("APP_ENV")) echo APP_ENV;` |
| `function_exists($name)` | Checks if a built-in or user-defined function exists. | `if (function_exists("cls")) cls();` |
| `class_exists($name, $autoload = true)` | Checks if a class has been declared. | `if (class_exists("PDO")) echo "PDO ready";` |
| `get_class($obj)` | Returns the class name of an object. | `echo get_class($db); // "SQLite3"` |
| `is_a($obj, $class)` | Checks whether `$obj` is an instance of `$class` or its subclass. | `var_dump(is_a(new PDOException(), "Exception"));` |
| `get_defined_functions()` | Returns `['internal' => [...], 'user' => [...]]` listing every internal and user function. | `$fns = get_defined_functions(); echo count($fns['user']);` |
| `call_user_func($cb, ...$args)` | Calls a callback passing individual arguments. | `echo call_user_func("strtoupper", "hi");` |
| `call_user_func_array($cb, $args)` | Calls a callback passing arguments from an array. | `echo call_user_func_array("sprintf", ["%s:%d", "x", 9]);` |
| `func_num_args()` | Returns the number of arguments passed to the current function. | `function f() { return func_num_args(); }` |
| `func_get_args()` | Returns an array of all arguments passed to the current function. | `function sum() { return array_sum(func_get_args()); }` |
| `spl_autoload_register($cb = null)` | Registers an autoloader callback invoked when an unknown class is referenced. | `spl_autoload_register(function($c){ include $c.".php"; });` |
| `spl_autoload_unregister($cb)` | Unregisters a previously registered SPL autoloader. | `spl_autoload_unregister($loader);` |
| `spl_object_hash($obj)` | Returns a unique identifier hash string for an object instance. | `echo spl_object_hash($db);` |

---

## 12. Output Buffering

Capture, inspect, discard, or flush stdout inside PHP scripts.

| Command | Description | Example |
|---|---|---|
| `ob_start($cb = null)` | Turns on output buffering (nestable). | `ob_start(); echo "buffered";` |
| `ob_get_contents()` | Returns the contents of the current output buffer without clearing it. | `$out = ob_get_contents();` |
| `ob_get_clean()` | Returns the current buffer contents and deletes/closes the buffer. | `$html = ob_get_clean();` |
| `ob_get_flush()` | Flushes the current buffer to stdout, returns its string contents, and closes it. | `$out = ob_get_flush();` |
| `ob_clean()` | Erases the contents of the current buffer without ending buffering. | `ob_clean();` |
| `ob_end_clean()` | Discards the current buffer contents and turns off that buffering level. | `ob_end_clean();` |
| `ob_flush()` | Sends the current buffer contents to the next level or stdout without closing it. | `ob_flush();` |
| `ob_end_flush()` | Sends the current buffer contents out and closes that buffering level. | `ob_end_flush();` |
| `ob_get_level()` | Returns the current nesting level of output buffering (`0` when inactive). | `echo ob_get_level();` |

---

## 13. URLs, Environment, Runtime Config & Errors

| Command | Description | Example |
|---|---|---|
| `parse_url($url, $component = -1)` | Parses a URL into scheme, host, port, user, pass, path, query, fragment. | `$u = parse_url("https://example.com/a?x=1");` |
| `getenv($name = null)` | Gets an environment variable if defined in the Uniter environment. | `$v = getenv("PATH");` |
| `ini_get($option)` | Gets the value of a PHP configuration setting. | `echo ini_get("include_path");` |
| `ini_set($option, $val)` | Sets a PHP configuration option and returns its old value. | `ini_set("display_errors", "1");` |
| `get_cfg_var($option)` | Gets a configuration option value from runtime config. | `echo get_cfg_var("include_path");` |
| `get_include_path()` | Gets the current `include_path` configuration option. | `echo get_include_path();` |
| `set_include_path($new_path)` | Sets the `include_path` configuration option. | `set_include_path(".:/lib");` |
| `get_loaded_extensions()` | Returns an array of loaded Uniter extension names. | `var_export(get_loaded_extensions());` |
| `phpversion()` | Returns the reported PHP version string. | `echo phpversion();` |
| `zend_version()` | Returns the reported Zend engine version string. | `echo zend_version();` |
| `php_uname($mode = "a")` | Returns system/environment information string. | `echo php_uname();` |
| `error_reporting($level = null)` | Gets or sets the active PHP error reporting bitmask. | `error_reporting(E_ALL);` |
| `trigger_error($msg, $type = E_USER_NOTICE)` | Generates a user-level error, warning, or notice message. | `trigger_error("Check input", E_USER_WARNING);` |

---

## 14. Constants Reference

Predefined constants registered across `vfs.js`, `math.php`, `arrays.php`, `sqlite.php`, and Uniter core:

- **Files & Streams (`vfs.js`):**
  `SEEK_SET` (`0`), `SEEK_CUR` (`1`), `SEEK_END` (`2`), `FILE_APPEND` (`8`), `FILE_IGNORE_NEW_LINES` (`2`), `FILE_SKIP_EMPTY_LINES` (`4`), `LOCK_EX` (`2`), `SCANDIR_SORT_ASCENDING` (`0`), `SCANDIR_SORT_DESCENDING` (`1`), `SCANDIR_SORT_NONE` (`2`), `DIRECTORY_SEPARATOR` (`'/'`), `PHP_EOL` (`"\n"`)
- **Arrays & Sorting (`arrays.php` / core):**
  `CASE_LOWER` (`0`), `CASE_UPPER` (`1`), `SORT_REGULAR`, `SORT_NUMERIC` (`1`), `SORT_STRING`, `SORT_NATURAL`, `SORT_ASC` (`4`), `SORT_DESC` (`3`)
- **Math (`math.php`):**
  `M_E`, `M_LOG2E`, `M_LOG10E`, `M_LN2`, `M_LN10`, `M_PI`, `M_PI_2`, `M_PI_4`, `M_1_PI`, `M_2_PI`, `M_SQRTPI`, `M_2_SQRTPI`, `M_SQRT2`, `M_SQRT3`, `M_SQRT1_2`, `M_LNPI`, `M_EULER`, `PHP_ROUND_HALF_UP` (`1`), `PHP_ROUND_HALF_DOWN` (`2`), `PHP_ROUND_HALF_EVEN` (`3`), `PHP_ROUND_HALF_ODD` (`4`), `INF`, `NAN`
- **SQLite3 (`sqlite.php`):**
  `SQLITE3_ASSOC` (`1`), `SQLITE3_NUM` (`2`), `SQLITE3_BOTH` (`3`), `SQLITE3_INTEGER` (`1`), `SQLITE3_FLOAT` (`2`), `SQLITE3_TEXT` (`3`), `SQLITE3_BLOB` (`4`), `SQLITE3_NULL` (`5`)
- **PDO Class Constants (`PDO::*` in `sqlite.php`):**
  `PDO::FETCH_ASSOC` (`2`), `PDO::FETCH_NUM` (`3`), `PDO::FETCH_BOTH` (`4`), `PDO::FETCH_COLUMN` (`7`), `PDO::PARAM_NULL` (`0`), `PDO::PARAM_INT` (`1`), `PDO::PARAM_STR` (`2`), `PDO::PARAM_BOOL` (`5`)

---

## 15. Standalone Scripts & Unit Tests

Run these scripts directly from the `php >` prompt with `include '...'` (or `$includePhp('...')`) without keeping test functions permanently loaded in memory:

| Script | Purpose | Example |
|---|---|---|
| `example.php` | Comprehensive walkthrough of every subsystem and all 8 test suites. | `include 'example.php';` |
| `screen_demo.php` | Interactive 2D framebuffer demo using `screen_mode()`, `cls()`, `locate()`, `gotoxy()`, ANSI escapes, and `screen_line()`. Call `screen_demo();` after including. | `include 'screen_demo.php'; screen_demo();` |
| `unit_test_string.php` | Runs 53 string and Perl `split()` assertions (`$unit_test_verbose = true;` for detailed output). | `include 'unit_test_string.php';` |
| `unit_test_date.php` | Runs 16 Oracle date/number formatting and conversion assertions. | `include 'unit_test_date.php';` |
| `unit_test_cron.php` | Runs 11 cron registration, override, deletion, and matcher assertions. | `include 'unit_test_cron.php';` |
| `unit_test_file.php` | Runs 19 VFS file, directory, `cd()`/`pwd()`/`ls()`, stream, `glob()`, and `include()` assertions. | `include 'unit_test_file.php';` |
| `unit_test_math.php` | Runs 15 math, trig, rounding, PRNG, and base-conversion assertions. | `include 'unit_test_math.php';` |
| `unit_test_array.php` | Runs 17 array transform, set, reduction, and sort assertions. | `include 'unit_test_array.php';` |
| `unit_test_sqlite.php` | Runs 7 `SQLite3` and `PDO` SQL/transaction/JOIN persistence assertions. | `include 'unit_test_sqlite.php';` |
| `unit_test_screen.php` | Runs 10 screen geometry, framebuffer, `locate()`, `gotoxy()`, and ANSI assertions. | `include 'unit_test_screen.php';` |
