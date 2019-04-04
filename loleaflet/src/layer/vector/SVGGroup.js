/* -*- js-indent-level: 8 -*- */
/*
 * L.SVGGroup
 */

L.SVGGroup = L.Layer.extend({

	options: {
		noClip: true
	},

	lastTouchEvent: {
		clientX: 0,
		clientY: 0
	},

	initialize: function (bounds, options) {
		L.setOptions(this, options);
		this._bounds = bounds;
		this._rect = L.rectangle(bounds, this.options);

		this.on('dragstart scalestart rotatestart', this._showEmbeddedSVG, this);
		this.on('dragend scaleend rotateend', this._hideEmbeddedSVG, this);
	},

	addEmbeddedSVG: function (svgString) {
		var parser = new DOMParser();
		var doc = parser.parseFromString(svgString, 'image/svg+xml');
		var size = L.bounds(this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
			this._map.latLngToLayerPoint(this._bounds.getSouthEast())).getSize();

		if (doc.lastChild.localName !== 'svg')
			return;

		if (svgString.indexOf('XTEXT_PAINTSHAPE_BEGIN') !== -1) {
			this._svg = this._path.insertBefore(doc.lastChild, this._rect._path);
			this._rect._path.setAttribute('pointer-events', 'visibleStroke');
			this._svg.setAttribute('pointer-events', 'none');
		} else {
			L.DomUtil.remove(this._rect._path);
			this._svg = this._path.appendChild(doc.lastChild);
			this._svg.setAttribute('pointer-events', 'visiblePainted');
			L.DomEvent.on(this._svg, 'mousedown', this._onDragStart, this);
			this._dragShape = this._svg;
		}

		this._svg.setAttribute('opacity', 0);
		this._svg.setAttribute('width', size.x);
		this._svg.setAttribute('height', size.y);

		this._update();
	},

	_onDragStart: function(evt) {
		if (evt.type === 'touchstart') {
			this.lastTouchEvent.clientX = evt.touches[0].clientX;
			this.lastTouchEvent.clientY = evt.touches[0].clientY;
		}

		if (!this._dragShape)
			return;
		this._moved = false;

		L.DomEvent.on(this._dragShape, 'mousemove', this._onDrag, this);
		L.DomEvent.on(this._dragShape, 'mouseup', this._onDragEnd, this);

		L.DomEvent.on(this._dragShape, 'touchmove', this._onDrag, this);
		L.DomEvent.on(this._dragShape, 'touchend', this._onDragEnd, this);

		var data = {
			originalEvent: evt,
			containerPoint: this._map.mouseEventToContainerPoint(evt)
		};
		this.dragging._onDragStart(data);

		var pos = this._map.mouseEventToLatLng(evt);
		this.fire('graphicmovestart', {pos: pos});
	},

	_onDrag: function(evt) {
		if (evt.type === 'touchmove') {
			this.lastTouchEvent.clientX = evt.touches[0].clientX;
			this.lastTouchEvent.clientY = evt.touches[0].clientY;
		}

		if (!this._dragShape)
			return;

		if (!this._moved) {
			this._moved = true;
			this._showEmbeddedSVG();
		}

		var data = {
			originalEvent: evt,
			containerPoint: this._map.mouseEventToContainerPoint(evt)
		};
		this.dragging._onDrag(data);

	},

	_onDragEnd: function(evt) {
		if (evt.type === 'touchend' && evt.touches.length == 0)
			evt.touches[0] = {clientX: this.lastTouchEvent.clientX, clientY: this.lastTouchEvent.clientY};

		if (!this._dragShape)
			return;
		L.DomEvent.off(this._dragShape, 'mousemove', this._onDrag, this);
		L.DomEvent.off(this._dragShape, 'mouseup', this._onDragEnd, this);

		L.DomEvent.off(this._dragShape, 'touchmove', this._onDrag, this);
		L.DomEvent.off(this._dragShape, 'touchend', this._onDragEnd, this);

		this._moved = false;
		this._hideEmbeddedSVG();
		var pos = this._map.mouseEventToLatLng(evt);
		this.fire('graphicmoveend', {pos: pos});

		this.dragging._onDragEnd(evt);
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
			L.DomUtil.addClass(this._path, 'leaflet-control-buttons-disabled');
			this._path.appendChild(this._rect._path);
			this._dragShape = this._rect._path;
			L.DomEvent.on(this._rect._path, 'mousedown', this._onDragStart, this);
			L.DomEvent.on(this._rect._path, 'touchstart', this._onDragStart, this);
		}
		this._update();
	},

	onRemove: function () {
		this._rect._map = this._rect._renderer = null;
		this.removeInteractiveTarget(this._rect._path);
		L.DomUtil.remove(this._rect._path);
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
