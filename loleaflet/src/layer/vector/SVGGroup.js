/* -*- js-indent-level: 8 -*- */
/*
 * L.SVGGroup
 */

L.SVGGroup = L.Layer.extend({

	initialize: function (bounds, options) {
		L.setOptions(this, options);
		this._bounds = bounds;
		this._rect = L.rectangle(bounds, options);
	},

	addFromString: function (svgString) {
		var parser = new DOMParser();
		var doc = parser.parseFromString(svgString, 'image/svg+xml');
		var size = L.bounds(this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
			this._map.latLngToLayerPoint(this._bounds.getSouthEast())).getSize();

		this._svg = this._path.appendChild(doc.lastChild);
		this._svg.setAttribute('width', size.x);
		this._svg.setAttribute('height', size.y);
		this._svg.setAttribute('preserveAspectRatio', 'xMinYMin');
		this._update();
	},

	bringToFront: function () {
		if (this._renderer) {
			this._renderer._bringToFront(this);
		}
		return this;
	},

	bringToBack: function () {
		if (this._renderer) {
			this._renderer._bringToBack(this);
		}
		return this;
	},

	getBounds: function () {
		return this._bounds;
	},

	getEvents: function () {
		return {};
	},

	onAdd: function () {
		this._renderer = this._map.getRenderer(this);
		this._renderer._initGroup(this);
		this._renderer._initPath(this._rect);
		this._renderer._addGroup(this);
		if (this._path && this._rect._path) {
			this._rect._map = this._map;
			this._rect._renderer = this._renderer;
			this._path.appendChild(this._rect._path);
			this.addInteractiveTarget(this._rect._path);
		}
		this._update();
	},

	onRemove: function () {
		this._rect._map = this._rect._renderer = null;
		this._path.removeChild(this._rect._path);
		this._renderer._removeGroup(this);
	},

	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	_project: function () {
		// console.log()
	},

	_reset: function () {
		this._update();
	},

	_update: function () {
		this._rect.setBounds(this._bounds);
		this._rect._reset();
		if (this._svg) {
			var point = this._map.latLngToLayerPoint(this._bounds.getNorthWest());
			this._svg.setAttribute('x', point.x);
			this._svg.setAttribute('y', point.y);
		}
	},

	_updatePath: function () {
		this._update();
	}

});

L.svgGroup = function (bounds, options) {
	return new L.SVGGroup(bounds, options);
};
