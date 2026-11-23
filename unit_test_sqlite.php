<?php
return call_user_func(function($verbose) {
	$dbPath = '/tmp/__sqlite_unit_test.db';
	if (is_file($dbPath)) {
		unlink($dbPath);
	}

	// 1. SQLite3 file-backed create, insert, prepared select, update, delete, persistence
	$db = new SQLite3($dbPath);
	$db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT DEFAULT "member", age INT)');
	$db->exec("INSERT INTO users (name, role, age) VALUES ('Alice', 'admin', 30), ('Bob', 'user', 25), ('Cara', 'user', 35)");
	$lastId = $db->lastInsertRowID();

	$stmt = $db->prepare('SELECT id, name, age FROM users WHERE age >= :minAge ORDER BY age DESC');
	$stmt->bindValue(':minAge', 30);
	$res = $stmt->execute();
	$r1 = $res->fetchArray(SQLITE3_ASSOC);
	$r2 = $res->fetchArray(SQLITE3_ASSOC);
	$r3 = $res->fetchArray(SQLITE3_ASSOC);

	$countVal = $db->querySingle('SELECT COUNT(*) FROM users');
	$db->exec("UPDATE users SET age = age + 1 WHERE name = 'Bob'");
	$updatedChanges = $db->changes();
	$bobAge = $db->querySingle("SELECT age FROM users WHERE name = 'Bob'");

	$db->close();

	// Re-open same VFS database file to verify localStorage persistence
	$db2 = new SQLite3($dbPath);
	$persistedCount = $db2->querySingle('SELECT COUNT(*) FROM users');
	$tables = $db2->querySingle("SELECT name FROM sqlite_master WHERE type = 'table'");
	$db2->close();

	// 2. PDO('sqlite:...') transactions, ROLLBACK, COMMIT, JOIN, GROUP BY, positional ?
	$pdo = new PDO('sqlite:' . $dbPath);
	$pdo->exec('CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INT, total REAL)');
	$ins = $pdo->prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)');
	$ins->execute([1, 50.0]);
	$ins->execute([1, 25.5]);
	$ins->execute([2, 10.0]);

	$pdo->beginTransaction();
	$pdo->exec("DELETE FROM orders WHERE user_id = 2");
	$pdo->rollBack();
	$afterRollbackCount = (int) $pdo->query('SELECT COUNT(*) FROM orders')->fetchColumn();

	$joinStmt = $pdo->query('SELECT u.name, SUM(o.total) AS spent FROM users u INNER JOIN orders o ON u.id = o.user_id GROUP BY u.name ORDER BY spent DESC');
	$spentRows = $joinStmt->fetchAll(PDO::FETCH_ASSOC);

	$likeRows = $pdo->query("SELECT name FROM users WHERE name LIKE 'a%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);

	$pdo = null;
	unlink($dbPath);

	$cases = [
		['SQLite3 autoincrement lastInsertRowID', $lastId, 3],
		['SQLite3 prepared SELECT ORDER BY + bindValue', $r1['name'] === 'Cara' && $r2['name'] === 'Alice' && $r3 === false, true],
		['SQLite3 querySingle COUNT(*) + UPDATE changes', $countVal === 3 && $updatedChanges === 1 && $bobAge === 26, true],
		['SQLite3 persistence across reopen + sqlite_master', $persistedCount === 3 && $tables === 'users', true],
		['PDO transaction ROLLBACK restores deleted rows', $afterRollbackCount, 3],
		['PDO INNER JOIN + GROUP BY + SUM + ORDER BY', count($spentRows) === 2 && $spentRows[0]['name'] === 'Alice' && $spentRows[0]['spent'] == 75.5, true],
		['PDO LIKE case-insensitive + FETCH_COLUMN', $likeRows, ['Alice']],
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

	echo "unit_test_sqlite.php: " . $passed . "/" . count($cases) . " passed\n";
	return $failed === 0;
}, isset($unit_test_verbose) && $unit_test_verbose);
