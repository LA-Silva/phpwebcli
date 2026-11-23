<?php

if (!function_exists('screen_columns')) {
	function screen_columns() {
		global $bridge;
		return (int) $bridge->screenColumns();
	}
}

if (!function_exists('screen_lines')) {
	function screen_lines() {
		global $bridge;
		return (int) $bridge->screenLines();
	}
}

if (!function_exists('cls')) {
	function cls() {
		global $bridge;
		return (bool) $bridge->screenClear();
	}
}

if (!function_exists('screen_unit_test')) {
	function screen_unit_test($verbose = false) {
		global $term;

		$cols = screen_columns();
		$lines = screen_lines();
		$termCols = (int) $term->cols();
		$termLines = (int) $term->rows();

		$cases = [
			['screen_columns() returns positive int', is_int($cols) && $cols > 0, true],
			['screen_lines() returns positive int', is_int($lines) && $lines > 0, true],
			['screen_columns() matches $term->cols()', $cols, $termCols],
			['screen_lines() matches $term->rows()', $lines, $termLines],
			['cls() function is defined', function_exists('cls'), true],
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

		echo "screen.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
		return $failed === 0;
	}
}
