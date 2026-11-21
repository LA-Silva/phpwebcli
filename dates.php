function sysdate($format = null) {
	global $bridge;
	return $bridge->sysdate($format);
}

function to_date($str, $format = null) {
	global $bridge;
	return $bridge->toDate($str, $format);
}

function to_char($value, $format = null) {
	global $bridge;
	return $bridge->toChar($value, $format);
}

function dates_unit_test($verbose = false) {
	$now = sysdate();
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

	echo "dates.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}
