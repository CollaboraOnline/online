/* -*- js-indent-level: 8 -*- */
/*
 * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
 */

import { Bounds } from '../../geometry/Bounds';
import { Point } from '../../geometry/Point';

L.Projection = {};

L.Projection.LonLat = {
	project: function (latlng) {
		return new Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new L.LatLng(point.y, point.x);
	},

	bounds: Bounds.toBounds([-180, -90], [180, 90])
};
