/**
 * @namespace
 * @type {Object}
 */
L.PathTransform = {};

/**
 * Point on the line segment or its extension
 *
 * @param  {L.Point} start
 * @param  {L.Point} final
 * @param  {Number}  distPx
 * @return {L.Point}
 */
L.PathTransform.pointOnLine = function(start, final, distPx) {
	var ratio = 1 + distPx / start.distanceTo(final);
	return new L.Point(
		start.x + (final.x - start.x) * ratio,
		start.y + (final.y - start.y) * ratio
	);
};


/**
 * Deep merge objects.
 */
L.PathTransform.merge = function() {
	var i = 1;
	var key, val;
	var obj = arguments[i];

	function isObject(object) {
		return Object.prototype.toString.call(object) === '[object Object]';
	}

	// make sure we don't modify source element and it's properties
	// objects are passed by reference
	var target = arguments[0];

	while (obj) {
		obj = arguments[i++];
		for (key in obj) {
			if (!Object.prototype.hasOwnProperty.call(obj, key)) {
				continue;
			}

			val = obj[key];

			if (isObject(val) && isObject(target[key])) {
				target[key] = L.Util.merge(target[key], val);
			} else {
				target[key] = val;
			}
		}
	}
	return target;
};
