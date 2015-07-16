/*
 * L.Map.Mouse is handling mouse interaction with the document
 */

L.Map.mergeOptions({
	mouse: true,
});

L.Map.Mouse = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
		this._mouseEventsQueue = [];
	},

	addHooks: function () {
		this._map.on('mousedown mouseup mouseover mouseout mousemove dblclick',
			this._onMouseEvent, this);
	},

	_onMouseEvent: function (e) {
		var docLayer = this._map._docLayer;
		if (docLayer._graphicMarker && docLayer._graphicMarker.isDragged) {
			return;
		}

		if (docLayer._startMarker.isDragged === true || docLayer._endMarker.isDragged === true) {
			return;
		}

		if (e.type === 'mousedown') {
			this._mouseDown = true;
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
			}
			var mousePos = docLayer._latLngToTwips(e.latlng);
			this._mouseEventsQueue.push(L.bind(function() {
				docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1);}, docLayer));
			this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), 500);
		}
		else if (e.type === 'mouseup') {
			this._mouseDown = false;
			if (this._map.dragging.enabled()) {
				if (this._mouseEventsQueue.length === 0) {
					// mouse up after panning
					return;
				}
			}
			clearTimeout(this._holdMouseEvent);
			this._holdMouseEvent = null;
			if (this._clickTime && Date.now() - this._clickTime <= 250) {
				// double click, a click was sent already
				this._mouseEventsQueue = [];
				return;
			}
			else {
				this._clickTime = Date.now();
				mousePos = docLayer._latLngToTwips(e.latlng);
				var timeOut = 250;
				if (docLayer._permission === 'edit') {
					timeOut = 0;
				}
				this._mouseEventsQueue.push(L.bind(function() {
					// if it's a click or mouseup after selecting
					if (this._mouseEventsQueue.length > 1) {
						// it's a click, fire mousedown
						this._mouseEventsQueue[0]();
						if (docLayer._permission === 'view') {
							docLayer._map.setPermission('edit');
						}
					}
					this._mouseEventsQueue = [];
					docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);
					docLayer._textArea.focus();
				}, this, docLayer));
				this._holdMouseEvent = setTimeout(L.bind(this._executeMouseEvents, this), timeOut);

				if (docLayer._startMarker._icon) {
					L.DomUtil.removeClass(docLayer._startMarker._icon, 'leaflet-not-clickable');
				}
				if (docLayer._endMarker._icon) {
					L.DomUtil.removeClass(docLayer._endMarker._icon, 'leaflet-not-clickable');
				}
			}
		}
		else if (e.type === 'mousemove' && this._mouseDown) {
			if (this._holdMouseEvent) {
				clearTimeout(this._holdMouseEvent);
				this._holdMouseEvent = null;
				if (this._map.dragging.enabled()) {
					// The user just panned the document
					this._mouseEventsQueue = [];
					return;
				}
				for (var i = 0; i < this._mouseEventsQueue.length; i++) {
					// synchronously execute old mouse events so we know that
					// they arrive to the server before the move command
					this._mouseEventsQueue[i]();
				}
				this._mouseEventsQueue = [];
			}
			if (!this._map.dragging.enabled()) {
				mousePos = docLayer._latLngToTwips(e.latlng);
				docLayer._postMouseEvent('move', mousePos.x, mousePos.y, 1);
				if (docLayer._startMarker._icon) {
					L.DomUtil.addClass(docLayer._startMarker._icon, 'leaflet-not-clickable');
				}
				if (docLayer._endMarker._icon) {
					L.DomUtil.addClass(docLayer._endMarker._icon, 'leaflet-not-clickable');
				}
			}
		}
		else if (e.type === 'dblclick') {
			mousePos = docLayer._latLngToTwips(e.latlng);
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 1);
			docLayer._postMouseEvent('buttondown', mousePos.x, mousePos.y, 2);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 2);
			docLayer._postMouseEvent('buttonup', mousePos.x, mousePos.y, 1);
		}
	},

	_executeMouseEvents: function () {
		this._holdMouseEvent = null;
		for (var i = 0; i < this._mouseEventsQueue.length; i++) {
			this._mouseEventsQueue[i]();
		}
		this._mouseEventsQueue = [];
	}
});

L.Map.addInitHook('addHandler', 'mouse', L.Map.Mouse);
