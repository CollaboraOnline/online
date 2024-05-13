/* -*- js-indent-level: 8 -*- */
/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

L.Map.mergeOptions({
	dragging: true
});

L.Map.Drag = L.Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new L.Draggable(map._mapPane, map._container);
			this._draggable._map = map;

			this._draggable.on({
				down: this._onDown,
				dragstart: this._onDragStart,
				predrag: this._onPreDrag,
				drag: this._onDrag,
				dragend: this._onDragEnd
			}, this);
		}
		this._draggable.enable();
	},

	removeHooks: function () {
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDown: function () {
		this._map.stop();
	},

	_onDragStart: function () {
		this._dragEdgeOffset = new L.Point(0, 0);

		var map = this._map;

		map
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onDrag: function (e) {
		this._map
		    .fire('move', e)
		    .fire('drag', e);
	},

	_onPreDrag: function () {
		var org = this._map.getPixelOrigin();
		var pos = this._map._getMapPanePos();
		var size = this._map.getLayerMaxBounds().getSize().subtract(this._map.getSize());

		if (this._draggable._newPos.x !== pos.x) {
			let clampedX = Math.max(
				Math.min(org.x, this._draggable._newPos.x),
				org.x - Math.max(size.x, 0)
			);
			this._dragEdgeOffset.x = Math.min(this._dragEdgeOffset.x, clampedX - this._draggable._newPos.x);
			this._draggable._newPos.x = this._draggable._newPos.x + this._dragEdgeOffset.x;
		}

		if (this._draggable._newPos.y !== pos.y) {
			let clampedY = Math.max(
				Math.min(org.y, this._draggable._newPos.y),
				org.y - Math.max(size.y, 0)
			);
			this._dragEdgeOffset.y = Math.min(this._dragEdgeOffset.y, clampedY - this._draggable._newPos.y);
			this._draggable._newPos.y = this._draggable._newPos.y + this._dragEdgeOffset.y;
		}
	},

	_onDragEnd: function (e) {
		var map = this._map;

		map.fire('dragend', e);
		map.fire('moveend');
	}
});
