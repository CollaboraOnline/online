/* -*- js-indent-level: 8 -*- */
/*
 * L.SVGGroup
 */

L.SVGGroup = L.Layer.extend({

	options: {
		noClip: true,
		manualDrag: false
	},

	initialize: function (bounds, options) {
		L.setOptions(this, options);
		this._bounds = bounds;
		this._rect = L.rectangle(bounds, this.options);
		if (L.Browser.touch && !L.Browser.pointer) {
			this.options.manualDrag = true;
		}

		this.on('dragstart scalestart rotatestart', this._showEmbeddedSVG, this);
		this.on('dragend scaleend rotateend', this._hideEmbeddedSVG, this);
	},

	setVisible: function (visible) {
		if (this._svg != null) {
			if (visible)
				this._svg.setAttribute('visibility', 'visible');
			else
				this._svg.setAttribute('visibility', 'hidden');
		}
	},

	sizeSVG: function () {
		var size = L.bounds(this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
			this._map.latLngToLayerPoint(this._bounds.getSouthEast())).getSize();

		this._svg.setAttribute('width', size.x);
		this._svg.setAttribute('height', size.y);
	},

	parseSVG: function (svgString) {
		var parser = new DOMParser();
		return parser.parseFromString(svgString, 'image/svg+xml');
	},

	addEmbeddedSVG: function (svgString) {
		var doc = this.parseSVG(svgString);

		if (doc.lastChild.localName !== 'svg')
			return;

		this._svg = this._path.insertBefore(doc.lastChild, this._rect._path);
		this._dragShape = this._rect._path;
		this._svg.setAttribute('pointer-events', 'none');
		this._svg.setAttribute('opacity', this._dragStarted ? 1 : 0);
		this.sizeSVG();
		this._update();
	},

	_onDragStart: function(evt) {
		if (!this._map || !this._dragShape || !this.dragging)
			return;
		this._dragStarted = true;
		this._moved = false;

		if (!this.options.manualDrag) {
			L.DomEvent.on(this._dragShape, 'mousemove', this._onDrag, this);
			L.DomEvent.on(this._dragShape, 'mouseup', this._onDragEnd, this);
			if (this.dragging.constraint)
				L.DomEvent.on(this._dragShape, 'mouseout', this._onDragEnd, this);
		}

		var data = {
			originalEvent: evt,
			containerPoint: this._map.mouseEventToContainerPoint(evt)
		};
		this.dragging._onDragStart(data);

		var pos = this._map.mouseEventToLatLng(evt);
		this.fire('graphicmovestart', {pos: pos});
	},

	_onDrag: function(evt) {
		if (!this._map || !this._dragShape || !this.dragging)
			return;

		if (!this._moved) {
			this._moved = true;
			this._showEmbeddedSVG();
		}

		this.dragging._onDrag(evt);
	},

	_onDragEnd: function(evt) {
		if (!this._map || !this._dragShape || !this.dragging)
			return;

		if (!this.options.manualDrag) {
			L.DomEvent.off(this._dragShape, 'mousemove', this._onDrag, this);
			L.DomEvent.off(this._dragShape, 'mouseup', this._onDragEnd, this);
			if (this.dragging.constraint)
				L.DomEvent.off(this._dragShape, 'mouseout', this._onDragEnd, this);
		}

		this._moved = false;
		this._hideEmbeddedSVG();

		if (this._map) {
			var pos = this._map.mouseEventToLatLng(evt);
			this.fire('graphicmoveend', {pos: pos});
		}

		if (this.options.manualDrag || evt.type === 'mouseup')
			this.dragging._onDragEnd(evt);
		this._dragStarted = false;
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
		this._dragStarted = false;
		this._renderer = this._map.getRenderer(this);
		this._renderer._initGroup(this);
		this._renderer._initPath(this._rect);
		this._renderer._addGroup(this);

		if (this._path && this._rect._path) {
			this._rect._map = this._map;
			this._rect._renderer = this._renderer;
			L.DomUtil.addClass(this._path, 'leaflet-control-buttons-disabled');

			if (this.options.svg) {
				var doc = this.parseSVG(this.options.svg);
				if (doc && doc.lastChild.localName === 'svg') {
					this._svg = this._path.appendChild(doc.lastChild);
					this._svg.setAttribute('opacity', 0);
					this._svg.setAttribute('pointer-events', 'none');
					this.sizeSVG();
				}
				delete this.options.svg;
			}

			this._path.appendChild(this._rect._path);
			this._dragShape = this._rect._path;

			if (!this.options.manualDrag) {
				L.DomEvent.on(this._rect._path, 'mousedown', this._onDragStart, this);
			}
		}
		this._update();
	},

	onRemove: function () {
		this._rect._map = this._rect._renderer = null;
		this.removeInteractiveTarget(this._rect._path);
		L.DomUtil.remove(this._rect._path);
		this.removeEmbeddedSVG();
		this._renderer._removeGroup(this);
	},

	removeEmbeddedSVG: function () {
		if (this._svg) {
			this._dragShape = null;
			L.DomUtil.remove(this._svg);
			delete this._svg;
			this._update();
		}
	},

	_hideEmbeddedSVG: function () {
		if (this._svg) {
			this._svg.setAttribute('opacity', 0);
		}
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

	_showEmbeddedSVG: function () {
		if (this._svg) {
			this._svg.setAttribute('opacity', 1);
		}
	},

	_update: function () {
		this._rect.setBounds(this._bounds);
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
