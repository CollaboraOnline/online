/* -*- js-indent-level: 8 -*- */

/* global app cool */

/*
 * window.L.Renderer is a base class for renderer implementations (SVG, Canvas);
 * handles renderer container, bounds and zoom animation.
 */

window.L.Renderer = window.L.Layer.extend({

	options: {
		// how much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction; defaults to clip with the map view
		padding: 0
	},

	initialize: function (options) {

		window.L.Layer.prototype.initialize.call(this);

		window.L.setOptions(this, options);
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
			window.L.DomUtil.addClass(this._container, this.rendererId + '-svg-pane');

		this._update();
	},

	onRemove: function () {
		window.L.DomUtil.remove(this._container);
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

		this._bounds = new cool.Bounds(min, min.add(size.multiplyBy(1 + p * 2)).round());
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
		window.L.DomUtil.addClass(this._container, className);
	},

	removeContainerClass: function (className) {
		window.L.DomUtil.removeClass(this._container, className);
	},

});


window.L.Map.include({
	// used by each vector layer to decide which renderer to use
	getRenderer: function (layer) {
		var renderer = layer.options.renderer || this._getPaneRenderer(layer.options.pane) || this.options.renderer || this._renderer;

		if (!renderer) {
			if (this.getSplitPanesContext()) {
				renderer = this._renderer = (L.SVG && window.L.SplitPanesSVG && window.L.splitPanesSVG()) ||
					(window.L.Canvas && window.L.SplitPanesCanvas && window.L.splitPanesCanvas());
			}
			else {
				renderer = this._renderer = (L.SVG && window.L.svg()) || (window.L.Canvas && window.L.canvas());
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
				renderer = (L.SVG && window.L.SplitPanesSVG && window.L.splitPanesSVG({pane: name})) ||
					(window.L.Canvas && window.L.SplitPanesCanvas && window.L.splitPanesCanvas({pane: name}));
			}
			else {
				renderer = (L.SVG && window.L.svg({pane: name})) || (window.L.Canvas && window.L.canvas({pane: name}));
			}

			window.app.console.assert(renderer, 'Could create a renderer!');
			this._paneRenderers[name] = renderer;
		}

		return renderer;
	}
});
