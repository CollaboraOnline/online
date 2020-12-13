/* -*- js-indent-level: 8 -*- */
/*
 * L.SplitterLine is a draggable L.Rectangle to be used as control for split-panes.
 */

L.SplitterLine = L.Rectangle.extend({

	options: {
		color: '#e0e0e0',
		fill: true,
		weight: 1,
		fillOpacity: 1,
		opacity: 1,
		interactive: true,
		fixed: true,
		draggable: true,
		noClip: true,
		isHoriz: true,
		manualDrag: false,
	},

	initialize: function (map, options) {

		this.options.isHoriz = options.isHoriz;
		var latlngBounds = this._calculateLatLngBounds(map);
		L.Rectangle.prototype.initialize.call(this, latlngBounds);
		L.setOptions(this, options);
	},

	_calculateLatLngBounds: function (map) {
		map = map || this._map;
		var splitPanesContext = map.getSplitPanesContext();
		console.assert(splitPanesContext, 'no splitPanesContext!');

		var size = map._docLayer.getMaxDocSize();
		var isHoriz = this.options.isHoriz;
		var splitPos = splitPanesContext.getSplitPos();

		this._lastPos = isHoriz ? splitPos.x : splitPos.y;

		var thickness = 4 * 10 / map._zoom;

		var xmin = isHoriz ? splitPos.x - thickness/2 : -size.x;
		var xmax = isHoriz ? splitPos.x + thickness/2 : size.x;

		// No split line when it is at the zero position
		if (!this._dragStarted && splitPos.y == 0 && !isHoriz) {
			xmin = 0;
			xmax = 0;
		}

		var ymin = !isHoriz ? splitPos.y - thickness/2 : -size.y;
		var ymax = !isHoriz ? splitPos.y + thickness/2 : size.y;

		// No split line when it is at the zero position
		if (!this._dragStarted && splitPos.x == 0 && isHoriz) {
			ymin = 0;
			ymax = 0;
		}
		return new L.LatLngBounds(
			map.unproject(new L.Point(xmin, ymin)),
			map.unproject(new L.Point(xmax, ymax))
		);
	},

	onAdd: function () {

		L.Rectangle.prototype.onAdd.call(this);

		/* FIXME No dragging currently, it still needs a lot of polishing.
		if (!this.dragging) {
			this.makeDraggable();
		}

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var node = nodeData.getNode();
			L.DomEvent.on(node, 'mousedown', this._onDragStart, this);
		}.bind(this));
		*/

		this.addClass('leaflet-pane-splitter');

		this._map.on('zoomlevelschange', this.update, this);
	},

	_onDragStart: function(evt) {
		if (!this._map || !this.dragging) {
			return;
		}

		this._curPos = undefined;

		this._dragStarted = true;
		L.DomEvent.stop(evt);

		this.setBounds(this._calculateLatLngBounds());

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var node = nodeData.getNode();
			L.DomEvent.on(node, 'mousemove', this._onDrag, this);
			L.DomEvent.on(node, 'mouseup', this._onDragEnd, this);
		}.bind(this));


		var data = {
			originalEvent: evt,
			containerPoint: this._map.mouseEventToContainerPoint(evt)
		};
		this.dragging._onDragStart(data);
	},

	_onDrag: function(evt) {

		if (!this._map || !this.dragging)
			return;

		if (!this._moved) {
			this._moved = true;
		}

		var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
		var containerPoint = this._map.mouseEventToContainerPoint(first);

		var maxPos;
		if (this.options.isHoriz) {
			maxPos = this._map.getSize().x;
			this._curPos = Math.min(Math.max(0, containerPoint.x), maxPos);
		}
		else {
			maxPos = this._map.getSize().y;
			this._curPos = Math.min(Math.max(0, containerPoint.y), maxPos);
		}

		this.dragging._onDrag(evt);
	},

	_onDragEnd: function(evt) {
		if (!this._map || !this.dragging)
			return;

		this._pathNodeCollection.forEachNode(function (nodeData) {
			var node = nodeData.getNode();
			L.DomEvent.off(node, 'mousemove', this._onDrag, this);
			L.DomEvent.off(node, 'mouseup', this._onDragEnd, this);
		}.bind(this));

		this._moved = false;


		this.dragging._onDragEnd(evt);
		this._dragStarted = false;

		if (this._curPos !== undefined) {
			var splitPanesContext = this._map.getSplitPanesContext();
			if (this.options.isHoriz) {
				splitPanesContext.setHorizSplitPos(this._curPos);
			}
			else {
				splitPanesContext.setVertSplitPos(this._curPos);
			}

			var newPoint = splitPanesContext.getSplitPos();
			var newPos = this.options.isHoriz ? newPoint.x : newPoint.y;
			if (newPos == this._lastPos) {
				splitPanesContext.updateSplitters();
			}
		}

		this._curPos = undefined;
	},

	update: function () {
		this.setBounds(this._calculateLatLngBounds());
	},

});
