/*
 * A Leaflet layer that shows dark overlay around focused object.
 *
 */

L.ObjectFocusDarkOverlay = L.Layer.extend({
	onAdd: function() {
	},

	remove: function() {
	},
});

// Libreoffice-specific functionality follows.

/*
 * A L.ObjectFocusDarkOverlay
 */
L.ObjectFocusDarkOverlay = L.ObjectFocusDarkOverlay.extend({
	onAdd: function(map) {
		map.on('inplace', this._onStateChanged, this);
	},

	remove: function() {
		this._map.off('inplace', this._onStateChanged, this);
		this._parts.clearLayers();
		this._map.removeLayer(this._parts);
	},

	// coordinates are in Twips
	_addPart: function(x, y, w, h) {
		var rectangles = [];
		var topLeftTwips = new L.Point(x, y);
		var topRightTwips = topLeftTwips.add(new L.Point(w, 0));
		var bottomLeftTwips = topLeftTwips.add(new L.Point(0, h));
		var bottomRightTwips = topLeftTwips.add(new L.Point(w, h));
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

	_onStateChanged: function(args) {
		if (args.off && args.off === true) {
			this._parts.clearLayers();
			this._map.removeLayer(this._parts);
			this._parts = null;
			return;
		}

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
