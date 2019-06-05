/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.Map.CalcTap is used to enable mobile taps.
 */

/* global Hammer */
L.Map.CalcTap = L.Handler.extend({
	addHooks: function () {
		if (!this._toolbar) {
			this._toolbar = L.control.contextToolbar();
		}

		if (!this._hammer) {
			this._hammer = new Hammer(this._map._mapPane);
			this._hammer.get('swipe').set({
				direction: Hammer.DIRECTION_ALL
			});
			this._hammer.get('pan').set({
				direction: Hammer.DIRECTION_ALL
			});
		}
		this._hammer.on('hammer.input', L.bind(this._onHammer, this));
		this._hammer.on('tap', L.bind(this._onTap, this));
		this._hammer.on('swipe', L.bind(this._onSwipe, this));
		this._map.on('updatepermission', this._onPermission, this);
	},

	removeHooks: function () {
		this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
		this._hammer.off('press', L.bind(this._onPress, this));
		this._hammer.off('tap', L.bind(this._onTap, this));
		this._hammer.off('swipe', L.bind(this._onSwipe, this));
		this._hammer.off('panstart', L.bind(this._onPanStart, this));
		this._hammer.off('pan', L.bind(this._onPan, this));
		this._hammer.off('panend', L.bind(this._onPanEnd, this));
	},

	_onPermission: function (e) {
		if (e.perm == 'edit') {
			this._hammer.on('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.on('press', L.bind(this._onPress, this));
			this._hammer.on('panstart', L.bind(this._onPanStart, this));
			this._hammer.on('pan', L.bind(this._onPan, this));
			this._hammer.on('panend', L.bind(this._onPanEnd, this));
		} else {
			this._hammer.off('doubletap', L.bind(this._onDoubleTap, this));
			this._hammer.off('press', L.bind(this._onPress, this));
			this._hammer.off('panstart', L.bind(this._onPanStart, this));
			this._hammer.off('pan', L.bind(this._onPan, this));
			this._hammer.off('panend', L.bind(this._onPanEnd, this));
		}
	},

	_onHammer: function (e) {
		L.DomEvent.preventDefault(e.srcEvent);
		L.DomEvent.stopPropagation(e.srcEvent);
	},

	_onPress: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		if (this._map._docLayer.containsSelection(latlng)) {
			this._toolbar._pos = containerPoint;
			this._toolbar.addTo(this._map);
		} else {
			this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
			// send right click to trigger context menus
			this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 4, 0);
			this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 4, 0);
		}

		e.preventDefault();
	},

	_onTap: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._contextMenu._onMouseDown({originalEvent: e.srcEvent});
		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
	},

	_onDoubleTap: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);

		if (!this._map.hasFocus()) {
			setTimeout(L.bind(this._map.focus, this._map), 0);
		}
	},

	_onPanStart: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1, 1, 0);
	},

	_onPan: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1, 1, 0);
	},

	_onPanEnd: function (e) {
		var point = e.pointers[0],
		    containerPoint = this._map.mouseEventToContainerPoint(point),
		    layerPoint = this._map.containerPointToLayerPoint(containerPoint),
		    latlng = this._map.layerPointToLatLng(layerPoint),
		    mousePos = this._map._docLayer._latLngToTwips(latlng);

		this._map._docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1, 1, 0);
	},

	_onSwipe: function (e) {
		var evt = e.pointers[0];

		var iniEvent = {
			type: 'mousedown',
			canBubble: false,
			cancelable: true,
			screenX: evt.screenX,
			screenY: evt.screenY,
			clientX: evt.clientX,
			clientY: evt.clientY,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			metaKey: false,
			button: 0,
			target: evt.target,
			preventDefault: function () {}
		};

		var endEvent = {
			type: 'mousemove',
			canBubble: false,
			cancelable: true,
			screenX: evt.screenX,
			screenY: evt.screenY,
			clientX: evt.clientX + e.deltaX,
			clientY: evt.clientY + e.deltaY,
			ctrlKey: false,
			altKey: false,
			shiftKey: false,
			metaKey: false,
			button: 0,
			target: evt.target,
			preventDefault: function () {}
		};

		this._map.dragging._draggable._onDown(iniEvent);
		this._map.dragging._draggable._moved = true;
		this._map.dragging._draggable._onMove(endEvent);
		setTimeout(L.bind(this._map.dragging._draggable._onUp, this._map.dragging._draggable, endEvent), 0);
	}
});
