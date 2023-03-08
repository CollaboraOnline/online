/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.CanvasTileLayer is a layer with canvas based rendering.
 */

/* global app L CanvasSectionContainer CanvasOverlay CDarkOverlay CSplitterLine CStyleData $ _ isAnyVexDialogActive CPointSet CPolyUtil CPolygon Cursor CCellCursor CCellSelection PathGroupType UNOKey UNOModifier Uint8ClampedArray Uint8Array */

/*eslint no-extend-native:0*/
if (typeof String.prototype.startsWith !== 'function') {
	String.prototype.startsWith = function (str) {
		return this.slice(0, str.length) === str;
	};
}

// debugging aid.
function hex2string(inData)
{
	var hexified = [];
	var data = new Uint8Array(inData);
	for (var i = 0; i < data.length; i++) {
		var hex = data[i].toString(16);
		var paddedHex = ('00' + hex).slice(-2);
		hexified.push(paddedHex);
	}
	return hexified.join('');
}

// CStyleData is used to obtain CSS property values from style data
// stored in DOM elements in the form of custom CSS properties/variables.
var CStyleData = L.Class.extend({

	initialize: function (styleDataDiv) {
		this._div = styleDataDiv;
	},

	getPropValue: function (name) {
		return getComputedStyle(this._div).getPropertyValue(name);
	},

	getIntPropValue: function(name) { // (String) -> Number
		return parseInt(this.getPropValue(name));
	},

	getFloatPropValue: function(name) { // (String) -> Number
		return parseFloat(this.getPropValue(name));
	},

	getFloatPropWithoutUnit: function(name) { // (String) -> Number
		var value = this.getPropValue(name);
		if (value.indexOf('px'))
			value = value.split('px')[0];
		return parseFloat(value);
	}
});

// CSelections is used to add/modify/clear selections (text/cell-area(s)/ole)
// on canvas using polygons (CPolygon).
var CSelections = L.Class.extend({
	initialize: function (pointSet, canvasOverlay, selectionsDataDiv, map, isView, viewId, selectionType) {
		this._pointSet = pointSet ? pointSet : new CPointSet();
		this._overlay = canvasOverlay;
		this._styleData = new CStyleData(selectionsDataDiv);
		this._map = map;
		this._name = 'selections' + (isView ? '-viewid-' + viewId : '');
		this._isView = isView;
		this._viewId = viewId;
		this._isText = selectionType === 'text';
		this._isOle = selectionType === 'ole';
		this._selection = undefined;
		this._updateSelection();
		this._selectedMode = 0;
	},

	empty: function () {
		return !this._pointSet || this._pointSet.empty();
	},

	clear: function () {
		this.setPointSet(new CPointSet());
	},

	setPointSet: function(pointSet) {
		this._pointSet = pointSet;
		this._updateSelection();
	},

	contains: function(corePxPoint) {
		if (!this._selection)
			return false;

		return this._selection.anyRingBoundContains(corePxPoint);
	},

	getBounds: function() {
		return this._selection.getBounds();
	},

	_updateSelection: function() {
		if (!this._selection) {
			if (!this._isOle) {
				var fillColor = this._isView ?
					L.LOUtil.rgbToHex(this._map.getViewColor(this._viewId)) :
					this._styleData.getPropValue('background-color');
				var opacity = this._styleData.getFloatPropValue('opacity');
				var weight = this._styleData.getFloatPropWithoutUnit('border-top-width');
				var attributes = this._isText ? {
					viewId: this._isView ? this._viewId : undefined,
					groupType: PathGroupType.TextSelection,
					name: this._name,
					pointerEvents: 'none',
					fillColor: fillColor,
					fillOpacity: opacity,
					color: fillColor,
					opacity: 0.60,
					stroke: true,
					fill: true,
					weight: 1.0
				} : {
					viewId: this._isView ? this._viewId : undefined,
					name: this._name,
					pointerEvents: 'none',
					color: fillColor,
					fillColor: fillColor,
					fillOpacity: opacity,
					opacity: 1.0,
					weight: Math.round(weight * app.dpiScale)
				};
			}
			else {
				var attributes = {
					pointerEvents: 'none',
					fillColor: 'black',
					fillOpacity: 0.25,
					weight: 0,
					opacity: 0.25
				};
			}

			if (this._isText) {
				this._selection = new CPolygon(this._pointSet, attributes);
			}
			else if (this._isOle) {
				this._selection = new CDarkOverlay(this._pointSet, attributes);
			}
			else {
				this._selection = new CCellSelection(this._pointSet, attributes);
			}

			if (this._isText)
				this._overlay.initPath(this._selection);
			else
				this._overlay.initPathGroup(this._selection);
			return;
		}

		this._selection.setPointSet(this._pointSet);
	},

	remove: function() {
		if (!this._selection)
			return;
		if (this._isText)
			this._overlay.removePath(this._selection);
		else
			this._overlay.removePathGroup(this._selection);
	},
});

// CReferences is used to store and manage the CPath's of all
// references in the current sheet.
var CReferences = L.Class.extend({

	initialize: function (canvasOverlay) {

		this._overlay = canvasOverlay;
		this._marks = [];
	},

	// mark should be a CPath.
	addMark: function (mark) {
		this._overlay.initPath(mark);
		this._marks.push(mark);
	},

	// mark should be a CPath.
	hasMark: function (mark) {
		for (var i = 0; i < this._marks.length; ++i) {
			if (mark.getBounds().equals(this._marks[i].getBounds()))
				return true;
		}

		return false;
	},

	clear: function () {
		for (var i = 0; i < this._marks.length; ++i)
			this._overlay.removePath(this._marks[i]);
		this._marks = [];
	}

});


L.TileCoordData = L.Class.extend({

	initialize: function (left, top, zoom, part, mode) {
		this.x = left;
		this.y = top;
		this.z = zoom;
		this.part = part;
		this.mode = (mode !== undefined) ? mode : 0;
	},

	getPos: function () {
		return new L.Point(this.x, this.y);
	},

	key: function () {
		return this.x + ':' + this.y + ':' + this.z + ':' + this.part + ':'
			+ ((this.mode !== undefined) ? this.mode : 0);
	},

	toString: function () {
		return '{ left : ' + this.x + ', top : ' + this.y +
			', z : ' + this.z + ', part : ' + this.part + ', mode : ' + this.mode + ' }';
	}
});

L.TileCoordData.parseKey = function (keyString) {

	window.app.console.assert(typeof keyString === 'string', 'key should be a string');
	var k = keyString.split(':');
	var mode = (k.length === 4) ? +k[4] : 0;
	window.app.console.assert(k.length >= 5, 'invalid key format');
	return new L.TileCoordData(+k[0], +k[1], +k[2], +k[3], mode);
};

L.TileSectionManager = L.Class.extend({

	initialize: function (layer) {
		this._layer = layer;
		this._canvas = this._layer._canvas;
		this._map = this._layer._map;
		var mapSize = this._map.getPixelBoundsCore().getSize();
		this._oscCtxs = [];
		this._tilesSection = null; // Shortcut.

		this._sectionContainer = new CanvasSectionContainer(this._canvas, this._layer.isCalc() /* disableDrawing? */);

		if (this._layer.isCalc())
			this._sectionContainer.setClearColor('white'); // will be overridden by 'documentbackgroundcolor' msg.

		app.sectionContainer = this._sectionContainer;
		if (L.Browser.cypressTest) // If cypress is active, create test divs.
			this._sectionContainer.testing = true;

		this._sectionContainer.onResize(mapSize.x, mapSize.y);

		var splitPanesContext = this._layer.getSplitPanesContext();
		this._splitPos = splitPanesContext ?
			splitPanesContext.getSplitPos() : new L.Point(0, 0);
		this._updatesRunning = false;
		this._mirrorEventsFromSourceToCanvasSectionContainer(document.getElementById('map'));

		var canvasContainer = document.getElementById('document-container');
		var that = this;
		this.resObserver = new ResizeObserver(function() {
			that._layer._syncTileContainerSize();
		});
		this.resObserver.observe(canvasContainer);
	},

	// Map and TilesSection overlap entirely. Map is above tiles section. In order to handle events in tiles section, we need to mirror them from map.
	_mirrorEventsFromSourceToCanvasSectionContainer: function (sourceElement) {
		var that = this;
		sourceElement.addEventListener('mousedown', function (e) { that._sectionContainer.onMouseDown(e); }, true);
		sourceElement.addEventListener('click', function (e) { that._sectionContainer.onClick(e); }, true);
		sourceElement.addEventListener('dblclick', function (e) { that._sectionContainer.onDoubleClick(e); }, true);
		sourceElement.addEventListener('contextmenu', function (e) { that._sectionContainer.onContextMenu(e); }, true);
		sourceElement.addEventListener('wheel', function (e) { that._sectionContainer.onMouseWheel(e); }, true);
		sourceElement.addEventListener('mouseleave', function (e) { that._sectionContainer.onMouseLeave(e); }, true);
		sourceElement.addEventListener('mouseenter', function (e) { that._sectionContainer.onMouseEnter(e); }, true);
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

	getSplitPos: function () {
		var splitPanesContext = this._layer.getSplitPanesContext();
		return splitPanesContext ?
			splitPanesContext.getSplitPos().multiplyBy(app.dpiScale) :
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

	coordsIntersectVisible: function (coords) {
		if (!app.file.fileBasedView) {
			var ctx = this._paintContext();
			var tileBounds = new L.Bounds(new L.Point(coords.x, coords.y), new L.Point(coords.x + ctx.tileSize.x, coords.y + ctx.tileSize.y));
			return tileBounds.intersectsAny(ctx.paneBoundsList);
		}
		else {
			var ratio = this._layer._tileSize / this._layer._tileHeightTwips;
			var partHeightPixels = Math.round((this._layer._partHeightTwips + this._layer._spaceBetweenParts) * ratio);
			return L.LOUtil._doRectanglesIntersect(app.file.viewedRectangle, [coords.x, coords.y + partHeightPixels * coords.part, app.tile.size.pixels[0], app.tile.size.pixels[1]]);
		}
	},

	_addTilesSection: function () {
		this._sectionContainer.addSection(L.getNewTilesSection());
		this._tilesSection = this._sectionContainer.getSectionWithName('tiles');
		app.sectionContainer.setDocumentAnchorSection(L.CSections.Tiles.name);
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
			onDraw: that._onDrawGridSection,
			onDrawArea: that._drawGridSectionArea
		}, 'tiles'); // Its size and position will be copied from 'tiles' section.
		this._calcGridSection = this._sectionContainer.getSectionWithName(L.CSections.CalcGrid.name);
	},

	_addOverlaySection: function () {
		var canvasOverlay = this._layer._canvasOverlay = new CanvasOverlay(this._map, this._sectionContainer.getContext());
		this._sectionContainer.addSection(canvasOverlay);
		canvasOverlay.bindToSection(L.CSections.Tiles.name);
	},

	shouldDrawCalcGrid: function () {
		var defaultBG = 'ffffff';
		if (this._layer.coreDocBGColor)
			return (this._layer.coreDocBGColor === defaultBG);
		else
			return true;
	},

	_onDrawGridSection: function () {
		if (this.containerObject.isInZoomAnimation() || this.sectionProperties.tsManager.waitForTiles())
			return;

		if (this.sectionProperties.tsManager.shouldDrawCalcGrid()) {
			// grid-section's onDrawArea is TileSectionManager's _drawGridSectionArea().
			this.onDrawArea();
		}
	},

	_drawGridSectionArea: function (repaintArea, paneTopLeft, canvasCtx) {
		if (!this.sectionProperties.docLayer.sheetGeometry)
			return;

		var context = canvasCtx ? canvasCtx : this.context;
		var tsManager = this.sectionProperties.tsManager;
		context.strokeStyle = this.sectionProperties.strokeStyle;
		context.lineWidth = 1.0;
		var scale = 1.0;
		if (tsManager._inZoomAnim && tsManager._zoomFrameScale)
			scale = tsManager._zoomFrameScale;

		var ctx = this.sectionProperties.tsManager._paintContext();
		var isRTL = this.sectionProperties.docLayer.isLayoutRTL();
		var sectionWidth = this.size[0];
		var xTransform = function (xcoord) {
			return isRTL ? sectionWidth - xcoord : xcoord;
		};

		// This is called just before and after the dashed line drawing.
		var startEndDash = function (ctx2D, end) {
			// Style the dashed lines.
			var dashLen = 5;
			var gapLen = 5;

			// Restart the path to apply the dashed line style.
			ctx2D.closePath();
			ctx2D.beginPath();
			ctx2D.setLineDash(end ? [] : [dashLen, gapLen]);
		};

		var docLayer = this.sectionProperties.docLayer;
		var currentPart = docLayer._selectedPart;
		// Draw the print range with dashed line if singleton to match desktop Calc.
		var printRange = [];
		if (docLayer._printRanges && docLayer._printRanges.length > currentPart
			&& docLayer._printRanges[currentPart].length == 1)
			printRange = docLayer._printRanges[currentPart][0];

		for (var i = 0; i < ctx.paneBoundsList.length; ++i) {
			// co-ordinates of this pane in core document pixels
			var paneBounds = ctx.paneBoundsList[i];
			// co-ordinates of the main-(bottom right) pane in core document pixels
			var viewBounds = ctx.viewBounds;
			// into real pixel-land ...
			paneBounds.round();
			viewBounds.round();

			var paneOffset;
			var doOnePane = false;
			if (!repaintArea || !paneTopLeft) {
				repaintArea = paneBounds;
				paneOffset = paneBounds.getTopLeft(); // allocates
				// Cute way to detect the in-canvas pixel offset of each pane
				paneOffset.x = Math.min(paneOffset.x, viewBounds.min.x);
				paneOffset.y = Math.min(paneOffset.y, viewBounds.min.y);
			} else {
				// do only for the predefined pane (paneOffset / repaintArea)
				doOnePane = true;
				paneOffset = paneTopLeft.clone();
			}

			// Vertical line rendering on large areas is ~10x as expensive
			// as horizontal line rendering: due to cache effects - so to
			// help our poor CPU renderers - render in horizontal strips.
			var bandSize = 256;
			var clearDash = false;
			for (var miny = repaintArea.min.y; miny < repaintArea.max.y; miny += bandSize)
			{
				var maxy = Math.min(repaintArea.max.y, miny + bandSize);

				context.beginPath();

				// vertical lines
				this.sectionProperties.docLayer.sheetGeometry._columns.forEachInCorePixelRange(
					repaintArea.min.x, repaintArea.max.x,
					function(pos, colIndex) {
						var xcoord = xTransform(Math.floor(scale * (pos - paneOffset.x)) - 0.5);

						clearDash = false;
						if (printRange.length === 4
							&& (printRange[0] === colIndex || printRange[2] + 1 === colIndex)) {
							clearDash = true;
							startEndDash(context, false /* end? */);
						}

						context.moveTo(xcoord, Math.floor(scale * (miny - paneOffset.y)) + 0.5);
						context.lineTo(xcoord, Math.floor(scale * (maxy - paneOffset.y)) - 0.5);
						context.stroke();

						if (clearDash)
							startEndDash(context, true /* end? */);
					});

				// horizontal lines
				this.sectionProperties.docLayer.sheetGeometry._rows.forEachInCorePixelRange(
					miny, maxy,
					function(pos, rowIndex) {

						clearDash = false;
						if (printRange.length === 4
							&& (printRange[1] === rowIndex || printRange[3] + 1 === rowIndex)) {
							clearDash = true;
							startEndDash(context, false /* end? */);
						}

						context.moveTo(
							xTransform(Math.floor(scale * (repaintArea.min.x - paneOffset.x)) + 0.5),
							Math.floor(scale * (pos - paneOffset.y)) - 0.5);
						context.lineTo(
							xTransform(Math.floor(scale * (repaintArea.max.x - paneOffset.x)) - 0.5),
							Math.floor(scale * (pos - paneOffset.y)) - 0.5);
						context.stroke();

						if (clearDash)
							startEndDash(context, true /* end? */);
					});

				context.closePath();
			}

			if (doOnePane)
				break;
		}
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
			this.context.strokeRect(0, 0, splitPos.x * app.dpiScale, splitPos.y * app.dpiScale);
		}
	},

	_updateWithRAF: function () {
		// update-loop with requestAnimationFrame
		this._canvasRAF = L.Util.requestAnimFrame(this._updateWithRAF, this, false /* immediate */);
		this._sectionContainer.requestReDraw();
	},

	update: function () {
		this._sectionContainer.requestReDraw();
	},

	_viewReset: function () {
		var ctx = this._paintContext();
		for (var i = 0; i < ctx.paneBoundsList.length; ++i) {
			this._tilesSection.oscCtxs[i].fillStyle = this._sectionContainer.getClearColor();
			this._tilesSection.oscCtxs[i].fillRect(0, 0, this._tilesSection.offscreenCanvases[i].width, this._tilesSection.offscreenCanvases[i].height);
		}
	},

	_getZoomDocPos: function (pinchCenter, paneBounds, splitPos, scale, findFreePaneCenter) {
		var inXBounds = (pinchCenter.x >= paneBounds.min.x) && (pinchCenter.x <= paneBounds.max.x);
		var inYBounds = (pinchCenter.y >= paneBounds.min.y) && (pinchCenter.y <= paneBounds.max.y);

		// Calculate the pinch-center in off-screen canvas coordinates.
		var center = paneBounds.min.clone();
		if (inXBounds)
			center.x = pinchCenter.x;
		if (inYBounds)
			center.y = pinchCenter.y;

		var xMin = 0;
		var hasXMargin = !this._layer.isCalc();
		if (hasXMargin)
			xMin = -Infinity;
		else if (paneBounds.min.x > 0)
			xMin = splitPos.x;

		var yMin = 0;
		if (paneBounds.min.y < 0)
			yMin = -Infinity;
		else if (paneBounds.min.y > 0)
			yMin = splitPos.y;

		// Top left in document coordinates.
		var docTopLeft = new L.Point(
			Math.max(xMin,
				center.x - (center.x - paneBounds.min.x) / scale),
			Math.max(yMin,
				center.y - (center.y - paneBounds.min.y) / scale));

		if (!findFreePaneCenter)
			return { topLeft: docTopLeft };

		// Assumes paneBounds is the bounds of the free pane.
		var paneSize = paneBounds.getSize();
		var newPaneCenter = new L.Point(
			(docTopLeft.x - splitPos.x + (paneSize.x + splitPos.x) / (2 * scale)) * scale / app.dpiScale,
			(docTopLeft.y - splitPos.y + (paneSize.y + splitPos.y) / (2 * scale)) * scale / app.dpiScale);

		return {
			topLeft: docTopLeft,
			center: newPaneCenter
		};
	},

	_getZoomMapCenter: function (zoom) {
		var scale = this._calcZoomFrameScale(zoom);
		var ctx = this._paintContext();
		var splitPos = ctx.splitPos;
		var viewBounds = ctx.viewBounds;
		var freePaneBounds = new L.Bounds(viewBounds.min.add(splitPos), viewBounds.max);

		return this._getZoomDocPos(this._newCenter, freePaneBounds, splitPos, scale, true /* findFreePaneCenter */).center;
	},

	_zoomAnimation: function () {
		var painter = this;
		var ctx = this._paintContext();
		var canvasOverlay = this._layer._canvasOverlay;

		var rafFunc = function (timeStamp, final) {
			// Draw zoom frame with grids and directly from the tiles.
			// This will clear the doc area first.
			painter._tilesSection.drawZoomFrame(ctx);
			// Draw the overlay objects.
			canvasOverlay.onDraw();

			if (!final)
				painter._zoomRAF = requestAnimationFrame(rafFunc);
		};
		this.rafFunc = rafFunc;
		rafFunc();
	},

	_calcZoomFrameScale: function (zoom) {
		zoom = this._layer._map._limitZoom(zoom);
		var origZoom = this._layer._map.getZoom();
		// Compute relative-multiplicative scale of this zoom-frame w.r.t the starting zoom(ie the current Map's zoom).
		return this._layer._map.zoomToFactor(zoom - origZoom + this._layer._map.options.zoom);
	},

	_calcZoomFrameParams: function (zoom, newCenter) {
		this._zoomFrameScale = this._calcZoomFrameScale(zoom);
		this._newCenter = this._layer._map.project(newCenter).multiplyBy(app.dpiScale); // in core pixels
	},

	setWaitForTiles: function (wait) {
		this._waitForTiles = wait;
	},

	waitForTiles: function () {
		return this._waitForTiles;
	},

	zoomStep: function (zoom, newCenter) {
		if (this._finishingZoom) // finishing steps of animation still going on.
			return;

		this._calcZoomFrameParams(zoom, newCenter);

		if (!this._inZoomAnim) {
			this._sectionContainer.setInZoomAnimation(true);
			this._inZoomAnim = true;
			// Start RAF loop for zoom-animation
			this._zoomAnimation();
		}
	},

	zoomStepEnd: function (zoom, newCenter, mapUpdater, runAtFinish, noGap) {

		if (!this._inZoomAnim || this._finishingZoom)
			return;

		this._finishingZoom = true;

		this._map.disableTextInput();
		// Do a another animation from current non-integral log-zoom to
		// the final integral zoom, but maintain the same center.
		var steps = 10;
		var stepId = noGap ? steps : 0;

		var startZoom = this._zoomFrameScale;
		var endZoom = this._calcZoomFrameScale(zoom);
		var painter = this;
		var map = this._map;

		// Calculate the final center at final zoom in advance.
		var newMapCenter = this._getZoomMapCenter(zoom);
		var newMapCenterLatLng = map.unproject(newMapCenter, zoom);
		painter._sectionContainer.setZoomChanged(true);

		var stopAnimation = noGap ? true : false;
		var waitForTiles = false;
		var waitTries = 30;
		var finishingRAF = undefined;

		var finishAnimation = function () {

			if (stepId < steps) {
				// continue animating till we reach "close" to 'final zoom'.
				painter._zoomFrameScale = startZoom + (endZoom - startZoom) * stepId / steps;
				stepId += 1;
				if (stepId >= steps)
					stopAnimation = true;
			}

			if (stopAnimation) {
				stopAnimation = false;
				cancelAnimationFrame(painter._zoomRAF);
				painter._calcZoomFrameParams(zoom, newCenter);
				// Draw one last frame at final zoom.
				painter.rafFunc(undefined, true /* final? */);
				painter._zoomFrameScale = undefined;
				painter._sectionContainer.setInZoomAnimation(false);
				painter._inZoomAnim = false;

				painter.setWaitForTiles(true);
				// Set view and paint the tiles if all available.
				mapUpdater(newMapCenterLatLng);
				waitForTiles = true;
			}

			if (waitForTiles) {
				// Wait until we get all tiles or wait time exceeded.
				if (waitTries <= 0 || painter._tilesSection.haveAllTilesInView()) {
					// All done.
					waitForTiles = false;
					cancelAnimationFrame(finishingRAF);
					painter.setWaitForTiles(false);
					painter._sectionContainer.setZoomChanged(false);
					map.enableTextInput();
					map.focus(map.canAcceptKeyboardInput());
					// Paint everything.
					painter._sectionContainer.requestReDraw();
					// Don't let a subsequent pinchZoom start before finishing all steps till this point.
					painter._finishingZoom = false;
					// Run the finish callback.
					runAtFinish();
					return;
				}
				else
					waitTries -= 1;
			}

			finishingRAF = requestAnimationFrame(finishAnimation);
		};

		finishAnimation();
	},

	getTileSectionPos : function () {
		return new L.Point(this._tilesSection.myTopLeft[0], this._tilesSection.myTopLeft[1]);
	}
});

L.CanvasTileLayer = L.Layer.extend({

	isMacClient: (navigator.appVersion.indexOf('Mac') != -1 || navigator.userAgent.indexOf('Mac') != -1),

	options: {
		pane: 'tilePane',

		tileSize: window.tileSize,
		opacity: 1,

		updateWhenIdle: (window.mode.isMobile() || window.mode.isTablet()),
		updateInterval: 200,

		attribution: null,
		zIndex: null,
		bounds: null,

		minZoom: 0,

		maxZoom: 18,

		subdomains: 'abc',
		errorTileUrl: '',

		detectRetina: true,
		crossOrigin: false,
		previewInvalidationTimeout: 1000,
	},

	_pngCache: [],

	initialize: function (url, options) {
		this._url = url;
		options = L.setOptions(this, options);

		this._tileWidthPx = options.tileSize;
		this._tileHeightPx = options.tileSize;

		// Detecting retina displays, adjusting zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {
			options.minZoom = Math.max(0, options.minZoom);
			options.maxZoom--;
		}

		if (typeof options.subdomains === 'string') {
			options.subdomains = options.subdomains.split('');
		}

		// for https://github.com/Leaflet/Leaflet/issues/137
		if (!L.Browser.android) {
			this.on('tileunload', this._onTileRemove);
		}
		// text, presentation, spreadsheet, etc
		this._docType = options.docType;
		this._documentInfo = '';
		// Position and size of the visible cursor.
		this._visibleCursor = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Last cursor position for invalidation
		this.lastCursorPos = null;
		// Are we zooming currently ? - if so, no cursor.
		this._isZooming = false;
		// Original rectangle graphic selection in twips
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		// Rotation angle of selected graphic object
		this._graphicSelectionAngle = 0;
		// Original rectangle of cell cursor in twips
		this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		// Rectangle for cell cursor
		this._cellCursor =  L.LatLngBounds.createDefault();
		this._prevCellCursor = L.LatLngBounds.createDefault();
		this._cellCursorOnPgUp = null;
		this._cellCursorOnPgDn = null;
		this._shapeGridOffset = new L.Point(0, 0);
		this._masterPageChanged = false;

		// Position and size of the selection start (as if there would be a cursor caret there).

		// View cursors with viewId to 'cursor info' mapping
		// Eg: 1: {rectangle: 'x, y, w, h', visible: false}
		this._viewCursors = {};

		// View cell cursors with viewId to 'cursor info' mapping.
		this._cellViewCursors = {};

		// View selection of other views
		this._viewSelections = {};

		// Graphic view selection rectangles
		this._graphicViewMarkers = {};

		this._lastValidPart = -1;
		// Cursor marker
		this._cursorMarker = null;
		// Graphic marker
		this._graphicMarker = null;
		// Graphic Selected?
		this._hasActiveSelection = false;
		// Selection handle marker
		this._selectionHandles = {};
		['start', 'end'].forEach(L.bind(function (handle) {
			this._selectionHandles[handle] = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'leaflet-selection-marker-' + handle,
					iconSize: null
				}),
				draggable: true
			});
		}, this));

		this._dropDownButton = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-drop-down-marker',
				iconSize: null
			}),
			interactive: true
		});

		this._cellResizeMarkerStart = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._cellResizeMarkerEnd = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._referenceMarkerStart = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._referenceMarkerEnd = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'spreadsheet-cell-resize-marker',
				iconSize: null
			}),
			draggable: true
		});

		this._initializeTableOverlay();

		this._emptyTilesCount = 0;
		this._msgQueue = [];
		this._toolbarCommandValues = {};
		this._previewInvalidations = [];

		this._followThis = -1;
		this._editorId = -1;
		this._followUser = false;
		this._followEditor = false;
		this._selectedTextContent = '';
		this._typingMention = false;
		this._mentionText = [];
	},

	_initContainer: function () {
		if (this._canvasContainer) {
			window.app.console.error('called _initContainer() when this._canvasContainer is present!');
		}

		if (this._container) { return; }

		this._container = L.DomUtil.create('div', 'leaflet-layer');
		this._updateZIndex();

		if (this.options.opacity < 1) {
			this._updateOpacity();
		}

		this.getPane().appendChild(this._container);

		var mapContainer = document.getElementById('document-container');
		var canvasContainerClass = 'leaflet-canvas-container';
		this._canvasContainer = L.DomUtil.create('div', canvasContainerClass, mapContainer);
		this._canvasContainer.id = 'canvas-container';
		this._setup();
	},

	_setup: function () {

		if (!this._canvasContainer) {
			window.app.console.error('canvas container not found. _initContainer failed ?');
		}

		this._canvas = L.DomUtil.createWithId('canvas', 'document-canvas', this._canvasContainer);
		this._container.style.position = 'absolute';
		this._cursorDataDiv = L.DomUtil.create('div', 'cell-cursor-data', this._canvasContainer);
		this._selectionsDataDiv = L.DomUtil.create('div', 'selections-data', this._canvasContainer);
		this._splittersDataDiv = L.DomUtil.create('div', 'splitters-data', this._canvasContainer);
		this._cursorOverlayDiv = L.DomUtil.create('div', 'cursor-overlay', this._canvasContainer);
		this._splittersStyleData = new CStyleData(this._splittersDataDiv);

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
		else if (this._docType !== 'spreadsheet') { // See scroll section. panBy is used for spreadsheets while scrolling.
			this._map.on('movestart', this._painter.startUpdates, this._painter);
			this._map.on('moveend', this._painter.stopUpdates, this._painter);
		}
		this._map.on('resize', this._syncTileContainerSize, this);
		this._map.on('zoomend', this._painter.update, this._painter);
		this._map.on('splitposchanged', this._painter.update, this._painter);
		this._map.on('sheetgeometrychanged', this._painter.update, this._painter);
		this._map.on('move', this._syncTilePanePos, this);

		this._map.on('viewrowcolumnheaders', this._painter.update, this._painter);
		this._map.on('messagesdone', this._sendProcessedResponse, this);
		this._queuedProcessed = [];

		if (this._docType === 'spreadsheet') {
			this._painter._addGridSection();
		}

		// Add it regardless of the file type.
		app.sectionContainer.addSection(new app.definitions.CommentSection());

		this._syncTileContainerSize();
		this._setupTableOverlay();
	},

	// Returns true if the document type is Writer.
	isWriter: function() {
		return this._docType === 'text';
	},

	// Returns true if the document type is Calc.
	isCalc: function() {
		return this._docType === 'spreadsheet';
	},

	// Returns true if the document type is Impress.
	isImpress: function() {
		return this._docType === 'presentation';
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

	_removeAllTiles: function () {
		for (var key in this._tiles) {
			this._removeTile(key);
		}
	},

	_retainParent: function (x, y, z, part, mode, minZoom) {
		var x2 = Math.floor(x / 1.2),
		    y2 = Math.floor(y / 1.2),
		    z2 = z - 1;

		var key = x2 + ':' + y2 + ':' + z2 + ':' + part + ':' + mode,
		    tile = this._tiles[key];

		if (tile && tile.active) {
			tile.retain = true;
			return true;

		} else if (tile && tile.loaded) {
			tile.retain = true;
		}

		if (z2 > minZoom) {
			return this._retainParent(x2, y2, z2, part, mode, minZoom);
		}

		return false;
	},

	_retainChildren: function (x, y, z, part, mode, maxZoom) {

		for (var i = 1.2 * x; i < 1.2 * x + 2; i++) {
			for (var j = 1.2 * y; j < 1.2 * y + 2; j++) {

				var key = Math.floor(i) + ':' + Math.floor(j) + ':' +
					(z + 1) + ':' + part + ':' + mode,
				    tile = this._tiles[key];

				if (tile && tile.active) {
					tile.retain = true;
					continue;

				} else if (tile && tile.loaded) {
					tile.retain = true;
				}

				if (z + 1 < maxZoom) {
					this._retainChildren(i, j, z + 1, part, mode, maxZoom);
				}
			}
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

		app.twipsToPixels = app.tile.size.pixels[0] / app.tile.size.twips[0];
		app.pixelsToTwips = app.tile.size.twips[0] / app.tile.size.pixels[0];
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

		app.twipsToPixels = app.tile.size.pixels[0] / app.tile.size.twips[0];
		app.pixelsToTwips = app.tile.size.twips[0] / app.tile.size.pixels[0];

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

	_requestNewTiles: function () {
		this._onMessage('invalidatetiles: EMPTY', null);
		this._update();
	},

	toggleTileDebugMode: function() {
		this.toggleTileDebugModeImpl();
		this._requestNewTiles();
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

			if (!this._map._fatal && app.idleHandler._active && app.socket.connected())
				this._clientZoom = newClientZoom;
		}
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

	_sendTileCombineRequest: function(part, mode, tilePositionsX, tilePositionsY) {
		var msg = 'tilecombine ' +
			'nviewid=0 ' +
			'part=' + part + ' ' +
			((mode !== 0) ? ('mode=' + mode + ' ') : '') +
			'width=' + this._tileWidthPx + ' ' +
			'height=' + this._tileHeightPx + ' ' +
			'tileposx=' + tilePositionsX + ' '	+
			'tileposy=' + tilePositionsY + ' ' +
			'tilewidth=' + this._tileWidthTwips + ' ' +
			'tileheight=' + this._tileHeightTwips;
		app.socket.sendMessage(msg, '');
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

	getSplitPanesContext: function () {
		return undefined;
	},

	_createNewMouseEvent: function (type, inputEvent) {
		var event = inputEvent;
		if (inputEvent.type == 'touchstart' || inputEvent.type == 'touchmove') {
			event = inputEvent.touches[0];
		}
		else if (inputEvent.type == 'touchend') {
			event = inputEvent.changedTouches[0];
		}
		var newEvent = document.createEvent('MouseEvents');
		newEvent.initMouseEvent(
			type, true, true, window, 1,
			event.screenX, event.screenY,
			event.clientX, event.clientY,
			false, false, false, false, 0, null
		);
		return newEvent;
	},

	registerExportFormat: function(label, format) {
		if (!this._exportFormats) {
			this._exportFormats = [];
		}

		var duplicate = false;
		for (var i = 0; i < this._exportFormats.length; i++) {
			if (this._exportFormats[i].label == label && this._exportFormats[i].format == format) {
				duplicate = true;
				break;
			}
		}

		if (duplicate == false) {
			this._exportFormats.push({label: label, format: format});
		}
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}
		return this;
	},

	createTile: function (coords, done) {
		var tile = document.createElement('img');

		tile.onerror = L.bind(this._tileOnError, this, done, tile);

		if (this.options.crossOrigin) {
			tile.crossOrigin = '';
		}

		/*
		 Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
		 http://www.w3.org/TR/WCAG20-TECHS/H67
		*/
		tile.alt = '';
		this._emptyTilesCount += 1;
		return tile;
	},

	_getToolbarCommandsValues: function() {
		for (var i = 0; i < this._map.unoToolbarCommands.length; i++) {
			var command = this._map.unoToolbarCommands[i];
			app.socket.sendMessage('commandvalues command=' + command);
		}
	},

	_onMessage: function (textMsg, img) {
		this._saveMessageForReplay(textMsg);
		// 'tile:' is the most common message type; keep this the first.
		if (textMsg.startsWith('tile:') || textMsg.startsWith('delta:')) {
			this._onTileMsg(textMsg, img);
		}
		else if (textMsg.startsWith('commandvalues:')) {
			this._onCommandValuesMsg(textMsg);
		}
		else if (textMsg.startsWith('cursorvisible:')) {
			this._onCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('downloadas:')) {
			this._onDownloadAsMsg(textMsg);
		}
		else if (textMsg.startsWith('error:')) {
			this._onErrorMsg(textMsg);
		}
		else if (textMsg.startsWith('getchildid:')) {
			this._onGetChildIdMsg(textMsg);
		}
		else if (textMsg.startsWith('shapeselectioncontent:')) {
			this._onShapeSelectionContent(textMsg);
		}
		else if (textMsg.startsWith('graphicselection:')) {
			this._onGraphicSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('cellcursor:')) {
			this._onCellCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('celladdress:')) {
			this._onCellAddressMsg(textMsg);
		}
		else if (textMsg.startsWith('cellformula:')) {
			this._onCellFormulaMsg(textMsg);
		}
		else if (textMsg.startsWith('referencemarks:')) {
			this._onReferencesMsg(textMsg);
		}
		else if (textMsg.startsWith('referenceclear:')) {
			this._clearReferences();
		}
		else if (textMsg.startsWith('invalidatecursor:')) {
			this._onInvalidateCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidatetiles:')) {
			var payload = textMsg.substring('invalidatetiles:'.length + 1);
			if (!payload.startsWith('EMPTY')) {
				this._onInvalidateTilesMsg(textMsg);
			}
			else {
				var msg = 'invalidatetiles: ';
				if (this.isWriter()) {
					msg += 'part=0 ';
				} else {
					var tokens = payload.substring('EMPTY'.length + 1);
					tokens = tokens.split(',');
					var part = parseInt(tokens[0] ? tokens[0] : '');
					var mode = parseInt((tokens.length > 1 && tokens[1]) ? tokens[1] : '');
					mode = (isNaN(mode) ? this._selectedMode : mode);
					msg += 'part=' + (isNaN(part) ? this._selectedPart : part)
						+ ((mode && mode !== 0) ? (' mode=' + mode) : '')
						+ ' ';
				}
				msg += 'x=0 y=0 ';
				msg += 'width=' + this._docWidthTwips + ' ';
				msg += 'height=' + this._docHeightTwips;
				this._onInvalidateTilesMsg(msg);
			}
		}
		else if (textMsg.startsWith('mousepointer:')) {
			this._onMousePointerMsg(textMsg);
		}
		else if (textMsg.startsWith('renderfont:')) {
			this._onRenderFontMsg(textMsg, img);
		}
		else if (textMsg.startsWith('searchnotfound:')) {
			this._onSearchNotFoundMsg(textMsg);
		}
		else if (textMsg.startsWith('searchresultselection:')) {
			this._onSearchResultSelection(textMsg);
		}
		else if (textMsg.startsWith('setpart:')) {
			this._onSetPartMsg(textMsg);
		}
		else if (textMsg.startsWith('statechanged:')) {
			this._onStateChangedMsg(textMsg);
		}
		else if (textMsg.startsWith('status:') || textMsg.startsWith('statusupdate:')) {
			this._onStatusMsg(textMsg);

			// update tiles and selection because mode could be changed
			this._update();
			this.updateAllGraphicViewSelections();
			this.updateAllViewCursors();
			this.updateAllTextViewSelection();
		}
		else if (textMsg.startsWith('textselection:')) {
			this._onTextSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectioncontent:')) {
			if (this._map._clip)
				this._map._clip.setTextSelectionHTML(textMsg.substr(22));
			else
				// hack for ios and android to get selected text into hyperlink insertion dialog
				this._selectedTextContent = textMsg.substr(22);
		}
		else if (textMsg.startsWith('clipboardchanged')) {
			var jMessage = textMsg.substr(17);
			jMessage = JSON.parse(jMessage);

			if (jMessage.mimeType === 'text/plain') {
				this._map._clip.setTextSelectionHTML(jMessage.content);
				this._map._clip._execCopyCutPaste('copy');
			}
		}
		else if (textMsg.startsWith('textselectionend:')) {
			this._onTextSelectionEndMsg(textMsg);
		}
		else if (textMsg.startsWith('textselectionstart:')) {
			this._onTextSelectionStartMsg(textMsg);
		}
		else if (textMsg.startsWith('cellselectionarea:')) {
			this._onCellSelectionAreaMsg(textMsg);
		}
		else if (textMsg.startsWith('cellautofillarea:')) {
			this._onCellAutoFillAreaMsg(textMsg);
		}
		else if (textMsg.startsWith('complexselection:')) {
			if (this._map._clip)
				this._map._clip.onComplexSelection(textMsg.substr('complexselection:'.length));
		}
		else if (textMsg.startsWith('windowpaint:')) {
			this._onDialogPaintMsg(textMsg, img);
		}
		else if (textMsg.startsWith('window:')) {
			this._onDialogMsg(textMsg);
		}
		else if (textMsg.startsWith('unocommandresult:')) {
			this._onUnoCommandResultMsg(textMsg);
		}
		else if (textMsg.startsWith('rulerupdate:')) {
			this._onRulerUpdate(textMsg);
		}
		else if (textMsg.startsWith('contextmenu:')) {
			this._onContextMenuMsg(textMsg);
		}
		else if (textMsg.startsWith('invalidateviewcursor:')) {
			this._onInvalidateViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewcursorvisible:')) {
			this._onViewCursorVisibleMsg(textMsg);
		}
		else if (textMsg.startsWith('cellviewcursor:')) {
			this._onCellViewCursorMsg(textMsg);
		}
		else if (textMsg.startsWith('viewinfo:')) {
			this._onViewInfoMsg(textMsg);
		}
		else if (textMsg.startsWith('textviewselection:')) {
			this._onTextViewSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('graphicviewselection:')) {
			this._onGraphicViewSelectionMsg(textMsg);
		}
		else if (textMsg.startsWith('tableselected:')) {
			this._onTableSelectedMsg(textMsg);
		}
		else if (textMsg.startsWith('editor:')) {
			this._updateEditor(textMsg);
		}
		else if (textMsg.startsWith('validitylistbutton:')) {
			this._onValidityListButtonMsg(textMsg);
		}
		else if (textMsg.startsWith('validityinputhelp:')) {
			this._onValidityInputHelpMsg(textMsg);
		}
		else if (textMsg.startsWith('signaturestatus:')) {
			var signstatus = textMsg.substring('signaturestatus:'.length + 1);
			this._map.onChangeSignStatus(signstatus);
		}
		else if (textMsg.startsWith('signeddocumentuploadstatus:')) {
			var status = textMsg.substring('signeddocumentuploadstatus:'.length + 1);
			this._map.onVereignUploadStatus(status);
		}
		else if (textMsg.startsWith('removesession')) {
			var viewId = parseInt(textMsg.substring('removesession'.length + 1));
			if (this._map._docLayer._viewId === viewId) {
				this._map.fire('postMessage', {msgId: 'close', args: {EverModified: this._map._everModified, Deprecated: true}});
				this._map.fire('postMessage', {msgId: 'UI_Close', args: {EverModified: this._map._everModified}});
				if (!this._map._disableDefaultAction['UI_Close']) {
					this._map.remove();
				}
			}
		}
		else if (textMsg.startsWith('calcfunctionlist:')) {
			this._onCalcFunctionListMsg(textMsg.substring('calcfunctionlist:'.length + 1));
		}
		else if (textMsg.startsWith('tabstoplistupdate:')) {
			this._onTabStopListUpdate(textMsg);
		}
		else if (textMsg.startsWith('context:')) {
			var message = textMsg.substring('context:'.length + 1);
			message = message.split(' ');
			if (message.length > 1) {
				var old = this._map.context || {};
				this._map.context = {appId: message[0], context: message[1]};
				this._map.fire('contextchange', {appId: message[0], context: message[1], oldAppId: old.appId, oldContext: old.context});
			}
		}
		else if (textMsg.startsWith('formfieldbutton:')) {
			this._onFormFieldButtonMsg(textMsg);
		}
		else if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			if (obj.comment.cellPos) {
				// cellPos is in print-twips so convert to display twips.
				var cellPos = L.Bounds.parse(obj.comment.cellPos);
				cellPos = this._convertToTileTwipsSheetArea(cellPos);
				obj.comment.cellPos = cellPos.toCoreString();
			}
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablemodified:')) {
			obj = JSON.parse(textMsg.substring('redlinetablemodified:'.length + 1));
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablechanged:')) {
			obj = JSON.parse(textMsg.substring('redlinetablechanged:'.length + 1));
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).onACKComment(obj);
		}
		else if (textMsg.startsWith('documentbackgroundcolor:')) {
			if (this.isCalc()) {
				this.coreDocBGColor = textMsg.substring('documentbackgroundcolor:'.length + 1).trim();
				app.sectionContainer.setClearColor('#' + this.coreDocBGColor);
			}
		} else if (textMsg.startsWith('contentcontrol:')) {
			textMsg = textMsg.substring('contentcontrol:'.length + 1);
			if (!app.sectionContainer.doesSectionExist(L.CSections.ContentControl.name)) {
				app.sectionContainer.addSection(new app.definitions.ContentControlSection());
			}
			var section = app.sectionContainer.getSectionWithName(L.CSections.ContentControl.name);
			section.drawContentControl(JSON.parse(textMsg));
		}
		else if (textMsg.startsWith('versionbar:')) {
			obj = JSON.parse(textMsg.substring('versionbar:'.length + 1));
			this._map.fire('versionbar', obj);
		}
	},

	_onTabStopListUpdate: function (textMsg) {
		textMsg = textMsg.substring('tabstoplistupdate:'.length + 1);
		var json = JSON.parse(textMsg);
		this._map.fire('tabstoplistupdate', json);
	},

	toggleTileDebugModeImpl: function() {
		this._debug = !this._debug;
		if (!this._debug) {
			this._map.removeLayer(this._debugInfo);
			this._map.removeLayer(this._debugInfo2);
			$('.leaflet-control-layers-expanded').css('display', 'none');

			if (this._map._docLayer._docType === 'spreadsheet') {
				var section = this._map._docLayer._painter._sectionContainer.getSectionWithName('calc grid');
				if (section) {
					section.setDrawingOrder(L.CSections.CalcGrid.drawingOrder);
					section.sectionProperties.strokeStyle = '#c0c0c0';
				}
				this._map._docLayer._painter._sectionContainer.removeSection('splits');
				this._map._docLayer._painter._sectionContainer.reNewAllSections(true /* redraw */);
			}
		} else {
			if (this._debugInfo) {
				this._map.addLayer(this._debugInfo);
				this._map.addLayer(this._debugInfo2);
				$('.leaflet-control-layers-expanded').css('display', 'block');
			}
			this._debugInit();
		}
		if (app.socket.traceEventRecordingToggle)
			this._map.addLayer(this._debugTrace);
		else
			this._map.removeLayer(this._debugTrace);
	},

	_onCommandValuesMsg: function (textMsg) {
		var jsonIdx = textMsg.indexOf('{');
		if (jsonIdx === -1) {
			return;
		}
		var obj = JSON.parse(textMsg.substring(jsonIdx));
		if (obj.commandName === '.uno:DocumentRepair') {
			this._onDocumentRepair(obj);
		}
		else if (obj.commandName === '.uno:CellCursor') {
			this._onCellCursorMsg(obj.commandValues);
		}
		else if (this._map.unoToolbarCommands.indexOf(obj.commandName) !== -1) {
			this._toolbarCommandValues[obj.commandName] = obj.commandValues;
			this._map.fire('updatetoolbarcommandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
		else {
			this._map.fire('commandvalues', {
				commandName: obj.commandName,
				commandValues: obj.commandValues
			});
		}
	},

	_onCellAddressMsg: function (textMsg) {
		// When the user moves the focus to a different cell, a 'cellformula'
		// message is received from coolwsd, *then* a 'celladdress' message.
		var address = textMsg.substring(13);
		if (this._map._clip && !this._map['wopi'].DisableCopy) {
			this._map._clip.setTextSelectionText(this._lastFormula);
		}
		this._map.fire('celladdress', {address: address});
	},

	_onCellFormulaMsg: function (textMsg) {
		// When a 'cellformula' message from coolwsd is received,
		// store the text contents of the cell, but don't push
		// them to the clipboard container (yet).
		// This is done because coolwsd will send several 'cellformula'
		// messages during text composition, and resetting the contents
		// of the clipboard container mid-composition will easily break it.
		var formula = textMsg.substring(13);
		this._lastFormula = formula;
		this._map.fire('cellformula', {formula: formula});
	},

	_onCalcFunctionListMsg: function (textMsg) {
		var funcData = JSON.parse(textMsg);
		this._closeMobileWizard();

		var data = {
			id: 'funclist',
			type: '',
			text: _('Functions'),
			enabled: true,
			children: []
		};

		if (funcData.categories)
			this._onCalcFunctionListWithCategories(funcData, data);
		else
			this._onCalcFunctionList(funcData, data);

		if (funcData.wholeList)
			this._map._functionWizardData = data;

		this._openMobileWizard(data);
	},

	_getCalcFunctionListEntry: function(name, category, index, signature, description) {
		return  {
			id: '',
			type: 'calcfuncpanel',
			text: name,
			functionName: name,
			index: index,
			category: category,
			enabled: true,
			children: [
				{
					id: '',
					type: 'fixedtext',
					html: '<div class="func-info-sig">' + signature + '</div>' + '<div class="func-info-desc">' + description + '</div>',
					enabled: true,
					style: 'func-info'
				}
			]
		};
	},

	_onCalcFunctionList: function (funcList, data) {
		var entries = data.children;
		for (var idx = 0; idx < funcList.length; ++idx) {
			var func =  funcList[idx];
			var name = func.signature.split('(')[0];
			entries.push(this._getCalcFunctionListEntry(
				name, undefined, func.index, func.signature, func.description));
		}
	},

	_onCalcFunctionListWithCategories: function (funcData, data) {
		var categoryList = funcData.categories;
		var categoryEntries = data.children;
		for (var idx = 0; idx < categoryList.length; ++idx) {
			var category = categoryList[idx];
			var categoryEntry = {
				id: '',
				type: 'panel',
				text: category.name,
				index: idx,
				enabled: true,
				children: []
			};
			categoryEntries.push(categoryEntry);
		}

		var funcList = funcData.functions;
		for (idx = 0; idx < funcList.length; ++idx) {
			var func =  funcList[idx];
			var name = func.signature.split('(')[0];
			var funcEntries = categoryEntries[func.category].children;
			funcEntries.push(this._getCalcFunctionListEntry(
				name, func.category, func.index, func.signature, func.description));
		}
	},

	_onCursorVisibleMsg: function(textMsg) {
		var command = textMsg.match('cursorvisible: true');
		this._map._isCursorVisible = command ? true : false;
		this._removeSelection();
		this._onUpdateCursor();
	},

	_setCursorVisible: function() {
		this._map._isCursorVisible = true;
	},

	_onDownloadAsMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
		var parser = document.createElement('a');
		parser.href = window.host;

		var url = window.makeHttpUrlWopiSrc('/' + this._map.options.urlPrefix + '/',
			this._map.options.doc, '/download/' + command.downloadid);

		this._map.hideBusy();
		if (this._map['wopi'].DownloadAsPostMessage) {
			this._map.fire('postMessage', {msgId: 'Download_As', args: {Type: command.id, URL: url}});
		}
		else if (command.id === 'print') {
			if (this._map.options.print === false || L.Browser.cypressTest) {
				// open the pdf in a new tab, it can be printed directly in the browser's pdf viewer
				url = window.makeHttpUrlWopiSrc('/' + this._map.options.urlPrefix + '/',
					this._map.options.doc, '/download/' + command.downloadid,
					'attachment=0');

				if ('processCoolUrl' in window) {
					url = window.processCoolUrl({ url: url, type: 'print' });
				}

				window.open(url, '_blank');
			}
			else {
				if ('processCoolUrl' in window) {
					url = window.processCoolUrl({ url: url, type: 'print' });
				}

				this._map.fire('filedownloadready', {url: url});
			}
		}
		else if (command.id === 'slideshow') {
			this._map.fire('slidedownloadready', {url: url});
		}
		else if (command.id === 'export') {
			if ('processCoolUrl' in window) {
				url = window.processCoolUrl({ url: url, type: 'export' });
			}

			// Don't do a real download during testing
			if (!L.Browser.cypressTest)
				this._map._fileDownloader.src = url;
			else
				this._map._fileDownloader.setAttribute('data-src', url);
		}
	},

	_onErrorMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);

		// let's provide some convenience error codes for the UI
		var errorId = 1; // internal error
		if (command.errorCmd === 'load') {
			errorId = 2; // document cannot be loaded
		}
		else if (command.errorCmd === 'save' || command.errorCmd === 'saveas') {
			errorId = 5; // document cannot be saved
		}

		var errorCode = -1;
		if (command.errorCode !== undefined) {
			errorCode = command.errorCode;
		}

		this._map.fire('error', {cmd: command.errorCmd, kind: command.errorKind, id: errorId, code: errorCode});
	},

	_onGetChildIdMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
		this._map.fire('childid', {id: command.id});
	},

	_isGraphicAngleDivisibleBy90: function() {
		return (this._graphicSelectionAngle % 9000 === 0);
	},

	_shouldScaleUniform: function(extraInfo) {
		return (!this._isGraphicAngleDivisibleBy90() || extraInfo.isWriterGraphic || extraInfo.type === 22);
	},

	_onShapeSelectionContent: function (textMsg) {
		textMsg = textMsg.substring('shapeselectioncontent:'.length + 1);
		if (this._graphicMarker) {
			var extraInfo = this._graphicSelection.extraInfo;
			if (extraInfo.id) {
				this._map._cacheSVG[extraInfo.id] = textMsg;
			}
			var wasVisibleSVG = this._graphicMarker._hasVisibleEmbeddedSVG();
			this._graphicMarker.removeEmbeddedSVG();

			// video is handled in _onEmbeddedVideoContent
			var isVideoSVG = textMsg.indexOf('<video') !== -1;
			if (isVideoSVG) {
				this._map._cacheSVG[extraInfo.id] = undefined;
			} else {
				this._graphicMarker.addEmbeddedSVG(textMsg);
				if (wasVisibleSVG)
					this._graphicMarker._showEmbeddedSVG();
			}
		}
	},

	// shows the video inside current selection marker
	_onEmbeddedVideoContent: function (textMsg) {
		if (!this._graphicMarker)
			return;

		// Remove other view selection as it interferes with playing the media.
		for (var viewId in this._graphicViewMarkers) {
			if (viewId !== this._viewId && this._map._viewInfo[viewId]) {
				var viewMarker = this._graphicViewMarkers[viewId].marker;
				if (viewMarker)
					this._viewLayerGroup.removeLayer(viewMarker);
			}
		}

		var videoDesc = JSON.parse(textMsg);

		if (this._graphicSelectionTwips) {
			var topLeftPoint = this._twipsToCssPixels(
				this._graphicSelectionTwips.getTopLeft(), this._map.getZoom());
			var bottomRightPoint = this._twipsToCssPixels(
				this._graphicSelectionTwips.getBottomRight(), this._map.getZoom());

			videoDesc.width = bottomRightPoint.x - topLeftPoint.x;
			videoDesc.height = bottomRightPoint.y - topLeftPoint.y;
		}

		var videoToInsert = '<?xml version="1.0" encoding="UTF-8"?>\
		<foreignObject xmlns="http://www.w3.org/2000/svg" overflow="visible" width="'
			+ videoDesc.width + '" height="' + videoDesc.height + '">\
		    <body xmlns="http://www.w3.org/1999/xhtml">\
		        <video controls="controls" width="' + videoDesc.width + '" height="'
					+ videoDesc.height + '">\
		            <source src="' + videoDesc.url + '" type="' + videoDesc.mimeType + '"/>\
		        </video>\
		    </body>\
		</foreignObject>';

		this._graphicMarker.addEmbeddedVideo(videoToInsert);
	},

	_resetSelectionRanges: function() {
		this._graphicSelectionTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		this._hasActiveSelection = false;
	},

	_openMobileWizard: function(data) {
		this._map.fire('mobilewizard', {data: data});
	},

	_closeMobileWizard: function() {
		this._map.fire('closemobilewizard');
	},

	_extractAndSetGraphicSelection: function(messageJSON) {
		var calcRTL = this.isCalcRTL();
		var signX =  calcRTL ? -1 : 1;
		var hasExtraInfo = messageJSON.length > 5;
		var hasGridOffset = false;
		var extraInfo = null;
		if (hasExtraInfo) {
			extraInfo = messageJSON[5];
			if (extraInfo.gridOffsetX || extraInfo.gridOffsetY) {
				this._shapeGridOffset = new L.Point(signX * parseInt(extraInfo.gridOffsetX), parseInt(extraInfo.gridOffsetY));
				hasGridOffset = true;
			}
		}

		// Calc RTL: Negate positive X coordinates from core if grid offset is available.
		signX = hasGridOffset && calcRTL ? -1 : 1;
		var topLeftTwips = new L.Point(signX * messageJSON[0], messageJSON[1]);
		var offset = new L.Point(signX * messageJSON[2], messageJSON[3]);
		var bottomRightTwips = topLeftTwips.add(offset);

		if (hasGridOffset) {
			this._graphicSelectionTwips = new L.Bounds(topLeftTwips.add(this._shapeGridOffset), bottomRightTwips.add(this._shapeGridOffset));
		} else {
			this._graphicSelectionTwips = this._getGraphicSelectionRectangle(
				new L.Bounds(topLeftTwips, bottomRightTwips));
		}
		this._graphicSelection = new L.LatLngBounds(
			this._twipsToLatLng(this._graphicSelectionTwips.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(this._graphicSelectionTwips.getBottomRight(), this._map.getZoom()));

		this._graphicSelection.extraInfo = extraInfo;
	},

	renderDarkOverlay: function () {
		var zoom = this._map.getZoom();

		var northEastPoint = this._latLngToCorePixels(this._graphicSelection.getNorthEast(), zoom);
		var southWestPoint = this._latLngToCorePixels(this._graphicSelection.getSouthWest(), zoom);

		if (this.isCalcRTL()) {
			// Dark overlays (like any other overlay) need regular document coordinates.
			// But in calc-rtl mode, charts (like shapes) have negative x document coordinate
			// internal representation.
			northEastPoint.x = Math.abs(northEastPoint.x);
			southWestPoint.x = Math.abs(southWestPoint.x);
		}

		var bounds = new L.Bounds(northEastPoint, southWestPoint);

		this._oleCSelections.setPointSet(CPointSet.fromBounds(bounds));
	},

	_onGraphicSelectionMsg: function (textMsg) {
		if (this._map.hyperlinkPopup !== null) {
			this._closeURLPopUp();
		}
		if (textMsg.match('EMPTY')) {
			this._resetSelectionRanges();
		}
		else if (textMsg.match('INPLACE EXIT')) {
			this._oleCSelections.clear();
		}
		else if (textMsg.match('INPLACE')) {
			if (this._oleCSelections.empty()) {
				textMsg = '[' + textMsg.substr('graphicselection:'.length) + ']';
				try {
					var msgData = JSON.parse(textMsg);
					if (msgData.length > 1)
						this._extractAndSetGraphicSelection(msgData);
				}
				catch (error) {
					window.app.console.warn('cannot parse graphicselection command');
				}
				this.renderDarkOverlay();

				this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
				this._onUpdateGraphicSelection();
			}
		}
		else {
			textMsg = '[' + textMsg.substr('graphicselection:'.length) + ']';
			msgData = JSON.parse(textMsg);
			this._extractAndSetGraphicSelection(msgData);

			// Update the dark overlay on zooming & scrolling
			if (!this._oleCSelections.empty()) {
				this._oleCSelections.clear();
				this.renderDarkOverlay();
			}

			this._graphicSelectionAngle = (msgData.length > 4) ? msgData[4] : 0;

			if (this._graphicSelection.extraInfo) {
				var dragInfo = this._graphicSelection.extraInfo.dragInfo;
				if (dragInfo && dragInfo.dragMethod === 'PieSegmentDragging') {
					dragInfo.initialOffset /= 100.0;
					var dragDir = dragInfo.dragDirection;
					dragInfo.dragDirection = this._twipsToPixels(new L.Point(dragDir[0], dragDir[1]));
					dragDir = dragInfo.dragDirection;
					dragInfo.range2 = dragDir.x * dragDir.x + dragDir.y * dragDir.y;
				}
			}

			// defaults
			var extraInfo = this._graphicSelection.extraInfo;
			if (extraInfo) {
				if (extraInfo.isDraggable === undefined)
					extraInfo.isDraggable = true;
				if (extraInfo.isResizable === undefined)
					extraInfo.isResizable = true;
				if (extraInfo.isRotatable === undefined)
					extraInfo.isRotatable = true;
			}

			// Workaround for tdf#123874. For some reason the handling of the
			// shapeselectioncontent messages that we get back causes the WebKit process
			// to crash on iOS.
			if (!window.ThisIsTheiOSApp && this._graphicSelection.extraInfo.isDraggable && !this._graphicSelection.extraInfo.svg) {
				app.socket.sendMessage('rendershapeselection mimetype=image/svg+xml');
			}
		}

		// Graphics are by default complex selections, unless Core tells us otherwise.
		if (this._map._clip)
			this._map._clip.onComplexSelection('');

		// Reset text selection - important for textboxes in Impress
		if (this._selectionContentRequest)
			clearTimeout(this._selectionContentRequest);
		this._onMessage('textselectioncontent:');

		this._onUpdateGraphicSelection();

		if (msgData && msgData.length > 5) {
			var extraInfo = msgData[5];
			if (extraInfo.url !== undefined) {
				this._onEmbeddedVideoContent(JSON.stringify(extraInfo));
			}
		}
	},

	_onGraphicViewSelectionMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('graphicviewselection:'.length + 1));
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var strTwips = obj.selection.match(/\d+/g);
		this._graphicViewMarkers[viewId] = this._graphicViewMarkers[viewId] || {};
		this._graphicViewMarkers[viewId].part = parseInt(obj.part);
		this._graphicViewMarkers[viewId].mode = (obj.mode !== undefined) ? parseInt(obj.mode) : 0;
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundRectTwips = this._getGraphicSelectionRectangle(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._graphicViewMarkers[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(boundRectTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundRectTwips.getBottomRight(), this._map.getZoom()));
		}
		else {
			this._graphicViewMarkers[viewId].bounds = L.LatLngBounds.createDefault();
		}

		this._onUpdateGraphicViewSelection(viewId);

		if (this.isCalc()) {
			this._saveMessageForReplay(textMsg, viewId);
		}
	},

	_onCellCursorMsg: function (textMsg) {
		var autofillMarkerSection = app.sectionContainer.getSectionWithName(L.CSections.AutoFillMarker.name);

		if (!this._cellCursor) {
			this._cellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._prevCellCursor) {
			this._prevCellCursor = L.LatLngBounds.createDefault();
		}
		if (!this._cellCursorXY) {
			this._cellCursorXY = new L.Point(-1, -1);
		}
		if (!this._prevCellCursorXY) {
			this._prevCellCursorXY = new L.Point(-1, -1);
		}

		var oldCursorXY = this._cellCursorXY.clone();

		if (textMsg.match('EMPTY') || !this._map.isEditMode()) {
			app.file.calc.cellCursor.visible = false;
			this._cellCursorTwips = new L.Bounds(new L.Point(0, 0), new L.Point(0, 0));
			this._cellCursor = L.LatLngBounds.createDefault();
			this._cellCursorXY = new L.Point(-1, -1);
			this._cellCursorPixels = null;
			app.file.calc.cellCursor.visible = false;
			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellCursor(null);
			if (this._map._clip)
				this._map._clip.clearSelection();
		}
		else {
			var strTwips = textMsg.match(/\d+/g);

			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			this._cellCursorTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._cellCursor = new L.LatLngBounds(
				this._twipsToLatLng(this._cellCursorTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(this._cellCursorTwips.getBottomRight(), this._map.getZoom()));

			var start = this._twipsToCorePixels(this._cellCursorTwips.min);
			var offsetPixels = this._twipsToCorePixels(this._cellCursorTwips.getSize());
			this._cellCursorPixels = L.LOUtil.createRectangle(start.x, start.y, offsetPixels.x, offsetPixels.y);
			app.file.calc.cellCursor.address = [parseInt(strTwips[4]), parseInt(strTwips[5])];
			app.file.calc.cellCursor.rectangle.pixels = [Math.round(start.x), Math.round(start.y), Math.round(offsetPixels.x), Math.round(offsetPixels.y)];
			app.file.calc.cellCursor.rectangle.twips = this._cellCursorTwips.toRectangle();
			app.file.calc.cellCursor.visible = true;
			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellCursor([this._cellCursorPixels.getX2(), this._cellCursorPixels.getY2()]);

			this._cellCursorXY = new L.Point(parseInt(strTwips[4]), parseInt(strTwips[5]));

			app.file.calc.cellCursor.visible = true;
			app.file.calc.cellCursor.rectangle.twips = this._cellCursorTwips.toRectangle();
			app.file.calc.cellCursor.rectangle.pixels = [start.x, start.y, offsetPixels.x, offsetPixels.y];
			app.file.calc.cellCursor.address = [parseInt(strTwips[4]), parseInt(strTwips[5])];
		}

		var horizontalDirection = 0;
		var verticalDirection = 0;
		var sign = function(x) {
			return x > 0 ? 1 : x < 0 ? -1 : x;
		};
		if (!this._isEmptyRectangle(this._prevCellCursor) && !this._isEmptyRectangle(this._cellCursor)) {
			horizontalDirection = sign(this._cellCursor.getWest() - this._prevCellCursor.getWest());
			verticalDirection = sign(this._cellCursor.getNorth() - this._prevCellCursor.getNorth());
		}
		else if (!this._isEmptyRectangle(this._cellCursor)) {
			// This is needed for jumping view to cursor position on tab switch
			horizontalDirection = sign(this._cellCursor.getWest());
			verticalDirection = sign(this._cellCursor.getNorth());
		}

		var onPgUpDn = false;
		if (!this._isEmptyRectangle(this._cellCursor) && !this._prevCellCursor.equals(this._cellCursor)) {
			if ((this._cellCursorOnPgUp && this._cellCursorOnPgUp.equals(this._prevCellCursor)) ||
				(this._cellCursorOnPgDn && this._cellCursorOnPgDn.equals(this._prevCellCursor))) {
				onPgUpDn = true;
			}
			this._prevCellCursor = new L.LatLngBounds(this._cellCursor.getSouthWest(), this._cellCursor.getNorthEast());
		}

		var scrollToCursor = this._sheetSwitch.tryRestore(oldCursorXY.equals(this._cellCursorXY), this._selectedPart);

		this._onUpdateCellCursor(horizontalDirection, verticalDirection, onPgUpDn, scrollToCursor);

		// Remove input help if there is any:
		this._removeInputHelpMarker();

		var commentHasFocus = app.view.commentHasFocus;
		// unselect if anything is selected already
		if (!commentHasFocus && app.sectionContainer.doesSectionExist(L.CSections.CommentList.name)) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).unselect();
		}
	},

	_removeInputHelpMarker: function() {
		if (this._inputHelpPopUp) {
			this._map.removeLayer(this._inputHelpPopUp);
			this._inputHelpPopUp = null;
		}
	},

	_onDocumentRepair: function (textMsg) {
		if (!this._docRepair) {
			this._docRepair = L.control.documentRepair();
		}

		if (!this._docRepair.isVisible()) {
			this._docRepair.addTo(this._map);
			this._docRepair.fillActions(textMsg);
			this._docRepair.show();
		}
	},

	_onMousePointerMsg: function (textMsg) {
		textMsg = textMsg.substring(14); // "mousepointer: "
		textMsg = Cursor.getCustomCursor(textMsg) || textMsg;
		var mapPane = $('.leaflet-pane.leaflet-map-pane');
		if (mapPane.css('cursor') !== textMsg) {
			mapPane.css('cursor', textMsg);
		}
	},

	_setupClickFuncForId: function(targetId, func) {
		var target = document.getElementById(targetId);
		target.style.cursor = 'pointer';
		target.onclick = target.ontouchend = func;
	},

	_showURLPopUp: function(position, url) {
		var parent = L.DomUtil.create('div');
		L.DomUtil.createWithId('div', 'hyperlink-pop-up-preview', parent);
		var link = L.DomUtil.createWithId('a', 'hyperlink-pop-up', parent);
		link.innerText = url;
		var copyBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-copy', parent);
		L.DomUtil.addClass(copyBtn, 'hyperlink-popup-btn');
		copyBtn.setAttribute('title', _('Copy link location'));
		var imgCopyBtn = L.DomUtil.create('img', 'hyperlink-pop-up-copyimg', copyBtn);
		imgCopyBtn.setAttribute('src', L.LOUtil.getImageURL('lc_copyhyperlinklocation.svg'));
		imgCopyBtn.setAttribute('width', 18);
		imgCopyBtn.setAttribute('height', 18);
		imgCopyBtn.setAttribute('style', 'padding: 4px');
		var editBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-edit', parent);
		L.DomUtil.addClass(editBtn, 'hyperlink-popup-btn');
		editBtn.setAttribute('title', _('Edit link'));
		var imgEditBtn = L.DomUtil.create('img', 'hyperlink-pop-up-editimg', editBtn);
		imgEditBtn.setAttribute('src', L.LOUtil.getImageURL('lc_edithyperlink.svg'));
		imgEditBtn.setAttribute('width', 18);
		imgEditBtn.setAttribute('height', 18);
		imgEditBtn.setAttribute('style', 'padding: 4px');
		var removeBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-remove', parent);
		L.DomUtil.addClass(removeBtn, 'hyperlink-popup-btn');
		removeBtn.setAttribute('title', _('Remove link'));
		var imgRemoveBtn = L.DomUtil.create('img', 'hyperlink-pop-up-removeimg', removeBtn);
		imgRemoveBtn.setAttribute('src', L.LOUtil.getImageURL('lc_removehyperlink.svg'));
		imgRemoveBtn.setAttribute('width', 18);
		imgRemoveBtn.setAttribute('height', 18);
		imgRemoveBtn.setAttribute('style', 'padding: 4px');
		this._map.hyperlinkPopup = new L.Popup({className: 'hyperlink-popup', closeButton: false, closeOnClick: false, autoPan: false})
			.setHTMLContent(parent)
			.setLatLng(position)
			.openOn(this._map);
		document.getElementById('hyperlink-pop-up').title = url;
		var offsetDiffTop = $('.hyperlink-popup').offset().top - $('#map').offset().top;
		var offsetDiffLeft = $('.hyperlink-popup').offset().left - $('#map').offset().left;
		if (offsetDiffTop < 10) this._movePopUpBelow();
		if (offsetDiffLeft < 10) this._movePopUpRight();
		var map_ = this._map;
		this._setupClickFuncForId('hyperlink-pop-up', function() {
			if (!url.startsWith('#'))
				map_.fire('warn', {url: url, map: map_, cmd: 'openlink'});
			else
				map_.sendUnoCommand('.uno:JumpToMark?Bookmark:string=' + url.substring(1));
		});
		this._setupClickFuncForId('hyperlink-pop-up-copy', function () {
			map_.sendUnoCommand('.uno:CopyHyperlinkLocation');
		});
		this._setupClickFuncForId('hyperlink-pop-up-edit', function () {
			map_.sendUnoCommand('.uno:EditHyperlink');
		});
		this._setupClickFuncForId('hyperlink-pop-up-remove', function () {
			map_.sendUnoCommand('.uno:RemoveHyperlink');
		});

		if (this._map['wopi'].EnableRemoteLinkPicker)
			this._map.fire('postMessage', { msgId: 'Action_GetLinkPreview', args: { url: url } });
	},

	_movePopUpBelow: function() {
		var popUp = $('.hyperlink-popup').first();
		var bottom = parseInt(popUp.css('bottom')) - popUp.height();

		popUp.css({
			'bottom': bottom ? bottom + 'px': '',
			'display': 'flex',
			'flex-direction': 'column-reverse'
		});
		$('.leaflet-popup-tip-container').first().css('transform', 'rotate(180deg)');
	},

	_movePopUpRight: function() {
		$('.leaflet-popup-content-wrapper').first().css({
			'position': 'relative',
			'left': (this._map.hyperlinkPopup._containerWidth / 2)
		});
		$('.leaflet-popup-tip-container').first().css({
			'left': '25px'
		});
	},

	_closeURLPopUp: function() {
		this._map.closePopup(this._map.hyperlinkPopup);
		this._map.hyperlinkPopup = null;
	},

	_onInvalidateCursorMsg: function (textMsg) {
		textMsg = textMsg.substring('invalidatecursor:'.length + 1);
		var obj = JSON.parse(textMsg);
		var recCursor = this._getEditCursorRectangle(obj);
		if (recCursor === undefined) {
			return;
		}
		var modifierViewId = parseInt(obj.viewId);

		this._cursorAtMispelledWord = obj.mispelledWord ? Boolean(parseInt(obj.mispelledWord)).valueOf() : false;

		// Remember the last position of the caret (in core pixels).
		if (this._cursorCorePixels) {
			this._cursorPreviousPositionCorePixels = this._cursorCorePixels.clone();
		}

		this._visibleCursor = new L.LatLngBounds(
			this._twipsToLatLng(recCursor.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(recCursor.getBottomRight(), this._map.getZoom()));
		this._cursorCorePixels = this._twipsToCorePixelsBounds(recCursor);

		var cursorPos = this._visibleCursor.getNorthWest();
		var docLayer = this._map._docLayer;
		if ((docLayer._followEditor || docLayer._followUser) && this._map.lastActionByUser) {
			this._map._setFollowing(false, null);
		}
		this._map.lastActionByUser = false;

		this._map.hyperlinkUnderCursor = obj.hyperlink;
		this._closeURLPopUp();
		if (obj.hyperlink && obj.hyperlink.link) {
			this._showURLPopUp(cursorPos, obj.hyperlink.link);
		}

		if (!this._map.editorHasFocus() && this._map._isCursorVisible && (modifierViewId === this._viewId) && (this._map.isEditMode())) {
			// Regain cursor if we had been out of focus and now have input.
			// Unless the focus is in the Calc Formula-Bar, don't steal the focus.
			if (!this._map.calcInputBarHasFocus())
				this._map.fire('editorgotfocus');
		}

		//first time document open, set last cursor position
		if (!this.lastCursorPos)
			this.lastCursorPos = recCursor.getTopLeft();

		var updateCursor = false;
		if (!this.lastCursorPos.equals(recCursor.getTopLeft())) {
			updateCursor = true;
			this.lastCursorPos = recCursor.getTopLeft();
		}

		// If modifier view is different than the current view, then set last variable to "true". We'll keep the caret position at the same point relative to screen.
		this._onUpdateCursor(updateCursor && (modifierViewId === this._viewId), undefined /* zoom */, !(this._viewId === modifierViewId));
		// Only for reference equality comparison.
		this._lastVisibleCursorRef = this._visibleCursor;
	},

	_updateEditor: function(textMsg) {
		textMsg = textMsg.substring('editor:'.length + 1);
		var editorId = parseInt(textMsg);
		var docLayer = this._map._docLayer;

		docLayer._editorId = editorId;

		if (docLayer._followEditor) {
			docLayer._followThis = editorId;
		}

		if (this._map._viewInfo[editorId])
			this._map.fire('updateEditorName', {username: this._map._viewInfo[editorId].username});
	},

	_onInvalidateViewCursorMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('invalidateviewcursor:'.length + 1));
		var viewId = parseInt(obj.viewId);
		var docLayer = this._map._docLayer;

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var rectangle = this._getEditCursorRectangle(obj);
		if (rectangle === undefined) {
			return;
		}

		this._viewCursors[viewId] = this._viewCursors[viewId] || {};
		this._viewCursors[viewId].bounds = new L.LatLngBounds(
			this._twipsToLatLng(rectangle.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(rectangle.getBottomRight(), this._map.getZoom())),
		this._viewCursors[viewId].corepxBounds = this._twipsToCorePixelsBounds(rectangle);
		this._viewCursors[viewId].part = parseInt(obj.part);
		this._viewCursors[viewId].mode = (obj.mode !== undefined) ? parseInt(obj.mode) : 0;

		// FIXME. Server not sending view visible cursor
		if (typeof this._viewCursors[viewId].visible === 'undefined') {
			this._viewCursors[viewId].visible = true;
		}

		this._onUpdateViewCursor(viewId);

		if (docLayer._followThis === viewId && (docLayer._followEditor || docLayer._followUser)) {
			if (this._map.getDocType() === 'text' || this._map.getDocType() === 'presentation') {
				this.goToViewCursor(viewId);
			}
			else if (this._map.getDocType() === 'spreadsheet') {
				this.goToCellViewCursor(viewId);
			}
		}

		this._saveMessageForReplay(textMsg, viewId);
	},

	_onCellViewCursorMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('cellviewcursor:'.length + 1));
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours
		if (viewId === this._viewId) {
			return;
		}

		this._cellViewCursors[viewId] = this._cellViewCursors[viewId] || {};
		if (!this._cellViewCursors[viewId].bounds) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
			this._cellViewCursors[viewId].corePixelBounds = new L.Bounds();
		}
		if (obj.rectangle.match('EMPTY')) {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
			this._cellViewCursors[viewId].corePixelBounds = new L.Bounds();
		}
		else {
			var strTwips = obj.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundsTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			this._cellViewCursors[viewId].bounds = new L.LatLngBounds(
				this._twipsToLatLng(boundsTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundsTwips.getBottomRight(), this._map.getZoom()));
			var corePixelBounds = this._twipsToCorePixelsBounds(boundsTwips);
			corePixelBounds.round();
			this._cellViewCursors[viewId].corePixelBounds = corePixelBounds;
		}

		this._cellViewCursors[viewId].part = parseInt(obj.part);
		this._onUpdateCellViewCursor(viewId);

		if (this.isCalc()) {
			this._saveMessageForReplay(textMsg, viewId);
		}
	},

	_onUpdateCellViewCursor: function (viewId) {
		if (!this._cellViewCursors[viewId] || !this._cellViewCursors[viewId].bounds)
			return;

		var cellViewCursorMarker = this._cellViewCursors[viewId].marker;
		var viewPart = this._cellViewCursors[viewId].part;
		var viewMode = this._cellViewCursors[viewId].mode ? this._cellViewCursors[viewId].mode : 0;

		if (!this._isEmptyRectangle(this._cellViewCursors[viewId].bounds)
			&& this._selectedPart === viewPart && this._selectedMode === viewMode
			&& this._map.hasInfoForView(viewId)) {
			if (!cellViewCursorMarker) {
				var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				cellViewCursorMarker = new CCellCursor(this._cellViewCursors[viewId].corePixelBounds, {
					viewId: viewId,
					fill: false,
					color: backgroundColor,
					weight: 2 * app.dpiScale,
					toCompatUnits: function (corePx) {
						return this._map.unproject(L.point(corePx)
							.divideBy(app.dpiScale));
					}.bind(this)
				});
				this._cellViewCursors[viewId].marker = cellViewCursorMarker;
				cellViewCursorMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
				this._canvasOverlay.initPathGroup(cellViewCursorMarker);
			}
			else {
				cellViewCursorMarker.setBounds(this._cellViewCursors[viewId].corePixelBounds);
			}
		}
		else if (cellViewCursorMarker) {
			this._canvasOverlay.removePathGroup(cellViewCursorMarker);
			this._cellViewCursors[viewId].marker = undefined;
		}
	},

	goToCellViewCursor: function(viewId) {
		if (this._cellViewCursors[viewId] && !this._isEmptyRectangle(this._cellViewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._cellViewCursors[viewId].bounds)) {
				var mapBounds = this._map.getBounds();
				var scrollX = 0;
				var scrollY = 0;
				var spacingX = Math.abs(this._cellViewCursors[viewId].bounds.getEast() - this._cellViewCursors[viewId].bounds.getWest()) / 4.0;
				var spacingY = Math.abs(this._cellViewCursors[viewId].bounds.getSouth() - this._cellViewCursors[viewId].bounds.getNorth()) / 4.0;
				if (this._cellViewCursors[viewId].bounds.getWest() < mapBounds.getWest()) {
					scrollX = this._cellViewCursors[viewId].bounds.getWest() - mapBounds.getWest() - spacingX;
				} else if (this._cellViewCursors[viewId].bounds.getEast() > mapBounds.getEast()) {
					scrollX = this._cellViewCursors[viewId].bounds.getEast() - mapBounds.getEast() + spacingX;
				}

				if (this._cellViewCursors[viewId].bounds.getNorth() > mapBounds.getNorth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getNorth() - mapBounds.getNorth() + spacingY;
				} else if (this._cellViewCursors[viewId].bounds.getSouth() < mapBounds.getSouth()) {
					scrollY = this._cellViewCursors[viewId].bounds.getSouth() - mapBounds.getSouth() - spacingY;
				}

				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lat += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}

			var backgroundColor = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
			this._cellViewCursors[viewId].marker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: backgroundColor, color: 'white', closeButton: false});
		}
	},

	_onViewCursorVisibleMsg: function(textMsg) {
		textMsg = textMsg.substring('viewcursorvisible:'.length + 1);
		var obj = JSON.parse(textMsg);
		var viewId = parseInt(obj.viewId);

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = (obj.visible === 'true');
		}

		this._onUpdateViewCursor(viewId);
	},

	_addView: function(viewInfo) {
		if (viewInfo.color === 0 && this._map.getDocType() !== 'text') {
			viewInfo.color = L.LOUtil.getViewIdColor(viewInfo.id);
		}

		this._map.addView(viewInfo);

		//TODO: We can initialize color and other properties here.
		if (typeof this._viewCursors[viewInfo.id] !== 'undefined') {
			this._viewCursors[viewInfo.id] = {};
		}

		this._onUpdateViewCursor(viewInfo.id);
	},

	_removeView: function(viewId) {
		// Remove selection, if any.
		if (this._viewSelections[viewId] && this._viewSelections[viewId].selection) {
			this._viewSelections[viewId].selection.remove();
			this._viewSelections[viewId].selection = undefined;
		}

		// Remove the view and update (to refresh as needed).
		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = false;
			this._onUpdateViewCursor(viewId);
			delete this._viewCursors[viewId];
		}

		this._map.removeView(viewId);
	},

	removeAllViews: function() {
		for (var viewInfoIdx in this._map._viewInfo) {
			this._removeView(parseInt(viewInfoIdx));
		}
	},

	_onViewInfoMsg: function(textMsg) {
		textMsg = textMsg.substring('viewinfo: '.length);
		var viewInfo = JSON.parse(textMsg);
		this._map.fire('viewinfo', viewInfo);

		// A new view
		var viewIds = [];
		for (var viewInfoIdx in viewInfo) {
			if (!(parseInt(viewInfo[viewInfoIdx].id) in this._map._viewInfo)) {
				this._addView(viewInfo[viewInfoIdx]);
			}
			viewIds.push(viewInfo[viewInfoIdx].id);
		}

		// Check if any view is deleted
		for (viewInfoIdx in this._map._viewInfo) {
			if (viewIds.indexOf(parseInt(viewInfoIdx)) === -1) {
				this._removeView(parseInt(viewInfoIdx));
			}
		}

		// Sending postMessage about View_Added / View_Removed is
		// deprecated, going forward we prefer sending the entire information.
		this._map.fire('updateviewslist');
	},

	_onRenderFontMsg: function (textMsg, img) {
		var command = app.socket.parseServerCmd(textMsg);
		this._map.fire('renderfont', {
			font: command.font,
			char: command.char,
			img: img
		});
	},

	_onSearchNotFoundMsg: function (textMsg) {
		this._clearSearchResults();
		this._searchRequested = false;
		var originalPhrase = textMsg.substring(16);
		this._map.fire('search', {originalPhrase: originalPhrase, count: 0});
	},

	_getSearchResultRectangles: function (obj, results) {
		for (var i = 0; i < obj.searchResultSelection.length; i++) {
			results.push({
				part: parseInt(obj.searchResultSelection[i].part),
				rectangles: this._twipsRectanglesToPixelBounds(obj.searchResultSelection[i].rectangles),
				twipsRectangles: obj.searchResultSelection[i].rectangles
			});
		}
	},

	_getSearchResultRectanglesFileBasedView: function (obj, results) {
		var additionPerPart = this._partHeightTwips + this._spaceBetweenParts;

		for (var i = 0; i < obj.searchResultSelection.length; i++) {
			var rectangles = obj.searchResultSelection[i].rectangles;
			var part = parseInt(obj.searchResultSelection[i].part);
			rectangles = rectangles.split(',');
			rectangles = rectangles.map(function(element, index) {
				element = parseInt(element);
				if (index < 2)
					element += additionPerPart * part;
				return element;
			});

			rectangles = String(rectangles[0]) + ', ' + String(rectangles[1]) + ', ' + String(rectangles[2]) + ', ' + String(rectangles[3]);

			results.push({
				part: parseInt(obj.searchResultSelection[i].part),
				rectangles: this._twipsRectanglesToPixelBounds(rectangles),
				twipsRectangles: rectangles
			});
		}
	},

	_onSearchResultSelection: function (textMsg) {
		this._searchRequested = false;
		textMsg = textMsg.substring(23);
		var obj = JSON.parse(textMsg);
		var originalPhrase = obj.searchString;
		var count = obj.searchResultSelection.length;
		var highlightAll = obj.highlightAll;
		var results = [];

		if (!app.file.fileBasedView)
			this._getSearchResultRectangles(obj, results);
		else
			this._getSearchResultRectanglesFileBasedView(obj, results);

		// do not cache search results if there is only one result.
		// this way regular searches works fine
		if (count > 1)
		{
			this._clearSearchResults();
			this._searchResults = results;
			if (!app.file.fileBasedView)
				this._map.setPart(results[0].part); // go to first result.
			else
				this._map._docLayer._preview._scrollViewToPartPosition(results[0].part);
		} else if (count === 1) {
			this._lastSearchResult = results[0];
		}
		this._searchTerm = originalPhrase;
		this._map.fire('search', {originalPhrase: originalPhrase, count: count, highlightAll: highlightAll, results: results});
	},

	_clearSearchResults: function() {
		if (this._searchTerm) {
			this._textCSelections.clear();
		}
		this._lastSearchResult = null;
		this._searchResults = null;
		this._searchTerm = null;
		this._searchResultsLayer.clearLayers();
	},

	_drawSearchResults: function() {
		if (!this._searchResults) {
			return;
		}
		this._searchResultsLayer.clearLayers();
		for (var k = 0; k < this._searchResults.length; k++)
		{
			var result = this._searchResults[k];
			if (result.part === this._selectedPart)
			{
				var _fillColor = '#CCCCCC';
				var strTwips = result.twipsRectangles.match(/\d+/g);
				var rectangles = [];
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var topRightTwips = topLeftTwips.add(new L.Point(offset.x, 0));
					var bottomLeftTwips = topLeftTwips.add(new L.Point(0, offset.y));
					var bottomRightTwips = topLeftTwips.add(offset);
					rectangles.push([bottomLeftTwips, bottomRightTwips, topLeftTwips, topRightTwips]);
				}
				var polygons = L.PolyUtil.rectanglesToPolygons(rectangles, this);
				var selection = new L.Polygon(polygons, {
					pointerEvents: 'none',
					fillColor: _fillColor,
					fillOpacity: 0.25,
					weight: 2,
					opacity: 0.25});
				this._searchResultsLayer.addLayer(selection);
			}
		}
	},

	_onStateChangedMsg: function (textMsg) {
		textMsg = textMsg.substr(14);

		var isPureJSON = textMsg.indexOf('=') === -1 && textMsg.indexOf('{') !== -1;
		if (isPureJSON) {
			var json = JSON.parse(textMsg);
			if (json.commandName && json.state) {
				this._map.fire('commandstatechanged', json);
			}
		} else {
			var index = textMsg.indexOf('=');
			var commandName = index !== -1 ? textMsg.substr(0, index) : '';
			var state = index !== -1 ? textMsg.substr(index + 1) : '';
			this._map.fire('commandstatechanged', {commandName : commandName, state : state});
		}
	},

	_onUnoCommandResultMsg: function (textMsg) {
		// window.app.console.log('_onUnoCommandResultMsg: "' + textMsg + '"');
		textMsg = textMsg.substring(18);
		var obj = JSON.parse(textMsg);
		var commandName = obj.commandName;
		if (obj.success === 'true' || obj.success === true) {
			var success = true;
		}
		else if (obj.success === 'false' || obj.success === false) {
			success = false;
		}

		this._map.hideBusy();
		this._map.fire('commandresult', {commandName: commandName, success: success, result: obj.result});

		if (this._map.CallPythonScriptSource != null) {
			this._map.CallPythonScriptSource.postMessage(JSON.stringify({'MessageId': 'CallPythonScript-Result',
										     'SendTime': Date.now(),
										     'Values': obj
										    }),
								     '*');
			this._map.CallPythonScriptSource = null;
		}
	},

	_onRulerUpdate: function (textMsg) {
		textMsg = textMsg.substring(13);
		var obj = JSON.parse(textMsg);

		this._map.fire('rulerupdate', obj);
	},

	_onContextMenuMsg: function (textMsg) {
		textMsg = textMsg.substring(13);
		var obj = JSON.parse(textMsg);

		this._map.fire('locontextmenu', obj);
	},

	_onTextSelectionMsg: function (textMsg) {

		var rectArray = this._getTextSelectionRectangles(textMsg);
		var inTextSearch = $('input#search-input').is(':focus');
		var isTextSelection = this.isCursorVisible() || inTextSearch;
		if (rectArray.length) {

			var rectangles = rectArray.map(function (rect) {
				return rect.getPointArray();
			});

			if (app.file.fileBasedView && this._lastSearchResult) {
				// We rely on that _lastSearchResult has been updated before this function is called.
				var additionPerPart = this._partHeightTwips + this._spaceBetweenParts;
				for (var i = 0; i < rectangles.length; i++) {
					for (var j = 0; j < rectangles[i].length; j++) {
						rectangles[i][j].y += additionPerPart * this._lastSearchResult.part;
					}
				}
				this._map._docLayer._preview._scrollViewToPartPosition(this._lastSearchResult.part);
				this._updateFileBasedView();
				setTimeout(function () {app.sectionContainer.requestReDraw();}, 100);
			}

			var docLayer = this;
			var pointSet = CPolyUtil.rectanglesToPointSet(rectangles,
				function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});

			if (isTextSelection)
				this._textCSelections.setPointSet(pointSet);
			else
				this._cellCSelections.setPointSet(pointSet);

			this._map.removeLayer(this._map._textInput._cursorHandler); // User selected a text, we remove the carret marker.
			if (this._selectionContentRequest) {
				clearTimeout(this._selectionContentRequest);
			}
			this._selectionContentRequest = setTimeout(L.bind(function () {
				app.socket.sendMessage('gettextselection mimetype=text/html');}, this), 100);
		}
		else {
			this._textCSelections.clear();
			this._cellCSelections.clear();
			if (this._map._clip && this._map._clip._selectionType === 'complex')
				this._map._clip.clearSelection();
		}

		this._onUpdateTextSelection();
	},

	_onTextViewSelectionMsg: function (textMsg) {
		var obj = JSON.parse(textMsg.substring('textviewselection:'.length + 1));
		var viewId = parseInt(obj.viewId);
		var viewPart = parseInt(obj.part);
		var viewMode = (obj.mode !== undefined) ? parseInt(obj.mode) : 0;

		// Ignore if viewid is same as ours or not in our db
		if (viewId === this._viewId || !this._map._viewInfo[viewId]) {
			return;
		}

		var rectArray = this._getTextSelectionRectangles(obj.selection);
		this._viewSelections[viewId] = this._viewSelections[viewId] || {};

		if (rectArray.length) {

			var rectangles = rectArray.map(function (rect) {
				return rect.getPointArray();
			});

			this._viewSelections[viewId].part = viewPart;
			this._viewSelections[viewId].mode = viewMode;
			var docLayer = this;
			this._viewSelections[viewId].pointSet = CPolyUtil.rectanglesToPointSet(rectangles,
				function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});
		} else {
			this._viewSelections[viewId].pointSet = new CPointSet();
		}

		this._onUpdateTextViewSelection(viewId);

		this._saveMessageForReplay(textMsg, viewId);
	},

	_updateReferenceMarks: function() {
		this._clearReferences();

		if (!this._referencesAll)
			return;

		for (var i = 0; i < this._referencesAll.length; i++) {
			// Avoid doubled marks, add only marks for current sheet
			if (!this._references.hasMark(this._referencesAll[i].mark)
				&& this._selectedPart === this._referencesAll[i].part) {
				this._references.addMark(this._referencesAll[i].mark);
			}
			if (!window.mode.isDesktop()) {
				if (!this._referenceMarkerStart.isDragged) {
					this._map.addLayer(this._referenceMarkerStart);
					var sizeStart = this._referenceMarkerStart._icon.getBoundingClientRect();
					var posStart = this._referencesAll[i].mark.getBounds().getTopLeft().divideBy(app.dpiScale);
					posStart = posStart.subtract(new L.Point(sizeStart.width / 2, sizeStart.height / 2));
					posStart = this._map.unproject(posStart);
					this._referenceMarkerStart.setLatLng(posStart);
				}

				if (!this._referenceMarkerEnd.isDragged) {
					this._map.addLayer(this._referenceMarkerEnd);
					var sizeEnd = this._referenceMarkerEnd._icon.getBoundingClientRect();
					var posEnd = this._referencesAll[i].mark.getBounds().getBottomRight().divideBy(app.dpiScale);
					posEnd = posEnd.subtract(new L.Point(sizeEnd.width / 2, sizeEnd.height / 2));
					posEnd = this._map.unproject(posEnd);
					this._referenceMarkerEnd.setLatLng(posEnd);
				}
			}
		}
	},

	_onReferencesMsg: function (textMsg) {
		textMsg = textMsg.substr(textMsg.indexOf(' ') + 1);
		var marks = JSON.parse(textMsg);
		marks = marks.marks;
		var references = [];
		this._referencesAll = [];

		for (var mark = 0; mark < marks.length; mark++) {
			var strTwips = marks[mark].rectangle.match(/\d+/g);
			var strColor = marks[mark].color;
			var part = parseInt(marks[mark].part);

			if (strTwips != null) {
				var rectangles = [];
				for (var i = 0; i < strTwips.length; i += 4) {
					var topLeftTwips = new L.Point(parseInt(strTwips[i]), parseInt(strTwips[i + 1]));
					var offset = new L.Point(parseInt(strTwips[i + 2]), parseInt(strTwips[i + 3]));
					var boundsTwips = this._convertToTileTwipsSheetArea(
						new L.Bounds(topLeftTwips, topLeftTwips.add(offset)));
					rectangles.push([boundsTwips.getBottomLeft(), boundsTwips.getBottomRight(),
						boundsTwips.getTopLeft(), boundsTwips.getTopRight()]);
				}

				var docLayer = this;
				var pointSet = CPolyUtil.rectanglesToPointSet(rectangles, function (twipsPoint) {
					var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
					corePxPt.round();
					return corePxPt;
				});
				var reference = new CPolygon(pointSet, {
					pointerEvents: 'none',
					fillColor: '#' + strColor,
					fillOpacity: 0.25,
					weight: 2 * app.dpiScale,
					opacity: 0.25});

				references.push({mark: reference, part: part});
			}
		}

		for (i = 0; i < references.length; i++) {
			this._referencesAll.push(references[i]);
		}

		this._updateReferenceMarks();
	},

	_getStringPart: function (string) {
		var code = '';
		var i = 0;
		while (i < string.length) {
			if (string.charCodeAt(i) < 48 || string.charCodeAt(i) > 57) {
				code += string.charAt(i);
			}
			i++;
		}
		return code;
	},

	_getNumberPart: function (string) {
		var number = '';
		var i = 0;
		while (i < string.length) {
			if (string.charCodeAt(i) >= 48 && string.charCodeAt(i) <= 57) {
				number += string.charAt(i);
			}
			i++;
		}
		return parseInt(number);
	},

	_isWholeColumnSelected: function (cellAddress) {
		if (!cellAddress)
			cellAddress = document.getElementById('addressInput').value;

		var startEnd = cellAddress.split(':');
		if (startEnd.length === 1)
			return false; // Selection is not a range.

		var rangeStart = this._getNumberPart(startEnd[0]);
		if (rangeStart !== 1)
			return false; // Selection doesn't start at first row.

		var rangeEnd = this._getNumberPart(startEnd[1]);
		if (rangeEnd === 1048576) // Last row's number.
			return true;
		else
			return false;
	},

	_isWholeRowSelected: function (cellAddress) {
		if (!cellAddress)
			cellAddress = document.getElementById('addressInput').value;

		var startEnd = cellAddress.split(':');
		if (startEnd.length === 1)
			return false; // Selection is not a range.

		var rangeStart = this._getStringPart(startEnd[0]);
		if (rangeStart !== 'A')
			return false; // Selection doesn't start at first column.

		var rangeEnd = this._getStringPart(startEnd[1]);
		if (rangeEnd === 'XFD') // Last column's code.
			return true;
		else
			return false;
	},

	_updateScrollOnCellSelection: function (oldSelection, newSelection) {
		if (this.isCalc() && oldSelection) {
			var mapBounds = this._map.getBounds();
			if (!mapBounds.contains(newSelection) && !newSelection.equals(oldSelection)) {
				var spacingX = Math.abs(this._cellCursor.getEast() - this._cellCursor.getWest()) / 4.0;
				var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 2.0;

				var scrollX = 0, scrollY = 0;
				if (newSelection.getEast() > mapBounds.getEast() && newSelection.getEast() > oldSelection.getEast())
					scrollX = newSelection.getEast() - mapBounds.getEast() + spacingX;
				else if (newSelection.getWest() < mapBounds.getWest() && newSelection.getWest() < oldSelection.getWest())
					scrollX = newSelection.getWest() - mapBounds.getWest() - spacingX;
				if (newSelection.getNorth() > mapBounds.getNorth() && newSelection.getNorth() > oldSelection.getNorth())
					scrollY = newSelection.getNorth() - mapBounds.getNorth() + spacingY;
				else if (newSelection.getSouth() < mapBounds.getSouth() && newSelection.getSouth() < oldSelection.getSouth())
					scrollY = newSelection.getSouth() - mapBounds.getSouth() - spacingY;
				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scrollX;
					newCenter.lat += scrollY;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					if (!this._map.wholeColumnSelected && !this._map.wholeRowSelected) {
						var address = document.getElementById('addressInput').value;
						if (!this._isWholeColumnSelected(address) && !this._isWholeRowSelected(address))
							this._map.fire('scrollto', {x: center.x, y: center.y});
					}
				}
			}
		}
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length && this._map.isEditMode()) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			var oldSelection = this._textSelectionEnd;
			this._textSelectionEnd = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionEnd);
			this._updateMarkers();
		}
		else {
			this._textSelectionEnd = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length && this._map.isEditMode()) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			var oldSelection = this._textSelectionStart;
			//FIXME: The selection is really not two points, as they can be
			//FIXME: on top of each other, but on separate lines. We should
			//FIXME: capture the whole area in _onTextSelectionMsg.
			this._textSelectionStart = new L.LatLngBounds(
				this._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._twipsToLatLng(bottomRightTwips, this._map.getZoom()));

			this._updateScrollOnCellSelection(oldSelection, this._textSelectionStart);
		}
		else {
			this._textSelectionStart = null;
		}
	},

	_refreshRowColumnHeaders: function () {
		if (app.sectionContainer.doesSectionExist(L.CSections.RowHeader.name))
			app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
		if (app.sectionContainer.doesSectionExist(L.CSections.ColumnHeader.name))
			app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
	},

	_onCellSelectionAreaMsg: function (textMsg) {
		var autofillMarkerSection = app.sectionContainer.getSectionWithName(L.CSections.AutoFillMarker.name);
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map.isEditMode()) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundsTwips = this._convertToTileTwipsSheetArea(
				new L.Bounds(topLeftTwips, bottomRightTwips));
			var oldSelection = this._cellSelectionArea;
			this._cellSelectionArea = new L.LatLngBounds(
				this._twipsToLatLng(boundsTwips.getTopLeft(), this._map.getZoom()),
				this._twipsToLatLng(boundsTwips.getBottomRight(), this._map.getZoom()));

			var offsetPixels = this._twipsToCorePixels(boundsTwips.getSize());
			var start = this._twipsToCorePixels(boundsTwips.min);
			var cellSelectionAreaPixels = L.LOUtil.createRectangle(start.x, start.y, offsetPixels.x, offsetPixels.y);
			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellSelection([cellSelectionAreaPixels.getX2(), cellSelectionAreaPixels.getY2()]);

			if (this._cellCursor === null) {
				this._cellCursor = L.LatLngBounds.createDefault();
			}
			this._updateScrollOnCellSelection(oldSelection, this._cellSelectionArea);
		} else {
			this._cellSelectionArea = null;
			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellSelection(null);
			this._cellSelections = Array(0);
			this._map.wholeColumnSelected = false; // Message related to whole column/row selection should be on the way, we should update the variables now.
			this._map.wholeRowSelected = false;
			if (this._refreshRowColumnHeaders)
				this._refreshRowColumnHeaders();
		}
	},

	_onCellAutoFillAreaMsg: function (textMsg) {
		var strTwips = textMsg.match(/\d+/g);
		if (strTwips != null && this._map.isEditMode()) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));

			var topLeftPixels = this._twipsToCorePixels(topLeftTwips);
			var offsetPixels = this._twipsToCorePixels(offset);
			this._cellAutoFillAreaPixels = L.LOUtil.createRectangle(topLeftPixels.x, topLeftPixels.y, offsetPixels.x, offsetPixels.y);
		}
		else {
			this._cellAutoFillAreaPixels = null;
		}
	},

	_onDialogPaintMsg: function(textMsg, img) {
		var command = app.socket.parseServerCmd(textMsg);

		// app.socket.sendMessage('DEBUG _onDialogPaintMsg: hash=' + command.hash + ' img=' + typeof(img) + (typeof(img) == 'string' ? (' (length:' + img.length + ':"' + img.substring(0, 30) + (img.length > 30 ? '...' : '') + '")') : '') + ', cache size ' + this._pngCache.length);
		if (command.nopng) {
			var found = false;
			for (var i = 0; i < this._pngCache.length; i++) {
				if (this._pngCache[i].hash == command.hash) {
					found = true;
					// app.socket.sendMessage('DEBUG - Found in cache');
					img = this._pngCache[i].img;
					// Remove item (and add it below at the start of the array)
					this._pngCache.splice(i, 1);
					break;
				}
			}
			if (!found) {
				var message = 'windowpaint: message assumed PNG for hash ' + command.hash
				    + ' is cached here in the client but not found';
				if (L.Browser.cypressTest)
					throw new Error(message);
				app.socket.sendMessage('ERROR ' + message);
				// Not sure what to do. Ask the server to re-send the windowpaint: message but this time including the PNG?
			}
		} else {
			// Sanity check: If we get a PNG it should be for a hash that we don't have cached
			for (i = 0; i < this._pngCache.length; i++) {
				if (this._pngCache[i].hash == command.hash) {
					message = 'windowpaint: message included PNG for hash ' + command.hash
					    + ' even if it was already cached here in the client';
					if (L.Browser.cypressTest)
						throw new Error(message);
					app.socket.sendMessage('ERROR ' + message);
					// Remove the extra copy, code below will add it at the start of the array
					this._pngCache.splice(i, 1);
					break;
				}
			}
		}

		// If cache is max size, drop the last element
		if (this._pngCache.length == app.socket.TunnelledDialogImageCacheSize) {
			// app.socket.sendMessage('DEBUG - Dropping last cache element');
			this._pngCache.pop();
		}

		// Add element to cache
		this._pngCache.unshift({hash: command.hash, img:img});

		// app.socket.sendMessage('DEBUG - Cache size now ' + this._pngCache.length);

		this._map.fire('windowpaint', {
			id: command.id,
			img: img,
			width: command.width,
			height: command.height,
			rectangle: command.rectangle,
			hash: command.hash
		});
	},

	_onDialogMsg: function(textMsg) {
		textMsg = textMsg.substring('window: '.length);
		var dialogMsg = JSON.parse(textMsg);
		// e.type refers to signal type
		dialogMsg.winType = dialogMsg.type;
		this._map.fire('window', dialogMsg);
	},

	_tileOnError: function (done, tile, e) {
		var errorUrl = this.options.errorTileUrl;
		if (errorUrl) {
			tile.src = errorUrl;
		}
		done(e, tile);
	},

	_mapOnError: function (e) {
		if (e.msg && this._map.isEditMode() && e.critical !== false) {
			this._map.setPermission('view');
		}
	},

	_onTileRemove: function (e) {
		e.tile.onload = null;
	},

	_clearSelections: function (calledFromSetPartHandler) {
		// hide the cursor if not editable
		this._onUpdateCursor(calledFromSetPartHandler);
		// hide the text selection
		this._textCSelections.clear();
		// hide the cell selection
		this._cellCSelections.clear();
		// hide the ole selection
		this._oleCSelections.clear();
		// hide the selection handles
		this._onUpdateTextSelection();
		// hide the graphic selection
		this._graphicSelection = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
		this._onUpdateGraphicSelection();
		this._cellCursor = null;
		this._cellCursorXY = null;
		this._prevCellCursor = null;
		this._prevCellCursorXY = null;
		this._onUpdateCellCursor();
		if (this._map._clip)
			this._map._clip.clearSelection();
		else
			this._selectedTextContent = '';
	},

	containsSelection: function (latlng) {
		var corepxPoint = this._map.project(latlng);
		return this._textCSelections.empty() ?
			this._cellCSelections.contains(corepxPoint) :
			this._textCSelections.contains(corepxPoint);
	},

	_clearReferences: function () {
		this._references.clear();

		if (!this._referenceMarkerStart.isDragged)
			this._map.removeLayer(this._referenceMarkerStart);
		if (!this._referenceMarkerEnd.isDragged)
			this._map.removeLayer(this._referenceMarkerEnd);
	},

	_postMouseEvent: function(type, x, y, count, buttons, modifier) {
		if (!this._map._docLoaded)
			return;

		if (this._map.calcInputBarHasFocus() && type === 'move') {
			// When the Formula-bar has the focus, sending
			// mouse move with the document coordinates
			// hides the cursor (lost focus?). This is clearly
			// a bug in Core, but we need to work around it
			// until fixed. Just don't send mouse move.
			return;
		}

		this._sendClientZoom();

		this._sendClientVisibleArea();

		app.socket.sendMessage('mouse type=' + type +
				' x=' + x + ' y=' + y + ' count=' + count +
				' buttons=' + buttons + ' modifier=' + modifier);


		if (type === 'buttondown') {
			this._clearSearchResults();
		}
	},

	// Given a character code and a UNO keycode, send a "key" message to coolwsd.
	//
	// "type" is either "input" for key presses (akin to the DOM "keypress"
	// / "beforeinput" events) and "up" for key releases (akin to the DOM
	// "keyup" event).
	//
	// PageUp/PageDown and select column & row are handled as special cases for spreadsheets - in
	// addition of sending messages to coolwsd, they move the cell cursor around.
	postKeyboardEvent: function(type, charCode, unoKeyCode) {
		if (!this._map._docLoaded)
			return;

		if (this.isMacClient) {
			// Map Mac standard shortcuts to the LO shortcuts for the corresponding
			// functions when possible. Note that the Cmd modifier comes here as CTRL.

			// Cmd+UpArrow -> Ctrl+Home
			if (unoKeyCode == UNOKey.UP + UNOModifier.CTRL)
				unoKeyCode = UNOKey.HOME + UNOModifier.CTRL;
			// Cmd+DownArrow -> Ctrl+End
			else if (unoKeyCode == UNOKey.DOWN + UNOModifier.CTRL)
				unoKeyCode = UNOKey.END + UNOModifier.CTRL;
			// Cmd+LeftArrow -> Home
			else if (unoKeyCode == UNOKey.LEFT + UNOModifier.CTRL)
				unoKeyCode = UNOKey.HOME;
			// Cmd+RightArrow -> End
			else if (unoKeyCode == UNOKey.RIGHT + UNOModifier.CTRL)
				unoKeyCode = UNOKey.END;
			// Option+LeftArrow -> Ctrl+LeftArrow
			else if (unoKeyCode == UNOKey.LEFT + UNOModifier.ALT)
				unoKeyCode = UNOKey.LEFT + UNOModifier.CTRL;
			// Option+RightArrow -> Ctrl+RightArrow (Not entirely equivalent, should go
			// to end of word (or next), LO goes to beginning of next word.)
			else if (unoKeyCode == UNOKey.RIGHT + UNOModifier.ALT)
				unoKeyCode = UNOKey.RIGHT + UNOModifier.CTRL;
		}

		var completeEvent = app.socket.createCompleteTraceEvent('L.TileSectionManager.postKeyboardEvent', { type: type, charCode: charCode });

		var winId = this._map.getWinId();
		if (
			this.isCalc() &&
			this._prevCellCursor &&
			type === 'input' &&
			winId === 0
		) {
			if (unoKeyCode === UNOKey.PAGEUP) {
				if (this._cellCursorOnPgUp) {
					return;
				}
				this._cellCursorOnPgUp = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (unoKeyCode === UNOKey.PAGEDOWN) {
				if (this._cellCursorOnPgDn) {
					return;
				}
				this._cellCursorOnPgDn = new L.LatLngBounds(this._prevCellCursor.getSouthWest(), this._prevCellCursor.getNorthEast());
			}
			else if (unoKeyCode === UNOKey.SPACE + UNOModifier.CTRL) { // Select whole column.
				this._map.wholeColumnSelected = true;
			}
			else if (unoKeyCode === UNOKey.SPACE + UNOModifier.SHIFT) { // Select whole row.
				this._map.wholeRowSelected = true;
			}
		}

		this._sendClientZoom();

		this._sendClientVisibleArea();

		if (winId === 0) {
			app.socket.sendMessage(
				'key' +
				' type=' + type +
				' char=' + charCode +
				' key=' + unoKeyCode +
				'\n'
			);
		} else {
			app.socket.sendMessage(
				'windowkey id=' + winId +
				' type=' + type +
				' char=' + charCode +
				' key=' + unoKeyCode +
				'\n'
			);
		}
		if (completeEvent)
			completeEvent.finish();
	},

	_postSelectTextEvent: function(type, x, y) {
		app.socket.sendMessage('selecttext type=' + type +
				' x=' + x + ' y=' + y);
	},

	// Is rRectangle empty?
	_isEmptyRectangle: function (bounds) {
		if (!bounds) {
			return true;
		}
		return bounds.getSouthWest().equals(new L.LatLng(0, 0)) && bounds.getNorthEast().equals(new L.LatLng(0, 0));
	},

	_onZoomStart: function () {
		this._isZooming = true;
	},


	_onZoomEnd: function () {
		this._isZooming = false;
		if (!this.isCalc())
			this._replayPrintTwipsMsgs();
		this._onUpdateCursor(null, true);
		this.updateAllViewCursors();
	},

	_updateCursorPos: function () {
		var cursorPos = this._cursorCorePixels.getTopLeft();
		var cursorSize = this._cursorCorePixels.getSize();

		if (!this._cursorMarker) {
			this._cursorMarker = new Cursor(cursorPos, cursorSize, this._map, { blink: true });
		} else {
			this._cursorMarker.setPositionSize(cursorPos, cursorSize);
		}
	},

	_allowViewJump: function() {
		return (!this._map._clip || this._map._clip._selectionType !== 'complex') &&
		!this._referenceMarkerStart.isDragged && !this._referenceMarkerEnd.isDragged;
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (scroll, zoom, keepCaretPositionRelativeToScreen) {

		if (!this._visibleCursor ||
			this._isEmptyRectangle(this._visibleCursor) ||
			this._referenceMarkerStart.isDragged ||
			this._referenceMarkerEnd.isDragged ||
			this._map.ignoreCursorUpdate()) {
			return;
		}

		var cursorPos = this._visibleCursor.getNorthWest();
		var docLayer = this._map._docLayer;

		if (!zoom
		&& scroll !== false
		&& this._map._isCursorVisible
		// Do not center view in Calc if no new cursor coordinates have arrived yet.
		// ie, 'invalidatecursor' has not arrived after 'cursorvisible' yet.
		&& (!this.isCalc() || this._lastVisibleCursorRef !== this._visibleCursor)
		&& this._allowViewJump()) {

			var paneRectsInLatLng = this.getPaneLatLngRectangles();

			if (!this._visibleCursor.isInAny(paneRectsInLatLng)) {
				var center = this._map.project(cursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = Math.round(center.x < 0 ? 0 : center.x);
				center.y = Math.round(center.y < 0 ? 0 : center.y);

				if (!(this._selectionHandles.start && this._selectionHandles.start.isDragged) &&
				    !(this._selectionHandles.end && this._selectionHandles.end.isDragged) &&
				    !(docLayer._followEditor || docLayer._followUser) &&
				    !this._map.calcInputBarHasFocus()) {
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
			}
		}
		else if (keepCaretPositionRelativeToScreen) {
			/* We should be here when:
				Another view updated the text.
				That edit changed our cursor position.
			Now we already set the cursor position to another point.
			We want to keep the cursor position at the same point relative to screen.
			Do that only when we are reaching the end of screen so we don't flicker.
			*/
			var that = this;
			var paneRectsInLatLng = this.getPaneLatLngRectangles();
			var isCursorVisible = this._visibleCursor.isInAny(paneRectsInLatLng);
			if (!isCursorVisible) {
				setTimeout(function () {
					var y = that._cursorCorePixels.min.y - that._cursorPreviousPositionCorePixels.min.y;
					if (y) {
						that._painter._sectionContainer.getSectionWithName(L.CSections.Scroll.name).scrollVerticalWithOffset(y);
					}
				}, 0);
			}
		}

		this._updateCursorAndOverlay();

		this.eachView(this._viewCursors, function (item) {
			var viewCursorMarker = item.marker;
			if (viewCursorMarker) {
				viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getPosition().equals(viewCursorMarker.getPosition()) ? 0 : 1);
			}
		}, this, true);
	},

	activateCursor: function () {
		this._replayPrintTwipsMsg('invalidatecursor');
	},

	_isAnyInputFocused: function() {
		var hasTunneledDialogOpened = this._map.dialog ? this._map.dialog.hasOpenedDialog() : false;
		var hasJSDialogOpened = this._map.jsdialog ? this._map.jsdialog.hasDialogOpened() : false;
		var hasJSDialogFocused = L.DomUtil.hasClass(document.activeElement, 'jsdialog');
		var commentHasFocus = app.view.commentHasFocus;
		var inputHasFocus = $('input:focus').length > 0 || $('textarea.jsdialog:focus').length > 0;

		return hasTunneledDialogOpened || hasJSDialogOpened || hasJSDialogFocused
			|| commentHasFocus || inputHasFocus;
	},

	// enable or disable blinking cursor and  the cursor overlay depending on
	// the state of the document (if the falgs are set)
	_updateCursorAndOverlay: function (/*update*/) {
		if (this._map.isEditMode()
		&& this._map._isCursorVisible   // only when LOK has told us it is ok
		&& this._map.editorHasFocus()   // not when document is not focused
		&& !this._map.isSearching()  	// not when searching within the doc
		&& !this._isZooming             // not when zooming
		&& !this._isEmptyRectangle(this._visibleCursor)) {

			this._updateCursorPos();

			var scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
			if (!scrollSection.sectionProperties.mouseIsOnVerticalScrollBar && !scrollSection.sectionProperties.mouseIsOnHorizontalScrollBar) {
				this._map._textInput.showCursor();
			}

			var hasMobileWizardOpened = this._map.uiManager.mobileWizard ? this._map.uiManager.mobileWizard.isOpen() : false;
			var hasIframeModalOpened = $('.iframe-dialog-modal').is(':visible');
			// Don't show the keyboard when the Wizard is visible.
			if (!window.mobileWizard && !window.pageMobileWizard &&
				!window.insertionMobileWizard && !hasMobileWizardOpened &&
				!this._isAnyInputFocused() && !hasIframeModalOpened) {
				// If the user is editing, show the keyboard, but don't change
				// anything if nothing is changed.

				// We will focus map if no comment is being edited (writer only for now).
				if (this._docType === 'text') {
					var section = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name);
					if (!section || !section.sectionProperties.selectedComment || !section.sectionProperties.selectedComment.isEdit())
						this._map.focus(true);
				}
				else
					this._map.focus(true);
			}
		} else {
			this._map._textInput.hideCursor();
			// Maintain input if a dialog or search-box has the focus.
			if (this._map.editorHasFocus() && !isAnyVexDialogActive() && !this._map.isSearching()
				&& !this._isAnyInputFocused())
				this._map.focus(false);
		}
	},

	// Update colored non-blinking view cursor
	_onUpdateViewCursor: function (viewId) {
		if (typeof this._viewCursors[viewId] !== 'object' ||
		    typeof this._viewCursors[viewId].bounds !== 'object') {
			return;
		}

		var pixBounds = this._viewCursors[viewId].corepxBounds;
		var viewCursorPos = pixBounds.getTopLeft();
		var viewCursorMarker = this._viewCursors[viewId].marker;
		var viewCursorVisible = this._viewCursors[viewId].visible;
		var viewPart = this._viewCursors[viewId].part;
		var viewMode = this._viewCursors[viewId].mode ? this._viewCursors[viewId].mode : 0;

		if (!this._map.isViewReadOnly(viewId) &&
		    viewCursorVisible &&
		    !this._isZooming &&
		    !this._isEmptyRectangle(this._viewCursors[viewId].bounds) &&
		    (this.isWriter() || (this._selectedPart === viewPart && this._selectedMode === viewMode))) {
			if (!viewCursorMarker) {
				var viewCursorOptions = {
					color: L.LOUtil.rgbToHex(this._map.getViewColor(viewId)),
					blink: false,
					header: true, // we want a 'hat' to our view cursors (which will contain view user names)
					headerTimeout: 3000, // hide after some interval
					zIndex: viewId,
					headerName: this._map.getViewName(viewId)
				};
				viewCursorMarker = new Cursor(viewCursorPos, pixBounds.getSize(), this._map, viewCursorOptions);
				this._viewCursors[viewId].marker = viewCursorMarker;
			}
			else {
				viewCursorMarker.setPositionSize(viewCursorPos, pixBounds.getSize());
			}
			viewCursorMarker.setOpacity(this.isCursorVisible() && this._cursorMarker.getPosition().equals(viewCursorMarker.getPosition()) ? 0 : 1);
			if (!viewCursorMarker.isDomAttached())
				viewCursorMarker.add();
		}
		else if (viewCursorMarker && viewCursorMarker.isDomAttached()) {
			viewCursorMarker.remove();
		}

		if (this._viewCursors[viewId].marker && this._viewCursors[viewId].marker.isDomAttached())
			this._viewCursors[viewId].marker.showCursorHeader();
	},

	updateAllViewCursors: function() {
		this.eachView(this._viewCursors, this._onUpdateViewCursor, this, false);
	},

	updateAllTextViewSelection: function() {
		this.eachView(this._viewSelections, this._onUpdateTextViewSelection, this, false);
	},

	updateAllGraphicViewSelections: function () {
		this.eachView(this._graphicViewMarkers, this._onUpdateGraphicViewSelection, this, false);
	},

	isCursorVisible: function() {
		return this._cursorMarker ? this._cursorMarker.isDomAttached() : false;
	},

	goToViewCursor: function(viewId) {
		if (viewId === this._viewId) {
			this._onUpdateCursor();
			return;
		}

		if (this._viewCursors[viewId] && this._viewCursors[viewId].visible && !this._isEmptyRectangle(this._viewCursors[viewId].bounds)) {
			if (!this._map.getBounds().contains(this._viewCursors[viewId].bounds)) {
				var viewCursorPos = this._viewCursors[viewId].bounds.getNorthWest();
				var center = this._map.project(viewCursorPos);
				center = center.subtract(this._map.getSize().divideBy(2));
				center.x = Math.round(center.x < 0 ? 0 : center.x);
				center.y = Math.round(center.y < 0 ? 0 : center.y);

				this._map.fire('scrollto', {x: center.x, y: center.y});
			}

			this._viewCursors[viewId].marker.showCursorHeader();
		}
	},

	_onUpdateTextViewSelection: function (viewId) {
		viewId = parseInt(viewId);
		var viewPointSet = this._viewSelections[viewId].pointSet;
		var viewSelection = this._viewSelections[viewId].selection;
		var viewPart = this._viewSelections[viewId].part;
		var viewMode = this._viewSelections[viewId].mode ? this._viewSelections[viewId].mode : 0;

		if (viewPointSet &&
		    (this.isWriter() || (this._selectedPart === viewPart && this._selectedMode === viewMode))) {

			if (viewSelection) {
				if (!this._map.hasInfoForView(viewId)) {
					viewSelection.clear();
					return;
				}
				// change previous selections
				viewSelection.setPointSet(viewPointSet);
			} else {
				viewSelection = new CSelections(viewPointSet, this._canvasOverlay,
					this._selectionsDataDiv, this._map, true /* isView */, viewId, true /* isText */);
				this._viewSelections[viewId].selection = viewSelection;
			}
		}
		else if (viewSelection) {
			viewSelection.clear();
		}
	},

	_onUpdateGraphicViewSelection: function (viewId) {
		var viewBounds = this._graphicViewMarkers[viewId].bounds;
		var viewMarker = this._graphicViewMarkers[viewId].marker;
		var viewPart = this._graphicViewMarkers[viewId].part;
		var viewMode = this._graphicViewMarkers[viewId].mode;

		if (!this._isEmptyRectangle(viewBounds) &&
		   (this.isWriter() || (this._selectedPart === viewPart && this._selectedMode === viewMode))) {
			if (!viewMarker) {
				var color = L.LOUtil.rgbToHex(this._map.getViewColor(viewId));
				viewMarker = L.rectangle(viewBounds, {
					pointerEvents: 'auto',
					fill: false,
					color: color
				});
				// Disable autoPan, so the graphic view selection doesn't make the view jump to the popup.
				viewMarker.bindPopup(this._map.getViewName(viewId), {autoClose: false, autoPan: false, backgroundColor: color, color: 'white', closeButton: false});
				this._graphicViewMarkers[viewId].marker = viewMarker;
			}
			else {
				viewMarker.setBounds(viewBounds);
			}
			this._viewLayerGroup.addLayer(viewMarker);
		}
		else if (viewMarker) {
			this._viewLayerGroup.removeLayer(viewMarker);
		}
	},

	eachView: function (views, method, context, item) {
		for (var key in views) {
			method.call(context, item ? views[key] : key);
		}
	},

	// Update dragged graphics selection
	_onGraphicMove: function (e) {
		if (!e.pos) { return; }
		var aPos = this._latLngToTwips(e.pos);
		var calcRTL = this.isCalcRTL();
		if (e.type === 'graphicmovestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker.setVisible(true);
			this._graphicMarker._startPos = aPos;
		}
		else if (e.type === 'graphicmoveend' && this._graphicMarker._startPos) {
			var deltaPos = aPos.subtract(this._graphicMarker._startPos);
			if (deltaPos.x === 0 && deltaPos.y === 0) {
				this._graphicMarker.isDragged = false;
				this._graphicMarker.setVisible(false);
				return;
			}

			var param;
			var dragConstraint = this._graphicSelection.extraInfo.dragInfo;
			if (dragConstraint) {
				if (dragConstraint.dragMethod === 'PieSegmentDragging') {

					deltaPos = this._twipsToPixels(deltaPos);
					var dx = deltaPos.x;
					var dy = deltaPos.y;

					var initialOffset = dragConstraint.initialOffset;
					var dragDirection = dragConstraint.dragDirection;
					var additionalOffset = (dx * dragDirection.x + dy * dragDirection.y) / dragConstraint.range2;
					if (additionalOffset < -initialOffset)
						additionalOffset = -initialOffset;
					else if (additionalOffset > (1.0 - initialOffset))
						additionalOffset = 1.0 - initialOffset;

					var offset = Math.round((initialOffset + additionalOffset) * 100);

					// hijacking the uno:TransformDialog msg for sending the new offset value
					// for the pie segment dragging method;
					// indeed there isn't any uno msg dispatching on the core side, but a chart controller dispatching
					param = {
						Action: {
							type: 'string',
							value: 'PieSegmentDragging'
						},
						Offset: {
							type: 'long',
							value: offset
						}
					};
				}
			}
			else {
				var newPos = new L.Point(
					// Choose the logical left of the shape.
					this._graphicSelectionTwips.min.x + deltaPos.x,
					this._graphicSelectionTwips.min.y + deltaPos.y);

				var size = this._graphicSelectionTwips.getSize();

				if (calcRTL) {
					// make x coordinate of newPos +ve
					newPos.x = -newPos.x;
				}

				// try to keep shape inside document
				if (newPos.x + size.x > this._docWidthTwips)
					newPos.x = this._docWidthTwips - size.x;
				if (newPos.x < 0)
					newPos.x = 0;

				if (newPos.y + size.y > this._docHeightTwips)
					newPos.y = this._docHeightTwips - size.y;
				if (newPos.y < 0)
					newPos.y = 0;

				if (this.isCalc() && this.options.printTwipsMsgsEnabled) {
					newPos = this.sheetGeometry.getPrintTwipsPointFromTile(newPos);
				}

				// restore the sign(negative) of x coordinate.
				if (calcRTL) {
					newPos.x = -newPos.x;
				}

				param = {
					TransformPosX: {
						type: 'long',
						value: newPos.x
					},
					TransformPosY: {
						type: 'long',
						value: newPos.y
					}
				};
			}
			this._map.sendUnoCommand('.uno:TransformDialog ', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
		}
	},

	// Update dragged graphics selection resize.
	_onGraphicEdit: function (e) {
		if (!e.pos) { return; }
		if (!e.handleId) { return; }

		var calcRTL = this.isCalcRTL();
		var aPos = this._latLngToTwips(e.pos);
		var selMin = this._graphicSelectionTwips.min;
		var selMax = this._graphicSelectionTwips.max;

		var handleId = e.handleId;

		if (e.type === 'scalestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker.setVisible(true);
			if (selMax.x - selMin.x < 2)
				this._graphicMarker.dragHorizDir = 0; // overlapping handles
			else if (Math.abs(selMin.x - aPos.x) < 2)
				this._graphicMarker.dragHorizDir = -1; // left handle
			else if (Math.abs(selMax.x - aPos.x) < 2)
				this._graphicMarker.dragHorizDir = 1; // right handle
			if (selMax.y - selMin.y < 2)
				this._graphicMarker.dragVertDir = 0; // overlapping handles
			else if (Math.abs(selMin.y - aPos.y) < 2)
				this._graphicMarker.dragVertDir = -1; // up handle
			else if (Math.abs(selMax.y - aPos.y) < 2)
				this._graphicMarker.dragVertDir = 1; // down handle
		}
		else if (e.type === 'scaleend') {
			// fill params for uno command
			var param = {
				HandleNum: {
					type: 'long',
					value: handleId
				},
				NewPosX: {
					type: 'long',
					// In Calc RTL mode ensure that we send positive X coordinates.
					value: calcRTL ? -aPos.x : aPos.x
				},
				NewPosY: {
					type: 'long',
					value: aPos.y
				}
			};
			if (e.ordNum)
			{
				var glueParams = {
					OrdNum: {
						type: 'long',
						value: e.ordNum
					}
				};
				param = L.Util.extend({}, param, glueParams);
			}

			this._map.sendUnoCommand('.uno:MoveShapeHandle', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
			this._graphicMarker.dragHorizDir = undefined;
			this._graphicMarker.dragVertDir = undefined;
		}
	},

	_onGraphicRotate: function (e) {
		if (e.type === 'rotatestart') {
			this._graphicMarker.isDragged = true;
			this._graphicMarker.setVisible(true);
		}
		else if (e.type === 'rotateend') {
			var center = this._graphicSelectionTwips.getCenter();
			if (this.isCalc() && this.options.printTwipsMsgsEnabled) {
				center = this.sheetGeometry.getPrintTwipsPointFromTile(center);
			}
			var param = {
				TransformRotationDeltaAngle: {
					type: 'long',
					value: (((e.rotation * 18000) / Math.PI))
				},
				TransformRotationX: {
					type: 'long',
					value: center.x
				},
				TransformRotationY: {
					type: 'long',
					value: center.y
				}
			};
			this._map.sendUnoCommand('.uno:TransformDialog ', param);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
		}
	},

	// Update dragged text selection.
	_onSelectionHandleDrag: function (e) {
		if (e.type === 'drag') {
			window.IgnorePanning = true;
			e.target.isDragged = true;

			if (!e.originalEvent.pageX && !e.originalEvent.pageY) {
				return;
			}

			// This is rather hacky, but it seems to be the only way to make the
			// marker follow the mouse cursor if the document is autoscrolled under
			// us. (This can happen when we're changing the selection if the cursor
			// moves somewhere that is considered off screen.)

			// Onscreen position of the cursor, i.e. relative to the browser window
			var boundingrect = e.target._icon.getBoundingClientRect();
			var cursorPos = L.point(boundingrect.left, boundingrect.top);

			var expectedPos = L.point(e.originalEvent.pageX, e.originalEvent.pageY).subtract(e.target.dragging._draggable.startOffset);

			// Dragging the selection handles vertically more than one line on a touch
			// device is more or less impossible without this hack.
			if (!(typeof e.originalEvent.type === 'string' && e.originalEvent.type === 'touchmove')) {
				// If the map has been scrolled, but the cursor hasn't been updated yet, then
				// the current mouse position differs.
				if (!expectedPos.equals(cursorPos)) {
					var correction = expectedPos.subtract(cursorPos);

					e.target.dragging._draggable._startPoint = e.target.dragging._draggable._startPoint.add(correction);
					e.target.dragging._draggable._startPos = e.target.dragging._draggable._startPos.add(correction);
					e.target.dragging._draggable._newPos = e.target.dragging._draggable._newPos.add(correction);

					e.target.dragging._draggable._updatePosition();
				}
			}
			var containerPos = new L.Point(expectedPos.x - this._map._container.getBoundingClientRect().left,
				expectedPos.y - this._map._container.getBoundingClientRect().top);

			containerPos = containerPos.add(e.target.dragging._draggable.startOffset);
			this._map.fire('handleautoscroll', {pos: containerPos, map: this._map});
		}
		if (e.type === 'dragend') {
			window.IgnorePanning = undefined;
			e.target.isDragged = false;
			this._map.fire('scrollvelocity', {vx: 0, vy: 0});
		}

		var aPos = this._latLngToTwips(e.target.getLatLng());

		if (this._selectionHandles.start === e.target) {
			this._postSelectTextEvent('start', aPos.x, aPos.y);
		}
		else if (this._selectionHandles.end === e.target) {
			this._postSelectTextEvent('end', aPos.x, aPos.y);
		}
	},

	// Update dragged text selection.
	_onCellResizeMarkerDrag: function (e) {
		if (e.type === 'dragstart') {
			e.target.isDragged = true;
		}
		else if (e.type === 'drag') {
			var event = e.originalEvent;
			if (e.originalEvent.touches && e.originalEvent.touches.length > 0) {
				event = e.originalEvent.touches[0];
			}
			if (!event.pageX && !event.pageY) {
				return;
			}

			// handle scrolling

			// This is rather hacky, but it seems to be the only way to make the
			// marker follow the mouse cursor if the document is autoscrolled under
			// us. (This can happen when we're changing the selection if the cursor
			// moves somewhere that is considered off screen.)

			// Onscreen position of the cursor, i.e. relative to the browser window
			var boundingrect = e.target._icon.getBoundingClientRect();
			var cursorPos = L.point(boundingrect.left, boundingrect.top);
			var expectedPos = L.point(event.pageX, event.pageY).subtract(e.target.dragging._draggable.startOffset);

			// Dragging the selection handles vertically more than one line on a touch
			// device is more or less impossible without this hack.
			if (!(typeof e.originalEvent.type === 'string' && e.originalEvent.type === 'touchmove')) {
				// If the map has been scrolled, but the cursor hasn't been updated yet, then
				// the current mouse position differs.
				if (!expectedPos.equals(cursorPos)) {
					var correction = expectedPos.subtract(cursorPos);

					e.target.dragging._draggable._startPoint = e.target.dragging._draggable._startPoint.add(correction);
					e.target.dragging._draggable._startPos = e.target.dragging._draggable._startPos.add(correction);
					e.target.dragging._draggable._newPos = e.target.dragging._draggable._newPos.add(correction);

					e.target.dragging._draggable._updatePosition();
				}
			}
			var containerPos = new L.Point(expectedPos.x - this._map._container.getBoundingClientRect().left,
				expectedPos.y - this._map._container.getBoundingClientRect().top);

			containerPos = containerPos.add(e.target.dragging._draggable.startOffset);
			this._map.fire('handleautoscroll', {pos: containerPos, map: this._map});
		}
		else if (e.type === 'dragend') {
			e.target.isDragged = false;

			// handle scrolling
			this._map.focus();
			this._map.fire('scrollvelocity', {vx: 0, vy: 0});
		}

		// modify the mouse position - move to center of the marker
		var aMousePosition = e.target.getLatLng();
		aMousePosition = this._map.project(aMousePosition);
		var size;
		if (this._cellResizeMarkerStart === e.target) {
			size = this._cellResizeMarkerStart._icon.getBoundingClientRect();
		}
		else if (this._cellResizeMarkerEnd === e.target) {
			size = this._cellResizeMarkerEnd._icon.getBoundingClientRect();
		}

		aMousePosition = aMousePosition.add(new L.Point(size.width / 2, size.height / 2));
		aMousePosition = this._map.unproject(aMousePosition);
		aMousePosition = this._latLngToTwips(aMousePosition);

		if (this._cellResizeMarkerStart === e.target) {
			this._postSelectTextEvent('start', aMousePosition.x, aMousePosition.y);
			if (e.type === 'dragend') {
				this._onUpdateCellResizeMarkers();
				window.IgnorePanning = undefined;
			}
		}
		else if (this._cellResizeMarkerEnd === e.target) {
			this._postSelectTextEvent('end', aMousePosition.x, aMousePosition.y);
			if (e.type === 'dragend') {
				this._onUpdateCellResizeMarkers();
				window.IgnorePanning = undefined;
			}
		}
	},

	_onReferenceMarkerDrag: function(e) {
		if (e.type === 'dragstart') {
			e.target.isDragged = true;
			window.IgnorePanning = true;
		}
		else if (e.type === 'drag') {
			var startPos = this._map.project(this._referenceMarkerStart.getLatLng());
			var startSize = this._referenceMarkerStart._icon.getBoundingClientRect();
			startPos = startPos.add(new L.Point(startSize.width, startSize.height));
			var start = this.sheetGeometry.getCellFromPos(this._latLngToTwips(this._map.unproject(startPos)), 'tiletwips');

			var endPos = this._map.project(this._referenceMarkerEnd.getLatLng());
			var endSize = this._referenceMarkerEnd._icon.getBoundingClientRect();
			endPos = endPos.subtract(new L.Point(endSize.width / 2, endSize.height / 2));
			var end = this.sheetGeometry.getCellFromPos(this._latLngToTwips(this._map.unproject(endPos)), 'tiletwips');

			this._sendReferenceRangeCommand(start.x, start.y, end.x, end.y);
		}
		else if (e.type === 'dragend') {
			e.target.isDragged = false;
			window.IgnorePanning = undefined;
			this._updateReferenceMarks();
		}
	},

	_sendReferenceRangeCommand: function(startCol, startRow, endCol, endRow) {
		this._map.sendUnoCommand(
			'.uno:CurrentFormulaRange?StartCol=' + startCol +
			'&StartRow=' + startRow +
			'&EndCol=' + endCol +
			'&EndRow=' + endRow +
			'&Table=' + this._map._docLayer._selectedPart
		);
	},

	_onDropDownButtonClick: function () {
		if (this._validatedCellXY && this._cellCursorXY && this._validatedCellXY.equals(this._cellCursorXY)) {
			this._map.sendUnoCommand('.uno:DataSelect');
		}
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			// Hide the keyboard on graphic selection, unless cursor is visible.
			// Don't interrupt editing in dialogs
			if (!this._isAnyInputFocused())
				this._map.focus(this.isCursorVisible());

			if (this._graphicMarker) {
				this._graphicMarker.removeEventParent(this._map);
				this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
				this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
				if (this._graphicMarker.dragging)
					this._graphicMarker.dragging.disable();
				this._graphicMarker.transform.disable();
				this._map.removeLayer(this._graphicMarker);
			}

			if (!this._map.isEditMode()) {
				return;
			}

			var extraInfo = this._graphicSelection.extraInfo;
			this._graphicMarker = L.svgGroup(this._graphicSelection, {
				draggable: extraInfo.isDraggable,
				dragConstraint: extraInfo.dragInfo,
				svg: this._map._cacheSVG[extraInfo.id],
				transform: true,
				stroke: false,
				fillOpacity: 0,
				fill: true
			});

			if (!this._graphicMarker) {
				this._map.fire('error', {msg: 'Graphic marker initialization', cmd: 'marker', kind: 'failed', id: 1});
				return;
			}

			this._graphicMarker.on('graphicmovestart graphicmoveend', this._onGraphicMove, this);
			this._graphicMarker.on('scalestart scaleend', this._onGraphicEdit, this);
			this._graphicMarker.on('rotatestart rotateend', this._onGraphicRotate, this);
			this._map.addLayer(this._graphicMarker);
			if (extraInfo.isDraggable)
				this._graphicMarker.dragging.enable();
			this._graphicMarker.transform.enable({
				scaling: extraInfo.isResizable,
				rotation: extraInfo.isRotatable && !this.hasTableSelection(),
				uniformScaling: this._shouldScaleUniform(extraInfo),
				isRotated: !this._isGraphicAngleDivisibleBy90(),
				handles: (extraInfo.handles) ? extraInfo.handles.kinds || [] : [],
				shapes: (extraInfo.GluePoints) ? extraInfo.GluePoints.shapes : [],
				shapeType: extraInfo.type,
				scaleSouthAndEastOnly: this.hasTableSelection()});
			if (extraInfo.dragInfo && extraInfo.dragInfo.svg) {
				this._graphicMarker.removeEmbeddedSVG();
				this._graphicMarker.addEmbeddedSVG(extraInfo.dragInfo.svg);
			}
			this._hasActiveSelection = true;
		}
		else if (this._graphicMarker) {
			this._graphicMarker.off('graphicmovestart graphicmoveend', this._onGraphicMove, this);
			this._graphicMarker.off('scalestart scaleend', this._onGraphicEdit, this);
			this._graphicMarker.off('rotatestart rotateend', this._onGraphicRotate, this);
			if (this._graphicMarker.dragging)
				this._graphicMarker.dragging.disable();
			this._graphicMarker.transform.disable();
			this._map.removeLayer(this._graphicMarker);
			this._graphicMarker.isDragged = false;
			this._graphicMarker.setVisible(false);
		}
		this._updateCursorAndOverlay();
	},

	_onUpdateCellCursor: function (horizontalDirection, verticalDirection, onPgUpDn, scrollToCursor) {
		this._onUpdateCellResizeMarkers();
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			var mapBounds = this._map.getBounds();
			if (scrollToCursor && !this._cellCursorXY.equals(this._prevCellCursorXY) &&
			    !this._map.calcInputBarHasFocus()) {
				var scroll = this._calculateScrollForNewCellCursor();
				window.app.console.assert(scroll instanceof L.LatLng, '_calculateScrollForNewCellCursor returned wrong type');
				if (scroll.lng !== 0 || scroll.lat !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scroll.lng;
					newCenter.lat += scroll.lat;
					var center = this._map.project(newCenter);
					center = center.subtract(this._map.getSize().divideBy(2));
					center.x = Math.round(center.x < 0 ? 0 : center.x);
					center.y = Math.round(center.y < 0 ? 0 : center.y);
					this._map.fire('scrollto', {x: center.x, y: center.y});
				}
				this._prevCellCursorXY = this._cellCursorXY;
			}

			if (onPgUpDn) {
				this._cellCursorOnPgUp = null;
				this._cellCursorOnPgDn = null;
			}

			var corePxBounds = this._twipsToCorePixelsBounds(this._cellCursorTwips);
			corePxBounds.round();
			if (this._cellCursorMarker) {
				this._cellCursorMarker.setBounds(corePxBounds);
				this._map.removeLayer(this._dropDownButton);
			}
			else {
				var cursorStyle = new CStyleData(this._cursorDataDiv);
				var weight = cursorStyle.getFloatPropWithoutUnit('border-top-width');
				this._cellCursorMarker = new CCellCursor(
					corePxBounds,
					{
						name: 'cell-cursor',
						pointerEvents: 'none',
						fill: false,
						color: cursorStyle.getPropValue('border-top-color'),
						weight: Math.round(weight * app.dpiScale)
					});
				if (!this._cellCursorMarker) {
					this._map.fire('error', {msg: 'Cell Cursor marker initialization', cmd: 'cellCursor', kind: 'failed', id: 1});
					return;
				}
				this._canvasOverlay.initPathGroup(this._cellCursorMarker);
			}

			this._addDropDownMarker();

			var dontFocusDocument = this._isAnyInputFocused();

			// when the cell cursor is moving, the user is in the document,
			// and the focus should leave the cell input bar
			// exception: when dialog opened don't focus the document
			if (!dontFocusDocument)
				this._map.fire('editorgotfocus');
		}
		else if (this._cellCursorMarker) {
			this._canvasOverlay.removePathGroup(this._cellCursorMarker);
			this._cellCursorMarker = undefined;
		}
		this._removeDropDownMarker();

		//hyperlink pop-up from here
		if (this._lastFormula && this._cellCursorMarker && this._lastFormula.substring(1, 10) == 'HYPERLINK')
		{
			var formula = this._lastFormula;
			var targetURL = formula.substring(11, formula.length - 1).split(',')[0];
			targetURL = targetURL.split('"').join('');
			if (targetURL.startsWith('#')) {
				targetURL = targetURL.split(';')[0];
			} else {
				targetURL = this._map.makeURLFromStr(targetURL);
			}

			this._closeURLPopUp();
			if (targetURL) {
				this._showURLPopUp(this._cellCursor.getNorthEast(), targetURL);
			}

		}
		else if (this._map.hyperlinkPopup)
		{
			this._closeURLPopUp();
		}
	},

	_onValidityListButtonMsg: function(textMsg) {
		var strXY = textMsg.match(/\d+/g);
		var validatedCell = new L.Point(parseInt(strXY[0]), parseInt(strXY[1]));
		var show = parseInt(strXY[2]) === 1;
		if (show) {
			if (this._validatedCellXY && !this._validatedCellXY.equals(validatedCell)) {
				this._validatedCellXY = null;
				this._removeDropDownMarker();
			}
			this._validatedCellXY = validatedCell;
			this._addDropDownMarker();
		}
		else if (this._validatedCellXY && this._validatedCellXY.equals(validatedCell)) {
			this._validatedCellXY = null;
			this._removeDropDownMarker();
		}
	},

	_onValidityInputHelpMsg: function(textMsg) {
		var message = textMsg.replace('validityinputhelp: ', '');
		message = JSON.parse(message);

		var icon = L.divIcon({
			html: '<div class="input-help"><h4 id="input-help-title"></h4><p id="input-help-content"></p></div>',
			iconSize: [0, 0],
			iconAnchor: [0, 0]
		});

		this._removeInputHelpMarker();
		var inputHelpMarker = L.marker(this._cellCursor.getNorthEast(), { icon: icon });
		inputHelpMarker.addTo(this._map);
		document.getElementById('input-help-title').innerText = message.title;
		document.getElementById('input-help-content').innerText = message.content;
		this._inputHelpPopUp = inputHelpMarker;
	},

	_addDropDownMarker: function () {
		if (this._validatedCellXY && this._cellCursorXY && this._validatedCellXY.equals(this._cellCursorXY)) {
			var pos = this._cellCursor.getNorthEast();
			var dropDownMarker = this._getDropDownMarker(16);
			dropDownMarker.setLatLng(pos);
			this._map.addLayer(dropDownMarker);
		}
	},

	_removeDropDownMarker: function () {
		if (!this._validatedCellXY && this._dropDownButton)
			this._map.removeLayer(this._dropDownButton);
	},

	_getDropDownMarker: function (dropDownSize) {
		if (dropDownSize) {
			var icon =  L.divIcon({
				className: 'spreadsheet-drop-down-marker',
				iconSize: [dropDownSize, dropDownSize],
				iconAnchor: [0, 0]
			});
			this._dropDownButton.setIcon(icon);
		}
		return this._dropDownButton;
	},

	_onUpdateCellResizeMarkers: function () {
		var selectionOnDesktop = window.mode.isDesktop()
									&& (this._cellSelectionArea
									|| (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)));

		if (!selectionOnDesktop &&
			(!this._cellCSelections.empty() || (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)))) {
			if (this._isEmptyRectangle(this._cellSelectionArea) && this._isEmptyRectangle(this._cellCursor)) {
				return;
			}

			var cellRectangle = this._cellSelectionArea ? this._cellSelectionArea : this._cellCursor;

			if (!this._cellResizeMarkerStart.isDragged) {
				this._map.addLayer(this._cellResizeMarkerStart);
				var posStart = this._map.project(cellRectangle.getNorthWest());
				var sizeStart = this._cellResizeMarkerStart._icon.getBoundingClientRect();
				posStart = posStart.subtract(new L.Point(sizeStart.width / 2, sizeStart.height / 2));
				posStart = this._map.unproject(posStart);
				this._cellResizeMarkerStart.setLatLng(posStart);
			}
			if (!this._cellResizeMarkerEnd.isDragged) {
				this._map.addLayer(this._cellResizeMarkerEnd);
				var posEnd = this._map.project(cellRectangle.getSouthEast());
				var sizeEnd = this._cellResizeMarkerEnd._icon.getBoundingClientRect();
				posEnd = posEnd.subtract(new L.Point(sizeEnd.width / 2, sizeEnd.height / 2));
				posEnd = this._map.unproject(posEnd);
				this._cellResizeMarkerEnd.setLatLng(posEnd);
			}
		}
		else if (selectionOnDesktop) {
			this._map.removeLayer(this._cellResizeMarkerStart);
			this._map.removeLayer(this._cellResizeMarkerEnd);
		} else {
			this._map.removeLayer(this._cellResizeMarkerStart);
			this._map.removeLayer(this._cellResizeMarkerEnd);
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		this._onUpdateCellResizeMarkers();

		var startMarker = this._selectionHandles['start'];
		var endMarker = this._selectionHandles['end'];

		if (this._map.editorHasFocus() && (!this._textCSelections.empty() || startMarker.isDragged || endMarker.isDragged)) {
			this._updateMarkers();
		}
		else {
			this._updateMarkers();
			this._removeSelection();
		}
	},

	_removeSelection: function() {
		this._textSelectionStart = null;
		this._textSelectionEnd = null;
		this._selectedTextContent = '';
		for (var key in this._selectionHandles) {
			this._map.removeLayer(this._selectionHandles[key]);
			this._selectionHandles[key].isDragged = false;
		}
		this._textCSelections.clear();
	},

	_updateMarkers: function() {
		if (!this._map._isCursorVisible)
			return;
		var startMarker = this._selectionHandles['start'];
		var endMarker = this._selectionHandles['end'];

		if (!startMarker || !endMarker ||
		    this._isEmptyRectangle(this._textSelectionStart) ||
		    this._isEmptyRectangle(this._textSelectionEnd)) {
			return;
		}

		var startPos = this._map.project(this._textSelectionStart.getSouthWest());
		var endPos = this._map.project(this._textSelectionEnd.getSouthWest());
		var startMarkerPos = this._map.project(startMarker.getLatLng());
		// CalcRTL: position from core are in document coordinates. Conversion to layer coordinates for each maker is done
		// in L.Layer.getLayerPositionVisibility(). Icons of RTL "start" and "end" has to be interchanged.
		var calcRTL = this.isCalcRTL();
		if (startMarkerPos.distanceTo(endPos) < startMarkerPos.distanceTo(startPos) && startMarker._icon && endMarker._icon) {
			// if the start marker is actually closer to the end of the selection
			// reverse icons and markers
			L.DomUtil.removeClass(startMarker._icon, calcRTL ? 'leaflet-selection-marker-end' : 'leaflet-selection-marker-start');
			L.DomUtil.removeClass(endMarker._icon, calcRTL ? 'leaflet-selection-marker-start' : 'leaflet-selection-marker-end');
			L.DomUtil.addClass(startMarker._icon, calcRTL ? 'leaflet-selection-marker-start' : 'leaflet-selection-marker-end');
			L.DomUtil.addClass(endMarker._icon, calcRTL ? 'leaflet-selection-marker-end' : 'leaflet-selection-marker-start');
			var tmp = startMarker;
			startMarker = endMarker;
			endMarker = tmp;
		}
		else if (startMarker._icon && endMarker._icon) {
			// normal markers and normal icons
			L.DomUtil.removeClass(startMarker._icon, calcRTL ? 'leaflet-selection-marker-start' : 'leaflet-selection-marker-end');
			L.DomUtil.removeClass(endMarker._icon, calcRTL ? 'leaflet-selection-marker-end' : 'leaflet-selection-marker-start');
			L.DomUtil.addClass(startMarker._icon, calcRTL ? 'leaflet-selection-marker-end' : 'leaflet-selection-marker-start');
			L.DomUtil.addClass(endMarker._icon, calcRTL ? 'leaflet-selection-marker-start' : 'leaflet-selection-marker-end');
		}

		if (!startMarker.isDragged) {
			var pos = this._map.project(this._textSelectionStart.getSouthWest());
			pos = this._map.unproject(pos);
			startMarker.setLatLng(pos);
			this._map.addLayer(startMarker);
		}

		if (!endMarker.isDragged) {
			pos = this._map.project(this._textSelectionEnd.getSouthEast());
			pos = this._map.unproject(pos);
			endMarker.setLatLng(pos);
			this._map.addLayer(endMarker);
		}
	},

	hasGraphicSelection: function() {
		return (this._graphicSelection !== null &&
			!this._isEmptyRectangle(this._graphicSelection));
	},

	_onDragOver: function (e) {
		e = e.originalEvent;
		e.preventDefault();
	},

	_onDrop: function (e) {
		// Move the cursor, so that the insert position is as close to the drop coordinates as possible.
		var latlng = e.latlng;
		var docLayer = this._map._docLayer;
		var mousePos = docLayer._latLngToTwips(latlng);
		var count = 1;
		var buttons = 1;
		var modifier = this._map.keyboard.modifier;
		this._postMouseEvent('buttondown', mousePos.x, mousePos.y, count, buttons, modifier);
		this._postMouseEvent('buttonup', mousePos.x, mousePos.y, count, buttons, modifier);

		e = e.originalEvent;
		e.preventDefault();

		if (this._map._clip) {
			// Always capture the html content separate as we may lose it when we
			// pass the clipboard data to a different context (async calls, f.e.).
			var htmlText = e.dataTransfer.getData('text/html');
			this._map._clip.dataTransferToDocument(e.dataTransfer, /* preferInternal = */ false, htmlText);
		}
	},

	_onDragStart: function () {
		this._map.on('moveend', this._updateScrollOffset, this);
	},

	_onRequestLOKSession: function () {
		app.socket.sendMessage('requestloksession');
	},

	// This is really just called on zoomend
	_fitWidthZoom: function (e, maxZoom) {
		if (this.isCalc())
			return;

		if (isNaN(this._docWidthTwips)) { return; }
		var oldSize = e ? e.oldSize : this._map.getSize();
		var newSize = e ? e.newSize : this._map.getSize();

		newSize.x *= app.dpiScale;
		newSize.y *= app.dpiScale;
		oldSize.x *= app.dpiScale;
		oldSize.y *= app.dpiScale;

		if (this.isWriter() && newSize.x - oldSize.x === 0) { return; }

		var widthTwips = newSize.x * this._tileWidthTwips / this._tileSize;
		var ratio = widthTwips / this._docWidthTwips;

		maxZoom = maxZoom ? maxZoom : 10;
		var zoom = this._map.getScaleZoom(ratio, 10);

		zoom = Math.min(maxZoom, Math.max(0.1, zoom));
		// Not clear why we wanted to zoom in the past.
		// This resets the view & scroll area and does a 'panTo'
		// to keep the cursor in view.
		// But of course, zoom to fit the first time.
		if (this._firstFitDone)
			zoom = this._map._zoom;
		this._firstFitDone = true;

		if (zoom > 1)
			zoom = Math.floor(zoom);

		this._map.setZoom(zoom, {animate: false});
	},

	_onCurrentPageUpdate: function () {
		if (!this._map)
			return;

		var mapCenter = this._map.project(this._map.getCenter());
		if (!this._partPageRectanglesPixels || !(this._currentPage >= 0) || this._currentPage >= this._partPageRectanglesPixels.length ||
				this._partPageRectanglesPixels[this._currentPage].contains(mapCenter)) {
			// page number has not changed
			return;
		}
		for (var i = 0; i < this._partPageRectanglesPixels.length; i++) {
			if (this._partPageRectanglesPixels[i].contains(mapCenter)) {
				this._currentPage = i;
				this._map.fire('pagenumberchanged', {
					currentPage: this._currentPage,
					pages: this._pages,
					docType: this._docType
				});
				return;
			}
		}
	},

	// Cells can change position during changes of zoom level in calc
	// hence we need to request an updated cell cursor position for this level.
	_onCellCursorShift: function (force) {
		if ((this._cellCursorMarker && !this.options.sheetGeometryDataEnabled) || force) {
			this.requestCellCursor();
		}
	},

	requestCellCursor: function() {
		app.socket.sendMessage('commandvalues command=.uno:CellCursor'
			+ '?outputHeight=' + this._tileWidthPx
			+ '&outputWidth=' + this._tileHeightPx
			+ '&tileHeight=' + this._tileWidthTwips
			+ '&tileWidth=' + this._tileHeightTwips);
	},

	_invalidatePreviews: function () {
		if (this._map && this._map._docPreviews && this._previewInvalidations.length > 0) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					if (preview.index >= 0 && this.isWriter()) {
						// we have a preview for a page
						if (preview.invalid || (this._partPageRectanglesTwips.length > preview.index &&
								invalidBounds.intersects(this._partPageRectanglesTwips[preview.index]))) {
							toInvalidate[key] = true;
						}
					}
					else if (preview.index >= 0) {
						// we have a preview for a part
						if (preview.invalid || preview.index === this._selectedPart ||
								(preview.index === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}
					}
					else {
						// we have a custom preview
						var bounds = new L.Bounds(
							new L.Point(preview.tilePosX, preview.tilePosY),
							new L.Point(preview.tilePosX + preview.tileWidth, preview.tilePosY + preview.tileHeight));
						if (preview.invalid || (preview.part === this._selectedPart ||
								(preview.part === this._prevSelectedPart && this._prevSelectedPartNeedsUpdate)) &&
								invalidBounds.intersects(bounds)) {
							// if the current part needs its preview updated OR
							// the part has been changed and we need to update the previous part preview
							if (preview.index === this._prevSelectedPart) {
								this._prevSelectedPartNeedsUpdate = false;
							}
							toInvalidate[key] = true;
						}

					}
				}

			}

			for (key in toInvalidate) {
				// update invalid preview tiles
				preview = this._map._docPreviews[key];
				if (preview.autoUpdate) {
					if (preview.index >= 0) {
						this._map.getPreview(preview.id, preview.index, preview.maxWidth, preview.maxHeight, {autoUpdate: true});
					}
					else {
						this._map.getCustomPreview(preview.id, preview.part, preview.width, preview.height, preview.tilePosX,
							preview.tilePosY, preview.tileWidth, preview.tileHeight, {autoUpdate: true});
					}
				}
			}
		}
		this._previewInvalidations = [];
	},

	_onFormFieldButtonMsg: function (textMsg) {
		textMsg = textMsg.substring('formfieldbutton:'.length + 1);
		var json = JSON.parse(textMsg);
		if (json.action === 'show') {
			this._formFieldButton = new L.FormFieldButton(json);
			this._map.addLayer(this._formFieldButton);
		} else if (this._formFieldButton) {
			this._map.removeLayer(this._formFieldButton);
		}
	},

	// converts rectangle in print-twips to tile-twips rectangle of the smallest cell-range that encloses it.
	_convertToTileTwipsSheetArea: function (rectangle) {
		if (!(rectangle instanceof L.Bounds) || !this.options.printTwipsMsgsEnabled || !this.sheetGeometry) {
			return rectangle;
		}

		return this.sheetGeometry.getTileTwipsSheetAreaFromPrint(rectangle);
	},

	_getGraphicSelectionRectangle: function (rectangle) {
		if (!(rectangle instanceof L.Bounds) || !this.options.printTwipsMsgsEnabled || !this.sheetGeometry) {
			return rectangle;
		}

		// Calc
		var rectSize = rectangle.getSize();
		var newTopLeft = this.sheetGeometry.getTileTwipsPointFromPrint(rectangle.getTopLeft());
		if (this.isLayoutRTL()) { // Convert to negative display-twips coordinates.
			newTopLeft.x = -newTopLeft.x;
			rectSize.x = -rectSize.x;
		}

		return new L.Bounds(newTopLeft, newTopLeft.add(rectSize));
	},

	_convertCalcTileTwips: function (point, offset) {
		if (!this.options.printTwipsMsgsEnabled || !this.sheetGeometry)
			return point;
		var newPoint = new L.Point(parseInt(point.x), parseInt(point.y));
		var _offset = offset ? new L.Point(parseInt(offset.x), parseInt(offset.y)) : this._shapeGridOffset;
		return newPoint.add(_offset);
	},

	_getEditCursorRectangle: function (msgObj) {

		if (typeof msgObj !== 'object' || !Object.prototype.hasOwnProperty.call(msgObj,'rectangle')) {
			window.app.console.error('invalid edit cursor message');
			return undefined;
		}

		return L.Bounds.parse(msgObj.rectangle);
	},

	_getTextSelectionRectangles: function (textMsg) {

		if (typeof textMsg !== 'string') {
			window.app.console.error('invalid text selection message');
			return [];
		}

		return L.Bounds.parseArray(textMsg);
	},

	// Needed for the split-panes feature to determine the active split-pane.
	// Needs to be implemented by the app specific TileLayer.
	getCursorPos: function () {
		window.app.console.error('No implementations available for getCursorPos!');
		return new L.Point(0, 0);
	},

	getPaneLatLngRectangles: function () {
		var map = this._map;

		if (!this._splitPanesContext) {
			return [ map.getBounds() ];
		}

		// These paneRects are in core pixels.
		var paneRects = this._splitPanesContext.getPxBoundList();
		window.app.console.assert(paneRects.length, 'number of panes cannot be zero!');

		return paneRects.map(function (pxBound) {
			return new L.LatLngBounds(
				map.unproject(pxBound.getTopLeft().divideBy(app.dpiScale)),
				map.unproject(pxBound.getBottomRight().divideBy(app.dpiScale))
			);
		});
	},

	_debugGetTimeArray: function() {
		return {count: 0, ms: 0, best: Number.MAX_SAFE_INTEGER, worst: 0, date: 0};
	},

	_debugShowTileData: function() {
		this._debugData['loadCount'].setPrefix('Total of requested tiles: ' +
				this._debugInvalidateCount + ', recv-tiles: ' + this._debugLoadTile +
				', recv-delta: ' + this._debugLoadDelta +
				', cancelled: ' + this._debugCancelledTiles);
	},

	_debugInit: function() {
		this._debugTiles = {};
		this._debugInvalidBounds = {};
		this._debugInvalidBoundsMessage = {};
		this._debugTimeout();
		this._debugId = 0;
		this._debugCancelledTiles = 0;
		this._debugLoadTile = 0;
		this._debugLoadDelta = 0;
		this._debugInvalidateCount = 0;
		this._debugRenderCount = 0;
		this._debugDeltas = true;
		this._debugDeltasDetail = false;
		if (!this._debugData) {
			this._debugData = {};
			this._debugDataNames = ['tileCombine', 'fromKeyInputToInvalidate', 'ping', 'loadCount', 'postMessage'];
			for (var i = 0; i < this._debugDataNames.length; i++) {
				this._debugData[this._debugDataNames[i]] = L.control.attribution({prefix: '', position: 'bottomleft'}).addTo(this._map);
			}
			this._debugInfo = new L.LayerGroup();
			this._debugInfo2 = new L.LayerGroup();
			this._debugAlwaysActive = new L.LayerGroup();
			this._debugShowClipboard = new L.LayerGroup();
			this._tilesDevicePixelGrid = new L.LayerGroup();
			this._debugSidebar = new L.LayerGroup();
			this._debugTyper = new L.LayerGroup();
			this._debugTrace = new L.LayerGroup();
			this._debugLogging = new L.LayerGroup();
			this._map.addLayer(this._debugInfo);
			this._map.addLayer(this._debugInfo2);
			var overlayMaps = {
				'Tile overlays': this._debugInfo,
				'Screen overlays': this._debugInfo2,
				'Show Clipboard': this._debugShowClipboard,
				'Always active': this._debugAlwaysActive,
				'Typing': this._debugTyper,
				'Tiles device pixel grid': this._tilesDevicePixelGrid,
				'Sidebar Rerendering': this._debugSidebar,
				'Performance Tracing': this._debugTrace,
				'Protocol logging': this._debugLogging,
			};
			L.control.layers({}, overlayMaps, {collapsed: false}).addTo(this._map);

			this._map.on('layeradd', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = true;
				} else if (e.layer === this._debugShowClipboard) {
					this._map._textInput.debug(true);
				} else if (e.layer === this._debugTyper) {
					this._debugTypeTimeout();
				} else if (e.layer === this._debugInfo2) {
					for (var i = 0; i < this._debugDataNames.length; i++) {
						this._debugData[this._debugDataNames[i]].addTo(this._map);
					}
				} else if (e.layer === this._tilesDevicePixelGrid) {
					this._map._docLayer._painter._addTilePixelGridSection();
					this._map._docLayer._painter._sectionContainer.reNewAllSections(true);
				} else if (e.layer === this._debugSidebar) {
					this._map._debugSidebar = true;
				} else if (e.layer === this._debugTrace) {
					app.socket.setTraceEventLogging(true);
				} else if (e.layer === this._debugLogging) {
					window.setLogging(true);
				}
			}, this);
			this._map.on('layerremove', function(e) {
				if (e.layer === this._debugAlwaysActive) {
					this._map._debugAlwaysActive = false;
				} else if (e.layer === this._debugShowClipboard) {
					this._map._textInput.debug(false);
				} else if (e.layer === this._debugTyper) {
					clearTimeout(this._debugTypeTimeoutId);
				} else if (e.layer === this._debugInfo2) {
					for (var i in this._debugData) {
						this._debugData[i].remove();
					}
				} else if (e.layer === this._tilesDevicePixelGrid) {
					this._map._docLayer._painter._sectionContainer.removeSection('tile pixel grid');
					this._map._docLayer._painter._sectionContainer.reNewAllSections(true);
				} else if (e.layer === this._debugSidebar) {
					this._map._debugSidebar = false;
				} else if (e.layer === this._debugTrace) {
					app.socket.setTraceEventLogging(false);
				} else if (e.layer === this._debugLogging) {
					window.setLogging(false);
				}
			}, this);
		}
		this._debugTimePING = this._debugGetTimeArray();
		this._debugPINGQueue = [];
		this._debugTimeKeypress = this._debugGetTimeArray();
		this._debugKeypressQueue = [];
		this._debugLorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
		this._debugLorem += ' ' + this._debugLorem + '\n';
		this._debugLoremPos = 0;

		if (this._map._docLayer._docType === 'spreadsheet') {
			var section = this._map._docLayer._painter._sectionContainer.getSectionWithName('calc grid');
			if (section) {
				section.setDrawingOrder(L.CSections.CalcGrid.drawingOrderDebug);
				section.sectionProperties.strokeStyle = 'blue';
			}
			this._map._docLayer._painter._addSplitsSection();
			this._map._docLayer._painter._sectionContainer.reNewAllSections(true /* redraw */);
		}
	},

	_debugSetPostMessage: function(type,msg) {
		this._debugData['postMessage'].setPrefix(type+': '+ msg);
	},

	_debugSetTimes: function(times, value) {
		if (value < times.best) {
			times.best = value;
		}
		if (value > times.worst) {
			times.worst = value;
		}
		times.ms += value;
		times.count++;
		return 'best: ' + times.best + ' ms, avg: ' + Math.round(times.ms/times.count) + ' ms, worst: ' + times.worst + ' ms, last: ' + value + ' ms';
	},

	_debugAddInvalidationRectangle: function(topLeftTwips, bottomRightTwips, command) {
		var now = +new Date();

		var invalidBoundCoords = new L.LatLngBounds(this._twipsToLatLng(topLeftTwips, this._tileZoom),
			this._twipsToLatLng(bottomRightTwips, this._tileZoom));
		var rect = L.rectangle(invalidBoundCoords, {color: 'red', weight: 1, opacity: 1, fillOpacity: 0.4, pointerEvents: 'none'});
		this._debugInvalidBounds[this._debugId] = rect;
		this._debugInvalidBoundsMessage[this._debugId] = command;
		this._debugId++;
		this._debugInfo.addLayer(rect);

		var oldestKeypress = this._debugKeypressQueue.shift();
		if (oldestKeypress) {
			var timeText = this._debugSetTimes(this._debugTimeKeypress, now - oldestKeypress);
			this._debugData['fromKeyInputToInvalidate'].setPrefix('Elapsed time between key input and next invalidate: ' + timeText);
		}

		// query server ping time after invalidation messages
		// pings will be paired with the pong messages
		this._debugPINGQueue.push(+new Date());
		app.socket.sendMessage('ping');
	},

	_debugAddInvalidationData: function(tile) {
		if (tile._debugTile) {
			tile._debugTile.setStyle({fillOpacity: 0.5, fillColor: 'blue'});
			tile._debugTime.date = +new Date();
			tile._debugTile.date = +new Date();
			tile._debugInvalidateCount++;
			this._debugInvalidateCount++;
		}
	},

	_debugAddInvalidationMessage: function(message) {
		this._debugInvalidBoundsMessage[this._debugId - 1] = message;
		var messages = '';
		for (var i = this._debugId - 1; i > this._debugId - 6; i--) {
			if (i >= 0 && this._debugInvalidBoundsMessage[i]) {
				messages += '' + i + ': ' + this._debugInvalidBoundsMessage[i] + ' <br>';
			}
		}
		this._debugData['tileCombine'].setPrefix(messages);
		this._debugShowTileData();
	},

	_debugTimeout: function() {
		if (this._debug) {
			for (var key in this._debugInvalidBounds) {
				var rect = this._debugInvalidBounds[key];
				var opac = rect.options.fillOpacity;
				if (opac <= 0.04) {
					if (key < this._debugId - 5) {
						this._debugInfo.removeLayer(rect);
						delete this._debugInvalidBounds[key];
						delete this._debugInvalidBoundsMessage[key];
					} else {
						rect.setStyle({fillOpacity: 0, opacity: 1 - (this._debugId - key) / 7});
					}
				} else {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			for (key in this._debugTiles) {
				rect = this._debugTiles[key];
				var col = rect.options.fillColor;
				opac = rect.options.fillOpacity;
				if (col === 'blue' && opac >= 0.04 && rect.date + 1000 < +new Date()) {
					rect.setStyle({fillOpacity: opac - 0.04});
				}
			}
			this._debugTimeoutId = setTimeout(L.bind(this._debugTimeout, this), 50);
		}
	},

	_debugTypeTimeout: function() {
		var letter = this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length);
		this._debugKeypressQueue.push(+new Date());
		if (letter === '\n'.charCodeAt(0)) {
			this.postKeyboardEvent('input', 0, 1280);
		} else {
			this.postKeyboardEvent('input', this._debugLorem.charCodeAt(this._debugLoremPos % this._debugLorem.length), 0);
		}
		this._debugLoremPos++;
		this._debugTypeTimeoutId = setTimeout(L.bind(this._debugTypeTimeout, this), 50);
	},

	/// onlyThread - takes annotation indicating which thread will be generated
	getCommentWizardStructure: function(menuStructure, onlyThread) {
		var customTitleBar = L.DomUtil.create('div');
		L.DomUtil.addClass(customTitleBar, 'mobile-wizard-titlebar-btn-container');
		var title = L.DomUtil.create('span', '', customTitleBar);
		title.innerText = _('Comment');
		var button = L.DomUtil.createWithId('button', 'insert_comment', customTitleBar);
		L.DomUtil.addClass(button, 'mobile-wizard-titlebar-btn');
		button.innerText = '+';
		button.onclick = this._map.insertComment.bind(this._map);

		if (menuStructure === undefined) {
			menuStructure = {
				id : 'comment',
				type : 'mainmenu',
				enabled : true,
				text : _('Comment'),
				executionType : 'menu',
				data : [],
				children : []
			};

			if (this._map.isPermissionEditForComments())
				menuStructure['customTitle'] = customTitleBar;
		}

		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).createCommentStructure(menuStructure, onlyThread);

		if (menuStructure.children.length === 0) {
			var noComments = {
				id: 'emptyWizard',
				enable: true,
				type: 'emptyCommentWizard',
				text: _('No Comments'),
				children: []
			};
			menuStructure['children'].push(noComments);
		}
		return menuStructure;
	},

	_openCommentWizard: function(annotation) {
		window.commentWizard = true;
		var menuData = this._map._docLayer.getCommentWizardStructure();
		this._map.fire('mobilewizard', {data: menuData});

		// if annotation is provided we can select perticular comment
		if (annotation) {
			$('#comment' + annotation.sectionProperties.data.id).click();
		}
	},

	_saveMessageForReplay: function (textMsg, viewId) {
		// We will not get some messages (with coordinates)
		// from core when zoom changes because print-twips coordinates are zoom-invariant. So we need to
		// remember the last version of them and replay, when zoom is changed.
		// In calc we need to replay the messages when sheet-geometry changes too. This is because it is possible for
		// the updated print-twips messages to arrive before the sheet-geometry update message arrives.

		if (!this._printTwipsMessagesForReplay) {
			var ownViewTypes = this.isCalc() ? [
				'cellcursor',
				'referencemarks',
				'cellselectionarea',
				'textselection',
				'invalidatecursor',
				'textselectionstart',
				'textselectionend',
				'graphicselection',
			] : [
				'invalidatecursor',
				'textselection',
				'graphicselection'
			];

			if (this.isWriter())
				ownViewTypes.push('contentcontrol');

			var otherViewTypes = this.isCalc() ? [
				'cellviewcursor',
				'textviewselection',
				'invalidateviewcursor',
				'graphicviewselection',
			] : [
				'textviewselection',
				'invalidateviewcursor'
			];

			this._printTwipsMessagesForReplay = new L.MessageStore(ownViewTypes, otherViewTypes);
		}

		var colonIndex = textMsg.indexOf(':');
		if (colonIndex === -1) {
			return;
		}

		var msgType = textMsg.substring(0, colonIndex);
		this._printTwipsMessagesForReplay.save(msgType, textMsg, viewId);
	},

	_clearMsgReplayStore: function () {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.clear();
	},

	_replayPrintTwipsMsgs: function () {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.forEach(this._onMessage.bind(this));
	},

	_replayPrintTwipsMsg: function (msgType) {
		var msg = this._printTwipsMessagesForReplay.get(msgType);
		this._onMessage(msg);
	},

	_replayPrintTwipsMsgAllViews: function (msgType) {
		Object.keys(this._cellViewCursors).forEach(function (viewId) {
			var msg = this._printTwipsMessagesForReplay.get(msgType, parseInt(viewId));
			if (msg)
				this._onMessage(msg);
		}.bind(this));
	},

	_syncTilePanePos: function () {
		var tilePane = this._container.parentElement;
		if (tilePane) {
			var mapPanePos = this._map._getMapPanePos();
			L.DomUtil.setPosition(tilePane, new L.Point(-mapPanePos.x , -mapPanePos.y));
			var documentBounds = this._map.getPixelBoundsCore();
			var documentPos = documentBounds.min;
			var documentEndPos = documentBounds.max;
			this._painter._sectionContainer.setDocumentBounds([documentPos.x, documentPos.y, documentEndPos.x, documentEndPos.y]);
		}
	},

	pauseDrawing: function () {
		if (this._painter && this._painter._sectionContainer)
			this._painter._sectionContainer.pauseDrawing();
	},

	resumeDrawing: function (topLevel) {
		if (this._painter && this._painter._sectionContainer)
			this._painter._sectionContainer.resumeDrawing(topLevel);
	},

	enableDrawing: function () {
		if (this._painter && this._painter._sectionContainer)
			this._painter._sectionContainer.enableDrawing();
	},

	_getUIWidth: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
		if (section) {
			return Math.round(section.size[0] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getUIHeight: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
		if (section) {
			return Math.round(section.size[1] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupWidth: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
		if (section) {
			return Math.round(section.size[0] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupHeight: function () {
		var section = this._painter._sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
		if (section) {
			return Math.round(section.size[1] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getTilesSectionRectangle: function () {
		var section = app.sectionContainer.getSectionWithName(L.CSections.Tiles.name);
		if (section) {
			return L.LOUtil.createRectangle(section.myTopLeft[0] / app.dpiScale, section.myTopLeft[1] / app.dpiScale, section.size[0] / app.dpiScale, section.size[1] / app.dpiScale);
		}
		else {
			return L.LOUtil.createRectangle(0, 0, 0, 0);
		}
	},

	_getRealMapSize: function() {
		this._map._sizeChanged = true; // force using real size
		return this._map.getPixelBounds().getSize();
	},

	_syncTileContainerSize: function () {
		if (this._docType === 'presentation' || this._docType === 'drawing') {
			this.onResizeImpress();
		}

		var tileContainer = this._container;
		if (tileContainer) {
			var documentContainerSize = document.getElementById('document-container');
			documentContainerSize = documentContainerSize.getBoundingClientRect();
			documentContainerSize = [documentContainerSize.width, documentContainerSize.height];

			this._painter._sectionContainer.onResize(documentContainerSize[0], documentContainerSize[1]); // Canvas's size = documentContainer's size.

			var oldSize = this._getRealMapSize();

			var rectangle = this._getTilesSectionRectangle();
			var mapElement = document.getElementById('map'); // map's size = tiles section's size.
			mapElement.style.left = rectangle.getPxX1() + 'px';
			mapElement.style.top = rectangle.getPxY1() + 'px';
			mapElement.style.width = rectangle.getPxWidth() + 'px';
			mapElement.style.height = rectangle.getPxHeight() + 'px';

			tileContainer.style.width = rectangle.getPxWidth() + 'px';
			tileContainer.style.height = rectangle.getPxHeight() + 'px';

			var newSize = this._getRealMapSize();
			var heightIncreased = oldSize.y < newSize.y;
			var widthIncreased = oldSize.x < newSize.x;

			if (this._docType === 'spreadsheet') {
				if (this._painter._sectionContainer.doesSectionExist(L.CSections.RowHeader.name)) {
					this._painter._sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
					this._painter._sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
				}
			}

			if (oldSize.x !== newSize.x || oldSize.y !== newSize.y) {
				this._map.invalidateSize();
			}

			var hasMobileWizardOpened = this._map.uiManager.mobileWizard ? this._map.uiManager.mobileWizard.isOpen() : false;
			var hasIframeModalOpened = $('.iframe-dialog-modal').is(':visible');
			if (window.mode.isMobile() && !hasMobileWizardOpened && !hasIframeModalOpened) {
				if (heightIncreased) {
					// if the keyboard is hidden - be sure we setup correct state in TextInput
					this._map.setAcceptInput(false);
				} else
					this._onUpdateCursor(true);
			}

			this._fitWidthZoom();

			// Center the view w.r.t the new map-pane position using the current zoom.
			this._map.setView(this._map.getCenter());

			// We want to keep cursor visible when we show the keyboard on mobile device or tablet
			var isTabletOrMobile = window.mode.isMobile() || window.mode.isTablet();
			var hasVisibleCursor = this._map._docLayer._visibleCursor
				&& this._map._docLayer._cursorMarker && this._map._docLayer._cursorMarker.isDomAttached();
			if (!heightIncreased && isTabletOrMobile && this._map._docLoaded && hasVisibleCursor) {
				var cursorPos = this._map._docLayer._visibleCursor.getSouthWest();
				var centerOffset = this._map._getCenterOffset(cursorPos);
				var viewHalf = this._map.getSize()._divideBy(2);
				var cursorPositionInView =
					centerOffset.x > -viewHalf.x && centerOffset.x < viewHalf.x &&
					centerOffset.y > -viewHalf.y && centerOffset.y < viewHalf.y;
				if (!cursorPositionInView)
					this._map.panTo(cursorPos);
			}

			if (heightIncreased || widthIncreased) {
				this._painter._sectionContainer.requestReDraw();
				this._map.fire('sizeincreased');
			}
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

	setZoomChanged: function (zoomChanged) {
		this._painter._sectionContainer.setZoomChanged(zoomChanged);
	},

	onAdd: function (map) {
		this._tileWidthPx = this.options.tileSize;
		this._tileHeightPx = this.options.tileSize;

		this._initContainer();
		this._getToolbarCommandsValues();
		this._textCSelections = new CSelections(undefined, this._canvasOverlay,
			this._selectionsDataDiv, this._map, false /* isView */, undefined, 'text');
		this._cellCSelections = new CSelections(undefined, this._canvasOverlay,
			this._selectionsDataDiv, this._map, false /* isView */, undefined, 'cell');
		this._oleCSelections = new CSelections(undefined, this._canvasOverlay,
			this._selectionsDataDiv, this._map, false /* isView */, undefined, 'ole');
		this._references = new CReferences(this._canvasOverlay);
		this._referencesAll = [];

		// This layergroup contains all the layers corresponding to other's view
		this._viewLayerGroup = new L.LayerGroup();
		if (app.file.permission !== 'readonly') {
			map.addLayer(this._viewLayerGroup);
		}

		this._debug = map.options.debug;
		if (this._debug) {
			this._debugInit();
		}

		this._searchResultsLayer = new L.LayerGroup();
		map.addLayer(this._searchResultsLayer);

		this._levels = {};
		this._tiles = {};
		this._tileCache = {};

		app.socket.sendMessage('commandvalues command=.uno:AcceptTrackedChanges');

		map._fadeAnimated = false;
		this._viewReset();
		map.on('drag resize zoomend', this._updateScrollOffset, this);

		map.on('dragover', this._onDragOver, this);
		map.on('drop', this._onDrop, this);

		map.on('zoomstart', this._onZoomStart, this);
		map.on('zoomend', this._onZoomEnd, this);
		if (this._docType === 'spreadsheet') {
			map.on('zoomend', this._onCellCursorShift, this);
		}
		map.on('zoomend', L.bind(this.eachView, this, this._viewCursors, this._onUpdateViewCursor, this, false));
		map.on('dragstart', this._onDragStart, this);
		map.on('requestloksession', this._onRequestLOKSession, this);
		map.on('error', this._mapOnError, this);
		if (map.options.autoFitWidth !== false) {
			// always true since autoFitWidth is never set
			map.on('resize', this._fitWidthZoom, this);
		}
		// Retrieve the initial cell cursor position (as LOK only sends us an
		// updated cell cursor when the selected cell is changed and not the initial
		// cell).
		map.on('statusindicator',
			function (e) {
				if (e.statusType === 'alltilesloaded' && this._docType === 'spreadsheet') {
					if (!isAnyVexDialogActive())
						this._onCellCursorShift(true);
				}
			},
			this);

		map.on('updatepermission', function(e) {
			if (e.perm !== 'edit') {
				this._clearSelections();
			}
		}, this);

		for (var key in this._selectionHandles) {
			this._selectionHandles[key].on('drag dragend', this._onSelectionHandleDrag, this);
		}

		this._cellResizeMarkerStart.on('dragstart drag dragend', this._onCellResizeMarkerDrag, this);
		this._cellResizeMarkerEnd.on('dragstart drag dragend', this._onCellResizeMarkerDrag, this);
		this._referenceMarkerStart.on('dragstart drag dragend', this._onReferenceMarkerDrag, this);
		this._referenceMarkerEnd.on('dragstart drag dragend', this._onReferenceMarkerDrag, this);
		this._dropDownButton.on('click', this._onDropDownButtonClick, this);
		// The 'tap' events are not broadcasted by L.Map.TouchGesture, A specialized 'dropdownmarkertapped' event is
		// generated just for the validity-dropdown-icon.
		map.on('dropdownmarkertapped', this._onDropDownButtonClick, this);

		map.setPermission(app.file.permission);

		map.fire('statusindicator', {statusType: 'coolloaded'});

		this._map.sendInitUNOCommands();

		this._resetClientVisArea();
		this._requestNewTiles();

		map.setZoom();
	},

	onRemove: function (map) {
		this._painter.dispose();

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

		if (!this._oleCSelections.empty()) {
			this._oleCSelections.clear();
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

	zoomStepEnd: function (zoom, newCenter, mapUpdater, runAtFinish, noGap) {
		this._painter.zoomStepEnd(zoom, newCenter, mapUpdater, runAtFinish, noGap);
	},

	preZoomAnimation: function () {
		if (this.isCursorVisible()) {
			this._cursorMarker.setOpacity(0);
		}
		if (this._map._textInput._cursorHandler) {
			this._map._textInput._cursorHandler.setOpacity(0);
		}
		if (this._cellCursorMarker) {
			this._map.setOverlaysOpacity(0);
			this._map.setMarkersOpacity(0);
		}
		if (this._selectionHandles['start']) {
			this._selectionHandles['start'].setOpacity(0);
		}
		if (this._selectionHandles['end']) {
			this._selectionHandles['end'].setOpacity(0);
		}
		this.eachView(this._viewCursors, function (item) {
			var viewCursorMarker = item.marker;
			if (viewCursorMarker) {
				viewCursorMarker.setOpacity(0);
			}
		}, this, true);
	},

	postZoomAnimation: function () {
		if (this.isCursorVisible()) {
			this._cursorMarker.setOpacity(1);
		}
		if (this._map._textInput._cursorHandler) {
			this._map._textInput._cursorHandler.setOpacity(1);
		}
		if (this._cellCursorMarker) {
			this._map.setOverlaysOpacity(1);
			this._map.setMarkersOpacity(1);
		}
		if (this._selectionHandles['start']) {
			this._selectionHandles['start'].setOpacity(1);
		}
		if (this._selectionHandles['end']) {
			this._selectionHandles['end'].setOpacity(1);
		}

		if (this._annotations) {
			var annotations = this._annotations;
			if (annotations.update)
				setTimeout(function() {
					annotations.update();
				}, 250 /* ms */);
		}
	},

	// Meant for desktop case, where the ending zoom and centers are all known in advance.
	runZoomAnimation: function (zoomEnd, pinchCenter, mapUpdater, runAtFinish) {

		this.preZoomAnimation();
		this.zoomStep(this._map.getZoom(), pinchCenter);
		var thisObj = this;
		this.zoomStepEnd(zoomEnd, pinchCenter,
			mapUpdater,
			// runAtFinish
			function () {
				thisObj.postZoomAnimation();
				runAtFinish();
			});
	},

	_viewReset: function (e) {
		this._reset(this._map.getCenter(), this._map.getZoom(), e && e.hard);
		if (this._docType === 'spreadsheet' && this._annotations !== 'undefined') {
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		}

		this._painter._viewReset();
	},

	_removeSplitters: function () {
		if (this._xSplitter) {
			this._canvasOverlay.removePath(this._xSplitter);
			this._xSplitter = undefined;
		}

		if (this._ySplitter) {
			this._canvasOverlay.removePath(this._ySplitter);
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
		if (app.file.fileBasedView)
			this._updateFileBasedView(true);

		var key, tile;

		for (key in this._tiles) {
			tile = this._tiles[key];
			tile.retain = tile.current;
		}

		for (key in this._tiles) {
			tile = this._tiles[key];
			if (tile.current && !tile.active) {
				var coords = tile.coords;
				if (!this._retainParent(coords.x, coords.y, coords.z, coords.part, coords.mode, coords.z - 5)) {
					this._retainChildren(coords.x, coords.y, coords.z, coords.part, coords.mode, coords.z + 2);
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
			coords.part,
			coords.mode);
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
		return corePixels.divideBy(app.dpiScale);
	},

	_cssPixelsToCore: function (cssPixels) {
		return cssPixels.multiplyBy(app.dpiScale);
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
			(twips.x / this._tileWidthTwips) * (this._tileSize / app.dpiScale),
			(twips.y / this._tileHeightTwips) * (this._tileSize / app.dpiScale));
	},

	_cssPixelsToTwips: function (pixels) {
		return new L.Point(
			((pixels.x * app.dpiScale) / this._tileSize) * this._tileWidthTwips,
			((pixels.y * app.dpiScale) / this._tileSize) * this._tileHeightTwips);
	},

	_twipsToLatLng: function (twips, zoom) {
		var pixels = this._twipsToCssPixels(twips);
		return this._map.unproject(pixels, zoom);
	},

	_latLngToTwips: function (latLng, zoom) {
		var pixels = this._map.project(latLng, zoom);
		return this._cssPixelsToTwips(pixels);
	},

	_latLngToCorePixels: function(latLng, zoom) {
		var pixels = this._map.project(latLng, zoom);
		return new L.Point (
			pixels.x * app.dpiScale,
			pixels.y * app.dpiScale);
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
		else if ((coords.x / this._tileSize) * this._tileWidthTwips > this._docWidthTwips ||
			(coords.y / this._tileSize) * this._tileHeightTwips > this._docHeightTwips) {
			return false;
		}
		else
			return true;
	},

	_updateMaxBounds: function (sizeChanged) {
		if (this._docWidthTwips === undefined || this._docHeightTwips === undefined) {
			return;
		}

		var docPixelLimits = new L.Point(app.file.size.pixels[0] / app.dpiScale, app.file.size.pixels[1] / app.dpiScale);
		var scrollPixelLimits = new L.Point(app.view.size.pixels[0] / app.dpiScale, app.view.size.pixels[1] / app.dpiScale);
		var topLeft = this._map.unproject(new L.Point(0, 0));

		if (this._documentInfo === '' || sizeChanged) {
			// we just got the first status so we need to center the document
			this._map.setDocBounds(new L.LatLngBounds(topLeft, this._map.unproject(docPixelLimits)));
			this._map.setMaxBounds(new L.LatLngBounds(topLeft, this._map.unproject(scrollPixelLimits)));
		}

		this._docPixelSize = {x: docPixelLimits.x, y: docPixelLimits.y};
		this._map.fire('scrolllimits', {x: scrollPixelLimits.x, y: scrollPixelLimits.y});
	},

	// Used with filebasedview.
	_getMostVisiblePart: function (queue) {
		var parts = [];
		var found = false;

		for (var i = 0; i < queue.length; i++) {
			for (var j = 0; j < parts.length; j++) {
				if (parts[j].part === queue[i].part) {
					found = true;
					break;
				}
			}
			if (!found)
				parts.push({part: queue[i].part});
			found = false;
		}

		var ratio = this._tileSize / this._tileHeightTwips;
		var partHeightPixels = Math.round((this._partHeightTwips + this._spaceBetweenParts) * ratio);
		var partWidthPixels = Math.round(this._partWidthTwips * ratio);

		var rectangle;
		var maxArea = -1;
		var mostVisiblePart = 0;
		var docBoundsRectangle = app.sectionContainer.getDocumentBounds();
		docBoundsRectangle[2] = docBoundsRectangle[2] - docBoundsRectangle[0];
		docBoundsRectangle[3] = docBoundsRectangle[3] - docBoundsRectangle[1];
		for (i = 0; i < parts.length; i++) {
			rectangle = [0, partHeightPixels * parts[i].part, partWidthPixels, partHeightPixels];
			rectangle = L.LOUtil._getIntersectionRectangle(rectangle, docBoundsRectangle);
			if (rectangle) {
				if (rectangle[2] * rectangle[3] > maxArea) {
					maxArea = rectangle[2] * rectangle[3];
					mostVisiblePart = parts[i].part;
				}
			}
		}
		return mostVisiblePart;
	},

	// TODO: unused method?
	_doesQueueIncludeTileInfo: function (queue, part, mode, x, y) {
		for (var i = 0; i < queue.length; i++) {
			if (queue[i].part === part && queue[i].mode === mode &&
				queue[i].x === x && queue[i].y === y)
				return true;
		}
		return false;
	},

	_sortFileBasedQueue: function (queue) {
		for (var i = 0; i < queue.length - 1; i++) {
			for (var j = i + 1; j < queue.length; j++) {
				var a = queue[i];
				var b = queue[j];
				var switchTiles = false;

				if (a.part === b.part) {
					if (a.y > b.y) {
						switchTiles = true;
					}
					else if (a.y === b.y) {
						switchTiles = a.x > b.x;
					}
					else {
						switchTiles = false;
					}
				}
				else {
					switchTiles = a.part > b.part;
				}

				if (switchTiles) {
					var temp = a;
					queue[i] = b;
					queue[j] = temp;
				}
			}
		}
	},

	highlightCurrentPart: function (part) {
		var previews = document.getElementsByClassName('preview-frame');
		for (var i = 0; i < previews.length; i++) {
			if (parseInt(previews[i].id.replace('preview-frame-part-', '')) === part) {
				previews[i].style.border = '2px solid darkgrey';
			}
			else {
				previews[i].style.border = 'none';
			}
		}
	},

	// Used with file based view. Check the most visible part and set the selected part if needed.
	_checkSelectedPart: function () {
		var queue = this._updateFileBasedView(true);
		if (queue.length > 0) {
			var partToSelect = this._getMostVisiblePart(queue);
			if (this._selectedPart !== partToSelect) {
				this._selectedPart = partToSelect;
				this._preview._scrollToPart();
				this.highlightCurrentPart(partToSelect);
				app.socket.sendMessage('setclientpart part=' + this._selectedPart);
			}
		}
	},

	_updateFileBasedView: function (checkOnly, zoomFrameBounds, forZoom) {
		if (this._partHeightTwips === 0) // This is true before status message is handled.
			return [];
		if (this._isZooming)
			return [];

		if (!checkOnly) {
			// zoomFrameBounds and forZoom params were introduced to work only in checkOnly mode.
			window.app.console.assert(zoomFrameBounds === undefined, 'zoomFrameBounds must only be supplied when checkOnly is true');
			window.app.console.assert(forZoom === undefined, 'forZoom must only be supplied when checkOnly is true');
		}

		if (forZoom !== undefined) {
			window.app.console.assert(zoomFrameBounds, 'zoomFrameBounds must be valid when forZoom is specified');
		}

		var zoom = forZoom || Math.round(this._map.getZoom());
		var currZoom = Math.round(this._map.getZoom());
		var relScale = currZoom == zoom ? 1 : this._map.getZoomScale(zoom, currZoom);

		var ratio = this._tileSize * relScale / this._tileHeightTwips;
		var partHeightPixels = Math.round((this._partHeightTwips + this._spaceBetweenParts) * ratio);
		var partWidthPixels = Math.round((this._partWidthTwips) * ratio);
		var mode = 0; // mode is different only in Impress MasterPage mode so far

		var intersectionAreaRectangle = L.LOUtil._getIntersectionRectangle(app.file.viewedRectangle, [0, 0, partWidthPixels, partHeightPixels * this._parts]);

		var queue = [];

		if (intersectionAreaRectangle) {
			var minLocalX = Math.floor(intersectionAreaRectangle[0] / app.tile.size.pixels[0]) * app.tile.size.pixels[0];
			var maxLocalX = Math.floor((intersectionAreaRectangle[0] + intersectionAreaRectangle[2]) / app.tile.size.pixels[0]) * app.tile.size.pixels[0];

			var startPart = Math.floor(intersectionAreaRectangle[1] / partHeightPixels);
			var startY = app.file.viewedRectangle[1] - startPart * partHeightPixels;
			startY = Math.floor(startY / app.tile.size.pixels[1]) * app.tile.size.pixels[1];

			var endPart = Math.ceil((intersectionAreaRectangle[1] + intersectionAreaRectangle[3]) / partHeightPixels);
			var endY = app.file.viewedRectangle[1] + app.file.viewedRectangle[3] - endPart * partHeightPixels;
			endY = Math.floor(endY / app.tile.size.pixels[1]) * app.tile.size.pixels[1];

			var vTileCountPerPart = Math.ceil(partHeightPixels / app.tile.size.pixels[1]);

			for (var i = startPart; i < endPart; i++) {
				for (var j = minLocalX; j <= maxLocalX; j += app.tile.size.pixels[0]) {
					for (var k = 0; k <= vTileCountPerPart * app.tile.size.pixels[0]; k += app.tile.size.pixels[1])
						if ((i !== startPart || k >= startY) && (i !== endPart || k <= endY))
							queue.push(new L.TileCoordData(j, k, zoom, i, mode));
				}
			}

			this._sortFileBasedQueue(queue);

			for (i = 0; i < this._tiles.length; i++) {
				this._tiles[i].current = false; // Visible ones's "current" property will be set to true below.
			}

			var allNewTiles = true;
			for (i = 0; i < queue.length; i++) {
				var tempTile = this._tiles[this._tileCoordsToKey(queue[i])];
				if (tempTile && tempTile.loaded) {
					tempTile.current = true;
					allNewTiles = false;
				}
			}

			if (allNewTiles && !checkOnly)
				this._cancelTiles();
		}

		if (checkOnly) {
			return queue;
		}
		else {
			this._sendClientVisibleArea();
			this._sendClientZoom();

			for (var i = 0; i < queue.length; i++) {
				var key = this._tileCoordsToKey(queue[i]);
				var tile = this._tiles[key];
				if (!tile) {
					tile = this.createTile(this._wrapCoords(queue[i]), L.bind(this._tileReady, this, queue[i]));

					// save tile in cache
					this._tiles[key] = {
						el: tile,
						wid: 0,
						coords: queue[i],
						current: true
					};

					if (tile && this._tileCache[key]) {
						tile.el = this._tileCache[key];
					}
					else {
						this._sendTileCombineRequest(queue[i].part, queue[i].mode, (queue[i].x / this._tileSize) * this._tileWidthTwips, (queue[i].y / this._tileSize) * this._tileHeightTwips);
					}
				}
				else if (!tile.loaded) {
					this._sendTileCombineRequest(queue[i].part, queue[i].mode, (queue[i].x / this._tileSize) * this._tileWidthTwips, (queue[i].y / this._tileSize) * this._tileHeightTwips);
				}
			}
		}
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '') {
			return;
		}

		// Calc: do not set view area too early after load and before we get the cursor position.
		if (this.isCalc() && !this._gotFirstCellCursor)
			return;

		// be sure canvas is initialized already and has correct size
		var size = map.getSize();
		if (size.x === 0 || size.y === 0) {
			setTimeout(function () { this._update(); }.bind(this), 1);
			return;
		}

		if (app.file.fileBasedView) {
			this._updateFileBasedView();
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
				thiscoords.part !== this._selectedPart ||
				thiscoords.mode !== this._selectedMode) {
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
						this._selectedPart,
						this._selectedMode);

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

		if (this._masterPageChanged) {
			// avoid cancelling tiles on masterpage view switches
			// it will be cancelled updateOnPartChange when necessary
			this._masterPageChanged = false;
			cancelTiles = false;
		}

		if (queue.length !== 0) {
			if (cancelTiles) {
				// we know that a new set of tiles (that completely cover one/more panes) has been requested
				// so we're able to cancel the previous requests that are being processed
				this._cancelTiles();
			}

			this._addTiles(queue);
		}
	},

	_sendClientVisibleArea: function (forceUpdate) {
		if (!this._map._docLoaded)
			return;

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
			app.socket.sendMessage(newClientVisibleArea);
			if (!this._map._fatal && app.idleHandler._active && app.socket.connected())
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
				thiscoords.part !== this._selectedPart ||
				thiscoords.mode !== this._selectedMode) {
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
						this._selectedPart,
						this._selectedMode);

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

			var tilePositionsX = '';
			var tilePositionsY = '';
			var added = {};

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				key = this._tileCoordsToKey(coords);
				tile = undefined;
				if (coords.part === this._selectedPart && coords.mode === this._selectedMode) {
					var tileImg = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tileImg), 0);
					}

					// save tile in cache
					this._tiles[key] = tile = {
						el: tileImg,
						coords: coords,
						current: true
					};
				}

				if (!this._tileCache[key]) {
					// request each tile just once in these tilecombines
					if (added[key])
						continue;
					added[key] = true;

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
				else if (tile) {
					tile.el = this._tileCache[key];
					tile.loaded = true;
				}
			}

			if (tilePositionsX !== '' && tilePositionsY !== '') {
				this._sendTileCombineRequest(this._selectedPart, this._selectedMode, tilePositionsX, tilePositionsY);
			}
			else {
				// We have all necessary tile images in the cache, schedule a paint..
				// This may not be immediate if we are now in a slurp events call.
				this._painter.update();
			}
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

		// Don't paint the tile, only dirty the sectionsContainer if it is in the visible area.
		// _emitSlurpedTileEvents() will repaint canvas (if it is dirty).
		if (this._painter.coordsIntersectVisible(coords)) {
			this._painter._sectionContainer.setDirty();
		}

		if (this._noTilesToLoad()) {
			this.fire('load');
			this._pruneTiles();
		}
	},

	_addTiles: function (coordsQueue) {
		var coords, key, tile;
		// first take care of the DOM
		for (var i = 0; i < coordsQueue.length; i++) {
			coords = coordsQueue[i];

			key = this._tileCoordsToKey(coords);

			if (coords.part === this._selectedPart && coords.mode === this._selectedMode) {
				if (!this._tiles[key]) {
					var tileImg = this.createTile(this._wrapCoords(coords), L.bind(this._tileReady, this, coords));

					// if createTile is defined with a second argument ("done" callback),
					// we know that tile is async and will be ready later; otherwise
					if (this.createTile.length < 2) {
						// mark tile as ready, but delay one frame for opacity animation to happen
						setTimeout(L.bind(this._tileReady, this, coords, null, tileImg), 0);
					}

					// save tile in cache
					this._tiles[key] = tile = {
						el: tileImg,
						wid: 0,
						coords: coords,
						current: true
					};

					if (tile && this._tileCache[key]) {
						tile.el = this._tileCache[key];
						tile.loaded = true;
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
			if (this._tileCache[key]
				|| coords.part !== this._selectedPart
				|| coords.mode !== this._selectedMode) {
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

		var twips;
		var added = {};
		for (var r = 0; r < rectangles.length; ++r) {
			rectQueue = rectangles[r];
			var tilePositionsX = '';
			var tilePositionsY = '';
			var tileWids = '';
			for (i = 0; i < rectQueue.length; i++) {
				coords = rectQueue[i];
				key = this._tileCoordsToKey(coords);

				// request each tile just once in these tilecombines
				if (added[key])
					continue;
				added[key] = true;

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
			this._sendTileCombineRequest(coords.part, this._selectedMode, tilePositionsX, tilePositionsY);
		}
	},

	_cancelTiles: function () {
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
			if (coords.part === this._selectedPart && coords.mode === this._selectedMode) {

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
			typeof msgObj.part !== 'number' ||
			(typeof msgObj.mode !== 'number' && typeof msgObj.mode !== 'undefined')) {
			window.app.console.error('Unexpected content in the parsed tile message.');
		}
	},

	_tileMsgToCoords: function (tileMsg) {
		var coords = this._twipsToCoords(tileMsg);
		coords.z = tileMsg.zoom;
		coords.part = tileMsg.part;
		coords.mode = tileMsg.mode;
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
		if (!(this._tiles[key]._invalidCount > 0) && tile.el.src) {
			this._tileCache[key] = tile.el;
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

	_applyDelta: function(tile, rawDelta, isKeyframe) {
		if (this._debugDeltas)
			window.app.console.log('Applying a raw ' + (isKeyframe ? 'keyframe' : 'delta') +
					       ' of length ' + rawDelta.length + ' hex: ' + hex2string(rawDelta));

		if (rawDelta.length === 0)
			return; // that was easy!

		var traceEvent = app.socket.createCompleteTraceEvent('L.CanvasTileLayer.applyDelta',
								     { keyFrame: isKeyframe, length: rawDelta.length });

		// 'Uint8Array' delta
		var canvas;
		var initCanvas = false;
		if (tile.el && (tile.el instanceof HTMLCanvasElement))
			canvas = tile.el;
		else
		{
			canvas = document.createElement('canvas');
			canvas.width = window.tileSize;
			canvas.height = window.tileSize;
			initCanvas = true;
		}
		tile.el = canvas;
		tile.lastKeyframe = isKeyframe;

		// apply potentially several deltas in turn.
		var i = 0;
		var offset = 0;

		// FIXME:used clamped array ... as a 2nd parameter
		var allDeltas = window.fzstd.decompress(rawDelta);

		var imgData;
		var ctx = canvas.getContext('2d');

		while (offset < allDeltas.length)
		{
			if (this._debugDeltas)
				window.app.console.log('Next delta at ' + offset + ' length ' + (allDeltas.length - offset));
			var delta = allDeltas.subarray(offset);

			// Debugging paranoia: if we get this wrong bad things happen.
			if ((isKeyframe && delta.length != canvas.width * canvas.height * 4) ||
			    (!isKeyframe && delta.length == canvas.width * canvas.height * 4))
			{
				window.app.console.log('Unusual ' + (isKeyframe ? 'keyframe' : 'delta') +
						       ' possibly mis-tagged, suspicious size vs. type ' +
						       delta.length + ' vs. ' + (canvas.width * canvas.height * 4));
			}

			var len;
			if (isKeyframe)
			{
				// FIXME: use zstd to de-compress directly into a Uint8ClampedArray
				len = canvas.width * canvas.height * 4;
				var pixelArray = new Uint8ClampedArray(delta.subarray(0, len));
				imgData = new ImageData(pixelArray, canvas.width, canvas.height);

				if (this._debugDeltas)
					window.app.console.log('Applied keyframe ' + i++ + ' of total size ' + delta.length +
							       ' at stream offset ' + offset + ' size ' + len);
			}
			else
			{
				if (initCanvas && tile.el) // render old image data to the canvas
					ctx.drawImage(tile.el, 0, 0);

				if (!imgData) // no keyframe
				{
					if (this._debugDeltas)
						window.app.console.log('Fetch canvas contents');
					imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				}

				// copy old data to work from:
				var oldData = new Uint8ClampedArray(imgData.data);

				len = this._applyDeltaChunk(imgData, delta, oldData, canvas.width, canvas.height);
				if (this._debugDeltas)
					window.app.console.log('Applied chunk ' + i++ + ' of total size ' + delta.length +
							       ' at stream offset ' + offset + ' size ' + len);
			}

			initCanvas = false;
			isKeyframe = false;
			offset += len;
		}

	        if (imgData)
			ctx.putImageData(imgData, 0, 0);

		if (traceEvent)
			traceEvent.finish();
	},

	_applyDeltaChunk: function(imgData, delta, oldData, width, height) {
		var pixSize = width * height * 4;
		if (this._debugDeltas)
			window.app.console.log('Applying a delta of length ' +
					       delta.length + ' canvas size: ' + pixSize);
			// + ' hex: ' + hex2string(delta));

		var offset = 0;

		// Green-tinge the old-Data ...
		if (0)
		{
			for (var i = 0; i < pixSize; ++i)
				oldData[i*4 + 1] = 128;
		}

		// wipe to grey.
		if (0)
		{
			for (var i = 0; i < pixSize * 4; ++i)
				imgData.data[i] = 128;
		}

		// Apply delta.
		var stop = false;
		for (var i = 0; i < delta.length && !stop;)
		{
			switch (delta[i])
			{
			case 99: // 'c': // copy row
				var count = delta[i+1];
				var srcRow = delta[i+2];
				var destRow = delta[i+3];
				if (this._debugDeltasDetail)
					window.app.console.log('[' + i + ']: copy ' + count + ' row(s) ' + srcRow + ' to ' + destRow);
				i+= 4;
				for (var cnt = 0; cnt < count; ++cnt)
				{
					var src = (srcRow + cnt) * width * 4;
					var dest = (destRow + cnt) * width * 4;
					for (var j = 0; j < width * 4; ++j)
					{
						imgData.data[dest + j] = oldData[src + j];
					}
				}
				break;
			case 100: // 'd': // new run
				destRow = delta[i+1];
				var destCol = delta[i+2];
				var span = delta[i+3];
				offset = destRow * width * 4 + destCol * 4;
				if (this._debugDeltasDetail)
					window.app.console.log('[' + i + ']: apply new span of size ' + span +
							       ' at pos ' + destCol + ', ' + destRow + ' into delta at byte: ' + offset);
				i += 4;
				span *= 4;
				// imgData.data[offset + 1] = 256; // debug - greener start
				while (span-- > 0) {
					imgData.data[offset++] = delta[i++];
				}
				// imgData.data[offset - 2] = 256; // debug - blue terminator
				break;
			case 116: // 't': // terminate delta new one next
				stop = true;
				i++;
				break;
			default:
				console.log('[' + i + ']: ERROR: Unknown delta code ' + delta[i]);
				i = delta.length;
				break;
			}
		}

		return i;
	},

	_onTileMsg: function (textMsg, img) {
		var tileMsgObj = app.socket.parseServerCmd(textMsg);
		this._checkTileMsgObject(tileMsgObj);
		var coords = this._tileMsgToCoords(tileMsgObj);
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];
		if (this._debug && tile) {
			if (tile._debugLoadTile === undefined) {
				tile._debugLoadTile = 0;
				tile._debugLoadDelta = 0;
				tile._debugInvalidateCount = 0;
			}
			if (img.rawData && !img.isKeyframe)
			{
				tile._debugLoadDelta++;
				this._debugLoadDelta++;
			}
			else
			{
				tile._debugLoadTile++;
				this._debugLoadTile++;
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

			var msg = 'requested: ' + this._tiles[key]._debugInvalidateCount + '<br>rec-tiles: ' + this._tiles[key]._debugLoadTile + '<br>recv-delta: ' + this._tiles[key]._debugLoadDelta;
			if (tile._debugTime.date !== 0)
				msg += '<br>' + this._debugSetTimes(tile._debugTime, +new Date() - tile._debugTime.date).replace(/, /g, '<br>');
			tile._debugPopup.setContent(msg);

			if (tile._debugTile) // deltas in yellow
				tile._debugTile.setStyle({ fillOpacity: tile.lastKeyframe ? 0 : 0.1, fillColor: 'yellow' });

			this._debugShowTileData();
		}
		if (tileMsgObj.id !== undefined) {
			this._map.fire('tilepreview', {
				tile: img,
				id: tileMsgObj.id,
				width: tileMsgObj.width,
				height: tileMsgObj.height,
				part: tileMsgObj.part,
				mode: (tileMsgObj.mode !== undefined) ? tileMsgObj.mode : 0,
				docType: this._docType
			});
		}
		else if (tile) {
			tile.lastKeyframe = false;

			if (this._tiles[key]._invalidCount > 0)
				this._tiles[key]._invalidCount -= 1;

			tile.wireId = tileMsgObj.wireId;
			if (this._map._canvasDevicePixelGrid)
				// browser/test/pixel-test.png - debugging pixel alignment.
				tile.el.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QEIChoQ0oROpwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAACfklEQVR42u3dO67CQBBFwbnI+9/yJbCQLDIkPsZdFRAQjjiv3S8YZ63VNsl6aLvgop5+6vFzZ3QP/uQz2c0RIAAQAAzcASwAmAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACADGBnC8iQ5MABAACAB+zsVYjLZ9dOvd3zzg/QOYADByB/BvUCzBIAAQAFiCwQQAAYAAQAAgABAACAAEAAIAAYAAQAAgABAACAAEAAIAAYAAQAAwIgAXb2ECgABAAPDaI7SLsZhs+79kvX8AEwDsAM8DASzBIAAQAFiCwQQAAYAAQAAgABAAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAI4LSSOAQBgABAAPDVR9C2ToGxNkfww623bZL98/ilUzIBwA4wbCAgABAACAAswWACgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAAAjAESAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAQAAgABgABAACAAEAAIAAGAAEAAIAAQAAgABAACAAGAAEAAIAAQAAgAPiaJAEAAIAB48yNWW6fAWJsj4LRbb9sk++fxSxMA7AAMGwgCAAGAAMASDCYACAAEAAIAAYAAQAAgABAACAAEAAIAASAAR4AAQAAgABAACAAEANeW9e675sAEAAGAAODUO4AFgMnu7t9h2ahA0pgAAAAASUVORK5CYII=';

			else if (tile && img.rawData)
				this._applyDelta(tile, img.rawData, img.isKeyframe);

			else
				tile.el = img;
			tile.loaded = true;
			this._tileReady(coords, null /* err */, tile);
		}
		L.Log.log(textMsg, 'INCOMING', key);

		// Queue acknowledgment, that the tile message arrived
		var mode = (tileMsgObj.mode !== undefined) ? tileMsgObj.mode : 0;
		var tileID = tileMsgObj.part + ':' + mode + ':' + tileMsgObj.x + ':' + tileMsgObj.y + ':'
			+ tileMsgObj.tileWidth + ':' + tileMsgObj.tileHeight + ':' + tileMsgObj.nviewid;
		this._queuedProcessed.push(tileID);
	},

	_sendProcessedResponse: function() {
		var toSend = this._queuedProcessed;
		this._queuedProcessed = [];
		// FIXME: new multi-tile-processed message.
		for (var i = 0; i < toSend.length; i++) {
			app.socket.sendMessage('tileprocessed tile=' + toSend[i]);
		}
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
			this._xSplitter = new CSplitterLine(
				map, {
					name: 'horiz-pane-splitter',
					fillColor: this._splittersStyleData.getPropValue('color'),
					fillOpacity: this._splittersStyleData.getFloatPropValue('opacity'),
					thickness: Math.round(
						this._splittersStyleData.getFloatPropWithoutUnit('border-top-width')
						* app.dpiScale),
					isHoriz: true
				});

			this._canvasOverlay.initPath(this._xSplitter);
		}
		else {
			this._xSplitter.onPositionChange();
		}
	},

	updateVertPaneSplitter: function () {

		var map = this._map;

		if (!this._ySplitter) {
			this._ySplitter = new CSplitterLine(
				map, {
					name: 'vert-pane-splitter',
					fillColor: this._splittersStyleData.getPropValue('color'),
					fillOpacity: this._splittersStyleData.getFloatPropValue('opacity'),
					thickness: Math.round(
						this._splittersStyleData.getFloatPropWithoutUnit('border-top-width')
						* app.dpiScale),
					isHoriz: false
				});

			this._canvasOverlay.initPath(this._ySplitter);
		}
		else {
			this._ySplitter.onPositionChange();
		}
	},

	hasXSplitter: function () {
		return !!(this._xSplitter);
	},

	hasYSplitter: function () {
		return !!(this._ySplitter);
	},

	getTileSectionPos: function () {
		return this._painter.getTileSectionPos();
	},

	_coordsToTileBounds: function (coords) {
		var zoomFactor = this._map.zoomToFactor(coords.z);
		var tileTopLeft = new L.Point(
			coords.x * this.options.tileWidthTwips / this._tileSize / zoomFactor,
			coords.y * this.options.tileHeightTwips / this._tileSize / zoomFactor);
		var tileSize = new L.Point(this.options.tileWidthTwips / zoomFactor, this.options.tileHeightTwips / zoomFactor);
		return new L.Bounds(tileTopLeft, tileTopLeft.add(tileSize));
	},

	isLayoutRTL: function () {
		return !!this._layoutIsRTL;
	},

	isCalcRTL: function () {
		return this.isCalc() && this.isLayoutRTL();
	}

});

L.TilesPreFetcher = L.Class.extend({

	initialize: function (docLayer, map) {
		this._docLayer = docLayer;
		this._map = map;
	},

	preFetchTiles: function (forceBorderCalc, immediate) {
		if (app.file.fileBasedView && this._docLayer)
			this._docLayer._updateFileBasedView();

		if (this._docLayer._emptyTilesCount > 0 || !this._map || !this._docLayer) {
			return;
		}

		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var part = this._docLayer._selectedPart;
		var mode = this._docLayer._selectedMode;
		var hasEditPerm = this._map.isEditMode();

		if (this._zoom === undefined) {
			this._zoom = zoom;
		}

		if (this._preFetchPart === undefined) {
			this._preFetchPart = part;
		}

		if (this._preFetchMode === undefined) {
			this._preFetchMode = mode;
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
			mode !== this._preFetchMode ||
			hasEditPerm !== this._hasEditPerm ||
			!pixelBounds.equals(this._pixelBounds) ||
			!splitPos.equals(this._splitPos)) {

			this._zoom = zoom;
			this._preFetchPart = part;
			this._preFetchMode = mode;
			this._hasEditPerm = hasEditPerm;
			this._pixelBounds = pixelBounds;
			this._splitPos = splitPos;

			// Need to compute borders afresh and fetch tiles for them.
			this._borders = []; // Stores borders for each split-pane.
			var tileRanges = this._docLayer._pxBoundsToTileRanges(pixelBounds);
			var paneStatusList = splitPanesContext ? splitPanesContext.getPanesProperties() :
				[ { xFixed: false, yFixed: false} ];

			window.app.console.assert(tileRanges.length === paneStatusList.length, 'tileRanges and paneStatusList should agree on the number of split-panes');

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
					coords.mode = this._preFetchMode;
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
			window.app.console.assert(finalQueue.length <= maxTilesToFetch,
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
		this._preFetchMode = this._docLayer._selectedMode;
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

L.MessageStore = L.Class.extend({

	// ownViewTypes : The types of messages related to own view.
	// otherViewTypes: The types of messages related to other views.
	initialize: function (ownViewTypes, otherViewTypes) {

		if (!Array.isArray(ownViewTypes) || !Array.isArray(otherViewTypes)) {
			window.app.console.error('Unexpected argument types');
			return;
		}

		var ownMessages = {};
		ownViewTypes.forEach(function (msgType) {
			ownMessages[msgType] = '';
		});
		this._ownMessages = ownMessages;

		var othersMessages = {};
		otherViewTypes.forEach(function (msgType) {
			othersMessages[msgType] = [];
		});
		this._othersMessages = othersMessages;
	},

	clear: function () {
		var msgs = this._ownMessages;
		Object.keys(msgs).forEach(function (msgType) {
			msgs[msgType] = '';
		});

		msgs = this._othersMessages;
		Object.keys(msgs).forEach(function (msgType) {
			msgs[msgType] = [];
		});
	},

	save: function (msgType, textMsg, viewId) {

		var othersMessage = (typeof viewId === 'number');

		if (!othersMessage && Object.prototype.hasOwnProperty.call(this._ownMessages, msgType)) {
			this._ownMessages[msgType] = textMsg;
			return;
		}

		if (othersMessage && Object.prototype.hasOwnProperty.call(this._othersMessages, msgType)) {
			this._othersMessages[msgType][viewId] = textMsg;
		}
	},

	get: function (msgType, viewId) {

		var othersMessage = (typeof viewId === 'number');

		if (!othersMessage && Object.prototype.hasOwnProperty.call(this._ownMessages, msgType)) {
			return this._ownMessages[msgType];
		}

		if (othersMessage && Object.prototype.hasOwnProperty.call(this._othersMessages, msgType)) {
			return this._othersMessages[msgType][viewId];
		}
	},

	forEach: function (callback) {
		if (typeof callback !== 'function') {
			window.app.console.error('Invalid callback type');
			return;
		}

		this._cleanUpSelectionMessages(this._ownMessages);

		var ownMessages = this._ownMessages;
		Object.keys(this._ownMessages).forEach(function (msgType) {
			callback(ownMessages[msgType]);
		});

		var othersMessages = this._othersMessages;
		Object.keys(othersMessages).forEach(function (msgType) {
			othersMessages[msgType].forEach(callback);
		});
	},

	_cleanUpSelectionMessages: function(messages) {
		// must be called only from _replayPrintTwipsMsg !!
		// check if textselection is empty
		// if it is, we need to handle textselectionstart and textselectionend
		// otherwise we get handles without selection and they also may appear in the wrong cell
		// but it is also reproducible on the same cell too. e.g. selection handles without selection
		if (!messages && !messages['textselection'] && messages['textselection'] !== 'textselection: ')
			return;
		messages['textselectionstart'] = 'textselectionstart: ';
		messages['textselectionend'] = 'textselectionend: ';
	}
});
