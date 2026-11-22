<?php

if (!defined('M_PI')) define('M_PI', 3.14159265358979323846);
if (!defined('M_E')) define('M_E', 2.7182818284590452354);
if (!defined('M_LOG2E')) define('M_LOG2E', 1.4426950408889634074);
if (!defined('M_LOG10E')) define('M_LOG10E', 0.43429448190325182765);
if (!defined('M_LN2')) define('M_LN2', 0.69314718055994530942);
if (!defined('M_LN10')) define('M_LN10', 2.30258509299404568402);
if (!defined('M_PI_2')) define('M_PI_2', 1.57079632679489661923);
if (!defined('M_PI_4')) define('M_PI_4', 0.78539816339744830962);
if (!defined('M_1_PI')) define('M_1_PI', 0.31830988618379067154);
if (!defined('M_2_PI')) define('M_2_PI', 0.63661977236758134308);
if (!defined('M_SQRTPI')) define('M_SQRTPI', 1.77245385090551602729);
if (!defined('M_2_SQRTPI')) define('M_2_SQRTPI', 1.12837916709551257390);
if (!defined('M_SQRT2')) define('M_SQRT2', 1.41421356237309504880);
if (!defined('M_SQRT3')) define('M_SQRT3', 1.73205080756887729352);
if (!defined('M_SQRT1_2')) define('M_SQRT1_2', 0.70710678118654752440);
if (!defined('M_LNPI')) define('M_LNPI', 1.14472988584940017414);
if (!defined('M_EULER')) define('M_EULER', 0.57721566490153286061);

if (!defined('PHP_ROUND_HALF_UP')) define('PHP_ROUND_HALF_UP', 1);
if (!defined('PHP_ROUND_HALF_DOWN')) define('PHP_ROUND_HALF_DOWN', 2);
if (!defined('PHP_ROUND_HALF_EVEN')) define('PHP_ROUND_HALF_EVEN', 3);
if (!defined('PHP_ROUND_HALF_ODD')) define('PHP_ROUND_HALF_ODD', 4);

if (!defined('INF')) define('INF', $bridge->mathInf());
if (!defined('NAN')) define('NAN', $bridge->mathNan());

if (!function_exists('pi')) {
	function pi() {
		return M_PI;
	}
}

if (!function_exists('abs')) {
	function abs($num) {
		return $num < 0 ? -$num : +$num;
	}
}

if (!function_exists('floor')) {
	function floor($num) {
		global $bridge;
		return (float) $bridge->mathUnary('floor', $num);
	}
}

if (!function_exists('round')) {
	function round($num, $precision = 0, $mode = PHP_ROUND_HALF_UP) {
		global $bridge;
		return (float) $bridge->mathRound($num, (int) $precision, (int) $mode);
	}
}

if (!function_exists('min')) {
	function min() {
		$args = func_get_args();
		if (count($args) === 0) {
			return null;
		}
		$items = (count($args) === 1 && is_array($args[0])) ? $args[0] : $args;
		$best = null;
		$hasBest = false;
		foreach ($items as $item) {
			if (!$hasBest || $item < $best) {
				$best = $item;
				$hasBest = true;
			}
		}
		return $best;
	}
}

if (!function_exists('max')) {
	function max() {
		$args = func_get_args();
		if (count($args) === 0) {
			return null;
		}
		$items = (count($args) === 1 && is_array($args[0])) ? $args[0] : $args;
		$best = null;
		$hasBest = false;
		foreach ($items as $item) {
			if (!$hasBest || $item > $best) {
				$best = $item;
				$hasBest = true;
			}
		}
		return $best;
	}
}

if (!function_exists('pow')) {
	function pow($base, $exp) {
		global $bridge;
		$res = $bridge->mathBinary('pow', $base, $exp);
		if (is_int($base) && is_int($exp) && $exp >= 0 && is_int($res)) {
			return $res;
		}
		return $res;
	}
}

if (!function_exists('sqrt')) {
	function sqrt($num) {
		global $bridge;
		return (float) $bridge->mathUnary('sqrt', $num);
	}
}

if (!function_exists('exp')) {
	function exp($num) {
		global $bridge;
		return (float) $bridge->mathUnary('exp', $num);
	}
}

if (!function_exists('expm1')) {
	function expm1($num) {
		global $bridge;
		return (float) $bridge->mathUnary('expm1', $num);
	}
}

if (!function_exists('log')) {
	function log($num, $base = null) {
		global $bridge;
		return (float) $bridge->mathLog($num, $base);
	}
}

if (!function_exists('log10')) {
	function log10($num) {
		global $bridge;
		return (float) $bridge->mathUnary('log10', $num);
	}
}

if (!function_exists('log1p')) {
	function log1p($num) {
		global $bridge;
		return (float) $bridge->mathUnary('log1p', $num);
	}
}

if (!function_exists('hypot')) {
	function hypot($x, $y) {
		global $bridge;
		return (float) $bridge->mathBinary('hypot', $x, $y);
	}
}

if (!function_exists('fmod')) {
	function fmod($num1, $num2) {
		global $bridge;
		return (float) $bridge->mathBinary('fmod', $num1, $num2);
	}
}

if (!function_exists('fdiv')) {
	function fdiv($num1, $num2) {
		global $bridge;
		return (float) $bridge->mathBinary('fdiv', $num1, $num2);
	}
}

if (!function_exists('intdiv')) {
	function intdiv($num1, $num2) {
		global $bridge;
		return (int) $bridge->mathBinary('intdiv', $num1, $num2);
	}
}

if (!function_exists('deg2rad')) {
	function deg2rad($num) {
		global $bridge;
		return (float) $bridge->mathUnary('deg2rad', $num);
	}
}

if (!function_exists('rad2deg')) {
	function rad2deg($num) {
		global $bridge;
		return (float) $bridge->mathUnary('rad2deg', $num);
	}
}

if (!function_exists('sin')) {
	function sin($num) {
		global $bridge;
		return (float) $bridge->mathUnary('sin', $num);
	}
}

if (!function_exists('cos')) {
	function cos($num) {
		global $bridge;
		return (float) $bridge->mathUnary('cos', $num);
	}
}

if (!function_exists('tan')) {
	function tan($num) {
		global $bridge;
		return (float) $bridge->mathUnary('tan', $num);
	}
}

if (!function_exists('asin')) {
	function asin($num) {
		global $bridge;
		return (float) $bridge->mathUnary('asin', $num);
	}
}

if (!function_exists('acos')) {
	function acos($num) {
		global $bridge;
		return (float) $bridge->mathUnary('acos', $num);
	}
}

if (!function_exists('atan')) {
	function atan($num) {
		global $bridge;
		return (float) $bridge->mathUnary('atan', $num);
	}
}

if (!function_exists('atan2')) {
	function atan2($y, $x) {
		global $bridge;
		return (float) $bridge->mathBinary('atan2', $y, $x);
	}
}

if (!function_exists('sinh')) {
	function sinh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('sinh', $num);
	}
}

if (!function_exists('cosh')) {
	function cosh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('cosh', $num);
	}
}

if (!function_exists('tanh')) {
	function tanh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('tanh', $num);
	}
}

if (!function_exists('asinh')) {
	function asinh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('asinh', $num);
	}
}

if (!function_exists('acosh')) {
	function acosh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('acosh', $num);
	}
}

if (!function_exists('atanh')) {
	function atanh($num) {
		global $bridge;
		return (float) $bridge->mathUnary('atanh', $num);
	}
}

if (!function_exists('is_nan')) {
	function is_nan($num) {
		global $bridge;
		return (bool) $bridge->mathIsNan($num);
	}
}

if (!function_exists('is_finite')) {
	function is_finite($num) {
		global $bridge;
		return (bool) $bridge->mathIsFinite($num);
	}
}

if (!function_exists('is_infinite')) {
	function is_infinite($num) {
		global $bridge;
		return (bool) $bridge->mathIsInfinite($num);
	}
}

if (!function_exists('getrandmax')) {
	function getrandmax() {
		return 2147483647;
	}
}

if (!function_exists('mt_getrandmax')) {
	function mt_getrandmax() {
		return 2147483647;
	}
}

if (!function_exists('srand')) {
	function srand($seed = null) {
		global $bridge;
		$bridge->mathSrand($seed);
	}
}

if (!function_exists('mt_srand')) {
	function mt_srand($seed = null) {
		global $bridge;
		$bridge->mathSrand($seed);
	}
}

if (!function_exists('rand')) {
	function rand($min = null, $max = null) {
		global $bridge;
		return (int) $bridge->mathRand($min, $max);
	}
}

if (!function_exists('mt_rand')) {
	function mt_rand($min = null, $max = null) {
		global $bridge;
		return (int) $bridge->mathRand($min, $max);
	}
}

if (!function_exists('bindec')) {
	function bindec($binary_string) {
		global $bridge;
		return $bridge->mathFromBase((string) $binary_string, 2);
	}
}

if (!function_exists('octdec')) {
	function octdec($octal_string) {
		global $bridge;
		return $bridge->mathFromBase((string) $octal_string, 8);
	}
}

if (!function_exists('hexdec')) {
	function hexdec($hex_string) {
		global $bridge;
		return $bridge->mathFromBase((string) $hex_string, 16);
	}
}

if (!function_exists('decbin')) {
	function decbin($num) {
		global $bridge;
		return $bridge->mathToBase($num, 2);
	}
}

if (!function_exists('decoct')) {
	function decoct($num) {
		global $bridge;
		return $bridge->mathToBase($num, 8);
	}
}

if (!function_exists('base_convert')) {
	function base_convert($num, $from_base, $to_base) {
		global $bridge;
		return $bridge->mathBaseConvert((string) $num, (int) $from_base, (int) $to_base);
	}
}

if (!function_exists('math_unit_test')) {
	function math_unit_test($verbose = false) {
		srand(12345);
		$r1 = rand(1, 100);
		$r2 = rand(1, 100);
		srand(12345);
		$r1b = rand(1, 100);
		$r2b = rand(1, 100);

		$cases = [
			['abs(-42) and abs(-3.5)', abs(-42) === 42 && abs(-3.5) === 3.5, true],
			['floor(3.9) and floor(-3.1)', floor(3.9) == 3 && floor(-3.1) == -4, true],
			['round(3.14159, 2)', round(3.14159, 2), 3.14],
			['round(1234, -2)', round(1234, -2) == 1200, true],
			['round HALF_UP vs HALF_DOWN vs HALF_EVEN', round(1.5) == 2 && round(-1.5) == -2 && round(1.5, 0, PHP_ROUND_HALF_DOWN) == 1 && round(2.5, 0, PHP_ROUND_HALF_EVEN) == 2 && round(2.5, 0, PHP_ROUND_HALF_ODD) == 3, true],
			['min/max variadic and array', min(5, 2, 9) === 2 && max([1, 8, 3]) === 8, true],
			['pow(2, 10) and sqrt(81)', pow(2, 10) === 1024 && sqrt(81) == 9, true],
			['intdiv(17, 5) and fmod(5.7, 1.3)', intdiv(17, 5) === 3 && abs(fmod(5.7, 1.3) - 0.5) < 1e-9, true],
			['hypot(3, 4)', hypot(3, 4) == 5, true],
			['exp/log/log10', abs(log(exp(2)) - 2) < 1e-9 && log(8, 2) == 3 && log10(1000) == 3, true],
			['pi()/deg2rad/rad2deg/trig', abs(sin(deg2rad(90)) - 1) < 1e-9 && abs(cos(pi()) + 1) < 1e-9 && abs(rad2deg(atan2(1, 1)) - 45) < 1e-9, true],
			['hyperbolic sinh/cosh/tanh', abs(cosh(0) - 1) < 1e-9 && abs(sinh(0)) < 1e-9 && abs(tanh(0)) < 1e-9, true],
			['is_nan / is_finite / is_infinite', is_nan(NAN) && is_infinite(INF) && is_finite(42.5) && !is_finite(INF), true],
			['srand deterministic rand/mt_rand', $r1 === $r1b && $r2 === $r2b && $r1 >= 1 && $r1 <= 100, true],
			['bindec/decbin/octdec/decoct/hexdec/dechex/base_convert', bindec('101010') === 42 && decbin(42) === '101010' && octdec('755') === 493 && decoct(493) === '755' && hexdec('ff') === 255 && dechex(255) === 'ff' && base_convert('ff', 16, 2) === '11111111', true],
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

		echo "math.php unit_test: " . $passed . "/" . count($cases) . " passed\n";
		return $failed === 0;
	}
}
