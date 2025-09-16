/* -*- js-indent-level: 8 -*- */
/* global app */
/*
 * window.L.LatLng represents a geographical point with latitude and longitude coordinates.
 */

window.L.LatLng = function (lat, lng, alt) {
	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	this.lat = +lat;
	this.lng = +lng;

	if (alt !== undefined) {
		this.alt = +alt;
	}
};

window.L.LatLng.prototype = {
	equals: function (obj, maxMargin) {
		if (!obj) { return false; }

		obj = window.L.latLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= (maxMargin === undefined ? 1.0E-9 : maxMargin);
	},

	toString: function (precision) {
		return 'LatLng(' +
		        app.util.formatNum(this.lat, precision) + ', ' +
		        app.util.formatNum(this.lng, precision) + ')';
	},

	distanceTo: function () {
		return 0;
	},

	wrap: function () {
		return null;
	},
};


// constructs LatLng with different signatures
// (LatLng) or ([Number, Number]) or (Number, Number) or (Object)

window.L.latLng = function (a, b, c) {
	if (a instanceof window.L.LatLng) {
		return a;
	}
	if (app.util.isArray(a) && typeof a[0] !== 'object') {
		if (a.length === 3) {
			return new window.L.LatLng(a[0], a[1], a[2]);
		}
		if (a.length === 2) {
			return new window.L.LatLng(a[0], a[1]);
		}
		return null;
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new window.L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon, a.alt);
	}
	if (b === undefined) {
		return null;
	}
	return new window.L.LatLng(a, b, c);
};
