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

function date_to_number($str, $format = null) {
	global $bridge;
	return $bridge->dateToNumber($str, $format);
}

function number_to_date($num, $format = null) {
	global $bridge;
	return $bridge->numberToDate($num, $format);
}

