/*
 * L.GridLayer is used as base class for grid-like layers like TileLayer.
 */

L.GridLayer = L.Layer.extend({

	options: {
		pane: 'tilePane',

		tileSize: 256,
		opacity: 1,

		updateWhenIdle: L.Browser.mobile,
		updateInterval: 200,

		attribution: null,
		zIndex: null,
		bounds: null,

		minZoom: 0,
		// maxZoom: <Number>
		tileWidthTwips: 3000,
		tileHeightTwips: 3000
	},

	initialize: function (options) {
		options = L.setOptions(this, options);
	},

	onAdd: function () {
		this._initContainer();
		this._selections = new L.LayerGroup();
		this._map.addLayer(this._selections);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};

		this._map._fadeAnimated = false;
		this._viewReset();
		this._update();
		this._map._docLayer = this;
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
	},

	onRemove: function (map) {
		L.DomUtil.remove(this._container);
		map._removeZoomLimit(this);
		this._container = null;
		this._tileZoom = null;
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

		if (this._zoomAnimated) {
			events.zoomanim = this._animateZoom;
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
			if (this._levels[z].el.children.length || z === zoom) {
				this._levels[z].el.style.zIndex = maxZoom - Math.abs(zoom - z);
			} else {
				L.DomUtil.remove(this._levels[z].el);
				delete this._levels[z];
			}
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
	},

	_animateZoom: function (e) {
		this._reset(e.center, e.zoom, false, true, e.noUpdate);
	},

	_reset: function (center, zoom, hard, noPrune, noUpdate) {
		var tileZoom = Math.round(zoom),
			tileZoomChanged = this._tileZoom !== tileZoom;

		if (!noUpdate && (hard || tileZoomChanged)) {

			if (this._abortLoading) {
				this._abortLoading();
			}

			this._tileZoom = tileZoom;
			if (tileZoomChanged) {
				this._updateTileTwips();
				this._updateMaxBounds();
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

	_updateTileTwips: function () {
		// smaller zoom = zoom in
		var factor = Math.pow(1.2, (10 - this._tileZoom));
		this._tileWidthTwips = Math.round(this.options.tileWidthTwips * factor);
		this._tileHeightTwips = Math.round(this.options.tileHeightTwips * factor);
	},

	_updateMaxBounds: function (sizeChanged) {
		if (this._docWidthTwips === undefined || this._docHeightTwips === undefined) {
			return;
		}
		var docPixelLimits = new L.Point(this._docWidthTwips / this.options.tileWidthTwips,
										 this._docHeightTwips / this.options.tileHeightTwips);
		docPixelLimits = docPixelLimits.multiplyBy(this._tileSize);

		var topLeft = new L.Point(0, 0);
		topLeft = this._map.unproject(topLeft);
		var bottomRight = new L.Point(docPixelLimits.x, docPixelLimits.y);
		bottomRight = this._map.unproject(bottomRight);

		if (this._documentInfo === '' || sizeChanged) {
			// we just got the first status so we need to center the document
			this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
		}

		var scrollPixelLimits = new L.Point(this._docWidthTwips / this._tileWidthTwips,
										 this._docHeightTwips / this._tileHeightTwips);
		scrollPixelLimits = scrollPixelLimits.multiplyBy(this._tileSize);
		this._map.fire('docsize', {x: scrollPixelLimits.x, y: scrollPixelLimits.y});
	},

	_updateScrollOffset: function () {
		var centerPixel = this._map.project(this._map.getCenter());
		var newScrollPos = centerPixel.subtract(this._map.getSize().divideBy(2));
		var x = newScrollPos.x < 0 ? 0 : newScrollPos.x;
		var y = newScrollPos.y < 0 ? 0 : newScrollPos.y;
		this._map.fire('updatescrolloffset', {x: x, y: y});
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
		if (this._tileWidthTwips === undefined) {
			this._tileWidthTwips = this.options.tileWidthTwips;
		}
		if (this._tileHeightTwips === undefined) {
			this._tileHeightTwips = this.options.tileHeightTwips;
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
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '' ||
			(this.options.useSocket && map.socket && map.socket.readyState !== 1)) {
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
					this._keyToTileCoords(key).part !== this._currentPart) {
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
				coords.part = this._currentPart;

				if (!this._isValidTile(coords)) { continue; }

				key = this._tileCoordsToKey(coords);
				var tile = this._tiles[key];
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
				this.sendMessage('canceltiles');
				for (key in this._tiles) {
					if (!this._tiles[key].loaded) {
						L.DomUtil.remove(this._tiles[key].el);
						delete this._tiles[key];
					}
				}
				this._emptyTilesCount = 0;
			}

			// if its the first batch of tiles to load
			if (this._noTilesToLoad()) {
				this.fire('loading');
			}

			// create DOM fragment to append tiles in one batch
			var fragment = document.createDocumentFragment();

			for (i = 0; i < queue.length; i++) {
				this._addTile(queue[i], fragment);
			}

			this._level.el.appendChild(fragment);
		}
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
		// dangerous in connection with typing / invalidation, so let's
		// comment it out for now
		if (!(this._tiles[key]._invalidCount > 0)) {
			this._tileCache[key] = tile.el.src;
		}

		if (!tile.loaded && this._emptyTilesCount > 0) {
			this._emptyTilesCount -= 1;
		}
		L.DomUtil.remove(tile.el);
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

	_addTile: function (coords, fragment) {
		var tilePos = this._getTilePos(coords),
			key = this._tileCoordsToKey(coords);

		if (coords.part === this._currentPart) {
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
		}

		if (!this._tileCache[key]) {
			if (this.options.useSocket && this._map.socket) {
				var twips = this._coordsToTwips(coords);
				var msg = 'tile ' +
						'part=' + coords.part + ' ' +
						'width=' + this._tileSize + ' ' +
						'height=' + this._tileSize + ' ' +
						'tileposx=' + twips.x + ' '	+
						'tileposy=' + twips.y + ' ' +
						'tilewidth=' + this._tileWidthTwips + ' ' +
						'tileheight=' + this._tileHeightTwips;
				if (coords.part !== this._currentPart) {
					msg += ' prefetch=true';
				}
				this.sendMessage(msg, key);
			}
		}
		else {
			tile.src = this._tileCache[key];
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
		if (this._map._fadeAnimated) {
			L.DomUtil.setOpacity(tile.el, 0);
			L.Util.cancelAnimFrame(this._fadeFrame);
			this._fadeFrame = L.Util.requestAnimFrame(this._updateOpacity, this);
		} else {
			tile.active = true;
			this._pruneTiles();
		}

		L.DomUtil.addClass(tile.el, 'leaflet-tile-loaded');

		if (this._noTilesToLoad()) {
			this.fire('load');
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

	_noTilesToLoad: function () {
		for (var key in this._tiles) {
			if (!this._tiles[key].loaded) { return false; }
		}
		return true;
	},

	_preFetchTiles: function () {
		if (this._emptyTilesCount > 0) {
			return;
		}
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var tilesToFetch = 10;
		var maxBorderWidth = 5;

		if (this._permission === 'edit') {
			tilesToFetch = 5;
			maxBorderWidth = 3;
		}

		if (!this._preFetchBorder) {
			if (this._currentPart !== this._preFetchPart) {
				// all tiles from the new part have to be pre-fetched
				var tileBorder = this._preFetchBorder = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			}
			else {
				var pixelBounds = this._map.getPixelBounds(center, zoom);
				tileBorder = this._pxBoundsToTileRange(pixelBounds);
				this._preFetchBorder = tileBorder;
			}
		}
		else {
			tileBorder = this._preFetchBorder;
		}
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
			if (!(tileBorder.min.x >= 0 || tileBorder.min.y >= 0 ||
					tileBorder.max.x * this._tileWidthTwips < this._docWidthTwips ||
					 tileBorder.max.y * this._tileHeightTwips < this._docHeightTwips) &&
					this.options.preFetchOtherParts) {
				var diff = this._preFetchPart - this._currentPart;
				if (diff === 0 && this._currentPart < this._parts - 1) {
					this._preFetchPart += 1;
					this._preFetchBorder = null;
				}
				else if (diff === 0 && this._currentPart > 0) {
					this._preFetchPart -= 1;
					this._preFetchBorder = null;
				}
				else if (diff > 0) {
					if (this._currentPart - diff >= 0) {
						// lower part number
						this._preFetchPart = this._currentPart - diff;
						this._preFetchBorder = null;
					}
					else if (this._currentPart + diff + 1 < this._parts) {
						// higher part number
						this._preFetchPart = this._currentPart + diff + 1;
						this._preFetchBorder = null;
					}
				}
				else if (diff < 0) {
					if (this._currentPart - diff + 1 < this._parts) {
						// higher part number
						this._preFetchPart = this._currentPart - diff + 1;
						this._preFetchBorder = null;
					}
					else if (this._currentPart + diff - 1 >= 0) {
						// lower part number
						this._preFetchPart = this._currentPart + diff - 1;
						this._preFetchBorder = null;
					}
				}
			}
		}

		if (finalQueue.length > 0) {
			var fragment = document.createDocumentFragment();
			for (i = 0; i < finalQueue.length; i++) {
				this._addTile(finalQueue[i], fragment);
			}
			this._level.el.appendChild(fragment);
		}
	},

	_resetPreFetching: function (resetBorder) {
		clearInterval(this._tilesPreFetcher);
		clearTimeout(this._preFetchIdle);
		if (resetBorder) {
			this._preFetchBorder = null;
		}
		var interval = 750;
		var idleTime = 5000;
		this._preFetchIdle = setTimeout(L.bind(function () {
			this._tilesPreFetcher = setInterval(L.bind(this._preFetchTiles, this), interval);
		}, this), idleTime);
	}
});

L.gridLayer = function (options) {
	return new L.GridLayer(options);
};
