/*
 * A Leaflet layer that draws grid lines for spreadsheet row/column separators.
 */

L.CalcGridLines = L.LayerGroup.extend({
	// Options given to L.CalcGridLines will be propagated into the spawned
	// L.PolyLines. Default is thin grey lines.
	options: {
		color: '#c0c0c0',
		weight: 1,
		interactive: false
	},


	initialize: function(options) {
		L.LayerGroup.prototype.initialize.call(this, options);
		this._rowLines = L.layerGroup();
		this._colLines = L.layerGroup();
	},

	onAdd: function(map) {

		// The SVG renderer needs some specific customizations
		if (!this.options.renderer) {
			map.createPane('calc-background');

			this.options.renderer = new L.SVG({
				pane: 'calc-background'
			});

			// Hack the _updatePoly private method so it offsets all SVG path coordinates
			// to 0.5. This makes the rendered lines align to the screen pixel grid
			// nicely (at least in non-HPI screens)
			this.options.renderer._updatePoly = function(layer, closed) {
				var str = '', i, j, len, len2, points, p, rings = layer._parts;

				for (i = 0, len = rings.length; i < len; i++) {
					points = rings[i];

					for (j = 0, len2 = points.length; j < len2; j++) {
						p = points[j];
						str += (j ? 'L' : 'M') + (Math.ceil(p.x) - 0.5) + ' ' + (Math.ceil(p.y) - 0.5);
					}

					// closes the ring for polygons; "x" is VML syntax
					str += closed ? (L.Browser.svg ? 'z' : 'x') : '';
				}

				// SVG complains about empty path strings
				if (str === '') {
					str = 'M0 0';
				}

				this._setPath(layer, str, closed);
			}.bind(this.options.renderer);
		}

		this._map.on('viewrowcolumnheaders', this.onUpdate, this);

		this.addLayer(this._rowLines);
		this.addLayer(this._colLines);

	},

	remove: function() {
		this._map.off('viewrowcolumnheaders', this.onUpdate, this);

		this.removeLayer(this._rowLines);
		this.removeLayer(this._colLines);
	},

	// Redraw col/row lines whenever new information about them is available.
	// One websocket message might have info about cols, rows, or both
	onUpdate: function onUpdate(ev) {
		var ticks;

		// Aux stuff to scale twips from the websocket message
		// into map coordinate units
		var pixelToMapUnitRatio = this._map.options.crs.scale(this._map.getZoom());

		if (ev.data.columns && ev.data.columns.length) {
			ticks = new L.Control.Header.GapTickMap(this._map, ev.data.columns, 1024);
			this._colLines.clearLayers();

			ticks.forEachTick(function(idx, pos) {
				pos /= pixelToMapUnitRatio;
				this._colLines.addLayer(
					L.polyline([[[ L.Util.MIN_SAFE_INTEGER, pos ],[ L.Util.MAX_SAFE_INTEGER, pos ]]],
						this.options
					)
				);
			}.bind(this));
		}

		if (ev.data.rows && ev.data.rows.length) {
			ticks = new L.Control.Header.GapTickMap(this._map, ev.data.rows, 500001);
			this._rowLines.clearLayers();

			ticks.forEachTick(function(idx, pos) {
				pos /= pixelToMapUnitRatio;
				this._rowLines.addLayer(
					// Note that y-coordinates are inverted: Leaflet's CRS.Simple assumes
					// down = negative latlngs, whereas loolkit assumes down = positive twips
					L.polyline([[[ -pos, L.Util.MIN_SAFE_INTEGER ],[ -pos, L.Util.MAX_SAFE_INTEGER ]]],
						this.options
					)
				);
			}.bind(this));
		}
	}

});

