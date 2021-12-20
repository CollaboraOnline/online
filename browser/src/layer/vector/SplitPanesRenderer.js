/* -*- js-indent-level: 8 -*- */
/*
 * L.SplitPanesRenderer is a base class for split-panes renderer implementations (only SVG for now);
 * handles renderer container, bounds and zoom animation.
 */

L.SplitPanesRenderer = L.Layer.extend({

	options: {
		// how much to extend the clip area around the map view (relative to its size)
		// e.g. 0.1 would be 10% of map view in each direction; defaults to clip with the map view
		padding: 0
	},

	initialize: function (options) {
		L.setOptions(this, options);
		L.stamp(this);
	},

	onAdd: function () {
		window.app.console.assert(this._map.getSplitPanesContext(), 'no split-panes context object!');

		if (!this._container) {
			this._initContainer(); // defined by renderer implementations
		}

		this.getPane().appendChild(this._container);
		this._update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	setParentRenderer: function () {
		window.app.console.error('SplitPanesRenderer cannot be a child renderer!');
	},

	// All child renderers have dedicated event listeners.
	getEvents: function () {
		return {};
	},

	_update: function () {
	},

	getContainer: function () {
		return this._container;
	},
});
