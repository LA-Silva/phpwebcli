function hello123() {
	echo "hello srings";
}

function len($str) {
	return strlen((string) $str);
}

function left($str, $length) {
	$s = (string) $str;
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	return substr($s, 0, $n);
}

function right($str, $length) {
	$s = (string) $str;
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	$total = strlen($s);
	if ($n >= $total) {
		return $s;
	}
	return substr($s, -$n);
}

function mid($str, $start, $length = null) {
	$s = (string) $str;
	$pos = (int) $start;
	if ($pos < 1) {
		$pos = 1;
	}
	$offset = $pos - 1;
	$total = strlen($s);
	if ($offset >= $total) {
		return '';
	}
	if ($length === null) {
		return substr($s, $offset);
	}
	$n = (int) $length;
	if ($n <= 0) {
		return '';
	}
	return substr($s, $offset, $n);
}

function instr($arg1, $arg2, $arg3 = null) {
	if ($arg3 !== null) {
		if (is_int($arg1)) {
			$start = $arg1;
			$haystack = (string) $arg2;
			$needle = (string) $arg3;
		} else {
			$haystack = (string) $arg1;
			$needle = (string) $arg2;
			$start = (int) $arg3;
		}
	} else {
		$start = 1;
		$haystack = (string) $arg1;
		$needle = (string) $arg2;
	}

	if ($start < 1) {
		return 0;
	}

	$offset = $start - 1;
	$hayLen = strlen($haystack);
	if ($offset > $hayLen) {
		return 0;
	}

	if ($needle === '') {
		return $hayLen === 0 ? 0 : $start;
	}

	$pos = strpos($haystack, $needle, $offset);
	return $pos === false ? 0 : $pos + 1;
}

function lower($str) {
	return strtolower((string) $str);
}

function upper($str) {
	return strtoupper((string) $str);
}

function chr($code) {
	global $bridge;
	return $bridge->fromCharCode((int) $code);
}

function val($str) {
	$f = (float) $str;
	if ($f >= -2147483648 && $f <= 2147483647 && (int) $f == $f) {
		return (int) $f;
	}
	return $f;
}

if (!function_exists('ltrim')) {
	function ltrim($str, $characters = null) {
		$s = (string) $str;
		$chars = $characters === null
			? " \n\r\t" . chr(11) . chr(0)
			: (string) $characters;
		$total = strlen($s);
		$i = 0;
		while ($i < $total && strpos($chars, substr($s, $i, 1)) !== false) {
			$i++;
		}
		return substr($s, $i);
	}
}

if (!function_exists('rtrim')) {
	function rtrim($str, $characters = null) {
		$s = (string) $str;
		$chars = $characters === null
			? " \n\r\t" . chr(11) . chr(0)
			: (string) $characters;
		$i = strlen($s) - 1;
		while ($i >= 0 && strpos($chars, substr($s, $i, 1)) !== false) {
			$i--;
		}
		return substr($s, 0, $i + 1);
	}
}

if (!function_exists('strcmp')) {
	function strcmp($str1, $str2) {
		global $bridge;
		return $bridge->strcmp((string) $str1, (string) $str2);
	}
}

if (!function_exists('stricmp')) {
	function stricmp($str1, $str2) {
		return strcmp(strtolower((string) $str1), strtolower((string) $str2));
	}
}

function space($count) {
	$n = (int) $count;
	if ($n <= 0) {
		return '';
	}
	$out = '';
	for ($i = 0; $i < $n; $i++) {
		$out .= ' ';
	}
	return $out;
}

if (!function_exists('split')) {
	function split($pattern, $string = null, $limit = 0) {
		global $bridge;
		return $bridge->perlSplit($pattern, $string, $limit);
	}
}
