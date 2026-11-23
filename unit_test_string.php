<?php
return call_user_func(function($verbose) {
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
		['split(",", "a,b,c")', split(',', 'a,b,c'), ['a', 'b', 'c']],
		['split(",", "a,b,,") strips trailing empties', split(',', 'a,b,,'), ['a', 'b']],
		['split(",", "a,b,,", -1) keeps trailing empties', split(',', 'a,b,,', -1), ['a', 'b', '', '']],
		['split(",", "a,b,c,d", 2) preserves remainder', split(',', 'a,b,c,d', 2), ['a', 'b,c,d']],
		['split(" ", "  foo   bar  ") Perl space mode', split(' ', '  foo   bar  '), ['foo', 'bar']],
		['split("  foo   bar  ") 1-arg whitespace split', split('  foo   bar  '), ['foo', 'bar']],
		['split("/[,;]\\s*/", "red, green;blue") delimited regex', split('/[,;]\s*/', 'red, green;blue'), ['red', 'green', 'blue']],
		['split("/([+-])/", "10+20-30") capturing groups', split('/([+-])/', '10+20-30'), ['10', '+', '20', '-', '30']],
		['split("", "abc") splits characters', split('', 'abc'), ['a', 'b', 'c']],
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

	echo "unit_test_string.php: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}, isset($unit_test_verbose) && $unit_test_verbose);
