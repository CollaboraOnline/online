/* -*- js-indent-level: 8 -*- */
/*
 * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
 */

/* global cool */

window.L.Projection = {};

window.L.Projection.LonLat = {
	project: function (latlng) {
		return new cool.Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new window.L.LatLng(point.y, point.x);
	},

	bounds: cool.Bounds.toBounds([-180, -90], [180, 90])
};
