<?php

if (!defined('SQLITE3_ASSOC')) define('SQLITE3_ASSOC', 1);
if (!defined('SQLITE3_NUM')) define('SQLITE3_NUM', 2);
if (!defined('SQLITE3_BOTH')) define('SQLITE3_BOTH', 3);

if (!defined('SQLITE3_INTEGER')) define('SQLITE3_INTEGER', 1);
if (!defined('SQLITE3_FLOAT')) define('SQLITE3_FLOAT', 2);
if (!defined('SQLITE3_TEXT')) define('SQLITE3_TEXT', 3);
if (!defined('SQLITE3_BLOB')) define('SQLITE3_BLOB', 4);
if (!defined('SQLITE3_NULL')) define('SQLITE3_NULL', 5);

if (!class_exists('SQLite3Result')) {
	class SQLite3Result {
		private $columns = [];
		private $rows = [];
		private $cursor = 0;

		public function __construct($columns = [], $rows = []) {
			$this->columns = is_array($columns) ? $columns : [];
			$this->rows = is_array($rows) ? $rows : [];
			$this->cursor = 0;
		}

		public function numColumns() {
			return count($this->columns);
		}

		public function columnName($column_number) {
			$idx = (int) $column_number;
			return array_key_exists($idx, $this->columns) ? $this->columns[$idx] : false;
		}

		public function fetchArray($mode = null) {
			if ($mode === null) {
				$mode = SQLITE3_BOTH;
			}
			if ($this->cursor >= count($this->rows)) {
				return false;
			}
			$raw = $this->rows[$this->cursor];
			$this->cursor++;
			$out = [];
			$total = count($this->columns);
			for ($i = 0; $i < $total; $i++) {
				$val = array_key_exists($i, $raw) ? $raw[$i] : null;
				if ($mode === SQLITE3_NUM || $mode === SQLITE3_BOTH) {
					$out[$i] = $val;
				}
				if ($mode === SQLITE3_ASSOC || $mode === SQLITE3_BOTH) {
					$out[$this->columns[$i]] = $val;
				}
			}
			return $out;
		}

		public function reset() {
			$this->cursor = 0;
			return true;
		}

		public function finalize() {
			$this->rows = [];
			$this->cursor = 0;
			return true;
		}
	}
}

if (!class_exists('SQLite3Stmt')) {
	class SQLite3Stmt {
		private $connId;
		private $sql;
		private $positional = [];
		private $named = [];

		public function __construct($connId, $sql) {
			$this->connId = $connId;
			$this->sql = (string) $sql;
		}

		public function bindValue($param, $value, $type = null) {
			if (is_int($param)) {
				$this->positional[$param - 1] = $value;
			} else {
				$this->named[(string) $param] = $value;
			}
			return true;
		}

		public function bindParam($param, &$var, $type = null) {
			return $this->bindValue($param, $var, $type);
		}

		public function clear() {
			$this->positional = [];
			$this->named = [];
			return true;
		}

		public function reset() {
			return true;
		}

		public function close() {
			return true;
		}

		public function execute() {
			global $bridge;
			$pos = [];
			ksort($this->positional);
			foreach ($this->positional as $v) {
				$pos[] = $v;
			}
			$res = $bridge->sqlQuery($this->connId, $this->sql, $pos, $this->named);
			return new SQLite3Result($res['columns'], $res['rows']);
		}
	}
}

if (!class_exists('SQLite3')) {
	class SQLite3 {
		private $connId = null;

		public function __construct($filename = ':memory:', $flags = null, $encryption_key = '') {
			$this->open($filename);
		}

		public function open($filename = ':memory:') {
			global $bridge;
			$this->connId = $bridge->sqlOpen((string) $filename);
			return true;
		}

		public function close() {
			global $bridge;
			if ($this->connId !== null) {
				$ok = $bridge->sqlClose($this->connId);
				$this->connId = null;
				return $ok;
			}
			return true;
		}

		public function exec($query) {
			global $bridge;
			return $bridge->sqlExec($this->connId, (string) $query);
		}

		public function query($query) {
			global $bridge;
			$res = $bridge->sqlQuery($this->connId, (string) $query, [], []);
			return new SQLite3Result($res['columns'], $res['rows']);
		}

		public function querySingle($query, $entire_row = false) {
			$res = $this->query($query);
			$row = $res->fetchArray($entire_row ? SQLITE3_ASSOC : SQLITE3_NUM);
			if ($row === false) {
				return null;
			}
			return $entire_row ? $row : $row[0];
		}

		public function prepare($query) {
			return new SQLite3Stmt($this->connId, (string) $query);
		}

		public function lastInsertRowID() {
			global $bridge;
			return $bridge->sqlLastInsertRowId($this->connId);
		}

		public function changes() {
			global $bridge;
			return $bridge->sqlChanges($this->connId);
		}

		public static function escapeString($value) {
			global $bridge;
			return $bridge->sqlEscape((string) $value);
		}
	}
}

if (!class_exists('PDOException')) {
	class PDOException extends Exception {}
}

if (!class_exists('PDOStatement')) {
	class PDOStatement {
		private $connId;
		private $sql;
		private $positional = [];
		private $named = [];
		private $columns = [];
		private $rows = [];
		private $cursor = 0;
		private $affected = 0;

		public function __construct($connId, $sql, $columns = [], $rows = [], $affected = 0) {
			$this->connId = $connId;
			$this->sql = (string) $sql;
			$this->columns = is_array($columns) ? $columns : [];
			$this->rows = is_array($rows) ? $rows : [];
			$this->affected = (int) $affected;
			$this->cursor = 0;
		}

		public function bindValue($param, $value, $type = null) {
			if (is_int($param)) {
				$this->positional[$param - 1] = $value;
			} else {
				$this->named[(string) $param] = $value;
			}
			return true;
		}

		public function bindParam($param, &$var, $type = null) {
			return $this->bindValue($param, $var, $type);
		}

		public function execute($params = null) {
			global $bridge;
			$pos = [];
			$named = $this->named;
			if (is_array($params)) {
				foreach ($params as $k => $v) {
					if (is_int($k)) {
						$pos[] = $v;
					} else {
						$named[(string) $k] = $v;
					}
				}
			} else {
				ksort($this->positional);
				foreach ($this->positional as $v) {
					$pos[] = $v;
				}
			}
			$res = $bridge->sqlQuery($this->connId, $this->sql, $pos, $named);
			$this->columns = $res['columns'];
			$this->rows = $res['rows'];
			$this->affected = (int) $res['changes'];
			$this->cursor = 0;
			return true;
		}

		private function formatRow($raw, $mode) {
			if ($mode === PDO::FETCH_COLUMN) {
				return array_key_exists(0, $raw) ? $raw[0] : null;
			}
			$out = [];
			$total = count($this->columns);
			for ($i = 0; $i < $total; $i++) {
				$val = array_key_exists($i, $raw) ? $raw[$i] : null;
				if ($mode === PDO::FETCH_NUM || $mode === PDO::FETCH_BOTH) {
					$out[$i] = $val;
				}
				if ($mode === PDO::FETCH_ASSOC || $mode === PDO::FETCH_BOTH) {
					$out[$this->columns[$i]] = $val;
				}
			}
			return $out;
		}

		public function fetch($mode = null) {
			if ($mode === null) {
				$mode = self::FETCH_BOTH;
			}
			if ($this->cursor >= count($this->rows)) {
				return false;
			}
			$raw = $this->rows[$this->cursor];
			$this->cursor++;
			return $this->formatRow($raw, $mode);
		}

		public function fetchAll($mode = null) {
			if ($mode === null) {
				$mode = self::FETCH_BOTH;
			}
			$all = [];
			while ($this->cursor < count($this->rows)) {
				$all[] = $this->formatRow($this->rows[$this->cursor], $mode);
				$this->cursor++;
			}
			return $all;
		}

		public function fetchColumn($column_number = 0) {
			if ($this->cursor >= count($this->rows)) {
				return false;
			}
			$raw = $this->rows[$this->cursor];
			$this->cursor++;
			$idx = (int) $column_number;
			return array_key_exists($idx, $raw) ? $raw[$idx] : false;
		}

		public function rowCount() {
			return count($this->rows) > 0 ? count($this->rows) : $this->affected;
		}

		public function columnCount() {
			return count($this->columns);
		}

		public function closeCursor() {
			$this->rows = [];
			$this->cursor = 0;
			return true;
		}
	}
}

if (!class_exists('PDO')) {
	class PDO {
		const FETCH_ASSOC = 2;
		const FETCH_NUM = 3;
		const FETCH_BOTH = 4;
		const FETCH_COLUMN = 7;

		const PARAM_NULL = 0;
		const PARAM_INT = 1;
		const PARAM_STR = 2;
		const PARAM_BOOL = 5;

		private $connId = null;

		public function __construct($dsn, $username = null, $password = null, $options = null) {
			global $bridge;
			$this->connId = $bridge->sqlOpen((string) $dsn);
		}

		public function exec($statement) {
			global $bridge;
			$bridge->sqlExec($this->connId, (string) $statement);
			return $bridge->sqlChanges($this->connId);
		}

		public function query($statement, $mode = null) {
			if ($mode === null) {
				$mode = self::FETCH_BOTH;
			}
			global $bridge;
			$res = $bridge->sqlQuery($this->connId, (string) $statement, [], []);
			return new PDOStatement($this->connId, $statement, $res['columns'], $res['rows'], $res['changes']);
		}

		public function prepare($statement, $options = []) {
			return new PDOStatement($this->connId, (string) $statement);
		}

		public function lastInsertId($name = null) {
			global $bridge;
			return (string) $bridge->sqlLastInsertRowId($this->connId);
		}

		public function beginTransaction() {
			return $this->exec('BEGIN TRANSACTION') >= 0;
		}

		public function commit() {
			return $this->exec('COMMIT') >= 0;
		}

		public function rollBack() {
			return $this->exec('ROLLBACK') >= 0;
		}

		public function quote($string, $type = null) {
			if ($type === null) {
				$type = self::PARAM_STR;
			}
			global $bridge;
			return "'" . $bridge->sqlEscape((string) $string) . "'";
		}
	}
}

if (!function_exists('sqlite_unit_test')) {
	function sqlite_unit_test($verbose = false) {
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

		echo "sqlite.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
		return $failed === 0;
	}
}
