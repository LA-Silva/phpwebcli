<?php

if (!defined('CASE_LOWER')) define('CASE_LOWER', 0);
if (!defined('CASE_UPPER')) define('CASE_UPPER', 1);
if (!defined('SORT_NUMERIC')) define('SORT_NUMERIC', 1);
if (!defined('SORT_ASC')) define('SORT_ASC', 4);
if (!defined('SORT_DESC')) define('SORT_DESC', 3);

if (!function_exists('__array_cmp_values')) {
	function __array_cmp_values($a, $b, $flags = SORT_REGULAR) {
		if ($flags === SORT_STRING || $flags === SORT_NATURAL) {
			$sa = (string) $a;
			$sb = (string) $b;
			if ($flags === SORT_NATURAL) {
				$sa = strtolower($sa);
				$sb = strtolower($sb);
			}
			return strcmp($sa, $sb);
		}
		if ($flags === SORT_NUMERIC) {
			$na = (float) $a;
			$nb = (float) $b;
			return $na < $nb ? -1 : ($na > $nb ? 1 : 0);
		}
		if ($a < $b) return -1;
		if ($a > $b) return 1;
		return 0;
	}
}

if (!function_exists('range')) {
	function range($start, $end, $step = 1) {
		$stepNum = abs($step);
		if ($stepNum == 0) {
			$stepNum = 1;
		}
		if (is_string($start) && is_string($end) && !is_numeric($start) && !is_numeric($end) && strlen($start) > 0 && strlen($end) > 0) {
			$c1 = substr($start, 0, 1);
			$c2 = substr($end, 0, 1);
			$code1 = -1;
			$code2 = -1;
			for ($i = 0; $i < 256; $i++) {
				$ch = chr($i);
				if ($ch === $c1) $code1 = $i;
				if ($ch === $c2) $code2 = $i;
			}
			$inc = (int) $stepNum;
			if ($inc < 1) $inc = 1;
			$out = [];
			if ($code1 <= $code2) {
				for ($c = $code1; $c <= $code2; $c += $inc) {
					$out[] = chr($c);
				}
			} else {
				for ($c = $code1; $c >= $code2; $c -= $inc) {
					$out[] = chr($c);
				}
			}
			return $out;
		}

		$useFloat = is_float($start) || is_float($end) || is_float($step);
		$a = $useFloat ? (float) $start : (int) $start;
		$b = $useFloat ? (float) $end : (int) $end;
		$s = $useFloat ? (float) $stepNum : (int) $stepNum;
		if ($s <= 0) {
			$s = 1;
		}
		$out = [];
		if ($a <= $b) {
			for ($v = $a; $v <= $b + ($useFloat ? 1e-12 : 0); $v += $s) {
				$out[] = $v;
			}
		} else {
			for ($v = $a; $v >= $b - ($useFloat ? 1e-12 : 0); $v -= $s) {
				$out[] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('array_fill')) {
	function array_fill($start_index, $count, $value) {
		$idx = (int) $start_index;
		$n = (int) $count;
		$out = [];
		if ($n <= 0) {
			return $out;
		}
		$out[$idx] = $value;
		$next = $idx < 0 ? 0 : $idx + 1;
		for ($i = 1; $i < $n; $i++) {
			$out[$next] = $value;
			$next++;
		}
		return $out;
	}
}

if (!function_exists('array_fill_keys')) {
	function array_fill_keys($keys, $value) {
		$out = [];
		foreach ($keys as $k) {
			$out[$k] = $value;
		}
		return $out;
	}
}

if (!function_exists('array_combine')) {
	function array_combine($keys, $values) {
		$kList = array_values($keys);
		$vList = array_values($values);
		if (count($kList) !== count($vList)) {
			return false;
		}
		$out = [];
		$total = count($kList);
		for ($i = 0; $i < $total; $i++) {
			$out[$kList[$i]] = $vList[$i];
		}
		return $out;
	}
}

if (!function_exists('array_slice')) {
	function array_slice($array, $offset, $length = null, $preserve_keys = false) {
		$total = count($array);
		$start = (int) $offset;
		if ($start < 0) {
			$start = $total + $start;
			if ($start < 0) {
				$start = 0;
			}
		}
		if ($start >= $total) {
			return [];
		}

		$end = $total;
		if ($length !== null) {
			$len = (int) $length;
			if ($len < 0) {
				$end = $total + $len;
			} else {
				$end = $start + $len;
			}
		}
		if ($end > $total) {
			$end = $total;
		}
		if ($end <= $start) {
			return [];
		}

		$out = [];
		$pos = 0;
		foreach ($array as $k => $v) {
			if ($pos >= $start && $pos < $end) {
				if ($preserve_keys || is_string($k)) {
					$out[$k] = $v;
				} else {
					$out[] = $v;
				}
			}
			$pos++;
		}
		return $out;
	}
}

if (!function_exists('array_splice')) {
	function array_splice(&$array, $offset, $length = null, $replacement = []) {
		$total = count($array);
		$start = (int) $offset;
		if ($start < 0) {
			$start = $total + $start;
			if ($start < 0) {
				$start = 0;
			}
		}
		if ($start > $total) {
			$start = $total;
		}

		if ($length === null) {
			$end = $total;
		} else {
			$len = (int) $length;
			if ($len < 0) {
				$end = $total + $len;
			} else {
				$end = $start + $len;
			}
		}
		if ($end < $start) {
			$end = $start;
		}
		if ($end > $total) {
			$end = $total;
		}

		$rep = is_array($replacement) ? $replacement : [$replacement];
		$before = [];
		$removed = [];
		$after = [];

		$pos = 0;
		foreach ($array as $k => $v) {
			if ($pos < $start) {
				if (is_string($k)) {
					$before[$k] = $v;
				} else {
					$before[] = $v;
				}
			} elseif ($pos < $end) {
				if (is_string($k)) {
					$removed[$k] = $v;
				} else {
					$removed[] = $v;
				}
			} else {
				if (is_string($k)) {
					$after[$k] = $v;
				} else {
					$after[] = $v;
				}
			}
			$pos++;
		}

		$next = $before;
		foreach ($rep as $rv) {
			$next[] = $rv;
		}
		foreach ($after as $ak => $av) {
			if (is_string($ak)) {
				$next[$ak] = $av;
			} else {
				$next[] = $av;
			}
		}
		$array = $next;
		return $removed;
	}
}

if (!function_exists('array_chunk')) {
	function array_chunk($array, $length, $preserve_keys = false) {
		$size = (int) $length;
		if ($size < 1) {
			return null;
		}
		$chunks = [];
		$current = [];
		$i = 0;
		foreach ($array as $k => $v) {
			if ($preserve_keys) {
				$current[$k] = $v;
			} else {
				$current[] = $v;
			}
			$i++;
			if ($i >= $size) {
				$chunks[] = $current;
				$current = [];
				$i = 0;
			}
		}
		if ($i > 0) {
			$chunks[] = $current;
		}
		return $chunks;
	}
}

if (!function_exists('array_column')) {
	function array_column($array, $column_key, $index_key = null) {
		$out = [];
		foreach ($array as $row) {
			if (!is_array($row)) {
				continue;
			}
			$hasVal = $column_key === null || array_key_exists($column_key, $row);
			if (!$hasVal) {
				continue;
			}
			$val = $column_key === null ? $row : $row[$column_key];
			if ($index_key !== null && array_key_exists($index_key, $row)) {
				$out[$row[$index_key]] = $val;
			} else {
				$out[] = $val;
			}
		}
		return $out;
	}
}

if (!function_exists('array_pad')) {
	function array_pad($array, $length, $value) {
		$total = count($array);
		$target = (int) $length;
		$absTarget = $target < 0 ? -$target : $target;
		if ($absTarget <= $total) {
			return $array;
		}
		$padCount = $absTarget - $total;
		$out = [];
		if ($target < 0) {
			for ($i = 0; $i < $padCount; $i++) {
				$out[] = $value;
			}
		}
		foreach ($array as $k => $v) {
			if (is_string($k)) {
				$out[$k] = $v;
			} else {
				$out[] = $v;
			}
		}
		if ($target > 0) {
			for ($i = 0; $i < $padCount; $i++) {
				$out[] = $value;
			}
		}
		return $out;
	}
}

if (!function_exists('array_unshift')) {
	function array_unshift(&$array) {
		$args = func_get_args();
		$out = [];
		$totalArgs = count($args);
		for ($i = 1; $i < $totalArgs; $i++) {
			$out[] = $args[$i];
		}
		foreach ($array as $k => $v) {
			if (is_string($k)) {
				$out[$k] = $v;
			} else {
				$out[] = $v;
			}
		}
		$array = $out;
		return count($array);
	}
}

if (!function_exists('array_replace')) {
	function array_replace($array) {
		$args = func_get_args();
		$out = $array;
		$total = count($args);
		for ($i = 1; $i < $total; $i++) {
			$other = $args[$i];
			if (!is_array($other)) {
				continue;
			}
			foreach ($other as $k => $v) {
				$out[$k] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('__array_replace_recursive_two')) {
	function __array_replace_recursive_two($base, $over) {
		foreach ($over as $k => $v) {
			if (isset($base[$k]) && is_array($base[$k]) && is_array($v)) {
				$base[$k] = __array_replace_recursive_two($base[$k], $v);
			} else {
				$base[$k] = $v;
			}
		}
		return $base;
	}
}

if (!function_exists('array_replace_recursive')) {
	function array_replace_recursive($array) {
		$args = func_get_args();
		$out = $array;
		$total = count($args);
		for ($i = 1; $i < $total; $i++) {
			$other = $args[$i];
			if (is_array($other)) {
				$out = __array_replace_recursive_two($out, $other);
			}
		}
		return $out;
	}
}

if (!function_exists('__array_merge_recursive_two')) {
	function __array_merge_recursive_two($base, $over) {
		foreach ($over as $k => $v) {
			if (is_int($k)) {
				$base[] = $v;
			} elseif (array_key_exists($k, $base)) {
				if (is_array($base[$k]) && is_array($v)) {
					$base[$k] = __array_merge_recursive_two($base[$k], $v);
				} else {
					$existing = is_array($base[$k]) ? $base[$k] : [$base[$k]];
					$incoming = is_array($v) ? $v : [$v];
					$base[$k] = array_merge($existing, $incoming);
				}
			} else {
				$base[$k] = $v;
			}
		}
		return $base;
	}
}

if (!function_exists('array_merge_recursive')) {
	function array_merge_recursive() {
		$args = func_get_args();
		$out = [];
		foreach ($args as $arr) {
			if (is_array($arr)) {
				$out = __array_merge_recursive_two($out, $arr);
			}
		}
		return $out;
	}
}

if (!function_exists('array_reverse')) {
	function array_reverse($array, $preserve_keys = false) {
		$keys = array_keys($array);
		$vals = array_values($array);
		$out = [];
		for ($i = count($keys) - 1; $i >= 0; $i--) {
			$k = $keys[$i];
			$v = $vals[$i];
			if ($preserve_keys || is_string($k)) {
				$out[$k] = $v;
			} else {
				$out[] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('array_flip')) {
	function array_flip($array) {
		$out = [];
		foreach ($array as $k => $v) {
			if (is_int($v) || is_string($v)) {
				$out[$v] = $k;
			}
		}
		return $out;
	}
}

if (!function_exists('array_change_key_case')) {
	function array_change_key_case($array, $case = CASE_LOWER) {
		$out = [];
		foreach ($array as $k => $v) {
			$newKey = is_string($k)
				? ($case === CASE_UPPER ? strtoupper($k) : strtolower($k))
				: $k;
			$out[$newKey] = $v;
		}
		return $out;
	}
}

if (!function_exists('array_sum')) {
	function array_sum($array) {
		$sum = 0;
		foreach ($array as $v) {
			if (is_numeric($v)) {
				$sum += $v + 0;
			}
		}
		return $sum;
	}
}

if (!function_exists('array_product')) {
	function array_product($array) {
		$prod = 1;
		foreach ($array as $v) {
			if (is_numeric($v)) {
				$prod *= $v + 0;
			} else {
				$prod *= 0;
			}
		}
		return $prod;
	}
}

if (!function_exists('array_reduce')) {
	function array_reduce($array, $callback, $initial = null) {
		$acc = $initial;
		foreach ($array as $v) {
			$acc = call_user_func($callback, $acc, $v);
		}
		return $acc;
	}
}

if (!function_exists('array_walk')) {
	function array_walk(&$array, $callback, $userdata = null) {
		$hasUser = func_num_args() >= 3;
		foreach ($array as $k => &$v) {
			if ($hasUser) {
				call_user_func($callback, $v, $k, $userdata);
			} else {
				call_user_func($callback, $v, $k);
			}
		}
		unset($v);
		return true;
	}
}

if (!function_exists('array_count_values')) {
	function array_count_values($array) {
		$counts = [];
		foreach ($array as $v) {
			if (is_int($v) || is_string($v)) {
				if (!array_key_exists($v, $counts)) {
					$counts[$v] = 0;
				}
				$counts[$v]++;
			}
		}
		return $counts;
	}
}

if (!function_exists('array_intersect')) {
	function array_intersect($array) {
		$args = func_get_args();
		$total = count($args);
		$out = [];
		foreach ($array as $k => $v) {
			$presentAll = true;
			$sv = (string) $v;
			for ($i = 1; $i < $total; $i++) {
				$otherArr = $args[$i];
				$found = false;
				foreach ($otherArr as $other) {
					if ($sv === (string) $other) {
						$found = true;
						break;
					}
				}
				if (!$found) {
					$presentAll = false;
					break;
				}
			}
			if ($presentAll) {
				$out[$k] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('array_intersect_key')) {
	function array_intersect_key($array) {
		$args = func_get_args();
		$total = count($args);
		$out = [];
		foreach ($array as $k => $v) {
			$presentAll = true;
			for ($i = 1; $i < $total; $i++) {
				$otherArr = $args[$i];
				if (!array_key_exists($k, $otherArr)) {
					$presentAll = false;
					break;
				}
			}
			if ($presentAll) {
				$out[$k] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('array_diff_key')) {
	function array_diff_key($array) {
		$args = func_get_args();
		$total = count($args);
		$out = [];
		foreach ($array as $k => $v) {
			$presentOther = false;
			for ($i = 1; $i < $total; $i++) {
				$otherArr = $args[$i];
				if (array_key_exists($k, $otherArr)) {
					$presentOther = true;
					break;
				}
			}
			if (!$presentOther) {
				$out[$k] = $v;
			}
		}
		return $out;
	}
}

if (!function_exists('array_key_first')) {
	function array_key_first($array) {
		foreach ($array as $k => $v) {
			return $k;
		}
		return null;
	}
}

if (!function_exists('array_key_last')) {
	function array_key_last($array) {
		$last = null;
		foreach ($array as $k => $v) {
			$last = $k;
		}
		return $last;
	}
}

if (!function_exists('sort')) {
	function sort(&$array, $flags = SORT_REGULAR) {
		$vals = array_values($array);
		$n = count($vals);
		for ($i = 1; $i < $n; $i++) {
			$cur = $vals[$i];
			$j = $i - 1;
			while ($j >= 0 && __array_cmp_values($vals[$j], $cur, $flags) > 0) {
				$vals[$j + 1] = $vals[$j];
				$j--;
			}
			$vals[$j + 1] = $cur;
		}
		$array = $vals;
		return true;
	}
}

if (!function_exists('rsort')) {
	function rsort(&$array, $flags = SORT_REGULAR) {
		$vals = array_values($array);
		$n = count($vals);
		for ($i = 1; $i < $n; $i++) {
			$cur = $vals[$i];
			$j = $i - 1;
			while ($j >= 0 && __array_cmp_values($vals[$j], $cur, $flags) < 0) {
				$vals[$j + 1] = $vals[$j];
				$j--;
			}
			$vals[$j + 1] = $cur;
		}
		$array = $vals;
		return true;
	}
}

if (!function_exists('arsort')) {
	function arsort(&$array, $flags = SORT_REGULAR) {
		$pairs = [];
		foreach ($array as $k => $v) {
			$pairs[] = [$k, $v];
		}
		$n = count($pairs);
		for ($i = 1; $i < $n; $i++) {
			$cur = $pairs[$i];
			$j = $i - 1;
			while ($j >= 0 && __array_cmp_values($pairs[$j][1], $cur[1], $flags) < 0) {
				$pairs[$j + 1] = $pairs[$j];
				$j--;
			}
			$pairs[$j + 1] = $cur;
		}
		$out = [];
		foreach ($pairs as $p) {
			$out[$p[0]] = $p[1];
		}
		$array = $out;
		return true;
	}
}

if (!function_exists('ksort')) {
	function ksort(&$array, $flags = SORT_REGULAR) {
		$keys = array_keys($array);
		$n = count($keys);
		for ($i = 1; $i < $n; $i++) {
			$cur = $keys[$i];
			$j = $i - 1;
			while ($j >= 0 && __array_cmp_values($keys[$j], $cur, $flags) > 0) {
				$keys[$j + 1] = $keys[$j];
				$j--;
			}
			$keys[$j + 1] = $cur;
		}
		$out = [];
		foreach ($keys as $k) {
			$out[$k] = $array[$k];
		}
		$array = $out;
		return true;
	}
}

if (!function_exists('usort')) {
	function usort(&$array, $callback) {
		$vals = array_values($array);
		$n = count($vals);
		for ($i = 1; $i < $n; $i++) {
			$cur = $vals[$i];
			$j = $i - 1;
			while ($j >= 0 && call_user_func($callback, $vals[$j], $cur) > 0) {
				$vals[$j + 1] = $vals[$j];
				$j--;
			}
			$vals[$j + 1] = $cur;
		}
		$array = $vals;
		return true;
	}
}

if (!function_exists('uasort')) {
	function uasort(&$array, $callback) {
		$pairs = [];
		foreach ($array as $k => $v) {
			$pairs[] = [$k, $v];
		}
		$n = count($pairs);
		for ($i = 1; $i < $n; $i++) {
			$cur = $pairs[$i];
			$j = $i - 1;
			while ($j >= 0 && call_user_func($callback, $pairs[$j][1], $cur[1]) > 0) {
				$pairs[$j + 1] = $pairs[$j];
				$j--;
			}
			$pairs[$j + 1] = $cur;
		}
		$out = [];
		foreach ($pairs as $p) {
			$out[$p[0]] = $p[1];
		}
		$array = $out;
		return true;
	}
}

if (!function_exists('uksort')) {
	function uksort(&$array, $callback) {
		$keys = array_keys($array);
		$n = count($keys);
		for ($i = 1; $i < $n; $i++) {
			$cur = $keys[$i];
			$j = $i - 1;
			while ($j >= 0 && call_user_func($callback, $keys[$j], $cur) > 0) {
				$keys[$j + 1] = $keys[$j];
				$j--;
			}
			$keys[$j + 1] = $cur;
		}
		$out = [];
		foreach ($keys as $k) {
			$out[$k] = $array[$k];
		}
		$array = $out;
		return true;
	}
}

if (!function_exists('shuffle')) {
	function shuffle(&$array) {
		$vals = array_values($array);
		$n = count($vals);
		for ($i = $n - 1; $i > 0; $i--) {
			$j = rand(0, $i);
			$tmp = $vals[$i];
			$vals[$i] = $vals[$j];
			$vals[$j] = $tmp;
		}
		$array = $vals;
		return true;
	}
}

if (!function_exists('array_rand')) {
	function array_rand($array, $num = 1) {
		$keys = array_keys($array);
		$total = count($keys);
		$pick = (int) $num;
		if ($total === 0 || $pick < 1 || $pick > $total) {
			return null;
		}
		if ($pick === 1) {
			return $keys[rand(0, $total - 1)];
		}
		$indices = range(0, $total - 1);
		shuffle($indices);
		$chosen = array_slice($indices, 0, $pick);
		sort($chosen);
		$out = [];
		foreach ($chosen as $idx) {
			$out[] = $keys[$idx];
		}
		return $out;
	}
}

