/* -*- js-indent-level: 8 -*- */
/*
 * L.GridLayer is used as base class for grid-like layers like TileLayer.
 */

/* global app */

L.GridLayer = L.Layer.extend({

	options: {
		pane: 'tilePane',

		tileSize: window.tileSize,
		opacity: 1,

		updateWhenIdle: (window.mode.isMobile() || window.mode.isTablet()),
		updateInterval: 200,

		attribution: null,
		zIndex: null,
		bounds: null,

		minZoom: 0
		// maxZoom: <Number>
	},

	initialize: function (options) {
		L.setOptions(this, options);

		this._resetClientVisArea();
	},

	onAdd: function () {
		this._initContainer();
		this._levels = {};
		this._tiles = {};
		this._viewReset();
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		L.DomUtil.remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = null;
		this._clearPreFetch();
		clearTimeout(this._previewInvalidator);

		if (!this._cellCSelections.empty()) {
			this._cellCSelections.clear();
		}

		if (!this._textCSelections.empty()) {
			this._textCSelections.clear();
		}

		if (this._cursorMarker && this._cursorMarker.isDomAttached()) {
			this._cursorMarker.remove();
		}
		if (this._graphicMarker) {
			this._graphicMarker.remove();
		}
		for (var key in this._selectionHandles) {
			this._selectionHandles[key].remove();
		}
	},

	bringToFront: function () {
		if (this._map) {
			L.DomUtil.toFront(this._container);
			this._setAutoZIndex(Math.max);
		}
		return this;
	},

	bringToBack: function () {
		if (this._map) {
			L.DomUtil.toBack(this._container);
			this._setAutoZIndex(Math.min);
		}
		return this;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	getContainer: function () {
		return this._container;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}
		return this;
	},

	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	redraw: function () {
		if (this._map) {
			this._removeAllTiles();
			this._update();
		}
		return this;
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			moveend: this._move
		};

		if (!this.options.updateWhenIdle) {
			// update tiles on move, but not more often than once per given interval
			events.move = L.Util.throttle(this._move, this.options.updateInterval, this);
		}

		return events;
	},

	createTile: function () {
		return document.createElement('div');
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined && this.options.zIndex !== null) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (compare) {
		// go through all other layers of the same pane, set zIndex to max + 1 (front) or min - 1 (back)

		var layers = this.getPane().children,
		    edgeZIndex = -compare(-Infinity, Infinity); // -Infinity for max, Infinity for min

		for (var i = 0, len = layers.length, zIndex; i < len; i++) {

			zIndex = layers[i].style.zIndex;

			if (layers[i] !== this._container && zIndex) {
				edgeZIndex = compare(edgeZIndex, +zIndex);
			}
		}

		if (isFinite(edgeZIndex)) {
			this.options.zIndex = edgeZIndex + compare(-1, 1);
			this._updateZIndex();
		}
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;

		// IE doesn't inherit filter opacity properly, so we're forced to set it on tiles
		if (!L.Browser.ielt9 && !this._map._fadeAnimated) {
			L.DomUtil.setOpacity(this._container, opacity);
			return;
		}

		var now = +new Date(),
		    nextFrame = false;

		for (var key in this._tiles) {
			var tile = this._tiles[key];
			if (!tile.current || !tile.loaded || tile.active) { continue; }

			var fade = Math.min(1, (now - tile.loaded) / 200);
			if (fade < 1) {
				L.DomUtil.setOpacity(tile.el, opacity * fade);
				nextFrame = true;
			} else {
				L.DomUtil.setOpacity(tile.el, opacity);
				tile.active = true;
				this._pruneTiles();
			}
		}

		if (nextFrame) {
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		}
	},

	_initContainer: function () {
		if (this._container) { return; }

		this._container = L.DomUtil.create('div', 'leaflet-layer');
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);
	},

	_updateLevels: function () {
		var zoom = this._tileZoom,
		    maxZoom = this.options.maxZoom;

		for (var z in this._levels) {
			this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
		}

		var level = this._levels[zoom],
		    map = this._map;

		if (!level) {
			level = this._levels[zoom] = {};

			level.el = L.DomUtil.create('div', 'leaflet-tile-container leaflet-zoom-animated', this._container);
			level.el.style.zIndex = maxZoom;

			level.origin = map.project(map.unproject(map.getPixelOrigin()), zoom).round();
			level.zoom = zoom;

			this._setZoomTransform(level, map.getCenter(), map.getZoom());

			// force the browser to consider the newly added element for transition
			L.Util.falseFn(level.el.offsetWidth);
		}

		this._level = level;

		return level;
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

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_retainParent: function (x, y, z, part, minZoom) {
		var x2 = Math.floor(x / 1.2),
		    y2 = Math.floor(y / 1.2),
		    z2 = z - 1;

		var key = x2 + ':' + y2 + ':' + z2 + ':' + part,
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, part, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, part, maxZoom) {

		for (var i = 1.2 * x; i < 1.2 * x + 2; i++) {
			for (var j = 1.2 * y; j < 1.2 * y + 2; j++) {

				var key = Math.floor(i) + ':' + Math.floor(j) + ':' +
					(z + 1) + ':' + part,
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, part, maxZoom);
				}
			}
		}
	},

	_viewReset: function (e) {
		this._reset(this._map.getCenter(), this._map.getZoom(), e && e.hard);
		if (this._docType === 'spreadsheet' && this._annotations !== 'undefined') {
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		}
	},

	_reset: function (center, zoom, hard, noPrune, noUpdate) {
		var tileZoom = Math.round(zoom),
		    tileZoomChanged = this._tileZoom !== tileZoom;

		if (!noUpdate && (hard || tileZoomChanged)) {
			this._resetClientVisArea();

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._tileZoom = tileZoom;
			if (tileZoomChanged) {
				this._updateTileTwips();
				this._updateMaxBounds(null, null, zoom);
			}
			this._updateLevels();
			this._resetGrid();

			if (!L.Browser.mobileWebkit) {
				this._update(center, tileZoom);
			}

			if (!noPrune) {
				this._pruneTiles();
			}
		}

		this._setZoomTransforms(center, zoom);
	},

	// These variables indicates the clientvisiblearea sent to the server and stored by the server
	// We need to reset them when we are reconnecting to the server or reloading a document
	// because the server needs new data even if the client is unmodified.
	_resetClientVisArea: function ()  {
		this._clientZoom = '';
		this._clientVisibleArea = '';
	},

	_updateTileTwips: function () {
		// smaller zoom = zoom in
		var factor = Math.pow(1.2, (this._map.options.zoom - this._tileZoom));
		this._tileWidthTwips = Math.round(this.options.tileWidthTwips * factor);
		this._tileHeightTwips = Math.round(this.options.tileHeightTwips * factor);
		app.tile.size.twips = [this._tileWidthTwips, this._tileHeightTwips];
		app.file.size.pixels = [Math.round(app.tile.size.pixels[0] * (app.file.size.twips[0] / app.tile.size.twips[0])), Math.round(app.tile.size.pixels[1] * (app.file.size.twips[1] / app.tile.size.twips[1]))];
		app.view.size.pixels = app.file.size.pixels.slice();
	},

	_updateMaxBounds: function (sizeChanged, options, zoom) {
		if (this._docWidthTwips === undefined || this._docHeightTwips === undefined) {
			return;
		}
		if (!zoom) {
			zoom = this._map.getZoom();
		}

		var extraSize = options ? options.extraSize : null;
		var docPixelLimits = new L.Point(this._docWidthTwips / this.options.tileWidthTwips,
			this._docHeightTwips / this.options.tileHeightTwips);
		docPixelLimits = docPixelLimits.multiplyBy(this._tileSize);
		var scale = this._map.getZoomScale(zoom, 10);
		var topLeft = new L.Point(0, 0);
		topLeft = this._map.unproject(topLeft.multiplyBy(scale));
		var bottomRight = new L.Point(docPixelLimits.x, docPixelLimits.y);
		bottomRight = bottomRight.multiplyBy(scale);
		if (extraSize) {
			// extraSize is unscaled.
			bottomRight = bottomRight.add(extraSize);
		}
		bottomRight = this._map.unproject(bottomRight);

		if (this._documentInfo === '' || sizeChanged) {
			// we just got the first status so we need to center the document
			this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight), options);
			this._map.setDocBounds(new L.LatLngBounds(topLeft, this._map.unproject(docPixelLimits.multiplyBy(scale))));
		}

		var scrollPixelLimits = new L.Point(this._docWidthTwips / this._tileWidthTwips,
			this._docHeightTwips / this._tileHeightTwips);
		scrollPixelLimits = scrollPixelLimits.multiplyBy(this._tileSize);
		if (extraSize) {
			// extraSize is unscaled.
			scrollPixelLimits = scrollPixelLimits.add(extraSize);
		}
		this._docPixelSize = {x: scrollPixelLimits.x, y: scrollPixelLimits.y};
		this._map.fire('docsize', {x: scrollPixelLimits.x, y: scrollPixelLimits.y, extraSize: extraSize});
	},

	_checkSpreadSheetBounds: function (newZoom) {
		// for spreadsheets, when the document is smaller than the viewing area
		// we want it to be glued to the row/column headers instead of being centered
		// In the future we probably want to remove this and set the bonds only on the
		// left/upper side of the spreadsheet so that we can have an 'infinite' number of
		// cells downwards and to the right, like we have on desktop
		var viewSize = this._map.getSize();
		var scale = this._map.getZoomScale(newZoom);
		var width = this._docWidthTwips / this._tileWidthTwips * this._tileSize * scale;
		var height = this._docHeightTwips / this._tileHeightTwips * this._tileSize * scale;
		if (width < viewSize.x || height < viewSize.y) {
			// if after zoomimg the document becomes smaller than the viewing area
			width = Math.max(width, viewSize.x);
			height = Math.max(height, viewSize.y);
			if (!this._map.options._origMaxBounds) {
				this._map.options._origMaxBounds = this._map.options.maxBounds;
			}
			scale = this._map.options.crs.scale(1);
			this._map.setMaxBounds(new L.LatLngBounds(
					this._map.unproject(new L.Point(0, 0)),
					this._map.unproject(new L.Point(width * scale, height * scale))));
		}
		else if (this._map.options._origMaxBounds) {
			// if after zoomimg the document becomes larger than the viewing area
			// we need to restore the initial bounds
			this._map.setMaxBounds(this._map.options._origMaxBounds);
			this._map.options._origMaxBounds = null;
		}
	},

	_updateScrollOffset: function () {
		if (!this._map) return;
		var centerPixel = this._map.project(this._map.getCenter());
		var newScrollPos = centerPixel.subtract(this._map.getSize().divideBy(2));
		var x = Math.round(newScrollPos.x < 0 ? 0 : newScrollPos.x);
		var y = Math.round(newScrollPos.y < 0 ? 0 : newScrollPos.y);
		this._map.fire('updatescrolloffset', {x: x, y: y, updateHeaders: true});
	},

	_setZoomTransforms: function (center, zoom) {
		for (var i in this._levels) {
			this._setZoomTransform(this._levels[i], center, zoom);
		}
	},

	_setZoomTransform: function (level, center, zoom) {
		var scale = this._map.getZoomScale(zoom, level.zoom),
		    translate = level.origin.multiplyBy(scale)
			.subtract(this._map._getNewPixelOrigin(center, zoom)).round();

		L.DomUtil.setTransform(level.el, translate, scale);
	},

	_resetGrid: function () {
		var map = this._map,
		    crs = map.options.crs,
		    tileSize = this._tileSize = this._getTileSize(),
		    tileZoom = this._tileZoom;

		app.tile.size.pixels = [this._tileSize, this._tileSize];
		if (this._tileWidthTwips === undefined) {
			this._tileWidthTwips = this.options.tileWidthTwips;
			app.tile.size.twips[0] = this.options.tileWidthTwips;
		}
		if (this._tileHeightTwips === undefined) {
			this._tileHeightTwips = this.options.tileHeightTwips;
			app.tile.size.twips[1] = this.options.tileHeightTwips;
		}

		var bounds = this._map.getPixelWorldBounds(this._tileZoom);
		if (bounds) {
			this._globalTileRange = this._pxBoundsToTileRange(bounds);
		}

		this._wrapX = crs.wrapLng && [
			Math.floor(map.project([0, crs.wrapLng[0]], tileZoom).x / tileSize),
			Math.ceil(map.project([0, crs.wrapLng[1]], tileZoom).x / tileSize)
		];
		this._wrapY = crs.wrapLat && [
			Math.floor(map.project([crs.wrapLat[0], 0], tileZoom).y / tileSize),
			Math.ceil(map.project([crs.wrapLat[1], 0], tileZoom).y / tileSize)
		];
	},

	_getTileSize: function () {
		return this.options.tileSize;
	},

	_moveStart: function () {
		this._resetPreFetching();
	},

	_move: function () {
		this._update();
		this._resetPreFetching(true);
		this._onCurrentPageUpdate();
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}

		// TODO move to reset
		// var zoom = this._map.getZoom();

		// if (zoom > this.options.maxZoom ||
		//     zoom < this.options.minZoom) { return; }

		if (center === undefined) { center = map.getCenter(); }
		if (zoom === undefined) { zoom = Math.round(map.getZoom()); }

		var pixelBounds = map.getPixelBounds(center, zoom),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    queue = [];

		for (var key in this._tiles) {
			if (this._keyToTileCoords(key).z !== zoom ||
					this._keyToTileCoords(key).part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// if there is no exiting tile in the current view
		var newView = true;
		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new L.Point(i, j);
				coords.z = zoom;
				coords.part = this._selectedPart;

				if (!this._isValidTile(coords)) { continue; }

				key = this._tileCoordsToKey(coords);
				var tile = this._tiles[key];
				var invalid = tile && tile._invalidCount && tile._invalidCount > 0;
				if (tile && tile.loaded && !invalid) {
					tile.current = true;
					newView = false;
				} else if (invalid) {
					tile._invalidCount = 1;
					queue.push(coords);
				} else {
					queue.push(coords);
				}
			}
		}

		this._sendClientVisibleArea(true);

		this._sendClientZoom(true);

		if (queue.length !== 0) {
			if (newView) {
				// we know that a new set of tiles that cover the whole view has been requested
				// so we're able to cancel the previous requests that are being processed
				this._cancelTiles();
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();
			this._addTiles(queue, fragment);
			this._level.el.appendChild(fragment);
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

		var pixelBounds = map.getPixelBounds(center, zoom),
		    tileRange = this._pxBoundsToTileRange(pixelBounds),
		    queue = [];

		for (key in this._tiles) {
			if (this._keyToTileCoords(key).z !== zoom ||
					this._keyToTileCoords(key).part !== this._selectedPart) {
				this._tiles[key].current = false;
			}
		}

		// if there is no exiting tile in the current view
		var newView = true;
		// create a queue of coordinates to load tiles from
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				coords = new L.Point(i, j);
				coords.z = zoom;
				coords.part = this._selectedPart;

				if (!this._isValidTile(coords)) { continue; }

				key = this._tileCoordsToKey(coords);
				tile = this._tiles[key];
				if (tile) {
					tile.current = true;
					newView = false;
				} else {
					queue.push(coords);
				}
			}
		}

		if (queue.length !== 0) {
			if (newView) {
				// we know that a new set of tiles that cover the whole view has been requested
				// so we're able to cancel the previous requests that are being processed
				this._cancelTiles();
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();
			var tilePositionsX = [];
			var tilePositionsY = [];

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				var tilePos = this._getTilePos(coords);
				key = this._tileCoordsToKey(coords);

				if (coords.part === this._selectedPart) {
					tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					this._initTile(tile);

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
					}

					// we prefer top/left over translate3d so that we don't create a HW-accelerated layer from each tile
					// which is slow, and it also fixes gaps between tiles in Safari
					L.DomUtil.setPosition(tile, tilePos, true);

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						coords: coords,
						current: true
					};

					fragment.appendChild(tile);

					this.fire('tileloadstart', {
						tile: tile,
						coords: coords
					});
				}
				if (!this._tileCache[key]) {
					var twips = this._coordsToTwips(coords);
					tilePositionsX.push(twips.x);
					tilePositionsY.push(twips.y);
				}
				else {
					tile.src = this._tileCache[key];
				}
			}

			if (tilePositionsX.length > 0 && tilePositionsY.length > 0) {
				this._sendTileCombineRequest(this._selectedPart, tilePositionsX, tilePositionsY);
			}

			this._level.el.appendChild(fragment);
		}

		if (typeof (this._prevSelectedPart) === 'number' &&
			this._prevSelectedPart !== this._selectedPart
			&& this._docType === 'spreadsheet') {
			this._map.fire('updatescrolloffset', {x: 0, y: 0, updateHeaders: false});
			this._map.scrollTop(0);
			this._map.scrollLeft(0);

			// 2020-01-14 if no side effect occurs remove this code later
			// this._cellCursor = L.LatLngBounds.createDefault();
			// this._prevCellCursor = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(1, 1));
			// this._cellCursorXY = new L.Point(-1, -1);
			// this._prevCellCursorXY = new L.Point(0, 0);
		}
		if (this._docType === 'presentation' || this._docType === 'drawing')
			this._initPreFetchPartTiles();
	},

	_requestNewTiles: function () {
		this._onMessage('invalidatetiles: EMPTY', null);
		this._update();
	},

	toggleTileDebugMode: function() {
		this.toggleTileDebugModeImpl();
		this._requestNewTiles();
	},

	_sendClientVisibleArea: function (forceUpdate) {
		if (!this._map._docLoaded)
			return;

		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var size = new L.Point(visibleArea.getSize().x, visibleArea.getSize().y);
		var newClientVisibleArea = 'clientvisiblearea x=' + Math.round(visibleTopLeft.x)
					+ ' y=' + Math.round(visibleTopLeft.y)
					+ ' width=' + Math.round(size.x)
					+ ' height=' + Math.round(size.y);

		if (this._clientVisibleArea !== newClientVisibleArea || forceUpdate) {
			// Visible area is dirty, update it on the server
			app.socket.sendMessage(newClientVisibleArea);
			if (!this._map._fatal && this._map._active && app.socket.connected())
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

	_sendClientZoom: function (forceUpdate) {
		if (!this._map._docLoaded)
			return;

		var newClientZoom = 'tilepixelwidth=' + this._tileWidthPx + ' ' +
			'tilepixelheight=' + this._tileHeightPx + ' ' +
			'tiletwipwidth=' + this._tileWidthTwips + ' ' +
			'tiletwipheight=' + this._tileHeightTwips;

		if (this._clientZoom !== newClientZoom || forceUpdate) {
			// the zoom level has changed
			app.socket.sendMessage('clientzoom ' + newClientZoom);

			if (!this._map._fatal && this._map._active && app.socket.connected())
				this._clientZoom = newClientZoom;
		}
	},

	_cancelTiles: function() {
		app.socket.sendMessage('canceltiles');
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
				var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
				var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
				var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
				var tileTopLeft = this._coordsToTwips(coords);
				var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
				var tileBounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
				dropTile |= (tile._invalidCount > 0 && !visibleArea.intersects(tileBounds));
			}
			else {
				dropTile |= tile._invalidCount > 0;
			}


			if (dropTile) {
				L.DomUtil.remove(tile.el);
				delete this._tiles[key];
				if (this._debug && this._debugDataCancelledTiles) {
					this._debugCancelledTiles++;
					this._debugDataCancelledTiles.setPrefix('Cancelled tiles: ' + this._debugCancelledTiles);
				}
			}
		}
		this._emptyTilesCount = 0;
	},

	_isValidTile: function (coords) {
		if (coords.x < 0 || coords.y < 0) {
			return false;
		}
		if (coords.x * this._tileWidthTwips >= this._docWidthTwips ||
				coords.y * this._tileHeightTwips >= this._docHeightTwips) {
			return false;
		}
		return true;
	},

	_keyToBounds: function (key) {
		return this._tileCoordsToBounds(this._keyToTileCoords(key));
	},

	// converts tile coordinates to its geographical bounds
	_tileCoordsToBounds: function (coords) {

		var map = this._map,
		    tileSize = this._getTileSize(),

		    nwPoint = coords.multiplyBy(tileSize),
		    sePoint = nwPoint.add([tileSize, tileSize]),

		    nw = map.wrapLatLng(map.unproject(nwPoint, coords.z)),
		    se = map.wrapLatLng(map.unproject(sePoint, coords.z));

		return new L.LatLngBounds(nw, se);
	},

	// converts tile coordinates to key for the tile cache
	_tileCoordsToKey: function (coords) {
		return coords.x + ':' + coords.y + ':' + coords.z + ':' + coords.part;
	},

	// converts tile cache key to coordinates
	_keyToTileCoords: function (key) {
		var k = key.split(':'),
		coords = new L.Point(+k[0], +k[1]);
		coords.z = +k[2];
		coords.part = +k[3];
		return coords;
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
		L.DomUtil.remove(tile.el);
		if (this._debug && this._debugInfo && this._tiles[key]._debugPopup) {
			this._debugInfo.removeLayer(this._tiles[key]._debugPopup);
		}
		delete this._tiles[key];

		this.fire('tileunload', {
			tile: tile.el,
			coords: this._keyToTileCoords(key)
		});
	},

	_initTile: function (tile) {
		L.DomUtil.addClass(tile, 'leaflet-tile');

		tile.style.width = this._tileSize + 'px';
		tile.style.height = this._tileSize + 'px';

		tile.onselectstart = L.Util.falseFn;
		tile.onmousemove = L.Util.falseFn;

		// update opacity on tiles in IE7-8 because of filter inheritance problems
		if (L.Browser.ielt9 && this.options.opacity < 1) {
			L.DomUtil.setOpacity(tile, this.options.opacity);
		}

		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (L.Browser.android && !L.Browser.android23) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
	},

	_addTiles: function (coordsQueue, fragment) {
		var coords, key;
		// first take care of the DOM
		for (var i = 0; i < coordsQueue.length; i++) {
			coords = coordsQueue[i];

			var tilePos = this._getTilePos(coords);
			key = this._tileCoordsToKey(coords);

			if (coords.part === this._selectedPart) {
				if (!this._tiles[key]) {
					var tile = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					this._initTile(tile);

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tile), 0);
					}

					// we prefer top/left over translate3d so that we don't create a HW-accelerated layer from each tile
					// which is slow, and it also fixes gaps between tiles in Safari
					L.DomUtil.setPosition(tile, tilePos, true);

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						coords: coords,
						current: true
					};

					fragment.appendChild(tile);

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
		coordsQueue.sort(function(a, b) {
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
			var bound = new L.Point(coords.x, coords.y);

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
				if (!hasHole && (current.y === bound.y + 1)) {
					rowLocked = true;
					++bound.y;
				}

				if (current.y > bound.y) {
					break;
				}

				if (!rowLocked) {
					if (current.y === bound.y && current.x === bound.x + 1) {
						// extend the bound horizontally
						++bound.x;
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

		var twips;
		for (var r = 0; r < rectangles.length; ++r) {
			rectQueue = rectangles[r];
			var tilePositionsX = [];
			var tilePositionsY = [];
			for (i = 0; i < rectQueue.length; i++) {
				coords = rectQueue[i];
				twips = this._coordsToTwips(coords);
				tilePositionsX.push(twips.x);
				tilePositionsY.push(twips.y);
			}
			this._sendTileCombineRequest(coords.part, tilePositionsX, tilePositionsY);
		}
		if (this._docType === 'presentation' || this._docType === 'drawing')
			this._initPreFetchPartTiles();
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
		if (this._map._fadeAnimated) {
			L.DomUtil.setOpacity(tile.el, 0);
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
		}

		L.DomUtil.addClass(tile.el, 'leaflet-tile-loaded');

		if (this._noTilesToLoad()) {
			this.fire('load');
			this._pruneTiles();
		}
	},

	_getTilePos: function (coords) {
		return coords.multiplyBy(this._tileSize).subtract(this._level.origin);
	},

	_wrapCoords: function (coords) {
		var newCoords = new L.Point(
			this._wrapX ? L.Util.wrapNum(coords.x, this._wrapX) : coords.x,
			this._wrapY ? L.Util.wrapNum(coords.y, this._wrapY) : coords.y);
		newCoords.z = coords.z;
		newCoords.part = coords.part;
		return newCoords;
	},

	_pxBoundsToTileRange: function (bounds) {
		return new L.Bounds(
			bounds.min.divideBy(this._tileSize).floor().subtract([1, 1]),
			bounds.max.divideBy(this._tileSize).ceil());
	},

	_twipsToCoords: function (twips) {
		return new L.Point(
				Math.round(twips.x / twips.tileWidth),
				Math.round(twips.y / twips.tileHeight));
	},

	_coordsToTwips: function (coords) {
		return new L.Point(
				coords.x * this._tileWidthTwips,
				coords.y * this._tileHeightTwips);
	},

	_twipsToLatLng: function (twips, zoom) {
		var pixels = new L.Point(
				twips.x / this._tileWidthTwips * this._tileSize,
				twips.y / this._tileHeightTwips * this._tileSize);
		return this._map.unproject(pixels, zoom);
	},

	_latLngToTwips: function (latLng, zoom) {
		var pixels = this._map.project(latLng, zoom);
		return new L.Point(
				Math.round(pixels.x / this._tileSize * this._tileWidthTwips),
				Math.round(pixels.y / this._tileSize * this._tileHeightTwips));
	},

	_twipsToPixels: function (twips) {
		return new L.Point(
				twips.x / this._tileWidthTwips * this._tileSize,
				twips.y / this._tileHeightTwips * this._tileSize);
	},

	_pixelsToTwips: function (pixels) {
		return new L.Point(
				pixels.x * this._tileWidthTwips / this._tileSize,
				pixels.y * this._tileHeightTwips / this._tileSize);
	},

	_twipsRectangleToPixelBounds: function (strRectangle) {
		// TODO use this more
		// strRectangle = x, y, width, height
		var strTwips = strRectangle.match(/\d+/g);
		if (!strTwips) {
			return null;
		}
		var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
		var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
		var bottomRightTwips = topLeftTwips.add(offset);
		return new L.Bounds(
				this._twipsToPixels(topLeftTwips),
				this._twipsToPixels(bottomRightTwips));
	},

	_twipsRectanglesToPixelBounds: function (strRectangles) {
		// used when we have more rectangles
		strRectangles = strRectangles.split(';');
		var boundsList = [];
		for (var i = 0; i < strRectangles.length; i++) {
			var bounds = this._twipsRectangleToPixelBounds(strRectangles[i]);
			if (bounds) {
				boundsList.push(bounds);
			}
		}
		return boundsList;
	},

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	},

	_initPreFetchPartTiles: function() {
		// check existing timeout and clear it before the new one
		if (this._partTilePreFetcher)
			clearTimeout(this._partTilePreFetcher);
		this._partTilePreFetcher =
			setTimeout(
				L.bind(function() {
					this._preFetchPartTiles(this._selectedPart + this._map._partsDirection);
				},
				this),
			100 /*ms*/);
	},

	_preFetchPartTiles: function(part) {
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var pixelBounds = this._map.getPixelBounds(center, zoom);
		var tileRange = this._pxBoundsToTileRange(pixelBounds);
		var tilePositionsX = [];
		var tilePositionsY = [];
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new L.Point(i, j);
				coords.z = zoom;
				coords.part = part;

				if (!this._isValidTile(coords))
					continue;

				var key = this._tileCoordsToKey(coords);
				if (this._tileCache[key])
					continue;

				var twips = this._coordsToTwips(coords);
				tilePositionsX.push(twips.x);
				tilePositionsY.push(twips.y);
			}
		}
		if (tilePositionsX.length <= 0 || tilePositionsY.length <= 0) {
			return;
		}
		this._sendTileCombineRequest(part, tilePositionsX, tilePositionsY);
	},

	_sendTileCombineRequest: function(part, tilePositionsX, tilePositionsY) {
		var msg = 'tilecombine ' +
			'nviewid=0 ' +
			'part=' + part + ' ' +
			'width=' + this._tileWidthPx + ' ' +
			'height=' + this._tileHeightPx + ' ' +
			'tileposx=' + (typeof(tilePositionsX) === 'number' ? tilePositionsX: tilePositionsX.join()) + ' '	+
			'tileposy=' + (typeof(tilePositionsY) === 'number' ? tilePositionsY: tilePositionsY.join()) + ' ' +
			'tilewidth=' + this._tileWidthTwips + ' ' +
			'tileheight=' + this._tileHeightTwips;
		app.socket.sendMessage(msg, '');
	},

	_preFetchTiles: function (forceBorderCalc) {
		if (this._emptyTilesCount > 0 || !this._map) {
			return;
		}
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var tilesToFetch = 10;
		var maxBorderWidth = 5;
		var tileBorderSrc;

		if (this._map.isPermissionEdit()) {
			tilesToFetch = 5;
			maxBorderWidth = 3;
		}

		if (!this._preFetchBorder || forceBorderCalc) {
			var pixelBounds = this._map.getPixelBounds(center, zoom);
			tileBorderSrc = this._pxBoundsToTileRange(pixelBounds);
			this._preFetchBorder = tileBorderSrc;
		}
		else {
			tileBorderSrc = this._preFetchBorder;
		}

		// We mutate this - so need a temporary copy
		var tileBorder = new L.Bounds(tileBorderSrc.min, tileBorderSrc.max);

		var queue = [],
		    finalQueue = [],
		    visitedTiles = {},
		    borderWidth = 0;
		// don't search on a border wider than 5 tiles because it will freeze the UI

		while ((tileBorder.min.x >= 0 || tileBorder.min.y >= 0 ||
				tileBorder.max.x * this._tileWidthTwips < this._docWidthTwips ||
				 tileBorder.max.y * this._tileHeightTwips < this._docHeightTwips) &&
				tilesToFetch > 0 && borderWidth < maxBorderWidth) {
			// while the bounds do not fully contain the document

			for (var i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
				// tiles below the visible area
				var coords = new L.Point(i, tileBorder.max.y);
				queue.push(coords);
			}
			for (i = tileBorder.min.x; i <= tileBorder.max.x; i++) {
				// tiles above the visible area
				coords = new L.Point(i, tileBorder.min.y);
				queue.push(coords);
			}
			for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
				// tiles to the right of the visible area
				coords = new L.Point(tileBorder.max.x, i);
				queue.push(coords);
			}
			for (i = tileBorder.min.y; i <= tileBorder.max.y; i++) {
				// tiles to the left of the visible area
				coords = new L.Point(tileBorder.min.x, i);
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

		if (finalQueue.length > 0) {
			var fragment = document.createDocumentFragment();
			this._addTiles(finalQueue, fragment);
			this._level.el.appendChild(fragment);
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
			this._preFetchBorder = null;
		}
		var interval = 750;
		var idleTime = 5000;
		this._preFetchPart = this._selectedPart;
		this._preFetchIdle = setTimeout(L.bind(function () {
			this._tilesPreFetcher = setInterval(L.bind(this._preFetchTiles, this), interval);
			this._preFetchIdle = undefined;
		}, this), idleTime);
	},

	_clearPreFetch: function () {
		if (this._preFetchIdle !== undefined) {
			clearTimeout(this._preFetchIdle);
		}

		this._clearTilesPreFetcher();
	},

	_clearTilesPreFetcher: function () {
		if (this._tilesPreFetcher !== undefined) {
			clearInterval(this._tilesPreFetcher);
		}
	},

	_coordsToPixBounds: function (coords) {
		// coords.x and coords.y are the grid indices of the tile.
		var topLeft = new L.Point(coords.x, coords.y)._multiplyBy(this._tileSize);
		var bottomRight = topLeft.add(new L.Point(this._tileSize, this._tileSize));
		return new L.Bounds(topLeft, bottomRight);
	},

	getMaxDocSize: function () {
		return undefined;
	},

	getSnapDocPosX: function (docPosPixX) {
		return docPosPixX;
	},

	getSnapDocPosY: function (docPosPixY) {
		return docPosPixY;
	},

	hasSplitPanesSupport: function () {
		return false;
	},

	getSplitPanesContext: function () {
		return undefined;
	},

	updateHorizPaneSplitter: function () {
	},

	updateVertPaneSplitter: function () {
	},
});

L.gridLayer = function (options) {
	return new L.GridLayer(options);
};
