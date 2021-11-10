/* -*- js-indent-level: 8 -*- */
/*
 * L.Handler.Scroll is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

/* global app */
L.Map.mergeOptions({
	scrollHandler: true,
	wheelDebounceTime: 40,
	// Max idle time w.r.t ctrl+wheel events before invoking "zoomStepEnd".
	wheelZoomStepEndAfter: 500,
	// Step size in zoom level(log scale) for ctrl + wheel zoom animation.
	zoomLevelStepSize: 0.3,
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
		var viewCenter = this._map.getCenter();
		var mousePos = this._map.mouseEventToLatLng(e);

		var docLayer = this._map._docLayer;
		if (docLayer.isCalc()) {
			this._zoomCenter = mousePos;
		} else if (docLayer.isWriter()) {
			// Preserve the y coordinate position of the document where the mouse is.
			// Also preserve x coordinate if the current view does not have margins.
			//  If view has margins, we cannot center w.r.t arbitary position in the page because
			//  writer will eventually re-adjust page to the view's center after setting map zoom.
			var part = docLayer._currentPage;
			var rectangle = app.file.writer.pageRectangleList[part];
			var minX = Math.round(rectangle[0] * app.twipsToPixels);
			var maxX = minX + Math.round(rectangle[2] * app.twipsToPixels);
			var viewBounds = this._map.getPixelBoundsCore();
			var useMouseXCenter = viewBounds.min.x >= 0 && viewBounds.max.x <= maxX;

			this._zoomCenter = new L.LatLng(mousePos.lat, useMouseXCenter ? mousePos.lng : viewCenter.lng);

		} else {
			this._zoomCenter = viewCenter;
		}

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
		var lastScrollTime = this._zoomScrollTime;
		this._zoomScrollTime = new Date();
		var map = this._map;
		var mapZoom = map.getZoom();

		var newAnimation = !lastScrollTime ||
			(this._zoomScrollTime - lastScrollTime) > this._map.options.wheelZoomStepEndAfter;

		if (newAnimation && this._inZoomAnimation) {
			// Animation is on-going. Send this frame request to the ongoing one?
			this._zoomScrollTime = undefined;
			return;
		}

		var delta = this._delta;
		map.stop(); // stop panning and fly animations if any

		// Restrict delta to { -1, 0, 1 }
		delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
		delta = Math.max(Math.min(delta, 1), -1);

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		// Compute current zoom-frame's level.
		var prevZoom = newAnimation ? mapZoom : this._zoom;
		this._zoom = map._limitZoom(prevZoom + delta);
		if (newAnimation && this._zoom === mapZoom) {
			// We hit limits, don't start a new animation.
			this._zoomScrollTime = undefined;
			return;
		}

		this._stopZoomInterpolateRAFAt = this._zoomScrollTime.valueOf() + this._map.options.wheelZoomStepEndAfter;

		if (newAnimation) {
			this._inZoomAnimation = true;
			this._map._docLayer.preZoomAnimation();
			this._zoomInterpolateRAF = requestAnimationFrame(this._zoomInterpolateRAFFunc.bind(this));
		}
	},

	// RAF function that generates intermediate zoom-levels between scroll events.
	_zoomInterpolateRAFFunc: function () {
		var lastZoom = this._lastFrameZoom || this._map.getZoom();
		var toZoom = this._zoom; // This can vary while RAF is running.
		var step = this._map.options.zoomLevelStepSize;
		var zoomOut = toZoom < lastZoom;
		var frameZoom = zoomOut ? Math.max(toZoom, lastZoom - step) :
			Math.min(toZoom, lastZoom + step);

		if (frameZoom !== toZoom)
			this._map._docLayer.zoomStep(frameZoom, this._zoomCenter);

		this._lastFrameZoom = frameZoom;
		var now = (new Date()).valueOf();
		if (now < this._stopZoomInterpolateRAFAt)
			this._zoomInterpolateRAF = requestAnimationFrame(this._zoomInterpolateRAFFunc.bind(this));
		else
			this._stopZoomAnimation();
	},

	_stopZoomAnimation: function () {
		cancelAnimationFrame(this._zoomInterpolateRAF); // Already cancelled by now ?
		var zoom = this._zoom;
		var lastCenter = new L.LatLng(this._zoomCenter.lat, this._zoomCenter.lng);
		var map = this._map;
		map._docLayer.zoomStepEnd(zoom, lastCenter,
			// mapUpdater
			function (newMapCenter) {
				map.setView(newMapCenter || lastCenter, zoom);
			},
			// showMarkers
			function () {
				map._docLayer.postZoomAnimation();
				this._inZoomAnimation = false;
			}.bind(this),
			true /* noGap */);
	},
});
