/* -*- js-indent-level: 8 -*- */
/*
 * L.CanvasTileLayer is a L.TileLayer with canvas based rendering.
 */

L.TileCoordData = L.Class.extend({

	initialize: function (left, top, zoom, part) {
		this.x = left;
		this.y = top;
		this.z = zoom;
		this.part = part;
	},

	getPos: function () {
		return new L.Point(this.x, this.y);
	},

	key: function () {
		return this.x + ':' + this.y + ':' + this.z + ':' + this.part;
	},

	toString: function () {
		return '{ left : ' + this.x + ', top : ' + this.y +
			', z : ' + this.z + ', part : ' + this.part + ' }';
	}
});

L.TileCoordData.parseKey = function (keyString) {

	console.assert(typeof keyString === 'string', 'key should be a string');
	var k = keyString.split(':');
	console.assert(k.length >= 4, 'invalid key format');
	return new L.TileCoordData(+k[0], +k[1], +k[2], +k[3]);
};

L.CanvasTilePainter = L.Class.extend({

	options: {
		debug: false,
	},

	initialize: function (layer, dpiScale, enableImageSmoothing) {
		this._layer = layer;
		this._canvas = this._layer._canvas;

		if (dpiScale === 1 || dpiScale === 2) {
			enableImageSmoothing = (enableImageSmoothing === true);
		}
		else {
			enableImageSmoothing = (enableImageSmoothing === undefined || enableImageSmoothing);
		}

		this._dpiScale = dpiScale;

		this._map = this._layer._map;
		this._setupCanvas(enableImageSmoothing);

		this._topLeft = undefined;
		this._lastZoom = undefined;
		this._lastPart = undefined;
		var splitPanesContext = this._layer.getSplitPanesContext();
		this._splitPos = splitPanesContext ?
			splitPanesContext.getSplitPos() : new L.Point(0, 0);

		this._tileSizeCSSPx = undefined;
		this._updatesRunning = false;
	},

	isUpdatesRunning: function () {
		return this._updatesRunning;
	},

	startUpdates: function () {
		if (this._updatesRunning === true) {
			return false;
		}

		this._updatesRunning = true;
		this._updateWithRAF();
		return true;
	},

	stopUpdates: function () {
		if (this._updatesRunning) {
			L.Util.cancelAnimFrame(this._canvasRAF);
			this.update();
			this._updatesRunning = false;
			return true;
		}

		return false;
	},

	dispose: function () {
		this.stopUpdates();
	},

	setImageSmoothing: function (enable) {
		this._canvasCtx.imageSmoothingEnabled = enable;
		this._canvasCtx.msImageSmoothingEnabled = enable;
	},

	_setupCanvas: function (enableImageSmoothing) {
		console.assert(this._canvas, 'no canvas element');
		this._canvasCtx = this._canvas.getContext('2d', { alpha: false });
		this.setImageSmoothing(enableImageSmoothing);
		var mapSize = this._map.getPixelBounds().getSize();
		this._lastSize = mapSize;
		this._setCanvasSize(mapSize.x, mapSize.y);
	},

	_setCanvasSize: function (widthCSSPx, heightCSSPx) {
		this._canvas.style.width = widthCSSPx + 'px';
		this._canvas.style.height = heightCSSPx + 'px';
		this._canvas.width = Math.floor(widthCSSPx * this._dpiScale);
		this._canvas.height = Math.floor(heightCSSPx * this._dpiScale);

		this._width = parseInt(this._canvas.style.width);
		this._height = parseInt(this._canvas.style.height);
		this.clear();
		this._syncTileContainerSize();
	},

	_syncTileContainerSize: function () {
		var tileContainer = this._layer._container;
		if (tileContainer) {
			tileContainer.style.width = this._width + 'px';
			tileContainer.style.height = this._height + 'px';
		}
	},

	clear: function () {
		this._canvasCtx.save();
		this._canvasCtx.scale(this._dpiScale, this._dpiScale);
		this._canvasCtx.fillStyle = 'white';
		this._canvasCtx.fillRect(0, 0, this._width, this._height);
		this._canvasCtx.restore();
	},

	paint: function (tile, viewBounds, paneBoundsList) {

		if (this._tileSizeCSSPx === undefined) {
			this._tileSizeCSSPx = this._layer._getTileSize();
		}

		var tileTopLeft = tile.coords.getPos();
		var tileSize = new L.Point(this._tileSizeCSSPx, this._tileSizeCSSPx);
		var tileBounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileSize));

		viewBounds = viewBounds || this._map.getPixelBounds();
		var splitPanesContext = this._layer.getSplitPanesContext();
		paneBoundsList = paneBoundsList || (
			splitPanesContext ?
			splitPanesContext.getPxBoundList(viewBounds) :
			[viewBounds]
		);

		for (var i = 0; i < paneBoundsList.length; ++i) {
			var paneBounds = paneBoundsList[i];
			if (!paneBounds.intersects(tileBounds)) {
				continue;
			}

			var topLeft = paneBounds.getTopLeft();
			if (topLeft.x) {
				topLeft.x = viewBounds.min.x;
			}

			if (topLeft.y) {
				topLeft.y = viewBounds.min.y;
			}

			this._canvasCtx.save();
			this._canvasCtx.scale(this._dpiScale, this._dpiScale);
			this._canvasCtx.translate(-topLeft.x, -topLeft.y);

			// create a clip for the pane/view.
			this._canvasCtx.beginPath();
			var paneSize = paneBounds.getSize();
			this._canvasCtx.rect(paneBounds.min.x, paneBounds.min.y, paneSize.x + 1, paneSize.y + 1);
			this._canvasCtx.clip();

			if (this._dpiScale !== 1) {
				// FIXME: avoid this scaling when possible (dpiScale = 2).
				this._canvasCtx.drawImage(tile.el, tile.coords.x, tile.coords.y, this._tileSizeCSSPx, this._tileSizeCSSPx);
			}
			else {
				this._canvasCtx.drawImage(tile.el, tile.coords.x, tile.coords.y);
			}
			this._canvasCtx.restore();
		}
	},

	_drawSplits: function () {
		var splitPanesContext = this._layer.getSplitPanesContext();
		if (!splitPanesContext) {
			return;
		}
		var splitPos = splitPanesContext.getSplitPos();
		this._canvasCtx.save();
		this._canvasCtx.scale(this._dpiScale, this._dpiScale);
		this._canvasCtx.strokeStyle = 'red';
		this._canvasCtx.strokeRect(0, 0, splitPos.x, splitPos.y);
		this._canvasCtx.restore();
	},

	_updateWithRAF: function () {
		// update-loop with requestAnimationFrame
		this._canvasRAF = L.Util.requestAnimFrame(this._updateWithRAF, this, false /* immediate */);
		this.update();
	},

	update: function () {

		var splitPanesContext = this._layer.getSplitPanesContext();
		var zoom = Math.round(this._map.getZoom());
		var pixelBounds = this._map.getPixelBounds();
		var newSize = pixelBounds.getSize();
		var newTopLeft = pixelBounds.getTopLeft();
		var part = this._layer._selectedPart;
		var newSplitPos = splitPanesContext ?
			splitPanesContext.getSplitPos(): this._splitPos;

		var zoomChanged = (zoom !== this._lastZoom);
		var partChanged = (part !== this._lastPart);
		var sizeChanged = !newSize.equals(this._lastSize);
		var splitPosChanged = !newSplitPos.equals(this._splitPos);

		var skipUpdate = (
			this._topLeft !== undefined &&
			!zoomChanged &&
			!partChanged &&
			!sizeChanged &&
			!splitPosChanged &&
			newTopLeft.equals(this._topLeft));

		if (skipUpdate) {
			return;
		}

		if (sizeChanged) {
			this._setCanvasSize(newSize.x, newSize.y);
			this._lastSize = newSize;
		}

		if (splitPosChanged) {
			this._splitPos = newSplitPos;
		}

		// TODO: fix _shiftAndPaint for high DPI.
		var shiftPaintDisabled = true;
		var fullRepaintNeeded = zoomChanged || partChanged || sizeChanged || shiftPaintDisabled;

		this._lastZoom = zoom;
		this._lastPart = part;

		if (fullRepaintNeeded) {

			this._topLeft = newTopLeft;
			this._paintWholeCanvas();

			if (this.options.debug) {
				this._drawSplits();
			}

			return;
		}

		this._shiftAndPaint(newTopLeft);
	},

	_shiftAndPaint: function (newTopLeft) {

		console.assert(!this._layer.getSplitPanesContext(), '_shiftAndPaint is broken for split-panes.');
		var offset = new L.Point(this._width - 1, this._height - 1);

		var dx = newTopLeft.x - this._topLeft.x;
		var dy = newTopLeft.y - this._topLeft.y;
		if (!dx && !dy) {
			return;
		}

		// Determine the area that needs to be painted as max. two disjoint rectangles.
		var rectsToPaint = [];
		this._inMove = true;
		var oldTopLeft = this._topLeft;
		var oldBottomRight = oldTopLeft.add(offset);
		var newBottomRight = newTopLeft.add(offset);

		if (Math.abs(dx) < this._width && Math.abs(dy) < this._height) {

			this._canvasCtx.save();
			this._canvasCtx.scale(this._dpiScale, this._dpiScale);
			this._canvasCtx.globalCompositeOperation = 'copy';
			this._canvasCtx.drawImage(this._canvas, -dx, -dy);
			this._canvasCtx.globalCompositeOperation = 'source-over';
			this._canvasCtx.restore();

			var xstart = newTopLeft.x, xend = newBottomRight.x;
			var ystart = newTopLeft.y, yend = newBottomRight.y;
			if (dx) {
				xstart = dx > 0 ? oldBottomRight.x + 1 : newTopLeft.x;
				xend   = xstart + Math.abs(dx) - 1;
			}

			if (dy) {
				ystart = dy > 0 ? oldBottomRight.y + 1 : newTopLeft.y;
				yend   = ystart + Math.abs(dy) - 1;
			}

			// rectangle including the x-range that needs painting with full y-range.
			// This will take care of simultaneous non-zero dx and dy.
			if (dx) {
				rectsToPaint.push(new L.Bounds(
					new L.Point(xstart, newTopLeft.y),
					new L.Point(xend,   newBottomRight.y)
				));
			}

			// rectangle excluding the x-range that needs painting + needed y-range.
			if (dy) {
				rectsToPaint.push(new L.Bounds(
					new L.Point(dx > 0 ? newTopLeft.x : (dx ? xend + 1 : newTopLeft.x), ystart),
					new L.Point(dx > 0 ? xstart - 1   : newBottomRight.x,               yend)
				));
			}

		}
		else {
			rectsToPaint.push(new L.Bounds(newTopLeft, newBottomRight));
		}

		this._topLeft = newTopLeft;

		this._paintRects(rectsToPaint, newTopLeft);
	},

	_paintRects: function (rects, topLeft) {
		for (var i = 0; i < rects.length; ++i) {
			this._paintRect(rects[i], topLeft);
		}
	},

	_paintRect: function (rect) {
		var zoom = this._lastZoom || Math.round(this._map.getZoom());
		var part = this._lastPart || this._layer._selectedPart;
		var tileRange = this._layer._pxBoundsToTileRange(rect);
		var tileSize = this._tileSizeCSSPx || this._layer._getTileSize();
		for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
				var coords = new L.TileCoordData(
					i * tileSize,
					j * tileSize,
					zoom,
					part);

				var key = coords.key();
				var tile = this._layer._tiles[key];
				var invalid = tile && tile._invalidCount && tile._invalidCount > 0;
				if (tile && tile.loaded && !invalid) {
					this.paint(tile);
				}
			}
		}
	},

	_paintWholeCanvas: function () {
		var zoom = this._lastZoom || Math.round(this._map.getZoom());
		var part = this._lastPart || this._layer._selectedPart;

		var viewSize = new L.Point(this._width, this._height);
		var viewBounds = new L.Bounds(this._topLeft, this._topLeft.add(viewSize));

		var splitPanesContext = this._layer.getSplitPanesContext();
		// Calculate all this here intead of doing it per tile.
		var paneBoundsList = splitPanesContext ?
			splitPanesContext.getPxBoundList(viewBounds) : [viewBounds];
		var tileRanges = paneBoundsList.map(this._layer._pxBoundsToTileRange, this._layer);

		var tileSize = this._tileSizeCSSPx || this._layer._getTileSize();

		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			var tileRange = tileRanges[rangeIdx];
			for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
					var coords = new L.TileCoordData(
						i * tileSize,
						j * tileSize,
						zoom,
						part);

					var key = coords.key();
					var tile = this._layer._tiles[key];
					var invalid = tile && tile._invalidCount && tile._invalidCount > 0;
					if (tile && tile.loaded && !invalid) {
						this.paint(tile, viewBounds, paneBoundsList);
					}
				}
			}
		}
	},
});

L.CanvasTileLayer = L.TileLayer.extend({

	_initContainer: function () {
		if (this._canvasContainer) {
			console.error('called _initContainer() when this._canvasContainer is present!');
		}

		L.TileLayer.prototype._initContainer.call(this);

		var mapContainer = this._map.getContainer();
		var canvasContainerClass = 'leaflet-canvas-container';
		this._canvasContainer = L.DomUtil.create('div', canvasContainerClass, mapContainer);
		this._setup();
	},

	_setup: function () {

		if (!this._canvasContainer) {
			console.error('canvas container not found. _initContainer failed ?');
		}

		this._canvas = L.DomUtil.create('canvas', '', this._canvasContainer);
		this._painter = new L.CanvasTilePainter(this, L.getDpiScaleFactor());
		this._container.style.position = 'absolute';

		if (L.Browser.cypressTest) {
			this._cypressHelperDiv = L.DomUtil.create('div', '', this._container);
		}

		// For mobile/tablet the hammerjs swipe handler already uses a requestAnimationFrame to fire move/drag events
		// Using L.CanvasTilePainter's own requestAnimationFrame loop to do the updates in that case does not perform well.
		if (window.mode.isMobile() || window.mode.isTablet()) {
			this._map.on('move', this._painter.update, this._painter);
			this._map.on('moveend', function () {
				setTimeout(this.update.bind(this), 200);
			}, this._painter);
		}
		else {
			this._map.on('movestart', this._painter.startUpdates, this._painter);
			this._map.on('moveend', this._painter.stopUpdates, this._painter);
		}
		this._map.on('zoomend', this._painter.update, this._painter);
		this._map.on('splitposchanged', this._painter.update, this._painter);
		this._map.on('move', this._syncTilePanePos, this);
	},

	_syncTilePanePos: function () {
		var tilePane = this._container.parentElement;
		if (tilePane) {
			var mapPanePos = this._map._getMapPanePos();
			L.DomUtil.setPosition(tilePane, new L.Point(-mapPanePos.x , -mapPanePos.y));
		}
	},

	hasSplitPanesSupport: function () {
		// Only enabled for Calc for now
		// It may work without this.options.sheetGeometryDataEnabled but not tested.
		// The overlay-pane with split-panes is still based on svg renderer,
		// and not available for VML or canvas yet.
		if (this.isCalc() &&
			this.options.sheetGeometryDataEnabled &&
			L.Browser.svg) {
			return true;
		}

		return false;
	},

	onRemove: function (map) {
		this._painter.dispose();
		L.TileLayer.prototype.onRemove.call(this, map);
		this._removeSplitters();
		L.DomUtil.remove(this._canvasContainer);
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move,
			splitposchanged: this._move,
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
		}

		return events;
	},

	_removeSplitters: function () {
		var map = this._map;
		if (this._xSplitter) {
			map.removeLayer(this._xSplitter);
			this._xSplitter = undefined;
		}

		if (this._ySplitter) {
			map.removeLayer(this._ySplitter);
			this._ySplitter = undefined;
		}
	},

	_updateOpacity: function () {
		this._pruneTiles();
	},

	_updateLevels: function () {
	},

	_initTile: function () {
	},

	_pruneTiles: function () {
		var key, tile;

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.part, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.part, coords.z + 2);
				}
			}
		}

		for (key in this._tiles) {
			if (!this._tiles[key].retain) {
				this._removeTile(key);
			}
		}
	},

	_animateZoom: function () {
	},

	_setZoomTransforms: function () {
	},

	_setZoomTransform: function () {
	},

	_getTilePos: function (coords) {
		return coords.getPos();
	},

	_wrapCoords: function (coords) {
		return new L.TileCoordData(
			this._wrapX ? L.Util.wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? L.Util.wrapNum(coords.y, this._wrapY) : coords.y,
			coords.z,
			coords.part);
	},

	_pxBoundsToTileRanges: function (bounds) {
		if (!this._splitPanesContext) {
			return [this._pxBoundsToTileRange(bounds)];
		}

		var boundList = this._splitPanesContext.getPxBoundList(bounds);
		return boundList.map(this._pxBoundsToTileRange, this);
	},

	_pxBoundsToTileRange: function (bounds) {
		return new L.Bounds(
			bounds.min.divideBy(this._tileSize).floor(),
			bounds.max.divideBy(this._tileSize).floor());
	},

	_twipsToCoords: function (twips) {
		return new L.TileCoordData(
			Math.round(twips.x / twips.tileWidth) * this._tileSize,
			Math.round(twips.y / twips.tileHeight) * this._tileSize);
	},

	_coordsToTwips: function (coords) {
		return new L.Point(
			Math.floor(coords.x / this._tileSize) * this._tileWidthTwips,
			Math.floor(coords.y / this._tileSize) * this._tileHeightTwips);
	},

	_isValidTile: function (coords) {
		if (coords.x < 0 || coords.y < 0) {
			return false;
		}
		if ((coords.x / this._tileSize) * this._tileWidthTwips >= this._docWidthTwips ||
			(coords.y / this._tileSize) * this._tileHeightTwips >= this._docHeightTwips) {
			return false;
		}
		return true;
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}

		if (center === undefined) { center = map.getCenter(); }
		if (zoom === undefined) { zoom = Math.round(map.getZoom()); }

		var pixelBounds = map.getPixelBounds(center, zoom);
		var tileRanges = this._pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		for (var key in this._tiles) {
			var thiscoords = this._keyToTileCoords(key);
			if (thiscoords.z !== zoom ||
				thiscoords.part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// If there are panes that need new tiles for its entire area, cancel previous requests.
		var cancelTiles = false;
		var paneNewView;
		// create a queue of coordinates to load tiles from
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			paneNewView = true;
			var tileRange = tileRanges[rangeIdx];
			for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
					var coords = new L.TileCoordData(
						i * this._tileSize,
						j * this._tileSize,
						zoom,
						this._selectedPart);

					if (!this._isValidTile(coords)) { continue; }

					key = this._tileCoordsToKey(coords);
					var tile = this._tiles[key];
					var invalid = tile && tile._invalidCount && tile._invalidCount > 0;
					if (tile && tile.loaded && !invalid) {
						tile.current = true;
						paneNewView = false;
					} else if (invalid) {
						tile._invalidCount = 1;
						queue.push(coords);
					} else {
						queue.push(coords);
					}
				}
			}

			if (paneNewView) {
				cancelTiles = true;
			}
		}

		this._sendClientVisibleArea(true);

		this._sendClientZoom(true);

		if (queue.length !== 0) {
			if (cancelTiles) {
				// we know that a new set of tiles (that completely cover one/more panes) has been requested
				// so we're able to cancel the previous requests that are being processed
				this._cancelTiles();
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			this._addTiles(queue);
		}
	},

	_sendClientVisibleArea: function (forceUpdate) {

		var splitPos = this._splitPanesContext ? this._splitPanesContext.getSplitPos() : new L.Point(0, 0);

		var visibleArea = this._map.getPixelBounds();
		visibleArea = new L.Bounds(
			this._pixelsToTwips(visibleArea.min),
			this._pixelsToTwips(visibleArea.max)
		);
		splitPos = this._pixelsToTwips(splitPos);
		var size = visibleArea.getSize();
		var visibleTopLeft = visibleArea.min;
		var newClientVisibleArea = 'clientvisiblearea x=' + Math.round(visibleTopLeft.x)
					+ ' y=' + Math.round(visibleTopLeft.y)
					+ ' width=' + Math.round(size.x)
					+ ' height=' + Math.round(size.y)
					+ ' splitx=' + Math.round(splitPos.x)
					+ ' splity=' + Math.round(splitPos.y);

		if (this._clientVisibleArea !== newClientVisibleArea || forceUpdate) {
			// Visible area is dirty, update it on the server
			this._map._socket.sendMessage(newClientVisibleArea);
			if (!this._map._fatal && this._map._active && this._map._socket.connected())
				this._clientVisibleArea = newClientVisibleArea;
			if (this._debug) {
				this._debugInfo.clearLayers();
				for (var key in this._tiles) {
					this._tiles[key]._debugPopup = null;
					this._tiles[key]._debugTile = null;
				}
			}
		}
	},

	_updateOnChangePart: function () {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}
		var key, coords, tile;
		var center = map.getCenter();
		var zoom = Math.round(map.getZoom());

		var pixelBounds = map.getPixelBounds(center, zoom);
		var tileRanges = this._pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		for (key in this._tiles) {
			var thiscoords = this._keyToTileCoords(key);
			if (thiscoords.z !== zoom ||
				thiscoords.part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// If there are panes that need new tiles for its entire area, cancel previous requests.
		var cancelTiles = false;
		var paneNewView;
		// create a queue of coordinates to load tiles from
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
			paneNewView = true;
			var tileRange = tileRanges[rangeIdx];
			for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
				for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
					coords = new L.TileCoordData(
						i * this._tileSize,
						j * this._tileSize,
						zoom,
						this._selectedPart);

					if (!this._isValidTile(coords)) { continue; }

					key = this._tileCoordsToKey(coords);
					tile = this._tiles[key];
					if (tile) {
						tile.current = true;
						paneNewView = false;
					} else {
						queue.push(coords);
					}
				}
			}
			if (paneNewView) {
				cancelTiles = true;
			}
		}

		if (queue.length !== 0) {
			if (cancelTiles) {
				// we know that a new set of tiles (that completely cover one/more panes) has been requested
				// so we're able to cancel the previous requests that are being processed
				this._cancelTiles();
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			var tilePositionsX = '';
			var tilePositionsY = '';

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				key = this._tileCoordsToKey(coords);

				if (coords.part === this._selectedPart) {
					tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
					}

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						coords: coords,
						current: true
					};

					this.fire('tileloadstart', {
						tile: tile,
						coords: coords
					});
				}

				if (!this._tileCache[key]) {
					var twips = this._coordsToTwips(coords);
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += twips.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += twips.y;
				}
				else {
					tile.src = this._tileCache[key];
				}
			}

			if (tilePositionsX !== '' && tilePositionsY !== '') {
				var message = 'tilecombine ' +
					'nviewid=0 ' +
					'part=' + this._selectedPart + ' ' +
					'width=' + this._tileWidthPx + ' ' +
					'height=' + this._tileHeightPx + ' ' +
					'tileposx=' + tilePositionsX + ' ' +
					'tileposy=' + tilePositionsY + ' ' +
					'tilewidth=' + this._tileWidthTwips + ' ' +
					'tileheight=' + this._tileHeightTwips;

				this._map._socket.sendMessage(message, '');
			}

		}

		if (typeof (this._prevSelectedPart) === 'number' &&
			this._prevSelectedPart !== this._selectedPart
			&& this._docType === 'spreadsheet') {
			this._map.fire('updatescrolloffset', { x: 0, y: 0, updateHeaders: false });
			this._map.scrollTop(0);
			this._map.scrollLeft(0);
		}
	},

	_tileReady: function (coords, err, tile) {
		if (!this._map) { return; }

		if (err) {
			this.fire('tileerror', {
				error: err,
				tile: tile,
				coords: coords
			});
		}

		var key = this._tileCoordsToKey(coords);

		tile = this._tiles[key];
		if (!tile) { return; }

		tile.loaded = +new Date();
		tile.active = true;

		if (this._cypressHelperDiv) {
			var container = this._cypressHelperDiv;
			var newIndicator = L.DomUtil.create('div', 'leaflet-tile-loaded', this._cypressHelperDiv);
			setTimeout(function () {
				container.removeChild(newIndicator);
			}, 1000);
		}

		// paint this tile on canvas.
		this._painter.paint(tile);

		if (this._noTilesToLoad()) {
			this.fire('load');
			this._pruneTiles();
		}
	},

	_addTiles: function (coordsQueue) {
		var coords, key;
		// first take care of the DOM
		for (var i = 0; i < coordsQueue.length; i++) {
			coords = coordsQueue[i];

			key = this._tileCoordsToKey(coords);

			if (coords.part === this._selectedPart) {
				if (!this._tiles[key]) {
					var tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
					}

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						coords: coords,
						current: true
					};

					this.fire('tileloadstart', {
						tile: tile,
						coords: coords
					});

					if (tile && this._tileCache[key]) {
						tile.src = this._tileCache[key];
					}
				}
			}
		}

		// sort the tiles by the rows
		coordsQueue.sort(function (a, b) {
			if (a.y !== b.y) {
				return a.y - b.y;
			} else {
				return a.x - b.x;
			}
		});

		// try group the tiles into rectangular areas
		var rectangles = [];
		while (coordsQueue.length > 0) {
			coords = coordsQueue[0];

			// tiles that do not interest us
			key = this._tileCoordsToKey(coords);
			if (this._tileCache[key] || coords.part !== this._selectedPart) {
				coordsQueue.splice(0, 1);
				continue;
			}

			var rectQueue = [coords];
			var bound = coords.getPos(); // L.Point

			// remove it
			coordsQueue.splice(0, 1);

			// find the close ones
			var rowLocked = false;
			var hasHole = false;
			i = 0;
			while (i < coordsQueue.length) {
				var current = coordsQueue[i];

				// extend the bound vertically if possible (so far it was
				// continuous)
				if (!hasHole && (current.y === bound.y + this._tileSize)) {
					rowLocked = true;
					bound.y += this._tileSize;
				}

				if (current.y > bound.y) {
					break;
				}

				if (!rowLocked) {
					if (current.y === bound.y && current.x === bound.x + this._tileSize) {
						// extend the bound horizontally
						bound.x += this._tileSize;
						rectQueue.push(current);
						coordsQueue.splice(i, 1);
					} else {
						// ignore the rest of the row
						rowLocked = true;
						++i;
					}
				} else if (current.x <= bound.x && current.y <= bound.y) {
					// we are inside the bound
					rectQueue.push(current);
					coordsQueue.splice(i, 1);
				} else {
					// ignore this one, but there still may be other tiles
					hasHole = true;
					++i;
				}
			}

			rectangles.push(rectQueue);
		}

		var twips, msg;
		for (var r = 0; r < rectangles.length; ++r) {
			rectQueue = rectangles[r];
			var tilePositionsX = '';
			var tilePositionsY = '';
			for (i = 0; i < rectQueue.length; i++) {
				coords = rectQueue[i];
				twips = this._coordsToTwips(coords);

				if (tilePositionsX !== '') {
					tilePositionsX += ',';
				}
				tilePositionsX += twips.x;

				if (tilePositionsY !== '') {
					tilePositionsY += ',';
				}
				tilePositionsY += twips.y;
			}

			twips = this._coordsToTwips(coords);
			msg = 'tilecombine ' +
				'nviewid=0 ' +
				'part=' + coords.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'tilewidth=' + this._tileWidthTwips + ' ' +
				'tileheight=' + this._tileHeightTwips;
			this._map._socket.sendMessage(msg, '');
		}
	},

	_cancelTiles: function () {
		this._map._socket.sendMessage('canceltiles');
		for (var key in this._tiles) {
			var tile = this._tiles[key];
			// When _invalidCount > 0 the tile has been invalidated, however the new tile content
			// has not yet been fetched and because of `canceltiles` message it will never be
			// so we need to remove the tile, or when the tile is back inside the visible area
			// its content would be the old invalidated one. Drop only those tiles which are not in
			// the new visible area.
			// example: a tile is invalidated but a sudden scroll to the cell cursor position causes
			// to move the tile out of the visible area before the new content is fetched

			var dropTile = !tile.loaded;
			var coords = tile.coords;
			if (coords.part === this._selectedPart) {

				var tileBounds;
				if (!this._splitPanesContext) {
					var tileTopLeft = this._coordsToTwips(coords);
					var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
					tileBounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
					var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
					var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
					var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);

					dropTile |= (tile._invalidCount > 0 && !visibleArea.intersects(tileBounds));
				}
				else
				{
					var tilePos = coords.getPos();
					tileBounds = new L.Bounds(tilePos, tilePos.add(new L.Point(this._tileSize, this._tileSize)));
					dropTile |= (tile._invalidCount > 0 &&
						!this._splitPanesContext.intersectsVisible(tileBounds));
				}
			}
			else {
				dropTile |= tile._invalidCount > 0;
			}


			if (dropTile) {
				delete this._tiles[key];
				if (this._debug && this._debugDataCancelledTiles) {
					this._debugCancelledTiles++;
					this._debugDataCancelledTiles.setPrefix('Cancelled tiles: ' + this._debugCancelledTiles);
				}
			}
		}
		this._emptyTilesCount = 0;
	},

	_checkTileMsgObject: function (msgObj) {
		if (typeof msgObj !== 'object' ||
			typeof msgObj.x !== 'number' ||
			typeof msgObj.y !== 'number' ||
			typeof msgObj.tileWidth !== 'number' ||
			typeof msgObj.tileHeight !== 'number' ||
			typeof msgObj.part !== 'number') {
			console.error('Unexpected content in the parsed tile message.');
		}
	},

	_tileMsgToCoords: function (tileMsg) {
		var coords = this._twipsToCoords(tileMsg);
		coords.z = tileMsg.zoom;
		coords.part = tileMsg.part;
		return coords;
	},

	_tileCoordsToKey: function (coords) {
		return coords.key();
	},

	_keyToTileCoords: function (key) {
		return L.TileCoordData.parseKey(key);
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	_tileCoordsToBounds: function (coords) {

		var map = this._map;
		var tileSize = this._getTileSize();

		var nwPoint = new L.Point(coords.x, coords.y);
		var sePoint = nwPoint.add([tileSize, tileSize]);

		var nw = map.wrapLatLng(map.unproject(nwPoint, coords.z));
		var se = map.wrapLatLng(map.unproject(sePoint, coords.z));

		return new L.LatLngBounds(nw, se);
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile) { return; }

		// FIXME: this _tileCache is used for prev/next slide; but it is
		// dangerous in connection with typing / invalidation
		if (!(this._tiles[key]._invalidCount > 0)) {
			this._tileCache[key] = tile.el.src;
		}

		if (!tile.loaded && this._emptyTilesCount > 0) {
			this._emptyTilesCount -= 1;
		}

		if (this._debug && this._debugInfo && this._tiles[key]._debugPopup) {
			this._debugInfo.removeLayer(this._tiles[key]._debugPopup);
		}
		delete this._tiles[key];

		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_preFetchTiles: function () {
		if (this._emptyTilesCount > 0 || !this._map) {
			return;
		}
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var tilesToFetch = 10;
		var maxBorderWidth = 5;
		var tileBorderSrcs;

		if (this._map.isPermissionEdit()) {
			tilesToFetch = 5;
			maxBorderWidth = 3;
		}

		if (!this._preFetchBorders) {
			var pixelBounds = this._map.getPixelBounds(center, zoom);
			tileBorderSrcs = this._pxBoundsToTileRanges(pixelBounds);
			this._preFetchBorders = tileBorderSrcs;
		}
		else {
			tileBorderSrcs = this._preFetchBorders;
		}

		var queue = [];
		var finalQueue = [];
		var visitedTiles = {};
		var borderWidth = 0;
		// don't search on a border wider than 5 tiles because it will freeze the UI

		for (var rangeIdx = 0; rangeIdx < tileBorderSrcs.length; ++rangeIdx) {
			var tileBorder = new L.Bounds(
				tileBorderSrcs[rangeIdx].min,
				tileBorderSrcs[rangeIdx].max
			);

			while ((tileBorder.min.x >= 0 || tileBorder.min.y >= 0 ||
				tileBorder.max.x * this._tileWidthTwips < this._docWidthTwips ||
				tileBorder.max.y * this._tileHeightTwips < this._docHeightTwips) &&
				tilesToFetch > 0 && borderWidth < maxBorderWidth) {
				// while the bounds do not fully contain the document

				for (var i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
					// tiles below the visible area
					var coords = new L.TileCoordData(
						i * this._tileSize,
						tileBorder.max.y * this._tileSize);
					queue.push(coords);
				}
				for (i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
					// tiles above the visible area
					coords = new L.TileCoordData(
						i * this._tileSize,
						tileBorder.min.y * this._tileSize);
					queue.push(coords);
				}
				for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
					// tiles to the right of the visible area
					coords = new L.TileCoordData(
						tileBorder.max.x * this._tileSize,
						i * this._tileSize);
					queue.push(coords);
				}
				for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
					// tiles to the left of the visible area
					coords = new L.TileCoordData(
						tileBorder.min.x * this._tileSize,
						i * this._tileSize);
					queue.push(coords);
				}

				for (i = 0; i < queue.length && tilesToFetch > 0; i++) {
					coords = queue[i];
					coords.z = zoom;
					coords.part = this._preFetchPart;
					var key = this._tileCoordsToKey(coords);

					if (!this._isValidTile(coords) ||
						this._tiles[key] ||
						this._tileCache[key] ||
						visitedTiles[key]) {
						continue;
					}

					visitedTiles[key] = true;
					finalQueue.push(coords);
					tilesToFetch -= 1;
				}
				if (tilesToFetch === 0) {
					// don't update the border as there are still
					// some tiles to be fetched
					continue;
				}
				if (tileBorder.min.x >= 0) {
					tileBorder.min.x -= 1;
				}
				if (tileBorder.min.y >= 0) {
					tileBorder.min.y -= 1;
				}
				if (tileBorder.max.x * this._tileWidthTwips <= this._docWidthTwips) {
					tileBorder.max.x += 1;
				}
				if (tileBorder.max.y * this._tileHeightTwips <= this._docHeightTwips) {
					tileBorder.max.y += 1;
				}
				borderWidth += 1;
			}
		}

		if (finalQueue.length > 0) {
			this._addTiles(finalQueue);
		} else {
			clearInterval(this._tilesPreFetcher);
			this._tilesPreFetcher = undefined;
		}
	},

	_resetPreFetching: function (resetBorder) {
		if (!this._map) {
			return;
		}
		if (this._tilesPreFetcher)
			clearInterval(this._tilesPreFetcher);
		if (this._preFetchIdle)
			clearTimeout(this._preFetchIdle);
		if (resetBorder) {
			this._preFetchBorders = null;
		}
		var interval = 750;
		var idleTime = 5000;
		this._preFetchPart = this._selectedPart;
		this._preFetchIdle = setTimeout(L.bind(function () {
			this._tilesPreFetcher = setInterval(L.bind(this._preFetchTiles, this), interval);
			this._prefetchIdle = undefined;
		}, this), idleTime);
	},

	_onTileMsg: function (textMsg, img) {
		var tileMsgObj = this._map._socket.parseServerCmd(textMsg);
		this._checkTileMsgObject(tileMsgObj);
		var coords = this._tileMsgToCoords(tileMsgObj);
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (this._debug && tile) {
			if (tile._debugLoadCount) {
				tile._debugLoadCount++;
				this._debugLoadCount++;
			} else {
				tile._debugLoadCount = 1;
				tile._debugInvalidateCount = 1;
			}
			if (!tile._debugPopup) {
				var tileBound = this._keyToBounds(key);
				tile._debugPopup = L.popup({ className: 'debug', offset: new L.Point(0, 0), autoPan: false, closeButton: false, closeOnClick: false })
					.setLatLng(new L.LatLng(tileBound.getSouth(), tileBound.getWest() + (tileBound.getEast() - tileBound.getWest()) / 5));
				this._debugInfo.addLayer(tile._debugPopup);
				if (this._debugTiles[key]) {
					this._debugInfo.removeLayer(this._debugTiles[key]);
				}
				tile._debugTile = L.rectangle(tileBound, { color: 'blue', weight: 1, fillOpacity: 0, pointerEvents: 'none' });
				this._debugTiles[key] = tile._debugTile;
				tile._debugTime = this._debugGetTimeArray();
				this._debugInfo.addLayer(tile._debugTile);
			}
			if (tile._debugTime.date === 0) {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount);
			} else {
				tile._debugPopup.setContent('requested: ' + this._tiles[key]._debugInvalidateCount + '<br>received: ' + this._tiles[key]._debugLoadCount +
					'<br>' + this._debugSetTimes(tile._debugTime, +new Date() - tile._debugTime.date).replace(/, /g, '<br>'));
			}
			if (tile._debugTile) {
				tile._debugTile.setStyle({ fillOpacity: (tileMsgObj.renderid === 'cached') ? 0.1 : 0, fillColor: 'yellow' });
			}
			this._debugShowTileData();
		}
		if (tileMsgObj.id !== undefined) {
			this._map.fire('tilepreview', {
				tile: img,
				id: tileMsgObj.id,
				width: tileMsgObj.width,
				height: tileMsgObj.height,
				part: tileMsgObj.part,
				docType: this._docType
			});
		}
		else if (tile && typeof (img) == 'object') {
			console.error('Not implemented');
		}
		else if (tile) {
			if (this._tiles[key]._invalidCount > 0) {
				this._tiles[key]._invalidCount -= 1;
			}
			if (!tile.loaded) {
				this._emptyTilesCount -= 1;
				if (this._emptyTilesCount === 0) {
					this._map.fire('statusindicator', { statusType: 'alltilesloaded' });
				}
			}
			tile.el.src = img;
		}
		L.Log.log(textMsg, 'INCOMING', key);

		// Send acknowledgment, that the tile message arrived
		var tileID = tileMsgObj.part + ':' + tileMsgObj.x + ':' + tileMsgObj.y + ':' + tileMsgObj.tileWidth + ':' + tileMsgObj.tileHeight + ':' + tileMsgObj.nviewid;
		this._map._socket.sendMessage('tileprocessed tile=' + tileID);
	},

	_coordsToPixBounds: function (coords) {
		// coords.x and coords.y are the pixel coordinates of the top-left corner of the tile.
		var topLeft = new L.Point(coords.x, coords.y);
		var bottomRight = topLeft.add(new L.Point(this._tileSize, this._tileSize));
		return new L.Bounds(topLeft, bottomRight);
	},

	updateHorizPaneSplitter: function () {

		var map = this._map;

		if (!this._xSplitter) {
			this._xSplitter = new L.SplitterLine(
				map, { isHoriz: true });

			map.addLayer(this._xSplitter);
		}
		else {
			this._xSplitter.update();
		}
	},

	updateVertPaneSplitter: function () {

		var map = this._map;

		if (!this._ySplitter) {
			this._ySplitter = new L.SplitterLine(
				map, { isHoriz: false });

			map.addLayer(this._ySplitter);
		}
		else {
			this._ySplitter.update();
		}
	},

	hasXSplitter: function () {
		return !!(this._xSplitter);
	},

	hasYSplitter: function () {
		return !!(this._ySplitter);
	},

});
