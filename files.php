<?php

if (!function_exists('file_get_contents')) {
	function file_get_contents($filename) {
		global $bridge;
		return $bridge->vfsReadFile((string) $filename);
	}
}

if (!function_exists('file_put_contents')) {
	function file_put_contents($filename, $data, $flags = 0) {
		global $bridge;
		$payload = is_array($data) ? implode('', $data) : (string) $data;
		$append = (((int) $flags) & FILE_APPEND) !== 0;
		return $bridge->vfsWriteFile((string) $filename, $payload, $append);
	}
}

if (!function_exists('file')) {
	function file($filename, $flags = 0) {
		$content = file_get_contents($filename);
		if ($content === false) {
			return false;
		}
		if ($content === '') {
			return [];
		}
		$ignoreNewLines = (((int) $flags) & FILE_IGNORE_NEW_LINES) !== 0;
		$skipEmpty = (((int) $flags) & FILE_SKIP_EMPTY_LINES) !== 0;

		$lines = [];
		$len = strlen($content);
		$start = 0;
		while ($start < $len) {
			$nlPos = strpos($content, "\n", $start);
			if ($nlPos === false) {
				$rawLine = substr($content, $start);
				$start = $len;
			} else {
				$rawLine = substr($content, $start, $nlPos - $start + 1);
				$start = $nlPos + 1;
			}

			$line = $ignoreNewLines ? rtrim($rawLine, "\r\n") : $rawLine;
			if ($skipEmpty) {
				$trimmed = rtrim($line, "\r\n");
				if ($trimmed === '') {
					continue;
				}
			}
			$lines[] = $line;
		}
		return $lines;
	}
}

if (!function_exists('unlink')) {
	function unlink($filename) {
		global $bridge;
		return $bridge->vfsUnlink((string) $filename);
	}
}

if (!function_exists('rename')) {
	function rename($oldname, $newname) {
		global $bridge;
		return $bridge->vfsRename((string) $oldname, (string) $newname);
	}
}

if (!function_exists('copy')) {
	function copy($source, $dest) {
		global $bridge;
		return $bridge->vfsCopy((string) $source, (string) $dest);
	}
}

if (!function_exists('mkdir')) {
	function mkdir($directory, $permissions = 0777, $recursive = false) {
		global $bridge;
		return $bridge->vfsMkdir((string) $directory, (bool) $recursive);
	}
}

if (!function_exists('rmdir')) {
	function rmdir($directory) {
		global $bridge;
		return $bridge->vfsRmdir((string) $directory);
	}
}

if (!function_exists('is_dir')) {
	function is_dir($filename) {
		global $bridge;
		return $bridge->vfsIsDir((string) $filename);
	}
}

if (!function_exists('filesize')) {
	function filesize($filename) {
		global $bridge;
		return $bridge->vfsFilesize((string) $filename);
	}
}

if (!function_exists('filemtime')) {
	function filemtime($filename) {
		global $bridge;
		return $bridge->vfsFilemtime((string) $filename);
	}
}

if (!function_exists('touch')) {
	function touch($filename, $mtime = null) {
		global $bridge;
		return $bridge->vfsTouch((string) $filename, $mtime);
	}
}

if (!function_exists('scandir')) {
	function scandir($directory, $sorting_order = 0) {
		global $bridge;
		return $bridge->vfsScandir((string) $directory, (int) $sorting_order);
	}
}

if (!function_exists('glob')) {
	function glob($pattern) {
		global $bridge;
		return $bridge->vfsGlob((string) $pattern);
	}
}

if (!function_exists('basename')) {
	function basename($path, $suffix = '') {
		$p = str_replace('\\', '/', (string) $path);
		$p = rtrim($p, '/');
		if ($p === '') {
			return '';
		}
		$pos = strrpos($p, '/');
		$base = $pos === false ? $p : substr($p, $pos + 1);
		$suf = (string) $suffix;
		if ($suf !== '' && strlen($base) >= strlen($suf)) {
			if (substr($base, -strlen($suf)) === $suf) {
				$base = substr($base, 0, strlen($base) - strlen($suf));
			}
		}
		return $base;
	}
}

if (!function_exists('realpath')) {
	function realpath($path) {
		global $bridge;
		return $bridge->vfsRealpath((string) $path);
	}
}

if (!function_exists('getcwd')) {
	function getcwd() {
		global $bridge;
		return $bridge->vfsGetCwd();
	}
}

if (!function_exists('chdir')) {
	function chdir($directory) {
		global $bridge;
		return $bridge->vfsChdir((string) $directory);
	}
}

if (!function_exists('files_unit_test')) {
	function files_unit_test($verbose = false) {
		$prevCwd = getcwd();
		$base = '/tmp/__vfs_unit_test';

		// Clean any leftover test directory
		if (is_file($base . '/sub/moved.txt')) unlink($base . '/sub/moved.txt');
		if (is_file($base . '/sub/copied.txt')) unlink($base . '/sub/copied.txt');
		if (is_file($base . '/hello.txt')) unlink($base . '/hello.txt');
		if (is_file($base . '/lines.txt')) unlink($base . '/lines.txt');
		if (is_file($base . '/stream.txt')) unlink($base . '/stream.txt');
		if (is_file($base . '/touched.txt')) unlink($base . '/touched.txt');
		if (is_file($base . '/mod.php')) unlink($base . '/mod.php');
		if (is_dir($base . '/sub')) rmdir($base . '/sub');
		if (is_dir($base)) rmdir($base);

		$mkOk = mkdir($base . '/sub', 0777, true);
		$isDirOk = is_dir($base) && is_dir($base . '/sub') && file_exists($base);

		$written = file_put_contents($base . '/hello.txt', 'Hello');
		$appended = file_put_contents($base . '/hello.txt', ' VFS!', FILE_APPEND);
		$readBack = file_get_contents($base . '/hello.txt');
		$sizeOk = filesize($base . '/hello.txt');

		file_put_contents($base . '/lines.txt', "one\n\ntwo\nthree\n");
		$linesAll = file($base . '/lines.txt');
		$linesClean = file($base . '/lines.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

		$fp = fopen($base . '/stream.txt', 'w+');
		$isRes = is_resource($fp);
		$fw = fwrite($fp, "alpha\nbeta\n");
		$rewOk = rewind($fp);
		$line1 = fgets($fp);
		$posAfterLine1 = ftell($fp);
		$line2 = fgets($fp);
		$eofAfter = feof($fp);
		fseek($fp, 0, SEEK_SET);
		$firstTwo = fread($fp, 2);
		$fputsOk = fputs($fp, 'X');
		$closed = fclose($fp);

		$fpRead = fopen($base . '/stream.txt', 'r');
		$streamContent = fread($fpRead, 64);
		fclose($fpRead);

		$openMissing = fopen($base . '/nonexistent.txt', 'r');
		$openExclusiveExists = fopen($base . '/stream.txt', 'x');

		$copyOk = copy($base . '/hello.txt', $base . '/sub/copied.txt');
		$renameOk = rename($base . '/sub/copied.txt', $base . '/sub/moved.txt');
		$movedContent = file_get_contents($base . '/sub/moved.txt');

		$touchOk = touch($base . '/touched.txt', 1700000000);
		$mtimeVal = filemtime($base . '/touched.txt');

		$scan = scandir($base);
		$globRes = glob($base . '/*.txt');

		$chdirOk = chdir($base);
		$cwdNow = getcwd();
		$relExists = file_exists('hello.txt') && is_file('hello.txt');
		$realPathOk = realpath('sub/../hello.txt');
		chdir($prevCwd);

		file_put_contents($base . '/mod.php', '<?php return "vfs_included_ok";');
		$includedVal = include($base . '/mod.php');

		$unlinkOk = unlink($base . '/hello.txt')
			&& unlink($base . '/lines.txt')
			&& unlink($base . '/stream.txt')
			&& unlink($base . '/touched.txt')
			&& unlink($base . '/mod.php')
			&& unlink($base . '/sub/moved.txt');
		$rmdirOk = rmdir($base . '/sub') && rmdir($base) && !file_exists($base);

		$cases = [
			['mkdir recursive + is_dir + file_exists', $mkOk && $isDirOk, true],
			['file_put_contents + FILE_APPEND', $written === 5 && $appended === 5 && $readBack === 'Hello VFS!', true],
			['filesize', $sizeOk, 10],
			['file() preserves newlines', $linesAll, ["one\n", "\n", "two\n", "three\n"]],
			['file() FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES', $linesClean, ['one', 'two', 'three']],
			['fopen/fwrite/rewind/fgets/ftell/feof/fclose', $isRes && $fw === 11 && $rewOk && $line1 === "alpha\n" && $posAfterLine1 === 6 && $line2 === "beta\n" && $eofAfter && $closed, true],
			['fread + fseek + fputs overwrite', $firstTwo === 'al' && $fputsOk === 1 && $streamContent === "alXha\nbeta\n", true],
			['fopen missing r and existing x return false', $openMissing === false && $openExclusiveExists === false, true],
			['copy + rename across directories', $copyOk && $renameOk && $movedContent === 'Hello VFS!', true],
			['touch + filemtime', $touchOk && $mtimeVal === 1700000000, true],
			['scandir includes . and .. and children', is_array($scan) && in_array('.', $scan) && in_array('..', $scan) && in_array('hello.txt', $scan) && in_array('sub', $scan), true],
			['glob matches *.txt files', is_array($globRes) && in_array($base . '/hello.txt', $globRes), true],
			['chdir + getcwd + relative path + realpath', $chdirOk && $cwdNow === $base && $relExists && $realPathOk === $base . '/hello.txt', true],
			['basename with suffix', basename('/var/log/app.log', '.log'), 'app'],
			['include() loads PHP file from localStorage VFS', $includedVal, 'vfs_included_ok'],
			['unlink + rmdir cleanup', $unlinkOk && $rmdirOk, true],
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

		echo "files.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
		return $failed === 0;
	}
}
