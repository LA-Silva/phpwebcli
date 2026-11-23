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

