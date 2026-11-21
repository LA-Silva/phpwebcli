function cron($id = null, $schedule = null, $code = null) {
	global $bridge;
	if ($id === null) {
		$rows = $bridge->cronList();
		$jobs = [];
		foreach ($rows as $row) {
			$jobs[$row[0]] = [
				'id' => $row[0],
				'schedule' => $row[1],
				'code' => $row[2],
			];
		}
		return $jobs;
	}
	if ($schedule === null && $code === null) {
		return $bridge->cronDelete($id);
	}
	return $bridge->cronSet($id, $schedule, $code);
}

function cron_unit_test($verbose = false) {
	global $bridge;

	$created = cron(999, '* * * * *', "echo 'cron_test';");
	$listAfterAdd = cron();
	$overridden = cron(999, '*/5 * * * *', "echo 'cron_updated';");
	$listAfterOverride = cron();
	$deleted = cron(999);
	$deletedMissing = cron(999);
	$listAfterDelete = cron();

	$cases = [
		['cron(999, "* * * * *", ...) returns true', $created, true],
		['cron() lists registered job 999', isset($listAfterAdd['999']) && $listAfterAdd['999']['schedule'] === '* * * * *', true],
		['cron(999, "*/5 * * * *", ...) overrides job 999', $overridden && isset($listAfterOverride['999']) && $listAfterOverride['999']['schedule'] === '*/5 * * * *', true],
		['cron(999) deletes job 999', $deleted && !isset($listAfterDelete['999']), true],
		['cron(999) on missing job returns false', $deletedMissing, false],
		['cronMatches("* * * * *", "2026-11-21 13:45:00")', $bridge->cronMatches('* * * * *', '2026-11-21 13:45:00'), true],
		['cronMatches("*/15 * * * *", "2026-11-21 13:30:00")', $bridge->cronMatches('*/15 * * * *', '2026-11-21 13:30:00'), true],
		['cronMatches("*/15 * * * *", "2026-11-21 13:31:00")', $bridge->cronMatches('*/15 * * * *', '2026-11-21 13:31:00'), false],
		['cronMatches("30 14 21 NOV SAT", "2026-11-21 14:30:00")', $bridge->cronMatches('30 14 21 NOV SAT', '2026-11-21 14:30:00'), true],
		['cronMatches("@daily", "2026-11-21 00:00:00")', $bridge->cronMatches('@daily', '2026-11-21 00:00:00'), true],
		['cronMatches("0 9 * * 1-5", "2026-11-21 09:00:00") (Saturday)', $bridge->cronMatches('0 9 * * 1-5', '2026-11-21 09:00:00'), false],
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

	echo "cron.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}
