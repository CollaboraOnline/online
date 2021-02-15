/* -*- js-indent-level: 8 -*- */
/*
 * L.Handler.Scroll is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

L.Map.mergeOptions({
	scrollHandler: true,
	wheelDebounceTime: 40
});

L.Map.Scroll = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, {
			wheel: this._onWheelScroll,
			mousewheel: this._onWheelScroll,
			MozMousePixelScroll: L.DomEvent.preventDefault
		}, this);

		this._delta = 0;
		this._vertical = 1;
		this.lastY = 0;
		this.lastX = 0;

		if (!this._map.touchGesture) {
			L.DomEvent.on(this._map._container, {
				touchstart: this._onTouchScrollStart,
				touchmove: this._onTouchScroll,
			}, this);
		}
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, {
			mousewheel: this._onWheelScroll,
			MozMousePixelScroll: L.DomEvent.preventDefault
		}, this);
		if (!this._map.touchGesture) {
			L.DomEvent.off(this._map._container, {
				touchstart: this._onTouchScrollStart,
				touchmove: this._onTouchScroll,
			}, this);
		}
	},

	_onTouchScrollStart: function (e) {
		this.lastX = e.touches[0].clientX;
		this.lastY = e.touches[0].clientY;
	},

	_onTouchScroll: function (e) {
		var top = e.touches[0].clientY;
		var start = e.touches[0].clientX;
		var deltaX = (start - this.lastX);
		var deltaY = (top - this.lastY);
		var debounce = this._map.options.wheelDebounceTime;
		if (!this._startTime) {
			this._startTime = +new Date();
		}
		var left = Math.max(debounce - (+new Date() - this._startTime), 0);
		clearTimeout(this._timer);

		this.lastY = top;
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			this._vertical = 0;
			this._delta += deltaX / 120;
		} else {
			this._delta += deltaY / 120;
			this._vertical = 1;
		}
		this._timer = setTimeout(L.bind(this._performScroll, this), left);
	},

	_onWheelScroll: function (e) {
		var delta =  -1 * e.deltaY; // L.DomEvent.getWheelDelta(e);
		var debounce = this._map.options.wheelDebounceTime;

		this._delta = delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		if (e.ctrlKey) {
			this._timer = setTimeout(L.bind(this._performZoom, this), left);
		}

		L.DomEvent.stop(e);
	},

	_performScroll: function () {
		var map = this._map,
		    delta = -this._delta,
		    scrollAmount = Math.round(map.getSize().y / 20);

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }
		map.fire('scrollby', {x: (1 - this._vertical) * delta * scrollAmount, y: this._vertical * delta * scrollAmount});
	},

	_performZoom: function () {
		var map = this._map,
		    delta = this._delta,
		    zoom = map.getZoom();

		map.stop(); // stop panning and fly animations if any

		delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
		delta = Math.max(Math.min(delta, 1), -1);
		delta = map._limitZoom(zoom + delta) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else { // eslint-disable-next-line no-lonely-if
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});
