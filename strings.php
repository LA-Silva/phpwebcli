function hello123() {
	echo "hello srings";
}

function len($str) {
	return strlen((string) $str);
}

function left($str, $length) {
	$s = (string) $str;
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	return substr($s, 0, $n);
}

function right($str, $length) {
	$s = (string) $str;
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	$total = strlen($s);
	if ($n >= $total) {
		return $s;
	}
	return substr($s, -$n);
}

function mid($str, $start, $length = null) {
	$s = (string) $str;
	$pos = (int) $start;
	if ($pos < 1) {
		$pos = 1;
	}
	$offset = $pos - 1;
	$total = strlen($s);
	if ($offset >= $total) {
		return '';
	}
	if ($length === null) {
		return substr($s, $offset);
	}
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	return substr($s, $offset, $n);
}

function instr($arg1, $arg2, $arg3 = null) {
	if ($arg3 !== null) {
		if (is_int($arg1)) {
			$start = $arg1;
			$haystack = (string) $arg2;
			$needle = (string) $arg3;
		} else {
			$haystack = (string) $arg1;
			$needle = (string) $arg2;
			$start = (int) $arg3;
		}
	} else {
		$start = 1;
		$haystack = (string) $arg1;
		$needle = (string) $arg2;
	}

	if ($start < 1) {
		return 0;
	}

	$offset = $start - 1;
	$hayLen = strlen($haystack);
	if ($offset > $hayLen) {
		return 0;
	}

	if ($needle === '') {
		return $hayLen === 0 ? 0 : $start;
	}

	$pos = strpos($haystack, $needle, $offset);
	return $pos === false ? 0 : $pos + 1;
}

function lower($str) {
	return strtolower((string) $str);
}

function upper($str) {
	return strtoupper((string) $str);
}

function chr($code) {
	global $bridge;
	return $bridge->fromCharCode((int) $code);
}

function val($str) {
	$f = (float) $str;
	if ($f >= -2147483648 && $f <= 2147483647 && (int) $f == $f) {
		return (int) $f;
	}
	return $f;
}

if (!function_exists('ltrim')) {
	function ltrim($str, $characters = null) {
		$s = (string) $str;
		$chars = $characters === null
			? " \n\r\t" . chr(11) . chr(0)
			: (string) $characters;
		$total = strlen($s);
		$i = 0;
		while ($i < $total && strpos($chars, substr($s, $i, 1)) !== false) {
			$i++;
		}
		return substr($s, $i);
	}
}

if (!function_exists('rtrim')) {
	function rtrim($str, $characters = null) {
		$s = (string) $str;
		$chars = $characters === null
			? " \n\r\t" . chr(11) . chr(0)
			: (string) $characters;
		$i = strlen($s) - 1;
		while ($i >= 0 && strpos($chars, substr($s, $i, 1)) !== false) {
			$i--;
		}
		return substr($s, 0, $i + 1);
	}
}

if (!function_exists('strcmp')) {
	function strcmp($str1, $str2) {
		global $bridge;
		return $bridge->strcmp((string) $str1, (string) $str2);
	}
}

if (!function_exists('stricmp')) {
	function stricmp($str1, $str2) {
		return strcmp(strtolower((string) $str1), strtolower((string) $str2));
	}
}

function space($count) {
	$n = (int) $count;
	if ($n <= 0) {
		return '';
	}
	$out = '';
	for ($i = 0; $i < $n; $i++) {
		$out .= ' ';
	}
	return $out;
}

function unit_test($verbose = false) {
	$cases = [
		['len("hello")', len('hello'), 5],
		['len("")', len(''), 0],
		['left("hello", 2)', left('hello', 2), 'he'],
		['left("hello", 0)', left('hello', 0), ''],
		['left("hello", -3)', left('hello', -3), ''],
		['left("hello", 99)', left('hello', 99), 'hello'],
		['right("hello", 2)', right('hello', 2), 'lo'],
		['right("hello", 0)', right('hello', 0), ''],
		['right("hello", -3)', right('hello', -3), ''],
		['right("hello", 99)', right('hello', 99), 'hello'],
		['mid("abcdef", 1, 3)', mid('abcdef', 1, 3), 'abc'],
		['mid("abcdef", 3, 2)', mid('abcdef', 3, 2), 'cd'],
		['mid("abcdef", 3)', mid('abcdef', 3), 'cdef'],
		['mid("abcdef", 10, 2)', mid('abcdef', 10, 2), ''],
		['mid("abcdef", 2, 0)', mid('abcdef', 2, 0), ''],
		['instr("hello world", "world")', instr('hello world', 'world'), 7],
		['instr("hello", "xyz")', instr('hello', 'xyz'), 0],
		['instr(3, "banana", "na")', instr(3, 'banana', 'na'), 3],
		['instr(4, "banana", "na")', instr(4, 'banana', 'na'), 5],
		['instr("banana", "na", 4)', instr('banana', 'na', 4), 5],
		['instr(2, "12345", "34")', instr(2, '12345', '34'), 3],
		['instr(0, "hello", "h")', instr(0, 'hello', 'h'), 0],
		['lower("Hello World!")', lower('Hello World!'), 'hello world!'],
		['upper("Hello World!")', upper('Hello World!'), 'HELLO WORLD!'],
		['chr(65)', chr(65), 'A'],
		['chr(97)', chr(97), 'a'],
		['chr(321)', chr(321), 'A'],
		['val("42")', val('42'), 42],
		['val("  -3.14abc")', val('  -3.14abc'), -3.14],
		['val("abc")', val('abc'), 0],
		['ltrim("  hello  ")', ltrim("  hello  "), 'hello  '],
		['ltrim("00042", "0")', ltrim('00042', '0'), '42'],
		['rtrim("  hello  ")', rtrim("  hello  "), '  hello'],
		['rtrim("hello...", ".")', rtrim('hello...', '.'), 'hello'],
		['strcmp("abc", "abc")', strcmp('abc', 'abc'), 0],
		['strcmp("10", "2") < 0', strcmp('10', '2') < 0, true],
		['strcmp("b", "a") > 0', strcmp('b', 'a') > 0, true],
		['stricmp("Hello", "hello")', stricmp('Hello', 'hello'), 0],
		['stricmp("abc", "ABD") < 0', stricmp('abc', 'ABD') < 0, true],
		['space(5)', space(5), '     '],
		['space(0)', space(0), ''],
		['space(-2)', space(-2), ''],
		['sprintf("%s-%04d-%.2f-%X-%c", "ok", 7, 3.14159, 255, 65)', sprintf('%s-%04d-%.2f-%X-%c', 'ok', 7, 3.14159, 255, 65), 'ok-0007-3.14-FF-A'],
		['sprintf("100%% %2$s %1$d", 9, "hi")', sprintf('100%% %2$s %1$d', 9, 'hi'), '100% hi 9'],
	];

	$passed = 0;
	$failed = 0;

	foreach ($cases as $case) {
		$label = $case[0];
		$actual = $case[1];
		$expected = $case[2];

		if ($actual === $expected) {
			$passed++;
			if ($verbose) {
				echo "[PASS] " . $label . "\n";
			}
		} else {
			$failed++;
			echo "[FAIL] " . $label . " => got " . var_export($actual, true) . ", expected " . var_export($expected, true) . "\n";
		}
	}

	echo "strings.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}

