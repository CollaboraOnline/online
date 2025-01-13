/* -*- js-indent-level: 8 -*- */
/*
 * L.CRS is the base object for all defined CRS (Coordinate Reference Systems) in Leaflet.
 */

L.CRS = {
	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1, 0, -1, 0),

	// converts geo coords to pixel ones
	latLngToPoint: function (latlng, zoom) {
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	// converts pixel coords to geo coords
	pointToLatLng: function (point, zoom) {
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	// converts geo coords to projection-specific coords (e.g. in meters)
	project: function (latlng) {
		return this.projection.project(latlng);
	},

	// converts projected coords to geo coords
	unproject: function (point) {
		return this.projection.unproject(point);
	},

	// defines how the world scales with zoom
	scale: function (zoom) {
		return Math.pow(1.2, zoom);
	},

	// equivalent to doing an unproject with oldZoom then a project with newZoom
	// except that unproject is technically invalid (so possibly confusing) for any non-css-pixel
	// but this function will work with any scaling (including twips or core pixels)
	rescale: function (point, oldZoom, newZoom) {
		return L.point(
			point.x * this.scale(newZoom - oldZoom),
			point.y * this.scale(newZoom - oldZoom),
		);
	},

	distance: function (latlng1, latlng2) {
		var dx = latlng2.lng - latlng1.lng,
		    dy = latlng2.lat - latlng1.lat;

		return Math.sqrt(dx * dx + dy * dy);
	},

	// coordinate space is unbounded (infinite in all directions)
	infinite: true,
};
