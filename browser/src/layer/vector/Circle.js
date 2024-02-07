/* -*- js-indent-level: 8 -*- */
/*
 * L.Circle is a circle overlay (with a certain radius in meters).
 * It's an approximation and starts to diverge from a real circle closer to poles (due to projection distortion)
 */

// Looks like this file is not used.

L.Circle = L.CircleMarker.extend({

	initialize: function (latlng, radius, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._mRadius = radius;
	},

	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	getRadius: function () {
		return this._mRadius;
	},

	getBounds: function () {
		var half = [this._radius, this._radiusY];

		return new L.LatLngBounds(
			this._map.layerPointToLatLng(this._point.subtract(half)),
			this._map.layerPointToLatLng(this._point.add(half)));
	},

	setStyle: L.Path.prototype.setStyle,

	_project: function () {

		var map = this._map,
		    crs = map.options.crs;

		var latlng2 = crs.unproject(crs.project(this._latlng).subtract([this._mRadius, 0]));

		this._point = map.latLngToLayerPoint(this._latlng);
		this._radius = this._point.x - map.latLngToLayerPoint(latlng2).x;

		this._updateBounds();
	}
});

L.circle = function (latlng, radius, options) {
	return new L.Circle(latlng, radius, options);
};
