/* -*- js-indent-level: 8 -*- */
/*
 * window.L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

window.L.Rectangle = window.L.Polygon.extend({
	initialize: function (latLngBounds, options) {
		window.L.Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	setBounds: function (latLngBounds) {
		this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = window.L.latLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});

window.L.rectangle = function (latLngBounds, options) {
	return new window.L.Rectangle(latLngBounds, options);
};
