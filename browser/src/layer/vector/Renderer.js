/* -*- js-indent-level: 8 -*- */
/* global app */
/*
 * L.Renderer is a base class for renderer implementations (SVG, Canvas);
 * handles renderer container, bounds and zoom animation.
 */

L.Renderer = L.Layer.extend({

	options: {
		// how much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction; defaults to clip with the map view
		padding: 0
	},

	initialize: function (options) {

		L.Layer.prototype.initialize.call(this);

		L.setOptions(this, options);
		app.util.stamp(this);
	},

	setParentRenderer: function (parent) {
		window.app.console.assert(parent !== this, 'self reference');
		this._parentRenderer = parent;
	},

	onAdd: function () {
		if (!this._container) {
			this._initContainer(); // defined by renderer implementations
		}

		if (this._parentRenderer) {
			this._parentRenderer.getContainer().appendChild(this._container);
		}
		else {
			this.getPane().appendChild(this._container);
		}

		if (this.rendererId)
			L.DomUtil.addClass(this._container, this.rendererId + '-svg-pane');

		this._update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	getEvents: function () {
		var events = {
			moveend: this._update
		};
		return events;
	},

	_update: function () {
		// update pixel bounds of renderer container (for positioning/sizing/clipping later)
		if (this._parentRenderer) {
			var posBounds = this._parentRenderer.getChildPosBounds(this);
			this._position = posBounds.position;
			this._bounds = posBounds.bounds;
			return;
		}

		var p = this.options.padding,
		    size = this._map.getSize(),
		    min = this._map.containerPointToLayerPointIgnoreSplits(size.multiplyBy(-p)).round();

		this._bounds = new L.Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
		this._position = this._bounds.min;
	},

	getContainer: function () {
		return this._container;
	},

	getBounds: function () {
		return this._bounds;
	},

	intersectsBounds: function (pxBounds) {
		return this._bounds.intersects(pxBounds);
	},

	addContainerClass: function (className) {
		L.DomUtil.addClass(this._container, className);
	},

	removeContainerClass: function (className) {
		L.DomUtil.removeClass(this._container, className);
	},

});


L.Map.include({
	// used by each vector layer to decide which renderer to use
	getRenderer: function (layer) {
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			if (this.getSplitPanesContext()) {
				renderer = this._renderer = (L.SVG && L.SplitPanesSVG && L.splitPanesSVG()) ||
					(L.Canvas && L.SplitPanesCanvas && L.splitPanesCanvas());
			}
			else {
				renderer = this._renderer = (L.SVG && L.svg()) || (L.Canvas && L.canvas());
			}
		}

		window.app.console.assert(renderer, 'Could create a renderer!');

		if (!this.hasLayer(renderer)) {
			this.addLayer(renderer);
		}
		return renderer;
	},

	_getPaneRenderer: function (name) {
		if (name === 'overlayPane' || name === undefined) {
			return false;
		}

		var renderer = this._paneRenderers[name];
		if (renderer === undefined) {
			if (this.getSplitPanesContext()) {
				renderer = (L.SVG && L.SplitPanesSVG && L.splitPanesSVG({pane: name})) ||
					(L.Canvas && L.SplitPanesCanvas && L.splitPanesCanvas({pane: name}));
			}
			else {
				renderer = (L.SVG && L.svg({pane: name})) || (L.Canvas && L.canvas({pane: name}));
			}

			window.app.console.assert(renderer, 'Could create a renderer!');
			this._paneRenderers[name] = renderer;
		}

		return renderer;
	}
});
