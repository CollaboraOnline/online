/* -*- js-indent-level: 8 -*- */
/*
 * L.CanvasTileLayer is a L.TileLayer with canvas based rendering.
 */

/* global L CanvasSectionContainer CanvasOverlay */

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

L.TileSectionManager = L.Class.extend({

	initialize: function (layer) {
		this._layer = layer;
		this._canvas = this._layer._canvas;
		this._map = this._layer._map;
		var mapSize = this._map.getPixelBoundsCore().getSize();
		this._oscCtxs = [];
		this._tilesSection = null; // Shortcut.

		this._sectionContainer = new CanvasSectionContainer(this._canvas);
		if (L.Browser.cypressTest) // If cypress is active, create test divs.
			this._sectionContainer.testing = true;

		this._sectionContainer.onResize(mapSize.x, mapSize.y);

		var dpiScale = L.getDpiScaleFactor(true /* useExactDPR */);
		this._dpiScale = dpiScale;

		var splitPanesContext = this._layer.getSplitPanesContext();
		this._splitPos = splitPanesContext ?
			splitPanesContext.getSplitPos() : new L.Point(0, 0);
		this._updatesRunning = false;
		this._mirrorEventsFromSourceToCanvasSectionContainer(document.getElementById('map'));
	},

	// Map and TilesSection overlap entirely. Map is above tiles section. In order to handle events in tiles section, we need to mirror them from map.
	_mirrorEventsFromSourceToCanvasSectionContainer: function (sourceElement) {
		var that = this;
		sourceElement.addEventListener('mousemove', function (e) { that._sectionContainer.onMouseMove(e); }, true);
		sourceElement.addEventListener('mousedown', function (e) { that._sectionContainer.onMouseDown(e); }, true);
		sourceElement.addEventListener('mouseup', function (e) { that._sectionContainer.onMouseUp(e); }, true);
		sourceElement.addEventListener('click', function (e) { that._sectionContainer.onClick(e); }, true);
		sourceElement.addEventListener('dblclick', function (e) { that._sectionContainer.onDoubleClick(e); }, true);
		sourceElement.addEventListener('contextmenu', function (e) { that._sectionContainer.onContextMenu(e); }, true);
		sourceElement.addEventListener('wheel', function (e) { that._sectionContainer.onMouseWheel(e); }, true);
		sourceElement.addEventListener('mouseleave', function (e) { that._sectionContainer.onMouseLeave(e); }, true);
		sourceElement.addEventListener('touchstart', function (e) { that._sectionContainer.onTouchStart(e); }, true);
		sourceElement.addEventListener('touchmove', function (e) { that._sectionContainer.onTouchMove(e); }, true);
		sourceElement.addEventListener('touchend', function (e) { that._sectionContainer.onTouchEnd(e); }, true);
		sourceElement.addEventListener('touchcancel', function (e) { that._sectionContainer.onTouchCancel(e); }, true);
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

	getDpiScale: function () {
		return this._tilesSection.dpiScale;
	},

	getSplitPos: function () {
		var splitPanesContext = this._layer.getSplitPanesContext();
		return splitPanesContext ?
			splitPanesContext.getSplitPos().multiplyBy(this.getDpiScale()) :
			new L.Point(0, 0);
	},

	// Details of tile areas to render
	_paintContext: function() {
		var tileSize = new L.Point(this._layer._getTileSize(), this._layer._getTileSize());

		var viewBounds = this._map.getPixelBoundsCore();
		var splitPanesContext = this._layer.getSplitPanesContext();
		var paneBoundsList = splitPanesContext ?
		    splitPanesContext.getPxBoundList(viewBounds) :
		    [viewBounds];
		var canvasCorePx = new L.Point(this._pixWidth, this._pixHeight);

		return { canvasSize: canvasCorePx,
			 tileSize: tileSize,
			 viewBounds: viewBounds,
			 paneBoundsList: paneBoundsList,
			 paneBoundsActive: splitPanesContext ? true: false,
			 splitPos: this.getSplitPos(),
		};
	},

	_addTilesSection: function () {
		this._sectionContainer.pushSection(L.getNewTilesSection());
		this._tilesSection = this._sectionContainer.getSectionWithName('tiles');
	},

	_addGridSection: function () {
		var that = this;
		this._sectionContainer.createSection({
			name: L.CSections.CalcGrid.name,
			anchor: 'top left',
			position: [0, 0],
			size: [0, 0],
			expand: '',
			processingOrder: L.CSections.CalcGrid.processingOrder, // Size and position will be copied, this value is not important.
			drawingOrder: L.CSections.CalcGrid.drawingOrder,
			zIndex: L.CSections.CalcGrid.zIndex,
			// Even if this one is drawn on top, won't be able to catch events.
			// Sections with "interactable: true" can catch events even if they are under a section with property "interactable: false".
			interactable: false,
			sectionProperties: {
				docLayer: that._layer,
				tsManager: that,
				strokeStyle: '#c0c0c0'
			},
			onDraw: that._onDrawGridSection
		}, 'tiles'); // Its size and position will be copied from 'tiles' section.
	},

	_addOverlaySection: function () {
		var tsMgr = this;
		var canvasOverlay = this._layer._canvasOverlay = new CanvasOverlay(this._map, this._sectionContainer.getContext());
		this._sectionContainer.createSection({
			name: L.CSections.Overlays.name,
			anchor: 'top left',
			position: [0, 0],
			size: [0, 0],
			expand: '',
			processingOrder: L.CSections.Overlays.processingOrder,
			drawingOrder: L.CSections.Overlays.drawingOrder,
			zIndex: L.CSections.Overlays.zIndex,
			interactable: false,
			sectionProperties: {
				docLayer: tsMgr._layer,
				tsManager: tsMgr
			},
			onInitialize: canvasOverlay.onInitialize.bind(canvasOverlay),
			onResize: canvasOverlay.onResize.bind(canvasOverlay), // will call onDraw.
			onDraw: canvasOverlay.onDraw.bind(canvasOverlay)
		}, L.CSections.Tiles.name); // 'tile' section is the parent.
		canvasOverlay.setOverlaySection(this._sectionContainer.getSectionWithName(L.CSections.Overlays.name));
	},

	_onDrawGridSection: function () {
		if (!this.sectionProperties.docLayer.sheetGeometry)
			return;

		this.context.strokeStyle = this.sectionProperties.strokeStyle;
		this.context.lineWidth = 1.0;

		var ctx = this.sectionProperties.tsManager._paintContext();
		var context = this.context;

		this.context.beginPath();
		for (var i = 0; i < ctx.paneBoundsList.length; ++i) {
			// co-ordinates of this pane in core document pixels
			var paneBounds = ctx.paneBoundsList[i];
			// co-ordinates of the main-(bottom right) pane in core document pixels
			var viewBounds = ctx.viewBounds;
			// into real pixel-land ...
			paneBounds.round();
			viewBounds.round();

			var paneOffset = paneBounds.getTopLeft(); // allocates
			// Cute way to detect the in-canvas pixel offset of each pane
			paneOffset.x = Math.min(paneOffset.x, viewBounds.min.x);
			paneOffset.y = Math.min(paneOffset.y, viewBounds.min.y);

			// URGH -> zooming etc. (!?) ...
			this.sectionProperties.docLayer.sheetGeometry._columns.forEachInCorePixelRange(
				paneBounds.min.x, paneBounds.max.x,
				function(pos) {
					context.moveTo(pos - paneOffset.x - 0.5, paneBounds.min.y - paneOffset.y - 0.5);
					context.lineTo(pos - paneOffset.x - 0.5, paneBounds.max.y - paneOffset.y - 0.5);
					context.stroke();
				});

			this.sectionProperties.docLayer.sheetGeometry._rows.forEachInCorePixelRange(
				paneBounds.min.y, paneBounds.max.y,
				function(pos) {
					context.moveTo(paneBounds.min.x - paneOffset.x - 0.5, pos - paneOffset.y - 0.5);
					context.lineTo(paneBounds.max.x - paneOffset.x - 0.5, pos - paneOffset.y - 0.5);
					context.stroke();
				});
		}
		this.context.closePath();
	},

	// This section is added when debug is enabled. Splits are enabled for only Calc for now.
	_addSplitsSection: function () {
		var that = this;
		this._sectionContainer.createSection({
			name: L.CSections.Debug.Splits.name,
			anchor: 'top left',
			position: [0, 0],
			size: [0, 0],
			expand: '',
			processingOrder: L.CSections.Debug.Splits.processingOrder,
			drawingOrder: L.CSections.Debug.Splits.drawingOrder,
			zIndex: L.CSections.Debug.Splits.zIndex,
			// Even if this one is drawn on top, won't be able to catch events.
			// Sections with "interactable: true" can catch events even if they are under a section with property "interactable: false".
			interactable: false,
			sectionProperties: {
				docLayer: that._layer
			},
			onDraw: that._onDrawSplitsSection
		}, 'tiles'); // Its size and position will be copied from 'tiles' section.
	},

	// This section is added when debug is enabled.
	_addTilePixelGridSection: function () {
		var that = this;
		this._sectionContainer.createSection({
			name: L.CSections.Debug.TilePixelGrid.name,
			anchor: 'top left',
			position: [0, 0],
			size: [0, 0],
			expand: '',
			processingOrder: L.CSections.Debug.TilePixelGrid.processingOrder, // Size and position will be copied, this value is not important.
			drawingOrder: L.CSections.Debug.TilePixelGrid.drawingOrder,
			zIndex: L.CSections.Debug.TilePixelGrid.zIndex,
			interactable: false,
			sectionProperties: {},
			onDraw: that._onDrawTilePixelGrid
		}, 'tiles'); // Its size and position will be copied from 'tiles' section.
	},

	_onDrawTilePixelGrid: function() {
		var offset = 8;
		var count;
		this.context.lineWidth = 1;
		var currentPos;
		this.context.strokeStyle = '#ff0000';

		currentPos = 0;
		count = Math.round(this.context.canvas.height / offset);
		for (var i = 0; i < count; i++) {
			this.context.beginPath();
			this.context.moveTo(0.5, currentPos + 0.5);
			this.context.lineTo(this.context.canvas.width + 0.5, currentPos + 0.5);
			this.context.stroke();
			currentPos += offset;
		}

		currentPos = 0;
		count = Math.round(this.context.canvas.width / offset);
		for (var i = 0; i < count; i++) {
			this.context.beginPath();
			this.context.moveTo(currentPos + 0.5, 0.5);
			this.context.lineTo(currentPos + 0.5, this.context.canvas.height + 0.5);
			this.context.stroke();
			currentPos += offset;
		}
	},

	_onDrawSplitsSection: function () {
		var splitPanesContext = this.sectionProperties.docLayer.getSplitPanesContext();
		if (splitPanesContext) {
			var splitPos = splitPanesContext.getSplitPos();
			this.context.strokeStyle = 'red';
			this.context.strokeRect(0, 0, splitPos.x * this.dpiScale, splitPos.y * this.dpiScale);
		}
	},

	_updateWithRAF: function () {
		// update-loop with requestAnimationFrame
		this._canvasRAF = L.Util.requestAnimFrame(this._updateWithRAF, this, false /* immediate */);
		this._sectionContainer.requestReDraw();
	},

	clearTilesSection: function () {
		this._sectionContainer.setPenPosition(this._tilesSection);
		var size = this._map.getPixelBoundsCore().getSize();
		this._tilesSection.context.fillStyle = this._sectionContainer.getClearColor();
		this._tilesSection.context.fillRect(0, 0, size.x, size.y);
	},

	paintOverlayArea: function(coords) {
		var tileTopLeft = coords.getPos();
		var tileSize = this._layer._getTileSize();
		var tileBounds = new L.Bounds(tileTopLeft,
			tileTopLeft.add(new L.Point(tileSize, tileSize)));
		this._layer._canvasOverlay.paintRegion(tileBounds);
	},

	update: function () {
		this._sectionContainer.requestReDraw();
	},

	_viewReset: function () {
		var ctx = this._paintContext();
		for (var i = 0; i < ctx.paneBoundsList.length; ++i) {
			this._tilesSection.oscCtxs[i].fillStyle = 'white';
			this._tilesSection.oscCtxs[i].fillRect(0, 0, this._tilesSection.offscreenCanvases[i].width, this._tilesSection.offscreenCanvases[i].height);
		}
	},

	_zoomAnimation: function () {
		var painter = this;
		var ctx = this._paintContext();
		var paneBoundsList = ctx.paneBoundsList;
		var splitPos = ctx.splitPos;
		var canvasOverlay = this._layer._canvasOverlay;

		var rafFunc = function () {
			painter._sectionContainer.setPenPosition(painter._tilesSection);
			for (var i = 0; i < paneBoundsList.length; ++i) {
				var paneBounds = paneBoundsList[i];
				var paneSize = paneBounds.getSize();
				var extendedBounds = painter._tilesSection.extendedPaneBounds(paneBounds);
				var paneBoundsOffset = paneBounds.min.subtract(extendedBounds.min);
				var scale = painter._zoomFrameScale;

				var inXBounds = (painter._newCenter.x >= paneBounds.min.x) && (painter._newCenter.x <= paneBounds.max.x);
				var inYBounds = (painter._newCenter.y >= paneBounds.min.y) && (painter._newCenter.y <= paneBounds.max.y);

				// Calculate the pinch-center in off-screen canvas coordinates.
				var center = paneBounds.min.clone();
				if (inXBounds)
					center.x = painter._newCenter.x;
				if (inYBounds)
					center.y = painter._newCenter.y;

				// Top left position in the offscreen canvas.
				var sourceTopLeft = new L.Point(
					Math.max(paneBounds.min.x ? splitPos.x + 1 : 0,
						center.x - (center.x - paneBounds.min.x) / scale),
					Math.max(paneBounds.min.y ? splitPos.y + 1 : 0,
						center.y - (center.y - paneBounds.min.y) / scale))
					._subtract(paneBounds.min)._add(paneBoundsOffset);

				var destPos = new L.Point(0, 0);
				if (paneBoundsList.length > 1) {
					// Has freeze-panes, so recalculate the main canvas position to draw the pane
					// and compute the adjusted paneSizes.
					if (paneBounds.min.x) {
						// Pane is free to move in X direction.
						destPos.x = splitPos.x * scale;
						paneSize.x -= (splitPos.x * (scale - 1));
					} else {
						// Pane is fixed in X direction.
						paneSize.x += (splitPos.x * (scale - 1));
					}

					if (paneBounds.min.y) {
						// Pane is free to move in Y direction.
						destPos.y = splitPos.y * scale;
						paneSize.y -= (splitPos.y * (scale - 1));
					} else {
						// Pane is fixed in Y direction.
						paneSize.y += (splitPos.y * (scale - 1));
					}
				}

				painter._tilesSection.context.drawImage(painter._tilesSection.offscreenCanvases[i],
					sourceTopLeft.x, sourceTopLeft.y,
					// sourceWidth, sourceHeight
					paneSize.x / scale, paneSize.y / scale,
					// destX, destY
					destPos.x, destPos.y,
					// destWidth, destHeight
					paneSize.x, paneSize.y);
			}

			canvasOverlay.onDraw();

			painter._zoomRAF = requestAnimationFrame(rafFunc);
		};
		this.rafFunc = rafFunc;
		rafFunc();
	},

	_calcZoomFrameScale: function (zoom, newCenter) {
		zoom = this._layer._map._limitZoom(zoom);
		var origZoom = this._layer._map.getZoom();
		// Compute relative-multiplicative scale of this zoom-frame w.r.t the starting zoom(ie the current Map's zoom).
		this._zoomFrameScale = this._layer._map.zoomToFactor(zoom - origZoom + this._layer._map.options.zoom);

		this._newCenter = this._layer._map.project(newCenter).multiplyBy(this._tilesSection.dpiScale); // in core pixels
	},

	zoomStep: function (zoom, newCenter) {
		this._calcZoomFrameScale(zoom, newCenter);

		if (!this._inZoomAnim) {
			this._tilesSection.setInZoomAnim(true);
			this._inZoomAnim = true;
			this._layer._prefetchTilesSync();
			// Start RAF loop for zoom-animation
			this._zoomAnimation();
		}
	},

	zoomStepEnd: function (zoom, newCenter) {
		this._zoomFrameScale = undefined;
		if (this._inZoomAnim) {
			cancelAnimationFrame(this._zoomRAF);
			this._calcZoomFrameScale(zoom, newCenter);
			this.rafFunc();
			cancelAnimationFrame(this._zoomRAF);
			this._zoomFrameScale = undefined;
			this._tilesSection.setInZoomAnim(false);
			this._inZoomAnim = false;
		}
	}
});

L.CanvasTileLayer = L.TileLayer.extend({

	_initContainer: function () {
		if (this._canvasContainer) {
			console.error('called _initContainer() when this._canvasContainer is present!');
		}

		L.TileLayer.prototype._initContainer.call(this);

		var mapContainer = document.getElementById('document-container');
		var canvasContainerClass = 'leaflet-canvas-container';
		this._canvasContainer = L.DomUtil.create('div', canvasContainerClass, mapContainer);
		this._setup();
	},

	_setup: function () {

		if (!this._canvasContainer) {
			console.error('canvas container not found. _initContainer failed ?');
		}

		this._canvas = L.DomUtil.createWithId('canvas', 'document-canvas', this._canvasContainer);
		this._container.style.position = 'absolute';
		this._cursorDataDiv = L.DomUtil.create('div', 'cell-cursor-data', this._canvasContainer);
		this._selectionsDataDiv = L.DomUtil.create('div', 'selections-data', this._canvasContainer);

		this._painter = new L.TileSectionManager(this);
		this._painter._addTilesSection();
		this._painter._sectionContainer.getSectionWithName('tiles').onResize();
		this._painter._addOverlaySection();
		this._painter._sectionContainer.addSection(L.getNewScrollSection());

		// For mobile/tablet the hammerjs swipe handler already uses a requestAnimationFrame to fire move/drag events
		// Using L.TileSectionManager's own requestAnimationFrame loop to do the updates in that case does not perform well.
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
		this._map.on('resize', this._syncTileContainerSize, this);
		this._map.on('zoomend', this._painter.update, this._painter);
		this._map.on('splitposchanged', this._painter.update, this._painter);
		this._map.on('sheetgeometrychanged', this._painter.update, this._painter);
		this._map.on('move', this._syncTilePanePos, this);
		this._map.on('updateselectionheader', this._painter.update, this._painter);
		this._map.on('clearselectionheader', this._painter.update, this._painter);
		this._map.on('updatecurrentheader', this._painter.update, this._painter);

		this._map.on('viewrowcolumnheaders', this._painter.update, this._painter);

		if (this._docType === 'spreadsheet') {
			this._painter._addGridSection();
		}
		this._syncTileContainerSize();
	},

	_syncTilePanePos: function () {
		var tilePane = this._container.parentElement;
		if (tilePane) {
			var mapPanePos = this._map._getMapPanePos();
			L.DomUtil.setPosition(tilePane, new L.Point(-mapPanePos.x , -mapPanePos.y));
			var documentPos = this._map.getPixelBoundsCore().min;
			this._painter._sectionContainer.setDocumentTopLeft([documentPos.x, documentPos.y]);
		}
	},

	_getUIWidth: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
		if (section) {
			return Math.round(section.size[0] / section.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getUIHeight: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
		if (section) {
			return Math.round(section.size[1] / section.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupWidth: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
		if (section) {
			return Math.round(section.size[0] / section.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupHeight: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
		if (section) {
			return Math.round(section.size[1] / section.dpiScale);
		}
		else {
			return 0;
		}
	},

	_syncTileContainerSize: function () {
		var tileContainer = this._container;
		if (tileContainer) {
			var size = this._map.getPixelBounds().getSize();
			if (this._docType === 'spreadsheet') {
				var offset = this._getUIWidth() + this._getGroupWidth();
				offset += (this._getGroupWidth() > 0 ? 3: 1);

				size.x += offset;
				this._canvasContainer.style.left = -1 * (offset) + 'px';
				this._map.options.documentContainer.style.left = String(offset) + 'px';

				offset = this._getUIHeight() + this._getGroupHeight();
				size.y += offset;
				offset += (this._getGroupHeight() > 0 ? 3: 1);

				this._canvasContainer.style.top = -1 * offset + 'px';

				if (window.mode.isDesktop() || window.mode.isTablet()) {
					if (document.getElementById('map').classList.contains('notebookbar-opened'))
						this._map.options.documentContainer.style.marginTop = (Math.floor(this._getGroupHeight() + this._getUIHeight())) + 'px';
					else
						this._map.options.documentContainer.style.marginTop = (Math.floor(this._getGroupHeight())) + 'px';
				}
				else // Mobile.
					this._map.options.documentContainer.style.marginTop = String(this._getGroupHeight()) + 'px';
			}

			this._painter._sectionContainer.onResize(size.x, size.y);
			tileContainer.style.width = this._painter._sectionContainer.canvas.style.width;
			tileContainer.style.height = this._painter._sectionContainer.canvas.style.height;
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

	onAdd: function (map) {
		// Override L.TileLayer._tilePixelScale to 1 (independent of the device).
		this._tileWidthPx = this.options.tileSize;
		this._tileHeightPx = this.options.tileSize;
		this._tilePixelScale = 1;

		L.TileLayer.prototype.onAdd.call(this, map);
		map.setZoom();
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
			// update tiles on move, but not more often than once per given interval
			move: L.Util.throttle(this._move, this.options.updateInterval, this),
			splitposchanged: this._move,
		};

		return events;
	},

	// zoom is the new intermediate zoom level (log scale : 1 to 14)
	zoomStep: function (zoom, newCenter) {
		this._painter.zoomStep(zoom, newCenter);
	},

	zoomStepEnd: function (zoom, newCenter) {
		this._painter.zoomStepEnd(zoom, newCenter);
	},

	_viewReset: function (e) {
		L.TileLayer.prototype._viewReset.call(this, e);
		this._painter._viewReset();
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

	_corePixelsToCss: function (corePixels) {
		return corePixels.divideBy(this._painter._dpiScale);
	},

	_cssPixelsToCore: function (cssPixels) {
		return cssPixels.multiplyBy(this._painter._dpiScale);
	},

	_cssBoundsToCore: function (bounds) {
		return new L.Bounds(
			this._cssPixelsToCore(bounds.min),
			this._cssPixelsToCore(bounds.max)
		);
	},

	_twipsToCorePixels: function (twips) {
		return new L.Point(
			twips.x / this._tileWidthTwips * this._tileSize,
			twips.y / this._tileHeightTwips * this._tileSize);
	},

	_twipsToCorePixelsBounds: function (twips) {
		return new L.Bounds(
			this._twipsToCorePixels(twips.min),
			this._twipsToCorePixels(twips.max)
		);
	},

	_corePixelsToTwips: function (corePixels) {
		return new L.Point(
			corePixels.x / this._tileSize * this._tileWidthTwips,
			corePixels.y / this._tileSize * this._tileHeightTwips);
	},

	_twipsToCssPixels: function (twips) {
		return new L.Point(
			(twips.x / this._tileWidthTwips) * (this._tileSize / this._painter._dpiScale),
			(twips.y / this._tileHeightTwips) * (this._tileSize / this._painter._dpiScale));
	},

	_cssPixelsToTwips: function (pixels) {
		return new L.Point(
			((pixels.x * this._painter._dpiScale) / this._tileSize) * this._tileWidthTwips,
			((pixels.y * this._painter._dpiScale) / this._tileSize) * this._tileHeightTwips);
	},

	_twipsToLatLng: function (twips, zoom) {
		var pixels = this._twipsToCssPixels(twips);
		return this._map.unproject(pixels, zoom);
	},

	_latLngToTwips: function (latLng, zoom) {
		var pixels = this._map.project(latLng, zoom);
		return this._cssPixelsToTwips(pixels);
	},

	_twipsToPixels: function (twips) { // css pixels
		return this._twipsToCssPixels(twips);
	},

	_pixelsToTwips: function (pixels) { // css pixels
		return this._cssPixelsToTwips(pixels);
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

	_updateMaxBounds: function (sizeChanged, options, zoom) {
		if (this._docWidthTwips === undefined || this._docHeightTwips === undefined) {
			return;
		}
		if (!zoom) {
			zoom = this._map.getZoom();
		}

		var dpiScale = this._painter._dpiScale;
		var extraSize = options ? options.extraSize : null;
		var docPixelLimits = new L.Point(this._docWidthTwips / this.options.tileWidthTwips,
			this._docHeightTwips / this.options.tileHeightTwips);
		// docPixelLimits should be in csspx.
		docPixelLimits = docPixelLimits.multiplyBy(this._tileSize / dpiScale);
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
		scrollPixelLimits = scrollPixelLimits.multiplyBy(this._tileSize / dpiScale);
		if (extraSize) {
			// extraSize is unscaled.
			scrollPixelLimits = scrollPixelLimits.add(extraSize);
		}
		this._docPixelSize = {x: scrollPixelLimits.x, y: scrollPixelLimits.y};
		this._map.fire('docsize', {x: scrollPixelLimits.x, y: scrollPixelLimits.y, extraSize: extraSize});
	},


	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}

		if (center === undefined) { center = map.getCenter(); }
		if (zoom === undefined) { zoom = Math.round(map.getZoom()); }

		var pixelBounds = map.getPixelBoundsCore(center, zoom);
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

		this._sendClientVisibleArea();
		this._sendClientZoom();

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
		splitPos = this._corePixelsToTwips(splitPos);
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

		var pixelBounds = map.getPixelBoundsCore(center, zoom);
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
			var tileWids = '';

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

			// FIXME console.debug('Crass code duplication here in _updateOnChangePart');
			if (tilePositionsX !== '' && tilePositionsY !== '') {
				var message = 'tilecombine ' +
					'nviewid=0 ' +
					'part=' + this._selectedPart + ' ' +
					'width=' + this._tileWidthPx + ' ' +
					'height=' + this._tileHeightPx + ' ' +
					'tileposx=' + tilePositionsX + ' ' +
					'tileposy=' + tilePositionsY + ' ' +
				        'wid=' + tileWids + ' ' +
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

		var emptyTilesCountChanged = false;
		if (this._emptyTilesCount > 0) {
			this._emptyTilesCount -= 1;
			emptyTilesCountChanged = true;
		}

		if (emptyTilesCountChanged && this._emptyTilesCount === 0) {
			this._map.fire('statusindicator', { statusType: 'alltilesloaded' });
		}

		tile.loaded = +new Date();
		tile.active = true;

		// paint this tile on canvas.
		this._painter._tilesSection.paint(tile);
		this._painter.paintOverlayArea(coords);

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
						wid: 0,
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
			var tileWids = '';
			for (i = 0; i < rectQueue.length; i++) {
				coords = rectQueue[i];
				key = this._tileCoordsToKey(coords);

				twips = this._coordsToTwips(coords);

				if (tilePositionsX !== '')
					tilePositionsX += ',';
				tilePositionsX += twips.x;

				if (tilePositionsY !== '')
					tilePositionsY += ',';
				tilePositionsY += twips.y;

				tile = this._tiles[this._tileCoordsToKey(coords)];
				if (tileWids !== '')
					tileWids += ',';
				tileWids += tile && tile.wireId !== undefined ? tile.wireId : 0;
			}

			twips = this._coordsToTwips(coords);
			msg = 'tilecombine ' +
				'nviewid=0 ' +
				'part=' + coords.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'oldwid=' + tileWids + ' ' +
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
		nwPoint = this._corePixelsToCss(nwPoint);
		sePoint = this._corePixelsToCss(sePoint);

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

	_prefetchTilesSync: function () {
		if (!this._prefetcher)
			this._prefetcher = new L.TilesPreFetcher(this, this._map);
		this._prefetcher.preFetchTiles(true /* forceBorderCalc */, true /* immediate */);
	},

	_preFetchTiles: function (forceBorderCalc) {
		if (this._prefetcher) {
			this._prefetcher.preFetchTiles(forceBorderCalc);
		}
	},

	_resetPreFetching: function (resetBorder) {
		if (!this._prefetcher) {
			this._prefetcher = new L.TilesPreFetcher(this, this._map);
		}

		this._prefetcher.resetPreFetching(resetBorder);
	},

	_clearPreFetch: function () {
		if (this._prefetcher) {
			this._prefetcher.clearPreFetch();
		}
	},

	_clearTilesPreFetcher: function () {
		if (this._prefetcher) {
			this._prefetcher.clearTilesPreFetcher();
		}
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

			if (this._map._canvasDevicePixelGrid)
				// loleaflet/test/pixel-test.png
				img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QEIChoQ0oROpwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAACfklEQVR42u3dO67CQBBFwbnI+9/yJbCQLDIkPsZdFRAQjjiv3S8YZ63VNsl6aLvgop5+6vFzZ3QP/uQz2c0RIAAQAAzcASwAmAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACADGBnC8iQ5MABAACAB+zsVYjLZ9dOvd3zzg/QOYADByB/BvUCzBIAAQAFiCwQQAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAwIgAXb2ECgABAAPDaI7SLsZhs+79kvX8AEwDsAM8DASzBIAAQAFiCwQQAAYAAQAAgABAAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAI4LSSOAQBgABAAPDVR9C2ToGxNkfww623bZL98/ilUzIBwA4wbCAgABAACAAswWACgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAAAjAESAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAGAAEAAIAAQAAgABAACAAGAAEAAIAAQAAgAPiaJAEAAIAB48yNWW6fAWJsj4LRbb9sk++fxSxMA7AAMGwgCAAGAAMASDCYACAAEAAIAAYAAQAAgABAACAAEAAIAASAAR4AAQAAgABAACAAEANeW9e675sAEAAGAAODUO4AFgMnu7t9h2ahA0pgAAAAASUVORK5CYII=';

			tile.el.src = img;
			tile.wireId = tileMsgObj.wireId;
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

L.TilesPreFetcher = L.Class.extend({

	initialize: function (docLayer, map) {
		this._docLayer = docLayer;
		this._map = map;
	},

	preFetchTiles: function (forceBorderCalc, immediate) {

		if (this._docLayer._emptyTilesCount > 0 || !this._map || !this._docLayer) {
			return;
		}

		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var part = this._docLayer._selectedPart;
		var hasEditPerm = this._map.isPermissionEdit();

		if (this._zoom === undefined) {
			this._zoom = zoom;
		}

		if (this._preFetchPart === undefined) {
			this._preFetchPart = part;
		}

		if (this._hasEditPerm === undefined) {
			this._hasEditPerm = hasEditPerm;
		}

		var maxTilesToFetch = 10;
		// don't search on a border wider than 5 tiles because it will freeze the UI
		var maxBorderWidth = 5;

		if (hasEditPerm) {
			maxTilesToFetch = 5;
			maxBorderWidth = 3;
		}

		var tileSize = this._docLayer._tileSize;
		var pixelBounds = this._map.getPixelBoundsCore(center, zoom);

		if (this._pixelBounds === undefined) {
			this._pixelBounds = pixelBounds;
		}

		var splitPanesContext = this._docLayer.getSplitPanesContext();
		var splitPos = splitPanesContext ? splitPanesContext.getSplitPos() : new L.Point(0, 0);

		if (this._splitPos === undefined) {
			this._splitPos = splitPos;
		}

		var paneXFixed = false;
		var paneYFixed = false;

		if (forceBorderCalc ||
			!this._borders || this._borders.length === 0 ||
			zoom !== this._zoom ||
			part !== this._preFetchPart ||
			hasEditPerm !== this._hasEditPerm ||
			!pixelBounds.equals(this._pixelBounds) ||
			!splitPos.equals(this._splitPos)) {

			this._zoom = zoom;
			this._preFetchPart = part;
			this._hasEditPerm = hasEditPerm;
			this._pixelBounds = pixelBounds;
			this._splitPos = splitPos;

			// Need to compute borders afresh and fetch tiles for them.
			this._borders = []; // Stores borders for each split-pane.
			var tileRanges = this._docLayer._pxBoundsToTileRanges(pixelBounds);
			var paneStatusList = splitPanesContext ? splitPanesContext.getPanesProperties() :
				[ { xFixed: false, yFixed: false} ];

			console.assert(tileRanges.length === paneStatusList.length, 'tileRanges and paneStatusList should agree on the number of split-panes');

			for (var paneIdx = 0; paneIdx < tileRanges.length; ++paneIdx) {
				paneXFixed = paneStatusList[paneIdx].xFixed;
				paneYFixed = paneStatusList[paneIdx].yFixed;

				if (paneXFixed && paneYFixed) {
					continue;
				}

				var tileRange = tileRanges[paneIdx];
				var paneBorder = new L.Bounds(
					tileRange.min.add(new L.Point(-1, -1)),
					tileRange.max.add(new L.Point(1, 1))
				);

				this._borders.push(new L.TilesPreFetcher.PaneBorder(paneBorder, paneXFixed, paneYFixed));
			}

		}

		var finalQueue = [];
		var visitedTiles = {};

		var validTileRange = new L.Bounds(
			new L.Point(0, 0),
			new L.Point(
				Math.floor((this._docLayer._docWidthTwips - 1) / this._docLayer._tileWidthTwips),
				Math.floor((this._docLayer._docHeightTwips - 1) / this._docLayer._tileHeightTwips)
			)
		);

		var tilesToFetch = immediate ? Infinity : maxTilesToFetch; // total tile limit per call of preFetchTiles()
		var doneAllPanes = true;

		for (paneIdx = 0; paneIdx < this._borders.length; ++paneIdx) {

			var queue = [];
			paneBorder = this._borders[paneIdx];
			var borderBounds = paneBorder.getBorderBounds();

			paneXFixed = paneBorder.isXFixed();
			paneYFixed = paneBorder.isYFixed();

			while (tilesToFetch > 0 && paneBorder.getBorderIndex() < maxBorderWidth) {

				var clampedBorder = validTileRange.clamp(borderBounds);
				var fetchTopBorder = !paneYFixed && borderBounds.min.y === clampedBorder.min.y;
				var fetchBottomBorder = !paneYFixed && borderBounds.max.y === clampedBorder.max.y;
				var fetchLeftBorder = !paneXFixed && borderBounds.min.x === clampedBorder.min.x;
				var fetchRightBorder = !paneXFixed && borderBounds.max.x === clampedBorder.max.x;

				if (!fetchLeftBorder && !fetchRightBorder && !fetchTopBorder && !fetchBottomBorder) {
					break;
				}

				if (fetchBottomBorder) {
					for (var i = clampedBorder.min.x; i <= clampedBorder.max.x; i++) {
						// tiles below the visible area
						var coords = new L.TileCoordData(
							i * tileSize,
							borderBounds.max.y * tileSize);
						queue.push(coords);
					}
				}

				if (fetchTopBorder) {
					for (i = clampedBorder.min.x; i <= clampedBorder.max.x; i++) {
						// tiles above the visible area
						coords = new L.TileCoordData(
							i * tileSize,
							borderBounds.min.y * tileSize);
						queue.push(coords);
					}
				}

				if (fetchRightBorder) {
					for (i = clampedBorder.min.y; i <= clampedBorder.max.y; i++) {
						// tiles to the right of the visible area
						coords = new L.TileCoordData(
							borderBounds.max.x * tileSize,
							i * tileSize);
						queue.push(coords);
					}
				}

				if (fetchLeftBorder) {
					for (i = clampedBorder.min.y; i <= clampedBorder.max.y; i++) {
						// tiles to the left of the visible area
						coords = new L.TileCoordData(
							borderBounds.min.x * tileSize,
							i * tileSize);
						queue.push(coords);
					}
				}

				var tilesPending = false;
				for (i = 0; i < queue.length; i++) {
					coords = queue[i];
					coords.z = zoom;
					coords.part = this._preFetchPart;
					var key = this._docLayer._tileCoordsToKey(coords);

					if (!this._docLayer._isValidTile(coords) ||
						this._docLayer._tiles[key] ||
						this._docLayer._tileCache[key] ||
						visitedTiles[key]) {
						continue;
					}

					if (tilesToFetch > 0) {
						visitedTiles[key] = true;
						finalQueue.push(coords);
						tilesToFetch -= 1;
					}
					else {
						tilesPending = true;
					}
				}

				if (tilesPending) {
					// don't update the border as there are still
					// some tiles to be fetched
					continue;
				}

				if (!paneXFixed) {
					if (borderBounds.min.x > 0) {
						borderBounds.min.x -= 1;
					}
					if (borderBounds.max.x < validTileRange.max.x) {
						borderBounds.max.x += 1;
					}
				}

				if (!paneYFixed) {
					if (borderBounds.min.y > 0) {
						borderBounds.min.y -= 1;
					}

					if (borderBounds.max.y < validTileRange.max.y) {
						borderBounds.max.y += 1;
					}
				}

				paneBorder.incBorderIndex();

			} // border width loop end

			if (paneBorder.getBorderIndex() < maxBorderWidth) {
				doneAllPanes = false;
			}
		} // pane loop end

		if (!immediate)
			console.assert(finalQueue.length <= maxTilesToFetch,
				'finalQueue length(' + finalQueue.length + ') exceeded maxTilesToFetch(' + maxTilesToFetch + ')');

		var tilesRequested = false;

		if (finalQueue.length > 0) {
			this._cumTileCount += finalQueue.length;
			this._docLayer._addTiles(finalQueue);
			tilesRequested = true;
		}

		if (!tilesRequested || doneAllPanes) {
			this.clearTilesPreFetcher();
			this._borders = undefined;
		}
	},

	resetPreFetching: function (resetBorder) {

		if (!this._map) {
			return;
		}

		this.clearPreFetch();

		if (resetBorder) {
			this._borders = undefined;
		}

		var interval = 750;
		var idleTime = 5000;
		this._preFetchPart = this._docLayer._selectedPart;
		this._preFetchIdle = setTimeout(L.bind(function () {
			this._tilesPreFetcher = setInterval(L.bind(this.preFetchTiles, this), interval);
			this._preFetchIdle = undefined;
			this._cumTileCount = 0;
		}, this), idleTime);
	},

	clearPreFetch: function () {
		this.clearTilesPreFetcher();
		if (this._preFetchIdle !== undefined) {
			clearTimeout(this._preFetchIdle);
			this._preFetchIdle = undefined;
		}
	},

	clearTilesPreFetcher: function () {
		if (this._tilesPreFetcher !== undefined) {
			clearInterval(this._tilesPreFetcher);
			this._tilesPreFetcher = undefined;
		}
	},

});

L.TilesPreFetcher.PaneBorder = L.Class.extend({

	initialize: function(paneBorder, paneXFixed, paneYFixed) {
		this._border = paneBorder;
		this._xFixed = paneXFixed;
		this._yFixed = paneYFixed;
		this._index = 0;
	},

	getBorderIndex: function () {
		return this._index;
	},

	incBorderIndex: function () {
		this._index += 1;
	},

	getBorderBounds: function () {
		return this._border;
	},

	isXFixed: function () {
		return this._xFixed;
	},

	isYFixed: function () {
		return this._yFixed;
	},

});
