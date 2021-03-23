/*
 * A Leaflet layer that shows dark overlay around focused object.
 *
 */

L.ObjectFocusDarkOverlay = L.Layer.extend({
	onAdd: function() {
	}
});

// LibreOffice-specific functionality follows.

/*
 * A L.ObjectFocusDarkOverlay
 */
L.ObjectFocusDarkOverlay = L.ObjectFocusDarkOverlay.extend({
	onRemove: function() {
		this._parts.clearLayers();
		this._map.removeLayer(this._parts);
		this._parts = null;
	},

	// coordinates are in Twips
	_addPart: function(x, y, w, h) {
		var rectangles = [];
		var topLeftTwips = new L.Point(parseInt(x), parseInt(y));
		var topRightTwips = topLeftTwips.add(new L.Point(parseInt(w), 0));
		var bottomLeftTwips = topLeftTwips.add(new L.Point(0, parseInt(h)));
		var bottomRightTwips = topLeftTwips.add(new L.Point(parseInt(w), parseInt(h)));
		rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);

		var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this._map._docLayer);
		var part = new L.Polygon(polygons, {
			pointerEvents: 'none',
			fillColor: 'black',
			fillOpacity: 0.25,
			weight: 0,
			opacity: 0.25});

		this._parts.addLayer(part);
	},

	// args: {x, y, w, h}
	// defines area where the focused element is placed, values are in Twips
	show: function(args) {
		this._parts = new L.LayerGroup();
		this._map.addLayer(this._parts);

		var fullWidth = 1000000;
		var fullHeight = 1000000;

		this._addPart(0, 0, fullWidth, args.y);
		this._addPart(0, args.y, args.x, args.h);
		this._addPart(args.x + args.w, args.y, fullWidth, args.h);
		this._addPart(0, (args.y + args.h), fullWidth, fullHeight);
	}
});
