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

