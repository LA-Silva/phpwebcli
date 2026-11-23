<?php
return call_user_func(function($verbose) {
	$now = sysdate();
	$sampleTs = date_to_number('2026-11-22 12:00:06');
	$cases = [
		['sysdate() format YYYY-MM-DD HH24:MI:SS', strlen($now) === 19 && substr($now, 4, 1) === '-' && substr($now, 10, 1) === ' ', true],
		['to_date("21-NOV-2026", "DD-MON-YYYY")', to_date('21-NOV-2026', 'DD-MON-YYYY'), '2026-11-21 00:00:00'],
		['to_date("2026/11/21 02:05:09 PM", "YYYY/MM/DD HH12:MI:SS AM")', to_date('2026/11/21 02:05:09 PM', 'YYYY/MM/DD HH12:MI:SS AM'), '2026-11-21 14:05:09'],
		['to_date("21-NOV-99", "DD-MON-RR")', to_date('21-NOV-99', 'DD-MON-RR'), '1999-11-21 00:00:00'],
		['to_date("2026-11-21") default format', to_date('2026-11-21'), '2026-11-21 00:00:00'],
		['to_char(to_date("2026-11-21 14:05:09", "YYYY-MM-DD HH24:MI:SS"), "DD-MON-YYYY HH24:MI")', to_char(to_date('2026-11-21 14:05:09', 'YYYY-MM-DD HH24:MI:SS'), 'DD-MON-YYYY HH24:MI'), '21-NOV-2026 14:05'],
		['to_char("2026-11-21 14:05:09", "Day, Month DD YYYY HH:MI PM")', to_char('2026-11-21 14:05:09', 'Day, Month DD YYYY HH:MI PM'), 'Saturday, November 21 2026 02:05 PM'],
		['to_char(1234.5, "9,999.99")', to_char(1234.5, '9,999.99'), '1,234.50'],
		['to_char(42, "00000")', to_char(42, '00000'), '00042'],
		['to_char(-99.5, "$999.99")', to_char(-99.5, '$999.99'), '-$99.50'],
		['date_to_number("2026-11-22 12:00:06") returns positive int', is_int($sampleTs) && $sampleTs > 0, true],
		['number_to_date(date_to_number("2026-11-22 12:00:06")) round-trip', number_to_date($sampleTs), '2026-11-22 12:00:06'],
		['date_to_number(number_to_date(1234123)) inverse round-trip', date_to_number(number_to_date(1234123)), 1234123],
		['date_to_number +60s difference', date_to_number('2026-11-22 12:01:06') - $sampleTs, 60],
		['date_to_number with custom format', number_to_date(date_to_number('22-NOV-2026 08:15:30', 'DD-MON-YYYY HH24:MI:SS')), '2026-11-22 08:15:30'],
		['number_to_date with custom format', number_to_date($sampleTs, 'DD-MON-YYYY HH24:MI:SS'), '22-NOV-2026 12:00:06'],
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

	echo "unit_test_date.php: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}, isset($unit_test_verbose) && $unit_test_verbose);
