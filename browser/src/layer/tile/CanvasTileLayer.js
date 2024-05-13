/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * L.CanvasTileLayer is a layer with canvas based rendering.
 */

/* global app L CanvasSectionContainer CanvasOverlay CDarkOverlay CSplitterLine $ _ CPointSet CPolyUtil CPolygon Cursor CCellCursor CCellSelection PathGroupType UNOKey UNOModifier Uint8ClampedArray Uint8Array Uint32Array */

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

function clamp(num, min, max)
{
	return Math.min(Math.max(num, min), max);
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
		this._tilesSection = null; // Shortcut.

		if (L.Browser.cypressTest) // If cypress is active, create test divs.
			app.sectionContainer.testing = true;

		app.sectionContainer.onResize(mapSize.x, mapSize.y);

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

		this._zoomAtDocEdgeX = true;
		this._zoomAtDocEdgeY = true;
	},

	// Map and TilesSection overlap entirely. Map is above tiles section. In order to handle events in tiles section, we need to mirror them from map.
	_mirrorEventsFromSourceToCanvasSectionContainer: function (sourceElement) {
		sourceElement.addEventListener('mousedown', function (e) { app.sectionContainer.onMouseDown(e); }, true);
		sourceElement.addEventListener('click', function (e) { app.sectionContainer.onClick(e); }, true);
		sourceElement.addEventListener('dblclick', function (e) { app.sectionContainer.onDoubleClick(e); }, true);
		sourceElement.addEventListener('contextmenu', function (e) { app.sectionContainer.onContextMenu(e); }, true);
		sourceElement.addEventListener('wheel', function (e) { app.sectionContainer.onMouseWheel(e); }, true);
		sourceElement.addEventListener('mouseleave', function (e) { app.sectionContainer.onMouseLeave(e); }, true);
		sourceElement.addEventListener('mouseenter', function (e) { app.sectionContainer.onMouseEnter(e); }, true);
		sourceElement.addEventListener('touchstart', function (e) { app.sectionContainer.onTouchStart(e); }, true);
		sourceElement.addEventListener('touchmove', function (e) { app.sectionContainer.onTouchMove(e); }, true);
		sourceElement.addEventListener('touchend', function (e) { app.sectionContainer.onTouchEnd(e); }, true);
		sourceElement.addEventListener('touchcancel', function (e) { app.sectionContainer.onTouchCancel(e); }, true);
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
			return L.LOUtil._doRectanglesIntersect(app.file.viewedRectangle.pToArray(), [coords.x, coords.y + partHeightPixels * coords.part, app.tile.size.pixels[0], app.tile.size.pixels[1]]);
		}
	},

	_addTilesSection: function () {
		app.sectionContainer.addSection(L.getNewTilesSection());
		this._tilesSection = app.sectionContainer.getSectionWithName('tiles');
		app.sectionContainer.setDocumentAnchorSection(L.CSections.Tiles.name);
	},

	_addGridSection: function () {
		var that = this;
		app.sectionContainer.createSection({
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
		this._calcGridSection = app.sectionContainer.getSectionWithName(L.CSections.CalcGrid.name);
	},

	_addOverlaySection: function () {
		var canvasOverlay = this._layer._canvasOverlay = new CanvasOverlay(this._map, app.sectionContainer.getContext());
		app.sectionContainer.addSection(canvasOverlay);
		canvasOverlay.bindToSection(L.CSections.Tiles.name);
	},

	_onDrawGridSection: function () {
		if (this.containerObject.isInZoomAnimation() || this.sectionProperties.tsManager.waitForTiles())
			return;

		// We don't show the sheet grid, so we don't draw it.
		if (!this.sectionProperties.docLayer._sheetGrid)
			return;

		// grid-section's onDrawArea is TileSectionManager's _drawGridSectionArea().
		this.onDrawArea();
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

	// Debug tool. Splits are enabled for only Calc for now.
	_addSplitsSection: function () {
		var that = this;
		app.sectionContainer.createSection({
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
		app.sectionContainer.reNewAllSections(true);
	},

	_removeSplitsSection: function () {
		var section = app.sectionContainer.getSectionWithName('calc grid');
		if (section) {
			section.setDrawingOrder(L.CSections.CalcGrid.drawingOrder);
			section.sectionProperties.strokeStyle = '#c0c0c0';
		}
		app.sectionContainer.removeSection(L.CSections.Debug.Splits.name);
		app.sectionContainer.reNewAllSections(true);
	},

	// Debug tool
	_addTilePixelGridSection: function () {
		var that = this;
		app.sectionContainer.createSection({
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
		app.sectionContainer.reNewAllSections(true);
	},

	_removeTilePixelGridSection: function () {
		app.sectionContainer.removeSection(L.CSections.Debug.TilePixelGrid.name);
		app.sectionContainer.reNewAllSections(true);
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
		app.sectionContainer.requestReDraw();
	},

	update: function () {
		app.sectionContainer.requestReDraw();
	},

	/**
	 * Everything in this doc comment is speculation: I didn't write the code that supplies it and I'm guessing to
	 * have something to work on for this function. That said, given my observations, they seem incredibly likely to be correct
	 *
	 * @param pinchCenter {{x: number, y: number}} The current pinch center in doc core-pixels
	 * Normally expressed as an L.Point instance
	 *
	 * @param pinchStartCenter {{x: number, y: number}} The pinch center at the start of the pinch in doc core-pixels
	 * Normally expressed as an L.Point instance
	 *
	 * @param paneBounds {{min: {x: number, y: number}, max: {x: number, y: number}}} The edges of the current pane
	 * Traditionally this is the map border at the start of the pinch
	 *
	 * @param freezePane {{freezeX: boolean, freezeY: boolean}} Whether the pane is frozen in the x or y directions
	 *
	 * @param splitPos {{x: number, y: number}} The inset in core-pixels into the document caused by any splits (e.g. a frozen row at the start of the document)
	 *
	 * @param scale {number} The scale, relative to the initial size, of the document currently
	 * Or rather this is equivalent to: old_width / new_width
	 *
	 * @param findFreePaneCenter {boolean} Wether to return a center point
	 *
	 * @returns {{topLeft: {x: number, y: number}, center?: {x: number, y: number}}} An object with a top left point in core-pixels and optionally a center point
	 * Center is included iff findFreePaneCenter is true
	 * (probably this should be encoded into the type, e.g. with an overload when this is converted to TypeScript)
	 **/
	_getZoomDocPos: function (pinchCenter, pinchStartCenter, paneBounds, freezePane, splitPos, scale, findFreePaneCenter) {
		let xMin = 0;
		const hasXMargin = !this._layer.isCalc();
		if (hasXMargin) {
			xMin = -Infinity;
		} else if (paneBounds.min.x > 0) {
			xMin = splitPos.x;
		}

		let yMin = 0;
		if (paneBounds.min.y < 0) {
			yMin = -Infinity;
		} else if (paneBounds.min.y > 0) {
			yMin = splitPos.y;
		}

		const documentTopLeft = new L.Point(xMin, yMin);

		const paneSize = paneBounds.getSize();

		let centerOffset = {
			x: pinchCenter.x - pinchStartCenter.x,
			y: pinchCenter.y - pinchStartCenter.y,
		};

		// Portion of the pane away that our pinchStart (which should be where we zoom round) is
		const panePortion = {
			x: (pinchStartCenter.x - paneBounds.min.x) / paneSize.x,
			y: (pinchStartCenter.y - paneBounds.min.y) / paneSize.y,
		};

		// Top left in document coordinates.
		const docTopLeft = new L.Point(
			Math.max(documentTopLeft.x, pinchStartCenter.x + (centerOffset.x - paneSize.x * panePortion.x) / scale),
			Math.max(documentTopLeft.y, pinchStartCenter.y + (centerOffset.y - paneSize.y * panePortion.y) / scale)
		);

		if (freezePane.freezeX) {
			docTopLeft.x = paneBounds.min.x;
		}

		if (freezePane.freezeY) {
			docTopLeft.y = paneBounds.min.y;
		}

		if (!findFreePaneCenter) {
			return { topLeft: docTopLeft };
		}

		const newPaneCenter = new L.Point(
			(docTopLeft.x - splitPos.x + (paneSize.x + splitPos.x) * 0.5 / scale) / app.dpiScale,
			(docTopLeft.y - splitPos.y + (paneSize.y + splitPos.y) * 0.5 / scale) / app.dpiScale);

		return {
			topLeft: docTopLeft,
			center: this._map.project(this._map.unproject(newPaneCenter, this._map.getZoom()), this._map.getScaleZoom(scale))
		};
	},

	_getZoomMapCenter: function (zoom) {
		var scale = this._calcZoomFrameScale(zoom);
		var ctx = this._paintContext();
		var splitPos = ctx.splitPos;
		var viewBounds = ctx.viewBounds;
		var freePaneBounds = new L.Bounds(viewBounds.min.add(splitPos), viewBounds.max);

		return this._getZoomDocPos(
			this._newCenter,
			this._layer._pinchStartCenter,
			freePaneBounds,
			{ freezeX: false, freezeY: false },
			splitPos,
			scale,
			true /* findFreePaneCenter */
		).center;
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
			app.sectionContainer.setInZoomAnimation(true);
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
		app.sectionContainer.setZoomChanged(true);

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
				app.sectionContainer.setInZoomAnimation(false);
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
					app.sectionContainer.setZoomChanged(false);
					map.enableTextInput();
					map.focus(map.canAcceptKeyboardInput());
					// Paint everything.
					app.sectionContainer.requestReDraw();
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

	options: {
		pane: 'tilePane',

		tileSize: window.tileSize,
		opacity: 1,

		updateWhenIdle: (window.mode.isMobile() || window.mode.isTablet()),
		updateInterval: 200,

		attribution: null,
		zIndex: null,
		bounds: null,

		previewInvalidationTimeout: 1000,
	},

	_pngCache: [],

	initialize: function (options) {
		options = L.setOptions(this, options);

		this._tileWidthPx = options.tileSize;
		this._tileHeightPx = options.tileSize;

		// text, presentation, spreadsheet, etc
		this._docType = options.docType;
		this._documentInfo = '';
		app.file.textCursor.visible = false;
		// Last cursor position for invalidation
		this.lastCursorPos = null;
		// Are we zooming currently ? - if so, no cursor.
		this._isZooming = false;
		// Rectangle graphic selection
		this._graphicSelection = null;
		// Rotation angle of selected graphic object
		this._graphicSelectionAngle = 0;
		app.calc.cellCursorVisible = false;
		this._prevCellCursor = null;
		this._prevCellCursorAddress = null;
		this._cellCursorOnPgUp = null;
		this._cellCursorOnPgDn = null;
		this._shapeGridOffset = new app.definitions.simplePoint(0, 0);

		// Tile garbage collection counter
		this._gcCounter = 0;

		// Queue of tiles which were GC'd earlier than coolwsd expected
		this._fetchKeyframeQueue = [];

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

		this._moveInProgress = false;
		this._canonicalIdInitialized = false;
		this._nullDeltaUpdate = 0;
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
		app.sectionContainer = new CanvasSectionContainer(this._canvas, this.isCalc() /* disableDrawing? */);
		this._container.style.position = 'absolute';
		this._cursorDataDiv = L.DomUtil.create('div', 'cell-cursor-data', this._canvasContainer);
		this._selectionsDataDiv = L.DomUtil.create('div', 'selections-data', this._canvasContainer);
		this._splittersDataDiv = L.DomUtil.create('div', 'splitters-data', this._canvasContainer);
		this._cursorOverlayDiv = L.DomUtil.create('div', 'cursor-overlay', this._canvasContainer);
		if (L.Browser.cypressTest) {
			this._emptyDeltaDiv = L.DomUtil.create('div', 'empty-deltas', this._canvasContainer);
			this._emptyDeltaDiv.innerText = 0;
		}
		this._splittersStyleData = new CStyleData(this._splittersDataDiv);

		this._painter = new L.TileSectionManager(this);
		this._painter._addTilesSection();
		app.sectionContainer.getSectionWithName('tiles').onResize();
		this._painter._addOverlaySection();
		app.sectionContainer.addSection(L.getNewScrollSection(() => this._map._docLayer.isCalcRTL()));

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

	_reset: function (hard) {
		var tileZoom = Math.round(this._map.getZoom()),
		    tileZoomChanged = this._tileZoom !== tileZoom;
		this._tileSize = this._getTileSize();

		if (hard || tileZoomChanged) {
			this._resetClientVisArea();

			this._tileZoom = tileZoom;
			if (tileZoomChanged) {
				this._updateTileTwips();
				this._updateMaxBounds();
			}

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

			if (!L.Browser.mobileWebkit)
				this._update(this._map.getCenter(), tileZoom);

			this._pruneTiles();
		}
	},

	// These variables indicates the clientvisiblearea sent to the server and stored by the server
	// We need to reset them when we are reconnecting to the server or reloading a document
	// because the server needs new data even if the client is unmodified.
	_resetClientVisArea: function ()  {
		this._clientZoom = '';
		this._clientVisibleArea = '';
	},

	_resetCanonicalIdStatus: function() {
		this._canonicalIdInitialized = false;
	},

	_resetViewId: function () {
		this._viewId = undefined;
	},

	_getViewId: function () {
		return this._viewId;
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

	_getTileSize: function () {
		return this.options.tileSize;
	},

	_moveStart: function () {
		this._resetPreFetching();
		this._moveInProgress = true;
	},

	_move: function () {
		// We throttle the "move" event, but in moveEnd we always call
		// a _move anyway, so if there are throttled moves still
		// pending by the time moveEnd is called then there is no point
		// processing them after _moveEnd because we are up to date
		// already when they arrive and to do would just duplicate tile
		// requests
		if (!this._moveInProgress)
			return;

		this._update();
		this._resetPreFetching(true);
		this._onCurrentPageUpdate();
	},

	_moveEnd: function () {
		this._move();
		this._moveInProgress = false;
	},

	_requestNewTiles: function () {
		this._onMessage('invalidatetiles: EMPTY', null);
		this._update();
	},

	_refreshTilesInBackground: function() {
		for (var key in this._tiles) {
			this._tiles[key].wireId = 0;
			this._tiles[key].invalidFrom = 0;
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

	_initPreFetchPartTiles: function() {
		// check existing timeout and clear it before the new one
		if (this._partTilePreFetcher)
			clearTimeout(this._partTilePreFetcher);
		this._partTilePreFetcher =
			setTimeout(
				L.bind(function() {
					this._preFetchPartTiles(this._selectedPart + this._map._partsDirection, this._selectedMode);
				},
				this),
				100 /*ms*/);
	},

	_preFetchPartTiles: function(part, mode) {
		var center = this._map.getCenter();
		var zoom = this._map.getZoom();
		var pixelBounds = this._map.getPixelBoundsCore(center, zoom);
		var tileRange = this._pxBoundsToTileRange(pixelBounds);

		var tileCombineQueue = [];
		for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
				var coords = new L.TileCoordData(i * this._tileSize, j * this._tileSize, zoom, part, mode);

				if (!this._isValidTile(coords))
					continue;

				var key = this._tileCoordsToKey(coords);
				if (!this._tileNeedsFetch(key))
					continue;

				tileCombineQueue.push(coords);
			}
		}
		this._sendTileCombineRequest(tileCombineQueue);
	},

	_sendTileCombineRequest: function(tileCombineQueue) {
		if (tileCombineQueue.length <= 0)
			return;

		// Sort into buckets of consistent part & mode.
		var partMode = {};
		for (var i = 0; i < tileCombineQueue.length; ++i)
		{
			var coords = tileCombineQueue[i];
			// mode is a small number - give it 8 bits
			var pmKey = (coords.part << 8) + coords.mode;
			if (partMode[pmKey] === undefined)
				partMode[pmKey] = [];
			partMode[pmKey].push(coords);
		}

		for (var pmKey in partMode) {
			// no keys method
			var partTileQueue = partMode[pmKey];
			var part = partTileQueue[0].part;
			var mode = partTileQueue[0].mode;

			var tilePositionsX = [];
			var tilePositionsY = [];
			var tileWids = [];

			var added = {}; // uniqify
			for (var i = 0; i < partTileQueue.length; ++i)
			{
				var coords = partTileQueue[i];
				var key = this._tileCoordsToKey(coords);
				// request each tile just once in these tilecombines
				if (added[key])
					continue;
				added[key] = true;

				// build parameters
				var tile = this._tiles[key];
				tileWids.push((tile && tile.wireId !== undefined) ? tile.wireId : 0);

				var twips = this._coordsToTwips(coords);
				tilePositionsX.push(twips.x);
				tilePositionsY.push(twips.y);
			}

			var msg = 'tilecombine ' +
			    'nviewid=0 ' +
			    'part=' + part + ' ' +
			    ((mode !== 0) ? ('mode=' + mode + ' ') : '') +
			    'width=' + this._tileWidthPx + ' ' +
			    'height=' + this._tileHeightPx + ' ' +
		            'tileposx=' + tilePositionsX.join(',') + ' ' +
		            'tileposy=' + tilePositionsY.join(',') + ' ' +
		            'oldwid=' + tileWids.join(',') + ' ' +
			    'tilewidth=' + this._tileWidthTwips + ' ' +
			    'tileheight=' + this._tileHeightTwips;
			app.socket.sendMessage(msg, '');
		}
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

	createTile: function (coords, key) {
		if (this._tiles[key])
		{
			if (this._debugDeltas)
				window.app.console.debug('Already created tile ' + key);
			return this._tiles[key];
		}
		var tile = {
			coords: coords,
			current: true, // is this currently visible
			canvas: null,  // canvas ready to render
			imgDataCache: null, // flat byte array of canvas data
			rawDeltas: null, // deltas ready to decompress
			deltaCount: 0, // how many deltas on top of the keyframe
			updateCount: 0, // how many updates did we have
			loadCount: 0, // how many times did we get a new keyframe
			gcErrors: 0, // count freed keyframe in JS, but kept in wsd.
			missingContent: 0, // how many times rendered without content
			invalidateCount: 0, // how many invalidations touched this tile
			viewId: 0, // canonical view id
			wireId: 0, // monotonic timestamp for optimizing fetch
			invalidFrom: 0, // a wireId - for avoiding races on invalidation
			lastRendered: new Date(),
			hasContent: function() {
				return this.imgDataCache || this.hasKeyframe();
			},
			needsFetch: function() {
				return this.invalidFrom >= this.wireId || !this.hasContent();
			},
			hasKeyframe: function() {
				return this.rawDeltas && this.rawDeltas.length > 0;
			}
		};
		this._emptyTilesCount += 1;
		this._tiles[key] = tile;

		return tile;
	},

	_tileNeedsFetch: function(key) {
		var tile = this._tiles[key];
		return !tile || tile.needsFetch();
	},

	_getToolbarCommandsValues: function() {
		for (var i = 0; i < this._map.unoToolbarCommands.length; i++) {
			var command = this._map.unoToolbarCommands[i];
			app.socket.sendMessage('commandvalues command=' + command);
		}
	},

	_parseCellRange: function(cellRange) {
		var strTwips = cellRange.match(/\d+/g);
		var startCellAddress = [parseInt(strTwips[0]), parseInt(strTwips[1])];
		var endCellAddress = [parseInt(strTwips[2]), parseInt(strTwips[3])];
		return new L.Bounds(startCellAddress, endCellAddress);
	},

	_cellRangeToTwipRect: function(cellRange) {
		var startCell = cellRange.getTopLeft();
		var startCellRectPixel = this.sheetGeometry.getCellRect(startCell.x, startCell.y);
		var topLeftTwips = this._corePixelsToTwips(startCellRectPixel.min);
		var endCell = cellRange.getBottomRight();
		var endCellRectPixel = this.sheetGeometry.getCellRect(endCell.x, endCell.y);
		var bottomRightTwips = this._corePixelsToTwips(endCellRectPixel.max);
		return new L.Bounds(topLeftTwips, bottomRightTwips);
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
		else if (textMsg.startsWith('graphicinnertextarea:')) {
			this._onGraphicInnerTextAreaMsg(textMsg);
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

				// see invalidatetiles: in wsd/protocol.txt for structure
				var tmp = payload.substring('EMPTY'.length).replaceAll(',', ' , ');
				var tokens = tmp.split(/[ \n]+/);

				var wireIdToken = undefined;
				var commaargs = [];

				var commaarg = false;
				for (var i = 0; i < tokens.length; i++) {
					if (tokens[i] === ',') {
						commaarg = true;
						continue;
					}
					if (commaarg) {
						commaargs.push(tokens[i]);
						commaarg = false;
					}
					else if (tokens[i].startsWith('wid=')) {
						wireIdToken = tokens[i];
					}
					else if (tokens[i])
						console.error('unsupported invalidatetile token: ' + tokens[i]);
				}

				if (this.isWriter()) {
					msg += 'part=0 ';
				} else {

					var part = parseInt(commaargs.length > 0 ? commaargs[0] : '');
					var mode = parseInt(commaargs.length > 1 ? commaargs[1] : '');

					mode = (isNaN(mode) ? this._selectedMode : mode);
					msg += 'part=' + (isNaN(part) ? this._selectedPart : part)
						+ ((mode && mode !== 0) ? (' mode=' + mode) : '')
						+ ' ';
				}
				msg += 'x=0 y=0 ';
				msg += 'width=' + this._docWidthTwips + ' ';
				msg += 'height=' + this._docHeightTwips;
				if (wireIdToken !== undefined)
					msg += ' ' + wireIdToken;
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
			let textMsgContent = textMsg.substr(22);
			let textMsgHtml = '';
			let textMsgPlainText = '';
			if (textMsgContent.startsWith('{')) {
				// Multiple formats: JSON.
				let textMsgJson = JSON.parse(textMsgContent);
				textMsgHtml = textMsgJson['text/html'];
				textMsgPlainText = textMsgJson['text/plain;charset=utf-8'];
			} else {
				// Single format: as-is.
				textMsgHtml = textMsgContent;
			}
			const hyperlinkTextBox = document.getElementById('hyperlink-text-box');
			if (hyperlinkTextBox) {
				// Hyperlink dialog is open, the text selection is for the link text
				// widget.
				const extracted = this._map.extractContent(textMsgHtml);
				hyperlinkTextBox.value = extracted.trim();
			} else if (this._map._clip) {
				this._map._clip.setTextSelectionHTML(textMsgHtml, textMsgPlainText);
			} else
				// hack for ios and android to get selected text into hyperlink insertion dialog
				this._selectedTextContent = textMsgHtml;
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
		else if (textMsg.startsWith('tooltip:')) {
			var tooltipInfo = JSON.parse(textMsg.substring('tooltip:'.length + 1));
			if (tooltipInfo.type === 'formulausage') {
				this._onCalcFunctionUsageMsg(tooltipInfo.text);
			}
			else if (tooltipInfo.type === 'generaltooltip') {
				var tooltipInfo = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
				this._map.uiManager.showDocumentTooltip(tooltipInfo);
			}
			else {
				console.error('unknown tooltip type');
			}
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
		else if (textMsg.startsWith('canonicalidchange:')) {
			var payload = textMsg.substring('canonicalidchange:'.length + 1);
			var viewRenderedState = payload.split('=')[3].split(' ')[0];
			if (this._debug.overlayOn) {
				var viewId = payload.split('=')[1].split(' ')[0];
				var canonicalId = payload.split('=')[2].split(' ')[0];
				this._debug.setOverlayMessage('canonicalViewId',
					'Canonical id changed to: ' + canonicalId + ' for view id: ' + viewId + ' with view renderend state: ' + viewRenderedState
				);
			}
			if (!this._canonicalIdInitialized) {
				this._canonicalIdInitialized = true;
				this._update();
			} else {
				this._requestNewTiles();
				this._invalidateAllPreviews();
				this.redraw();
			}
		}
		else if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
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
		else if (textMsg.startsWith('applicationbackgroundcolor:')) {
			app.sectionContainer.setClearColor('#' + textMsg.substring('applicationbackgroundcolor:'.length + 1).trim());
			app.sectionContainer.requestReDraw();
		}
		else if (textMsg.startsWith('documentbackgroundcolor:')) {
			app.sectionContainer.setDocumentBackgroundColor('#' + textMsg.substring('documentbackgroundcolor:'.length + 1).trim());
		}
		else if (textMsg.startsWith('contentcontrol:')) {
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
		else if (textMsg.startsWith('a11yfocuschanged:')) {
			obj = JSON.parse(textMsg.substring('a11yfocuschanged:'.length + 1));
			var listPrefixLength = obj.listPrefixLength !== undefined ? parseInt(obj.listPrefixLength) : 0;
			this._map._textInput.onAccessibilityFocusChanged(
				obj.content, parseInt(obj.position), parseInt(obj.start), parseInt(obj.end),
				listPrefixLength, parseInt(obj.force) > 0);
		}
		else if (textMsg.startsWith('a11ycaretchanged:')) {
			obj = JSON.parse(textMsg.substring('a11yfocuschanged:'.length + 1));
			this._map._textInput.onAccessibilityCaretChanged(parseInt(obj.position));
		}
		else if (textMsg.startsWith('a11ytextselectionchanged:')) {
			obj = JSON.parse(textMsg.substring('a11ytextselectionchanged:'.length + 1));
			this._map._textInput.onAccessibilityTextSelectionChanged(parseInt(obj.start), parseInt(obj.end));
		}
		else if (textMsg.startsWith('a11yfocusedcellchanged:')) {
			obj = JSON.parse(textMsg.substring('a11yfocusedcellchanged:'.length + 1));
			var outCount = obj.outCount !== undefined ? parseInt(obj.outCount) : 0;
			var inList = obj.inList !== undefined ? obj.inList : [];
			var row = parseInt(obj.row);
			var col = parseInt(obj.col);
			var rowSpan = obj.rowSpan !== undefined ? parseInt(obj.rowSpan) : 1;
			var colSpan = obj.colSpan !== undefined ? parseInt(obj.colSpan) : 1;
			this._map._textInput.onAccessibilityFocusedCellChanged(
				outCount, inList, row, col, rowSpan, colSpan, obj.paragraph);
		}
		else if (textMsg.startsWith('a11yeditinginselectionstate:')) {
			obj = JSON.parse(textMsg.substring('a11yeditinginselectionstate:'.length + 1));
			this._map._textInput.onAccessibilityEditingInSelectionState(
				parseInt(obj.cell) > 0, parseInt(obj.enabled) > 0, obj.selection, obj.paragraph);
		}
		else if (textMsg.startsWith('a11yselectionchanged:')) {
			obj = JSON.parse(textMsg.substring('a11yselectionchanged:'.length + 1));
			this._map._textInput.onAccessibilitySelectionChanged(
				parseInt(obj.cell) > 0, obj.action, obj.name, obj.text);
		}
		else if (textMsg.startsWith('a11yfocusedparagraph:')) {
			obj = JSON.parse(textMsg.substring('a11yfocusedparagraph:'.length + 1));
			this._map._textInput.setA11yFocusedParagraph(
				obj.content, parseInt(obj.position), parseInt(obj.start), parseInt(obj.end));
		}
		else if (textMsg.startsWith('a11ycaretposition:')) {
			var pos = textMsg.substring('a11ycaretposition:'.length + 1);
			this._map._textInput.setA11yCaretPosition(parseInt(pos));
		}
		else if (textMsg.startsWith('colorpalettes:')) {
			var json = JSON.parse(textMsg.substring('colorpalettes:'.length + 1));

			for (var key in json) {
				if (app.colorPalettes[key]) {
					app.colorPalettes[key].colors = json[key];
				} else {
					window.app.console.warn('Unknown palette: "' + key + '"');
				}
			}

			// Remove empty palettes, eg. Document colors in Impress are empty
			for (var key in app.colorPalettes) {
				if (!app.colorPalettes[key].colors || !app.colorPalettes[key].colors.length) {
					delete app.colorPalettes[key];
				}
			}
		}
	},

	_onTabStopListUpdate: function (textMsg) {
		textMsg = textMsg.substring('tabstoplistupdate:'.length + 1);
		var json = JSON.parse(textMsg);
		this._map.fire('tabstoplistupdate', json);
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

	_onCalcFunctionUsageMsg: function (textMsg) {
		var pos = this._map._docLayer._twipsToLatLng({ x: this._lastVisibleCursorRef.x2, y: this._lastVisibleCursorRef.y1 });
		this._map.uiManager.showFormulaTooltip(textMsg, pos);
	},

	_onCalcFunctionListMsg: function (textMsg) {
		if (textMsg.startsWith('hidetip')) {
			this._map.uiManager.hideFormulaTooltip();
		}
		else {
			var funcData = JSON.parse(textMsg);

			if (window.mode.isMobile()) {
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
			}
			else {
				var pos = this._map._docLayer._twipsToLatLng({ x: this._lastVisibleCursorRef.x2, y: this._lastVisibleCursorRef.y1 });
				var tooltipinfo = this._getFunctionList(textMsg);
				this._map.uiManager.showFormulaTooltip(tooltipinfo, pos);
			}
		}
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
		app.file.textCursor.visible = command ? true : false;
		this._removeSelection();
		this._onUpdateCursor();
	},

	_setCursorVisible: function() {
		app.file.textCursor.visible = true;
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

		if (this._graphicSelection) {
			videoDesc.width = this._graphicSelection.cWidth;
			videoDesc.height = this._graphicSelection.cHeight;
		}
		// proxy cannot identify RouteToken if it is encoded
		var routeTokenIndex = videoDesc.url.indexOf('%26RouteToken=');
		if (routeTokenIndex != -1) {
			videoDesc.url = videoDesc.url.replace('%26RouteToken=', '&amp;RouteToken=');
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
		this._graphicSelection = null;
		this._hasActiveSelection = false;
	},

	_openMobileWizard: function(data) {
		this._map.fire('mobilewizard', {data: data});
	},

	_closeMobileWizard: function() {
		this._map.fire('closemobilewizard');
	},

	_extractAndSetGraphicSelection: function(messageJSON) {
		var signX =  this.isCalcRTL() ? -1 : 1;
		var hasExtraInfo = messageJSON.length > 5;
		var hasGridOffset = false;
		var extraInfo = null;
		if (hasExtraInfo) {
			extraInfo = messageJSON[5];
			if (extraInfo.gridOffsetX || extraInfo.gridOffsetY) {
				this._shapeGridOffset = new app.definitions.simplePoint(signX * extraInfo.gridOffsetX, extraInfo.gridOffsetY);
				hasGridOffset = true;
			}
		}

		// Calc RTL: Negate positive X coordinates from core if grid offset is available.
		signX = hasGridOffset && this.isCalcRTL() ? -1 : 1;
		this._graphicSelection = new app.definitions.simpleRectangle(signX * messageJSON[0], messageJSON[1], signX * messageJSON[2], messageJSON[3]);

		if (hasGridOffset)
			this._graphicSelection.moveBy([this._shapeGridOffset.x, this._shapeGridOffset.y]);

		this._graphicSelection.extraInfo = extraInfo;
	},

	renderDarkOverlay: function () {
		var topLeft = new L.Point(this._graphicSelection.pX1, this._graphicSelection.pY1);
		var bottomRight = new L.Point(this._graphicSelection.pX2, this._graphicSelection.pY2);

		if (this.isCalcRTL()) {
			// Dark overlays (like any other overlay) need regular document coordinates.
			// But in calc-rtl mode, charts (like shapes) have negative x document coordinate
			// internal representation.
			topLeft.x = Math.abs(topLeft.x);
			bottomRight.x = Math.abs(bottomRight.x);
		}

		var bounds = new L.Bounds(topLeft, bottomRight);

		this._oleCSelections.setPointSet(CPointSet.fromBounds(bounds));
	},

	_onGraphicInnerTextAreaMsg: function (textMsg) {
		var msgData = JSON.parse(textMsg.substr('graphicinnertextarea: "innerTextRect":'.length));
		this._onUpdateGraphicInnerTextArea(msgData, true /*force add layer*/);
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

				this._graphicSelection = null;
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

			// Note2: scroll to frame in writer would result an error:
			//   svgexport.cxx:810: ...UnknownPropertyException message: "Background
			var isFrame = extraInfo.type == 601 && !extraInfo.isWriterGraphic;

			if (!window.ThisIsTheiOSApp && this._graphicSelection.extraInfo.isDraggable && !this._graphicSelection.extraInfo.svg
				&& !isFrame)
			{
				app.socket.sendMessage('rendershapeselection mimetype=image/svg+xml');
			}

			// scroll to selected graphics, if it has no cursor
			if (!this.isWriter() && this._graphicSelection
				&& this._allowViewJump()) {

				var docLayer = this._map._docLayer;
				if (
					(
						!app.isPointVisibleInTheDisplayedArea([this._graphicSelection.x1, this._graphicSelection.y1]) ||
						!app.isPointVisibleInTheDisplayedArea([this._graphicSelection.x2, this._graphicSelection.y2])
					)
					&&
					!this._selectionHandles.active &&
					!(docLayer._followEditor || docLayer._followUser) &&
					!this._map.calcInputBarHasFocus()) {
					this.scrollToPos(new app.definitions.simplePoint(this._graphicSelection.x1, this._graphicSelection.y1));
				}
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

		var oldCursorAddress = app.calc.cellAddress.clone();

		if (textMsg.match('EMPTY')) {
			app.calc.cellCursorVisible = false;
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
			let _cellCursorTwips = this._convertToTileTwipsSheetArea(new L.Bounds(topLeftTwips, bottomRightTwips));

			app.calc.cellAddress = new app.definitions.simplePoint(parseInt(strTwips[4]), parseInt(strTwips[5]));
			let tempRectangle = _cellCursorTwips.toRectangle();
			app.calc.cellCursorRectangle = new app.definitions.simpleRectangle(tempRectangle[0], tempRectangle[1], tempRectangle[2], tempRectangle[3]);
			app.calc.cellCursorVisible = true;

			app.sectionContainer.onCellAddressChanged();
			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellCursor([app.calc.cellCursorRectangle.pX2, app.calc.cellCursorRectangle.pY2]);
		}

		var onPgUpDn = false;
		if (app.calc.cellCursorVisible && this._prevCellCursor && !this._prevCellCursor.equals(app.calc.cellCursorRectangle.toArray())) {
			if ((this._cellCursorOnPgUp && this._cellCursorOnPgUp.equals(this._prevCellCursor.toArray())) ||
				(this._cellCursorOnPgDn && this._cellCursorOnPgDn.equals(this._prevCellCursor.toArray()))) {
				onPgUpDn = true;
			}
			this._prevCellCursor = app.calc.cellCursorRectangle.clone();
		}

		var sameAddress = oldCursorAddress.equals(app.calc.cellAddress.toArray());

		var scrollToCursor = this._sheetSwitch.tryRestore(sameAddress, this._selectedPart);

		this._onUpdateCellCursor(onPgUpDn, scrollToCursor, sameAddress);

		// Remove input help if there is any:
		this._removeInputHelpMarker();
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

	_getFunctionList: function(textMsg) {
		var maxSuggestion = 3;
		var functionNameList = [];
		var resultText = '';
		var currentFuncDescription = '';

		var suggestionArray = JSON.parse(textMsg);
		if (suggestionArray.length < maxSuggestion) { maxSuggestion = suggestionArray.length; }

		for (var i = 0; i < maxSuggestion; i++) {
			if (i == 0)
				currentFuncDescription = suggestionArray[i].description;

			var signature = suggestionArray[i].signature;
			functionNameList.push(signature.substring(0,signature.indexOf('(')));
		}

		for (var i = 0; i < maxSuggestion; i++) {
			if (i == 0)
				resultText = resultText + '[' + functionNameList[i] + ']';
			else
				resultText = resultText + ', ' + functionNameList[i];
		}

		var remainingFuncCount = suggestionArray.length - maxSuggestion;
		if (remainingFuncCount > 0)
			resultText = resultText + ' ' + _('and %COUNT more').replace('%COUNT', remainingFuncCount);

		resultText = resultText + ' : ' + currentFuncDescription;

		return resultText;
	},

	_showURLPopUp: function(position, url) {
		var parent = L.DomUtil.create('div', '');
		L.DomUtil.createWithId('div', 'hyperlink-pop-up-preview', parent);
		var link = L.DomUtil.createWithId('a', 'hyperlink-pop-up', parent);
		link.innerText = url;
		var copyBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-copy', parent);
		L.DomUtil.addClass(copyBtn, 'hyperlink-popup-btn');
		copyBtn.setAttribute('title', _('Copy link location'));
		var imgCopyBtn = L.DomUtil.create('img', 'hyperlink-pop-up-copyimg', copyBtn);
		L.LOUtil.setImage(imgCopyBtn, 'lc_copyhyperlinklocation.svg', this._map);
		imgCopyBtn.setAttribute('width', 18);
		imgCopyBtn.setAttribute('height', 18);
		imgCopyBtn.setAttribute('style', 'padding: 4px');
		var editBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-edit', parent);
		L.DomUtil.addClass(editBtn, 'hyperlink-popup-btn');
		editBtn.setAttribute('title', _('Edit link'));
		var imgEditBtn = L.DomUtil.create('img', 'hyperlink-pop-up-editimg', editBtn);
		L.LOUtil.setImage(imgEditBtn, 'lc_edithyperlink.svg', this._map);
		imgEditBtn.setAttribute('width', 18);
		imgEditBtn.setAttribute('height', 18);
		imgEditBtn.setAttribute('style', 'padding: 4px');
		var removeBtn = L.DomUtil.createWithId('div', 'hyperlink-pop-up-remove', parent);
		L.DomUtil.addClass(removeBtn, 'hyperlink-popup-btn');
		removeBtn.setAttribute('title', _('Remove link'));
		var imgRemoveBtn = L.DomUtil.create('img', 'hyperlink-pop-up-removeimg', removeBtn);
		L.LOUtil.setImage(imgRemoveBtn, 'lc_removehyperlink.svg', this._map);
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
				map_.sendUnoCommand('.uno:JumpToMark?Bookmark:string=' + encodeURIComponent(url.substring(1)));
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
		if (recCursor === undefined || this.persistCursorPositionInWriter) {
			this.persistCursorPositionInWriter = false;
			return;
		}

		app.file.textCursor.visible = true;

		// tells who trigerred cursor invalidation, but recCursors is stil "our"
		var modifierViewId = parseInt(obj.viewId);
		var weAreModifier = (modifierViewId === this._viewId);

		this._cursorAtMispelledWord = obj.mispelledWord ? Boolean(parseInt(obj.mispelledWord)).valueOf() : false;

		// Remember the last position of the caret (in core pixels).
		this._cursorPreviousPositionCorePixels = app.file.textCursor.rectangle.clone();

		app.file.textCursor.rectangle = new app.definitions.simpleRectangle(recCursor.getTopLeft().x, recCursor.getTopLeft().y, recCursor.getSize().x, recCursor.getSize().y);

		if (this._docType === 'text') {
			app.sectionContainer.onCursorPositionChanged();
		}

		var docLayer = this._map._docLayer;
		if ((docLayer._followEditor || docLayer._followUser) && this._map.lastActionByUser) {
			this._map._setFollowing(false, null);
		}
		this._map.lastActionByUser = false;

		this._map.hyperlinkUnderCursor = obj.hyperlink;
		this._closeURLPopUp();
		if (obj.hyperlink && obj.hyperlink.link) {
			this._showURLPopUp(this._map._docLayer._twipsToLatLng({ x: app.file.textCursor.rectangle.x1, y: app.file.textCursor.rectangle.y1 }), obj.hyperlink.link);
		}

		if (!this._map.editorHasFocus() && app.file.textCursor.visible && weAreModifier) {
			// Regain cursor if we had been out of focus and now have input.
			// Unless the focus is in the Calc Formula-Bar, don't steal the focus.
			if (!this._map.calcInputBarHasFocus())
				this._map.fire('editorgotfocus');
		}

		//first time document open, set last cursor position
		if (!this.lastCursorPos)
			this.lastCursorPos = app.file.textCursor.rectangle.clone();

		var updateCursor = false;
		if (!this.lastCursorPos.equals(app.file.textCursor.rectangle.toArray())) {
			updateCursor = true;
			this.lastCursorPos = app.file.textCursor.rectangle.clone();
		}

		// If modifier view is different than the current view
		// we'll keep the caret position at the same point relative to screen.
		this._onUpdateCursor(
			/* scroll */ updateCursor && weAreModifier,
			/* zoom */ undefined,
			/* keepCaretPositionRelativeToScreen */ !weAreModifier);

		// Only for reference equality comparison.
		this._lastVisibleCursorRef = app.file.textCursor.rectangle.clone();
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
					name: 'cell-view-cursor-' + viewId,
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
					this.scrollToPos(newCenter);
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
		if (this._viewSelections[viewId]) {
			if (this._viewSelections[viewId].selection) {
				this._viewSelections[viewId].selection.remove();
				this._viewSelections[viewId].selection = undefined;
			}
			delete this._viewSelections[viewId];
		}

		// update viewcursor in writer
		if (typeof this._viewCursors[viewId] !== 'undefined') {
			this._viewCursors[viewId].visible = false;
			this._onUpdateViewCursor(viewId);
			delete this._viewCursors[viewId];
		}

		//  update cellviewcursor in calc
		if (typeof this._cellViewCursors[viewId] !== 'undefined') {
			this._cellViewCursors[viewId].bounds = L.LatLngBounds.createDefault();
			this._cellViewCursors[viewId].corePixelBounds = new L.Bounds();
			this._onUpdateCellViewCursor(viewId);
			delete this._cellViewCursors[viewId];
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
			// json.state as empty string is fine, for example it means no selection
			// when json.commandName is '.uno:RowColSelCount'.
			if (json.commandName && json.state !== undefined) {
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
			if (L.Browser.hasNavigatorClipboardWrite) {
				// Just set the selection type, no fetch of the content.
				this._map._clip.setTextSelectionType('text');
			} else {
				// Trigger fetching the selection content, we already need to have
				// it locally by the time 'copy' is executed.
				if (this._selectionContentRequest) {
					clearTimeout(this._selectionContentRequest);
				}
				this._selectionContentRequest = setTimeout(L.bind(function () {
					app.socket.sendMessage('gettextselection mimetype=text/html,text/plain;charset=utf-8');}, this), 100);
			}
		}
		else {
			this._selectionHandles.start.setShowSection(false);
			this._selectionHandles.end.setShowSection(false);
			this._selectionHandles.active = false;

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
			cellAddress = document.getElementById('addressInput-input').value;

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
			cellAddress = document.getElementById('addressInput-input').value;

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

	_latLngBoundsToSimpleRectangle: function(latLngBounds) {
		let topLeft = this._latLngToTwips(latLngBounds.getNorthWest());
		let bottomRight = this._latLngToTwips(latLngBounds.getSouthEast());

		return new app.definitions.simpleRectangle(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
	},

	_simpleRectangleToLatLngBounds: function(simpleRectangle) {
		return new L.LatLngBounds(
			this._twipsToLatLng({ x: simpleRectangle.x1, y: simpleRectangle.y1 }, this._map.getZoom()),
			this._twipsToLatLng({ x: simpleRectangle.x2, y: simpleRectangle.y2 }, this._map.getZoom()));
	},

	_updateScrollOnCellSelection: function (oldSelection, newSelection) {
		if (this.isCalc() && oldSelection) {
			if (!app.file.viewedRectangle.containsRectangle(newSelection.toArray()) && !newSelection.equals(oldSelection.toArray())) {
				var spacingX = Math.abs(app.calc.cellCursorRectangle.pWidth) / 4.0;
				var spacingY = Math.abs(app.calc.cellCursorRectangle.pHeight) / 2.0;

				var scrollX = 0, scrollY = 0;
				if (newSelection.pX2 > app.file.viewedRectangle.pX2 && newSelection.pX2 > oldSelection.pX2)
					scrollX = newSelection.pX2 - app.file.viewedRectangle.pX2 + spacingX;
				else if (newSelection.pX1 < app.file.viewedRectangle.pX1 && newSelection.pX1 < oldSelection.pX1)
					scrollX = newSelection.pX1 - app.file.viewedRectangle.pX1 - spacingX;
				if (newSelection.pY1 > app.file.viewedRectangle.pY1 && newSelection.pY1 > oldSelection.pY1)
					scrollY = newSelection.pY1 - app.file.viewedRectangle.pY1 + spacingY;
				else if (newSelection.pY2 < app.file.viewedRectangle.pY2 && newSelection.pY2 < oldSelection.pY2)
					scrollY = newSelection.pY2 - app.file.viewedRectangle.pY2 - spacingY;
				if (scrollX !== 0 || scrollY !== 0) {
					var newCenter = new app.definitions.simplePoint(app.file.viewedRectangle.center[0], app.file.viewedRectangle.center[1]);
					newCenter.pX += scrollX;
					newCenter.pY += scrollY;
					if (!this._map.wholeColumnSelected && !this._map.wholeRowSelected) {
						var address = document.getElementById('addressInput-input').value;
						if (!this._isWholeColumnSelected(address) && !this._isWholeRowSelected(address))
							this.scrollToPos(newCenter);
					}
				}
			}
		}
	},

	_onTextSelectionEndMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			var oldSelection = this._selectionHandles.end.rectangle ? this._selectionHandles.end.rectangle.clone(): null;

			this._selectionHandles.end.rectangle = new app.definitions.simpleRectangle(topLeftTwips.x, topLeftTwips.y, (bottomRightTwips.x - topLeftTwips.x), (bottomRightTwips.y - topLeftTwips.y));

			this._updateScrollOnCellSelection(oldSelection, this._selectionHandles.end.rectangle);
			this._selectionHandles.end.setShowSection(true);
			this._updateMarkers();
		}
		else {
			this._selectionHandles.end.rectangle = null;
		}
	},

	_onTextSelectionStartMsg: function (textMsg) {
		var rectangles = this._getTextSelectionRectangles(textMsg);

		if (rectangles.length) {
			var topLeftTwips = rectangles[0].getTopLeft();
			var bottomRightTwips = rectangles[0].getBottomRight();
			let oldSelection = this._selectionHandles.start.rectangle ? this._selectionHandles.start.rectangle.clone(): null;
			//FIXME: The selection is really not two points, as they can be
			//FIXME: on top of each other, but on separate lines. We should
			//FIXME: capture the whole area in _onTextSelectionMsg.
			this._selectionHandles.start.rectangle = new app.definitions.simpleRectangle(topLeftTwips.x, topLeftTwips.y, (bottomRightTwips.x - topLeftTwips.x), (bottomRightTwips.y - topLeftTwips.y));

			this._updateScrollOnCellSelection(oldSelection, this._selectionHandles.start.rectangle);

			this._selectionHandles.start.setShowSection(true);
			this._selectionHandles.active = true;
		}
		else {
			this._selectionHandles.start.rectangle = null;
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
		if (strTwips != null) {
			var topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(strTwips[1]));
			var offset = new L.Point(parseInt(strTwips[2]), parseInt(strTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var boundsTwips = this._convertToTileTwipsSheetArea(new L.Bounds(topLeftTwips, bottomRightTwips));

			var oldSelection = this._cellSelectionArea ? this._cellSelectionArea.clone(): null;
			this._cellSelectionArea = new app.definitions.simpleRectangle(boundsTwips.min.x, boundsTwips.min.y, parseInt(strTwips[2]), parseInt(strTwips[3]));

			if (autofillMarkerSection)
				autofillMarkerSection.calculatePositionViaCellSelection([this._cellSelectionArea.pX2, this._cellSelectionArea.pY2]);

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

	_mapOnError: function (e) {
		if (e.msg && this._map.isEditMode() && e.critical !== false) {
			this._map.setPermission('view');
		}
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
		this._graphicSelection = null;
		this._onUpdateGraphicSelection();
		app.calc.cellCursorVisible = false;
		this._prevCellCursor = null;
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

		if (L.Browser.mac) {
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
				this._cellCursorOnPgUp = this._prevCellCursor.clone();
			}
			else if (unoKeyCode === UNOKey.PAGEDOWN) {
				if (this._cellCursorOnPgDn) {
					return;
				}
				this._cellCursorOnPgDn = this._prevCellCursor.clone();
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
			this._replayPrintTwipsMsgs(false);
		this._onUpdateCursor(null, true);
		this.updateAllViewCursors();
	},

	_updateCursorPos: function () {
		var cursorPos = new L.Point(app.file.textCursor.rectangle.pX1, app.file.textCursor.rectangle.pY1);
		var cursorSize = new L.Point(app.file.textCursor.rectangle.pWidth, app.file.textCursor.rectangle.pHeight);

		if (!this._cursorMarker) {
			this._cursorMarker = new Cursor(cursorPos, cursorSize, this._map, { blink: true });
		} else {
			this._cursorMarker.setPositionSize(cursorPos, cursorSize);
		}
	},

	goToTarget: function(target) {
		var command = {
			'Name': {
				type: 'string',
				value: 'URL'
			},
			'URL': {
				type: 'string',
				value: '#' + target
			}
		};

		this._map.sendUnoCommand('.uno:OpenHyperlink', command);
	},

	_allowViewJump: function() {
		return (!this._map._clip || this._map._clip._selectionType !== 'complex');
	},

	// Scrolls the view to selected position
	scrollToPos: function(pos) {
		if (pos instanceof app.definitions.simplePoint) // Turn into lat/lng if required (pos may also be a simplePoint.).
			pos = this._twipsToLatLng({ x: pos.x, y: pos.y });

		var center = this._map.project(pos);
		center = center.subtract(this._map.getSize().divideBy(2));
		center.x = Math.round(center.x < 0 ? 0 : center.x);
		center.y = Math.round(center.y < 0 ? 0 : center.y);
		this._map.fire('scrollto', {x: center.x, y: center.y});
	},

	// Update cursor layer (blinking cursor).
	_onUpdateCursor: function (scroll, zoom, keepCaretPositionRelativeToScreen) {

		if (!app.file.textCursor.visible ||
			this._map.ignoreCursorUpdate()) {
			return;
		}

		var docLayer = this._map._docLayer;

		if (!zoom
		&& scroll !== false
		&& (app.file.textCursor.visible || this._graphicSelection)
		// Do not center view in Calc if no new cursor coordinates have arrived yet.
		// ie, 'invalidatecursor' has not arrived after 'cursorvisible' yet.
		&& (!this.isCalc() || (this._lastVisibleCursorRef && !this._lastVisibleCursorRef.equals(app.file.textCursor.rectangle.toArray())))
		&& this._allowViewJump()) {

			// Cursor invalidation should take most precedence among all the scrolling to follow the cursor
			// so here we disregard all the pending scrolling
			app.sectionContainer.getSectionWithName(L.CSections.Scroll.name).pendingScrollEvent = null;
			var correctedCursor = app.file.textCursor.rectangle.clone();

			if (this._docType === 'text') {
				// For Writer documents, disallow scrolling to cursor outside of the page (horizontally)
				// Use document dimensions to approximate page width
				correctedCursor.x1 = clamp(correctedCursor.x1, 0, app.file.size.twips[0]);
				correctedCursor.x2 = clamp(correctedCursor.x2, 0, app.file.size.twips[0]);
			}

			if (!app.isPointVisibleInTheDisplayedArea(new app.definitions.simplePoint(correctedCursor.x1, correctedCursor.y1).toArray()) ||
				!app.isPointVisibleInTheDisplayedArea(new app.definitions.simplePoint(correctedCursor.x2, correctedCursor.y2).toArray())) {
				if (!this._selectionHandles.active &&
				    !(docLayer._followEditor || docLayer._followUser) &&
				    !this._map.calcInputBarHasFocus()) {
					this.scrollToPos(new app.definitions.simplePoint(correctedCursor.x1, correctedCursor.y1));
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

			var isCursorVisible = app.isPointVisibleInTheDisplayedArea(app.file.textCursor.rectangle.toArray());

			if (!isCursorVisible) {
				setTimeout(function () {
					var y = app.file.textCursor.rectangle.pY1 - that._cursorPreviousPositionCorePixels.pY1;
					if (y) {
						app.sectionContainer.getSectionWithName(L.CSections.Scroll.name).scrollVerticalWithOffset(y);
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
		if (app.file.textCursor.visible   // only when LOK has told us it is ok
			&& this._map.editorHasFocus()   // not when document is not focused
			&& !this._map.isSearching()  	// not when searching within the doc
			&& !this._isZooming             // not when zooming
		) {
			if (this._innerTextRectMarker)
				this._map.addLayer(this._innerTextRectMarker);
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
			if (this._map.editorHasFocus() && !this._map.uiManager.isAnyDialogOpen() && !this._map.isSearching()
				&& !this._isAnyInputFocused())
				this._map.focus(false);
			if (this._innerTextRectMarker)
				this._map.removeLayer(this._innerTextRectMarker);
		}

		// when first time we updated the cursor - document is loaded
		// let's move cursor to the target
		if (this._map.options.docTarget !== '') {
			this.goToTarget(this._map.options.docTarget);
			this._map.options.docTarget = '';
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
				this.scrollToPos(viewCursorPos);
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
				// Choose the logical left of the shape.
				var newPos = new L.Point(this._graphicSelection.x1 + deltaPos.x, this._graphicSelection.y1 + deltaPos.y);
				var size = { x: this._graphicSelection.width, y: this._graphicSelection.height };

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
		var selMin = { x: this._graphicSelection.x1, y: this._graphicSelection.y1 };
		var selMax = { x: this._graphicSelection.x2, y: this._graphicSelection.y2 };

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
			var center = { x: this._graphicSelection.center[0], y: this._graphicSelection.center[1] };
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

	_sendReferenceRangeCommand: function(startCol, startRow, endCol, endRow) {
		this._map.sendUnoCommand(
			'.uno:CurrentFormulaRange?StartCol=' + startCol +
			'&StartRow=' + startRow +
			'&EndCol=' + endCol +
			'&EndRow=' + endRow +
			'&Table=' + this._map._docLayer._selectedPart
		);
	},

	_onUpdateGraphicInnerTextArea: function (rect, force) {
		var topLeftTwips = new L.Point(rect[0], rect[1]);
		var offset = new L.Point(rect[2], rect[3]);
		var bottomRightTwips = topLeftTwips.add(offset);

		this._innerTextRectTwips = this._getGraphicSelectionRectangle(
			new L.Bounds(topLeftTwips, bottomRightTwips));

		this._innerTextRect = new L.LatLngBounds(
			this._twipsToLatLng(this._innerTextRectTwips.getTopLeft(), this._map.getZoom()),
			this._twipsToLatLng(this._innerTextRectTwips.getBottomRight(), this._map.getZoom()));

		if (this._innerTextRectMarker)
			this._map.removeLayer(this._innerTextRectMarker);

		this._innerTextRectMarker = L.svgGroup(this._innerTextRect, {
			draggable: true,
			dragConstraint: undefined,
			transform: false,
			stroke: false,
			fillOpacity: 0,
			fill: true,
			isText: true
		});

		if (force)
			this._map.addLayer(this._innerTextRectMarker);
	},

	// Update group layer selection handler.
	_onUpdateGraphicSelection: function () {
		if (this._graphicSelection) {
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

			if (extraInfo.innerTextRect) {
				this._onUpdateGraphicInnerTextArea(extraInfo.innerTextRect);
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

	// TODO: used only in calc: move to CalcTileLayer
	_onUpdateCellCursor: function (onPgUpDn, scrollToCursor, sameAddress) {
		this._onUpdateCellResizeMarkers();
		if (app.calc.cellCursorVisible) {
			var mapBounds = this._map.getBounds();
			if (scrollToCursor && (!this._prevCellCursorAddress || !app.calc.cellAddress.equals(this._prevCellCursorAddress.toArray())) &&
			    !this._map.calcInputBarHasFocus()) {
				var scroll = this._calculateScrollForNewCellCursor();
				window.app.console.assert(scroll instanceof L.LatLng, '_calculateScrollForNewCellCursor returned wrong type');
				if (scroll.lng !== 0 || scroll.lat !== 0) {
					var newCenter = mapBounds.getCenter();
					newCenter.lng += scroll.lng;
					newCenter.lat += scroll.lat;
					this.scrollToPos(newCenter);
				}
				this._prevCellCursorAddress = app.calc.cellAddress.clone();
			}

			if (onPgUpDn) {
				this._cellCursorOnPgUp = null;
				this._cellCursorOnPgDn = null;
			}

			var corePxBounds = new L.Bounds(new L.Point(app.calc.cellCursorRectangle.pX1, app.calc.cellCursorRectangle.pY1),
											new L.Point(app.calc.cellCursorRectangle.pX2, app.calc.cellCursorRectangle.pY2));

			if (this._cellCursorMarker) {
				this._cellCursorMarker.setBounds(corePxBounds);
				this._removeCellDropDownArrow();
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

			this._addCellDropDownArrow();

			var focusOutOfDocument = document.activeElement === document.body;
			var dontFocusDocument = this._isAnyInputFocused() || focusOutOfDocument;
			var dontStealFocus = sameAddress && this._map.calcInputBarHasFocus();
			dontFocusDocument = dontFocusDocument || dontStealFocus;

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
		this._removeCellDropDownArrow();
		this._closeURLPopUp();
	},

	_onValidityListButtonMsg: function(textMsg) {
		var strXY = textMsg.match(/\d+/g);
		var validatedCellAddress = new app.definitions.simplePoint(parseInt(strXY[0]), parseInt(strXY[1])); // Cell address of the validility list.
		var show = parseInt(strXY[2]) === 1;
		if (show) {
			if (this._validatedCellAddress && !validatedCellAddress.equals(this._validatedCellAddress.toArray())) {
				this._validatedCellAddress = null;
				this._removeCellDropDownArrow();
			}
			this._validatedCellAddress = validatedCellAddress;
			this._addCellDropDownArrow();
		}
		else if (this._validatedCellAddress && validatedCellAddress.equals(this._validatedCellAddress.toArray())) {
			this._validatedCellAddress = null;
			this._removeCellDropDownArrow();
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
		var pos = this._twipsToLatLng({ x: app.calc.cellCursorRectangle.x2, y: app.calc.cellCursorRectangle.y1 });
		var inputHelpMarker = L.marker(pos, { icon: icon });
		inputHelpMarker.addTo(this._map);
		document.getElementById('input-help-title').innerText = message.title;
		document.getElementById('input-help-content').innerText = message.content;
		this._inputHelpPopUp = inputHelpMarker;
	},

	_addCellDropDownArrow: function () {
		if (this._validatedCellAddress && app.calc.cellCursorVisible && this._validatedCellAddress.equals(app.calc.cellAddress.toArray())) {
			if (!app.sectionContainer.getSectionWithName('DropDownArrow')) {
				let position = new app.definitions.simplePoint(app.calc.cellCursorRectangle.x2, app.calc.cellCursorRectangle.y1);

				let dropDownSection = new app.definitions.calcValidityDropDown('DropDownArrow', position);
				app.sectionContainer.addSection(dropDownSection);
			}
			else {
				app.sectionContainer.getSectionWithName('DropDownArrow').setPosition(app.calc.cellCursorRectangle.pX2, app.calc.cellCursorRectangle.pY1);
			}
		}
	},

	_removeCellDropDownArrow: function () {
		if (!this._validatedCellAddress)
			app.sectionContainer.removeSection('DropDownArrow');
	},

	_onUpdateCellResizeMarkers: function () {
		var selectionOnDesktop = window.mode.isDesktop() && (this._cellSelectionArea || app.calc.cellCursorVisible);

		if (!selectionOnDesktop && (!this._cellCSelections.empty() || app.calc.cellCursorVisible)) {

			if (!this._cellSelectionArea && !app.calc.cellCursorVisible)
				return;

			this._cellSelectionHandleStart.setShowSection(true);
			this._cellSelectionHandleEnd.setShowSection(true);

			var cellRectangle = this._cellSelectionArea ? this._cellSelectionArea.clone() : app.calc.cellCursorRectangle.clone();

			const posStart = new app.definitions.simplePoint(cellRectangle.x1, cellRectangle.y1);
			const posEnd = new app.definitions.simplePoint(cellRectangle.x2, cellRectangle.y2);

			const offset = this._cellSelectionHandleStart.sectionProperties.circleRadius;
			this._cellSelectionHandleStart.setPosition(posStart.pX - offset, posStart.pY - offset);
			this._cellSelectionHandleEnd.setPosition(posEnd.pX - offset, posEnd.pY - offset);
		}
		else {
			this._cellSelectionHandleStart.setShowSection(false);
			this._cellSelectionHandleEnd.setShowSection(false);
		}
	},

	// Update text selection handlers.
	_onUpdateTextSelection: function () {
		this._onUpdateCellResizeMarkers();

		if (this._map.editorHasFocus() && (!this._textCSelections.empty() || this._selectionHandles.active)) {
			this._updateMarkers();
		}
		else {
			this._updateMarkers();
			this._removeSelection();
		}
	},

	_removeSelection: function() {
		this._selectionHandles.start.rectangle = null;
		this._selectionHandles.end.rectangle = null;
		this._selectedTextContent = '';

		this._selectionHandles.start.setShowSection(false);
		this._selectionHandles.end.setShowSection(false);
		this._selectionHandles.active = false;

		this._textCSelections.clear();
	},

	_updateMarkers: function() {
		if (!app.file.textCursor.visible || !this._selectionHandles.start.rectangle)
			return;

		if (!this._selectionHandles.start.isSectionShown() || !this._selectionHandles.end.isSectionShown())
			return;

		var startPos = { x: this._selectionHandles.start.rectangle.pX1, y: this._selectionHandles.start.rectangle.pY2 };
		var endPos = { x: this._selectionHandles.end.rectangle.pX1, y: this._selectionHandles.end.rectangle.pY2 };

		if (app.map._docLayer.isCalcRTL()) {
			// Mirror position from right to left.
			startPos.x = app.sectionContainer.getDocumentBounds()[2] - (startPos.x - app.sectionContainer.getDocumentBounds()[0]);
			endPos.x = app.sectionContainer.getDocumentBounds()[2] - (endPos.x - app.sectionContainer.getDocumentBounds()[0]);
		}

		const oldStart = this._selectionHandles.start.getPosition();
		const oldEnd = this._selectionHandles.end.getPosition();

		startPos.x -= 30 * app.dpiScale;
		this._selectionHandles.start.setPosition(startPos.x, startPos.y);
		let newStart = this._selectionHandles.start.getPosition();


		this._selectionHandles.end.setPosition(endPos.x, endPos.y);
		const newEnd = this._selectionHandles.end.getPosition();

		if (app.map._docLayer.isCalcRTL() && (newStart.y < newEnd.y || (newStart.y <= newEnd.y && newStart.x < newEnd.x))) {
			// If the start handle is actually closer to the end of the selection, reverse positions (Right To Left case).
			this._selectionHandles.start.setPosition(newEnd.pX, newEnd.pY);
			this._selectionHandles.end.setPosition(newStart.pX, newStart.pY);
		}
		else if (
			!app.map._docLayer.isCalcRTL() &&
			(oldEnd.distanceTo(newStart.toArray()) < 20 || oldStart.distanceTo(newEnd.toArray()) < 20)
		) {
			/*
				If the start handle is actually closer to the end of the selection, reverse positions.
				This seems to be a core side issue to me. I think the start and end positions are switched but the handlers aren't on the core side.
			*/
			const temp = this._selectionHandles.start;
			this._selectionHandles.start = this._selectionHandles.end;
			this._selectionHandles.end = temp;
		}
	},

	hasGraphicSelection: function() {
		return !!this._graphicSelection;
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

	_invalidateAllPreviews: function () {
		this._previewInvalidations = [];
		for (var key in this._map._docPreviews) {
			var preview = this._map._docPreviews[key];
			preview.invalid = true;
			this._previewInvalidations.push(new L.Bounds(new L.Point(0, 0), new L.Point(preview.maxWidth, preview.maxHeight)));
		}
		this._invalidatePreviews();
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
		var _offset = offset ? new L.Point(parseInt(offset.x), parseInt(offset.y)) : new L.Point(this._shapeGridOffset.x, this._shapeGridOffset.y);
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

			if (app.isCommentEditingAllowed())
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

	_clearMsgReplayStore: function (notOtherMsg) {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.clear(notOtherMsg);
	},

	_replayPrintTwipsMsgs: function (differentSheet) {
		if (!this._printTwipsMessagesForReplay) {
			return;
		}

		this._printTwipsMessagesForReplay.forEach(function (msg) {
			// don't try and replace graphic selection if the sheet/page has changed
			var skipMessage = differentSheet && msg.startsWith('graphicselection:');
			if (!skipMessage)
				this._onMessage(msg);
		}.bind(this));
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
			app.sectionContainer.setDocumentBounds([documentPos.x, documentPos.y, documentEndPos.x, documentEndPos.y]);
		}
	},

	pauseDrawing: function () {
		if (this._painter && app.sectionContainer)
			app.sectionContainer.pauseDrawing();
	},

	resumeDrawing: function (topLevel) {
		if (this._painter && app.sectionContainer)
			app.sectionContainer.resumeDrawing(topLevel);
	},

	enableDrawing: function () {
		if (this._painter && app.sectionContainer)
			app.sectionContainer.enableDrawing();
	},

	_getUIWidth: function () {
		var section = app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
		if (section) {
			return Math.round(section.size[0] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getUIHeight: function () {
		var section = app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
		if (section) {
			return Math.round(section.size[1] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupWidth: function () {
		var section = app.sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
		if (section) {
			return Math.round(section.size[0] / app.dpiScale);
		}
		else {
			return 0;
		}
	},

	_getGroupHeight: function () {
		var section = app.sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
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

			app.sectionContainer.onResize(documentContainerSize[0], documentContainerSize[1]); // Canvas's size = documentContainer's size.

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
				if (app.sectionContainer.doesSectionExist(L.CSections.RowHeader.name)) {
					app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
					app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
				}
			}

			if (oldSize.x !== newSize.x || oldSize.y !== newSize.y) {
				this._map.invalidateSize();
			}

			var hasMobileWizardOpened = this._map.uiManager.mobileWizard ? this._map.uiManager.mobileWizard.isOpen() : false;
			var hasIframeModalOpened = $('.iframe-dialog-modal').is(':visible');
			// when integrator has opened dialog in parent frame (eg. save as) we shouldn't steal the focus
			var focusedUI = document.activeElement === document.body;
			if (window.mode.isMobile() && !hasMobileWizardOpened && !hasIframeModalOpened && !focusedUI) {
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
			var hasVisibleCursor = app.file.textCursor.visible
				&& this._map._docLayer._cursorMarker && this._map._docLayer._cursorMarker.isDomAttached();
			if (!heightIncreased && isTabletOrMobile && this._map._docLoaded && hasVisibleCursor) {
				var cursorPos = this._map._docLayer._twipsToLatLng({ x: app.file.textCursor.rectangle.x1, y: app.file.textCursor.rectangle.y2 });
				var centerOffset = this._map._getCenterOffset(cursorPos);
				var viewHalf = this._map.getSize()._divideBy(2);
				var cursorPositionInView =
					centerOffset.x > -viewHalf.x && centerOffset.x < viewHalf.x &&
					centerOffset.y > -viewHalf.y && centerOffset.y < viewHalf.y;
				if (!cursorPositionInView)
					this._map.panTo(cursorPos);
			}

			if (heightIncreased || widthIncreased) {
				app.sectionContainer.requestReDraw();
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
		app.sectionContainer.setZoomChanged(zoomChanged);
	},

	onAdd: function (map) {
		this._tileWidthPx = this.options.tileSize;
		this._tileHeightPx = this.options.tileSize;

		this._initContainer();

		// Initiate selection handles.
		this._selectionHandles = {};
		this._selectionHandles.start = new app.definitions.textSelectionHandleSection('selection_start_handle', 30, 44, new app.definitions.simplePoint(0, 0), 'text-selection-handle-start', false);
		this._selectionHandles.end = new app.definitions.textSelectionHandleSection('selection_end_handle', 30, 44, new app.definitions.simplePoint(0, 0), 'text-selection-handle-end', false);
		this._selectionHandles.active = false;

		// Cell selection handles (mobile & tablet).
		this._cellSelectionHandleStart = new app.definitions.cellSelectionHandle('cell_selection_handle_start');
		this._cellSelectionHandleEnd = new app.definitions.cellSelectionHandle('cell_selection_handle_end');

		app.sectionContainer.addSection(this._map._docLayer._selectionHandles.start);
		app.sectionContainer.addSection(this._map._docLayer._selectionHandles.end);
		app.sectionContainer.addSection(this._map._docLayer._cellSelectionHandleStart);
		app.sectionContainer.addSection(this._map._docLayer._cellSelectionHandleEnd);

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
		if (!app.isReadOnly()) {
			map.addLayer(this._viewLayerGroup);
		}

		this._debug = map._debug;

		this._searchResultsLayer = new L.LayerGroup();
		map.addLayer(this._searchResultsLayer);

		this._levels = {};
		this._tiles = {}; // stores all tiles, keyed by coordinates, and cached, compressed deltas

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
					if (!this._map.uiManager.isAnyDialogOpen())
						this._onCellCursorShift(true);
				}
			},
			this);

		map.on('updatepermission', function(e) {
			if (e.perm !== 'edit') {
				this._clearSelections();
			}
		}, this);

		map.setPermission(app.file.permission);

		map.fire('statusindicator', {statusType: 'coolloaded'});

		this._map.sendInitUNOCommands();

		this._resetClientVisArea();
		this._requestNewTiles();

		map.setZoom();

		// This is called when page size is increased
		// the content of the page that become visible may stay empty
		// unless we have the tiles in the cache already
		// This will only fetch the tiles which are invalid or does not exist
		map.on('sizeincreased', function() {
			this._update();
		}.bind(this));
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

		app.sectionContainer.removeSection(this._selectionHandles.start);
		app.sectionContainer.removeSection(this._selectionHandles.end);

		this._removeSplitters();
		L.DomUtil.remove(this._canvasContainer);
	},

	getEvents: function () {
		var events = {
			viewreset: this._viewReset,
			movestart: this._moveStart,
			// update tiles on move, but not more often than once per given interval
			move: L.Util.throttle(this._move, this.options.updateInterval, this),
			moveend: this._moveEnd,
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

	preZoomAnimation: function (pinchStartCenter) {
		this._pinchStartCenter = this._map.project(pinchStartCenter).multiplyBy(app.dpiScale); // in core pixels

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

		if (this._selectionHandles.start.isSectionShown())
			this._selectionHandles.start.setOpacity(0);
		if (this._selectionHandles.end.isSectionShown())
			this._selectionHandles.end.setOpacity(0);

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

		if (this._selectionHandles.start.isSectionShown())
			this._selectionHandles.start.setOpacity(1);
		if (this._selectionHandles.end.isSectionShown())
			this._selectionHandles.end.setOpacity(1);

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

		this.preZoomAnimation(pinchCenter);
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
		this._reset(e && e.hard);
		if (this._docType === 'spreadsheet' && this._annotations !== 'undefined') {
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		}
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

	_pruneTiles: function () {
		// update tile.current for the view
		if (app.file.fileBasedView)
			this._updateFileBasedView(true);

		this._garbageCollect();
	},

	_getTilePos: function (coords) {
		return coords.getPos();
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

		var intersectionAreaRectangle = L.LOUtil._getIntersectionRectangle(app.file.viewedRectangle.pToArray(), [0, 0, partWidthPixels, partHeightPixels * this._parts]);

		var queue = [];

		if (intersectionAreaRectangle) {
			var minLocalX = Math.floor(intersectionAreaRectangle[0] / app.tile.size.pixels[0]) * app.tile.size.pixels[0];
			var maxLocalX = Math.floor((intersectionAreaRectangle[0] + intersectionAreaRectangle[2]) / app.tile.size.pixels[0]) * app.tile.size.pixels[0];

			var startPart = Math.floor(intersectionAreaRectangle[1] / partHeightPixels);
			var startY = app.file.viewedRectangle.pY1 - startPart * partHeightPixels;
			startY = Math.floor(startY / app.tile.size.pixels[1]) * app.tile.size.pixels[1];

			var endPart = Math.ceil((intersectionAreaRectangle[1] + intersectionAreaRectangle[3]) / partHeightPixels);
			var endY = app.file.viewedRectangle.pY1 + app.file.viewedRectangle.pY2 - endPart * partHeightPixels;
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

			for (i = 0; i < queue.length; i++) {
				var tempTile = this._tiles[this._tileCoordsToKey(queue[i])];
				if (tempTile)
					tempTile.current = true;
			}
		}

		if (checkOnly) {
			return queue;
		}
		else {
			this._sendClientVisibleArea();
			this._sendClientZoom();

			var tileCombineQueue = [];
			for (var i = 0; i < queue.length; i++) {
				var key = this._tileCoordsToKey(queue[i]);
				var tile = this._tiles[key];
				if (!tile)
					tile = this.createTile(queue[i], key);
				if (tile.needsFetch())
					tileCombineQueue.push(queue[i]);
			}
			this._sendTileCombineRequest(tileCombineQueue);
		}
	},

	_getMissingTiles: function (pixelBounds, zoom) {
		var tileRanges = this._pxBoundsToTileRanges(pixelBounds);
		var queue = [];

		// create a queue of coordinates to load tiles from
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
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

					var key = this._tileCoordsToKey(coords);
					var tile = this._tiles[key];
					if (tile && !tile.needsFetch())
						tile.current = true;
					else
						queue.push(coords);
				}
			}
		}

		return queue;
	},

	_update: function (center, zoom) {
		var map = this._map;
		if (!map || this._documentInfo === '' || !this._canonicalIdInitialized) {
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

		for (var key in this._tiles) {
			var thiscoords = this._keyToTileCoords(key);
			if (thiscoords.z !== zoom ||
				thiscoords.part !== this._selectedPart ||
				thiscoords.mode !== this._selectedMode) {
				this._tiles[key].current = false;
			}
		}

		var pixelBounds = map.getPixelBoundsCore(center, zoom);
		var queue = this._getMissingTiles(pixelBounds, zoom);

		this._sendClientVisibleArea();
		this._sendClientZoom();

		if (queue.length !== 0)
			this._addTiles(queue, false);

		if (this.isCalc() || this.isWriter())
			this._initPreFetchAdjacentTiles(pixelBounds, zoom);
	},

	_initPreFetchAdjacentTiles: function (pixelBounds, zoom) {
		if (this._adjacentTilePreFetcher)
			clearTimeout(this._adjacentTilePreFetcher);

		this._adjacentTilePreFetcher = setTimeout(function() {
			// Extend what we request to include enough to populate a full
			// scroll after or before the current viewport
			//
			// request separately from the current viewPort to get
			// those tiles first.
			var pixelHeight = pixelBounds.getSize().y;
			var pixelPrevNextHeight = pixelHeight;
			var pixelTopLeft = pixelBounds.getTopLeft();
			var pixelBottomRight = pixelBounds.getBottomRight();

			if (this.isCalc())
				pixelPrevNextHeight = ~~ (pixelPrevNextHeight * 1.5);

			pixelTopLeft.y += pixelHeight;
			pixelBottomRight.y += pixelPrevNextHeight;
			pixelBounds = new L.Bounds(pixelTopLeft, pixelBottomRight);
			var queue = this._getMissingTiles(pixelBounds, zoom);

			pixelTopLeft.y -= pixelHeight + pixelPrevNextHeight;
			pixelBottomRight.y -= pixelHeight + pixelPrevNextHeight;
			pixelBounds = new L.Bounds(pixelTopLeft, pixelBottomRight);
			queue = queue.concat(this._getMissingTiles(pixelBounds, zoom));

			if (queue.length !== 0)
				this._addTiles(queue, true);

		}.bind(this), 250 /*ms*/);
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

		if (this._ySplitter) {
			this._ySplitter.onPositionChange();
		}
		if (this._xSplitter) {
			this._xSplitter.onPositionChange();
		}
		if (this._clientVisibleArea !== newClientVisibleArea || forceUpdate) {
			// Visible area is dirty, update it on the server
			app.socket.sendMessage(newClientVisibleArea);
			if (!this._map._fatal && app.idleHandler._active && app.socket.connected())
				this._clientVisibleArea = newClientVisibleArea;
			if (this._debug.tileInvalidationsOn)
				this._debug._tileInvalidationLayer.clearLayers();
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

		// mark tiles not matching our part & mode as not being current
		for (key in this._tiles) {
			var thiscoords = this._keyToTileCoords(key);
			if (thiscoords.z !== zoom ||
				thiscoords.part !== this._selectedPart ||
				thiscoords.mode !== this._selectedMode) {
				this._tiles[key].current = false;
			}
		}

		// create a queue of coordinates to load tiles from
		for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
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
					if (tile && !tile.needsFetch())
						tile.current = true;
					else
						queue.push(coords);
				}
			}
		}

		if (queue.length !== 0) {
			var tileCombineQueue = [];

			for (i = 0; i < queue.length; i++) {
				coords = queue[i];
				key = this._tileCoordsToKey(coords);
				if (!this._tiles[key])
					this.createTile(coords, key);

				if (this._tileNeedsFetch(key)) {
					tileCombineQueue.push(coords);
				}
			}

			if (tileCombineQueue.length >= 0) {
				this._sendTileCombineRequest(tileCombineQueue);
			} else {
				// We have all necessary tile images in the cache, schedule a paint..
				// This may not be immediate if we are now in a slurp events call.
				this._painter.update();
			}
		}
		if (this._docType === 'presentation' || this._docType === 'drawing')
			this._initPreFetchPartTiles();
	},

	_tileReady: function (coords) {
		var key = this._tileCoordsToKey(coords);

		var tile = this._tiles[key];
		if (!tile)
			return;

		var emptyTilesCountChanged = false;
		if (this._emptyTilesCount > 0) {
			this._emptyTilesCount -= 1;
			emptyTilesCountChanged = true;
		}

		if (this._map && emptyTilesCountChanged && this._emptyTilesCount === 0) {
			this._map.fire('statusindicator', { statusType: 'alltilesloaded' });
		}

		var now = new Date();

		// Newly (pre)-fetched tiles, rendered or not should be privileged.
		tile.lastRendered = now;

		// Don't paint the tile, only dirty the sectionsContainer if it is in the visible area.
		// _emitSlurpedTileEvents() will repaint canvas (if it is dirty).
		if (this._painter.coordsIntersectVisible(coords)) {
			app.sectionContainer.setDirty(coords);
		}
	},

	// create tiles if needed for queued coordinates, and build a
	// tilecombined request for any tiles we need to fetch.
	_addTiles: function (coordsQueue, preFetch) {
		var coords, key;

		for (var i = 0; i < coordsQueue.length; i++) {
			coords = coordsQueue[i];

			key = this._tileCoordsToKey(coords);

			if (coords.part === this._selectedPart &&
			    coords.mode === this._selectedMode) {
				var tile = this._tiles[key];
				if (!tile) {
					// We always want to ensure the tile
					// exists.
					tile = this.createTile(coords, key);
				}
				if (preFetch) {
					// If preFetching at idle, take the
					// opportunity to create an up to date
					// canvas for the tile in advance.
					this.ensureCanvas(tile, null, true);
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
			if (!this._tileNeedsFetch(key)
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

		for (var r = 0; r < rectangles.length; ++r)
			this._sendTileCombineRequest(rectangles[r]);

		if (this._docType === 'presentation' || this._docType === 'drawing')
			this._initPreFetchPartTiles();
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
		coords.mode = tileMsg.mode !== undefined ? tileMsg.mode : 0;
		return coords;
	},

	_tileCoordsToKey: function (coords) {
		return coords.key();
	},

	_keyToTileCoords: function (key) {
		return L.TileCoordData.parseKey(key);
	},

	// Fix for cool#5876 allow immediate reuse of canvas context memory
	// WKWebView has a hard limit on the number of bytes of canvas
	// context memory that can be allocated. Reducing the canvas
	// size to zero is a way to reduce the number of bytes counted
	// against this limit.
	_reclaimTileCanvasMemory: function (tile) {
		if (tile && tile.canvas) {
			tile.canvas.width = 0;
			tile.canvas.height = 0;
			delete tile.canvas;
		}
		tile.imgDataCache = null;
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];
		if (!tile)
			return;

		if (!tile.hasContent() && this._emptyTilesCount > 0)
			this._emptyTilesCount -= 1;

		this._reclaimTileCanvasMemory(tile);
		delete this._tiles[key];
	},

	// We keep tile content around, but it will need
	// refreshing if we show it again - and we need to
	// know what monotonic time the invalidate came from
	// so we match this to a new incoming tile to unset
	// the invalid state later.
	_invalidateTile: function (key, wireId) {
		var tile = this._tiles[key];
		if (!tile)
			return;

		tile.invalidateCount++;

		if (this._debug.tileDataOn) {
			this._debug.tileDataAddInvalidate();
		}

		if (!tile.hasContent())
			this._removeTile(key);
		else
		{
			if (this._debugDeltas)
				window.app.console.debug('invalidate tile ' + key + ' with wireId ' + wireId);
			if (wireId)
				tile.invalidFrom = wireId;
			else
				tile.invalidFrom = tile.wireId;
		}
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

	// Ensure we have a renderable canvas for a given tile
	// Use this immediately before drawing a tile, pass in the time.
	ensureCanvas: function(tile, now, forPrefetch)
	{
		if (!tile)
			return;
		if (!tile.canvas)
		{
			// This allocation is usually cheap and reliable,
			// getting the canvas context, not so much.
			var canvas = document.createElement('canvas');
			canvas.width = window.tileSize;
			canvas.height = window.tileSize;

			tile.canvas = canvas;

			// re-hydrate recursively from cached data
			if (tile.hasKeyframe())
			{
				if (this._debugDeltas)
					window.app.console.log('Restoring a tile from cached delta at ' +
							       this._tileCoordsToKey(tile.coords));
				this._applyDelta(tile, tile.rawDeltas, true, false);
			}
		}
		if (!forPrefetch)
		{
			if (now !== null)
				tile.lastRendered = now;
			if (!tile.hasContent())
				tile.missingContent++;
		}
	},

	_maybeGarbageCollect: function() {
		if (!(++this._gcCounter % 53))
			this._garbageCollect();
	},

	// FIXME: could trim quite hard here, and do this at idle ...

	// Set a high and low watermark of how many canvases we want
	// and expire old ones
	_garbageCollect: function() {
		// 4k screen -> 8Mpixel, each tile is 64kpixel uncompressed
		var highNumCanvases = 250; // ~60Mb.
		var lowNumCanvases = 125;  // ~30Mb
		// real RAM sizes for keyframes + delta cache in memory.
		var highDeltaMemory = 120 * 1024 * 1024; // 120Mb
		var lowDeltaMemory = 60 * 1024 * 1024;   // 60Mb
		// number of tiles
		var highTileCount = 2 * 1024;
		var lowTileCount = 1024;

		if (this._debugDeltas)
			window.app.console.log('Garbage collect! iter: ' + this._gcCounter);

		/* uncomment to exercise me harder. */
		/* highNumCanvases = 3; lowNumCanvases = 2;
		   highDeltaMemory = 1024*1024; lowDeltaMemory = 1024*128;
		   highTileCount = 100; lowTileCount = 50; */

		var keys = [];
		for (var key in this._tiles) // no .keys() method.
			keys.push(key);

		// FIXME: should we sort by wireId - which is monotonic server ~time
		// sort by oldest
		keys.sort(function(a,b) { return b.lastRendered - a.lastRendered; });

		var canvasKeys = [];
		var totalSize = 0;
		for (var i = 0; i < keys.length; ++i)
		{
			var tile = this._tiles[keys[i]];
			if (tile.canvas)
				canvasKeys.push(keys[i]);
			totalSize += tile.rawDeltas ? tile.rawDeltas.length : 0;
		}

		// Trim ourselves down to size.
		if (canvasKeys.length > highNumCanvases)
		{
			for (var i = 0; i < canvasKeys.length - lowNumCanvases; ++i)
			{
				var key = canvasKeys[i];
				var tile = this._tiles[key];
				if (this._debugDeltas)
					window.app.console.log('Reclaim canvas ' + key +
							       ' last rendered: ' + tile.lastRendered);
				this._reclaimTileCanvasMemory(tile);
			}
		}

		// Trim memory down to size.
		if (totalSize > highDeltaMemory)
		{
			for (var i = 0; i < keys.length && totalSize > lowDeltaMemory; ++i)
			{
				var key = keys[i];
				var tile = this._tiles[key];
				if (tile.rawDeltas && !tile.current)
				{
					totalSize -= tile.rawDeltas.length;
					if (this._debugDeltas)
						window.app.console.log('Reclaim delta ' + key + ' memory: ' +
								       tile.rawDeltas.length + ' bytes');
					this._reclaimTileCanvasMemory(tile);
					tile.rawDeltas = null;
					// force keyframe
					tile.wireId = 0;
					tile.invalidFrom = 0;
				}
			}
		}

		// Trim the number of tiles down too ...
		if (keys.length > highTileCount)
		{
			for (var i = 0; i < keys.length - lowTileCount; ++i)
			{
				var key = keys[i];
				var tile = this._tiles[key];
				if (!tile.current)
					this._removeTile(keys[i]);
			}
		}
	},

	// work hard to ensure we get a canvas context to render with
	_ensureContext: function(tile)
	{
		var ctx;

		this._maybeGarbageCollect();

		// important this is after the garbagecollect
		if (!tile.canvas)
			this.ensureCanvas(tile, null, false);

		if ((ctx = tile.canvas.getContext('2d')))
			return ctx;

		// Not a good result - we ran out of canvas memory
		this._garbageCollect();

		if (!tile.canvas)
			this.ensureCanvas(tile, null, false);
		if ((ctx = tile.canvas.getContext('2d')))
			return ctx;

		// Free non-current canvas' and start again.
		if (this._debugDeltas)
			window.app.console.log('Free non-current tiles canvas memory');
		for (var key in this._tiles) {
			var t = this._tiles[key];
			if (t && !t.current)
				this._reclaimTileCanvasMemory(t);
		}
		if (!tile.canvas)
			this.ensureCanvas(tile, null, false);
		if ((ctx = tile.canvas.getContext('2d')))
			return ctx;

		if (this._debugDeltas)
			window.app.console.log('Throw everything overbarod to free all tiles canvas memory');
		for (var key in this._tiles) {
			var t = this._tiles[key];
			this._reclaimTileCanvasMemory(t);
		}
		if (!tile.canvas)
			this.ensureCanvas(tile, null, false);
		ctx = tile.canvas.getContext('2d');
		if (!ctx)
			window.app.console.log('Error: out of canvas memory.');
		return ctx;
	},

	_unpremultiply: function(rawDelta, byteLength) {
		var len = byteLength / 4;
		var delta32 = new Uint32Array(rawDelta.buffer, rawDelta.byteOffset, len);
		var resultu32 = new Uint32Array(len);
		var resultu8 = new Uint8ClampedArray(resultu32.buffer, resultu32.byteOffset, resultu32.byteLength);
		for (var i32 = 0; i32 < len; ++i32) {
			// premultiplied rgba -> unpremultiplied rgba
			var alpha = delta32[i32] >>> 24;
			if (alpha === 255) {
				resultu32[i32] = delta32[i32];
			}
			else if (alpha !== 0) { // dest can remain at ctored 0 if alpha is 0
				var i8 = i32 * 4;
				// forced to do the math
				resultu8[i8] = Math.ceil(rawDelta[i8] * 255 / alpha);
				resultu8[i8 + 1] = Math.ceil(rawDelta[i8 + 1] * 255 / alpha);
				resultu8[i8 + 2] = Math.ceil(rawDelta[i8 + 2] * 255 / alpha);
				resultu8[i8 + 3] = alpha;
			}
		}
		return resultu8;
	},

	_applyDelta: function(tile, rawDelta, isKeyframe, wireMessage) {
		// 'Uint8Array' rawDelta

		if (this._debugDeltas)
			window.app.console.log('Applying a raw ' + (isKeyframe ? 'keyframe' : 'delta') +
					       ' of length ' + rawDelta.length +
					       (this._debugDeltasDetail ? (' hex: ' + hex2string(rawDelta)) : ''));

		// Important to recurse & re-constitute from tile.rawDeelts
		// before appending rawDelta and then applying it again.
		var ctx = this._ensureContext(tile);
		if (!ctx) // out of canvas / texture memory.
			return;

		// if re-creating a canvas from rawDeltas don't update counts
		if (wireMessage) {
			if (isKeyframe) {
				tile.loadCount++;
				tile.deltaCount = 0;
				tile.updateCount = 0;
				if (this._debug.tileDataOn) {
					this._debug.tileDataAddLoad();
				}
			} else if (rawDelta.length === 0) {
				tile.updateCount++;
				this._nullDeltaUpdate++;
				if (this._emptyDeltaDiv) {
					this._emptyDeltaDiv.innerText = this._nullDeltaUpdate;
				}
				if (this._debug.tileDataOn) {
					this._debug.tileDataAddUpdate();
				}
				return; // that was easy
			} else {
				tile.deltaCount++;
				if (this._debug.tileDataOn) {
					this._debug.tileDataAddDelta();
				}
			}
		}
		// else - re-constituting from tile.rawData

		var traceEvent = app.socket.createCompleteTraceEvent('L.CanvasTileLayer.applyDelta',
								     { keyFrame: isKeyframe, length: rawDelta.length });

		// store the compressed version for later in its current
		// form as byte arrays, so that we can manage our canvases
		// better.
		if (isKeyframe)
		{
			if (tile.rawDeltas && tile.rawDeltas != rawDelta) // help the gc?
				tile.rawDeltas.length = 0;
			tile.rawDeltas = rawDelta; // overwrite
		}
		else if (!tile.rawDeltas)
		{
			window.app.console.log('Unusual: attempt to append a delta when we have no keyframe.');
			return;
		}
		else // assume we already have a delta.
		{
			// FIXME: this is not beautiful; but no concatenate here.
			var tmp = new Uint8Array(tile.rawDeltas.byteLength + rawDelta.byteLength);
			tmp.set(tile.rawDeltas, 0);
			tmp.set(rawDelta, tile.rawDeltas.byteLength);
			tile.rawDeltas = tmp;
		}

		// apply potentially several deltas in turn.
		var i = 0;
		var offset = 0;

		// FIXME:used clamped array ... as a 2nd parameter
		var allDeltas = window.fzstd.decompress(rawDelta);

		var imgData;

		// May have been changed by _ensureContext garbage collection
		var canvas = tile.canvas;

		if (isKeyframe)
		{
			// Debugging paranoia: if we get this wrong bad things happen.
			if (allDeltas.length < canvas.width * canvas.height * 4)
			{
				window.app.console.log('Unusual keyframe possibly mis-tagged, suspicious size vs. type ' +
						       allDeltas.length + ' vs. ' + (canvas.width * canvas.height * 4));
			}

			// FIXME: use zstd to de-compress directly into a Uint8ClampedArray
			var len = canvas.width * canvas.height * 4;
			var pixelArray = this._unpremultiply(allDeltas, len);
			imgData = new ImageData(pixelArray, canvas.width, canvas.height);

			if (this._debugDeltas)
				window.app.console.log('Applied keyframe ' + i++ + ' of total size ' + allDeltas.length +
						       ' at stream offset ' + offset + ' size ' + len);

			offset = len;
		}

		while (offset < allDeltas.length)
		{
			if (this._debugDeltas)
				window.app.console.log('Next delta at ' + offset + ' length ' + (allDeltas.length - offset));

			var delta = !offset ? allDeltas : allDeltas.subarray(offset);

			// Debugging paranoia: if we get this wrong bad things happen.
			if (delta.length >= canvas.width * canvas.height * 4)
			{
				window.app.console.log('Unusual delta possibly mis-tagged, suspicious size vs. type ' +
						       delta.length + ' vs. ' + (canvas.width * canvas.height * 4));
			}

			if (!imgData) // no keyframe
				imgData = tile.imgDataCache;
			if (!imgData)
			{
				if (this._debugDeltas)
					window.app.console.log('Fetch canvas contents');
				imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
			}

			// copy old data to work from:
			var oldData = new Uint8ClampedArray(imgData.data);

			var len = this._applyDeltaChunk(imgData, delta, oldData, canvas.width, canvas.height);
			if (this._debugDeltas)
				window.app.console.log('Applied chunk ' + i++ + ' of total size ' + delta.length +
						       ' at stream offset ' + offset + ' size ' + len);

			offset += len;
		}

		if (imgData)
		{
			// hold onto the original imgData for reuse in the no keyframe case
			tile.imgDataCache = imgData;
			ctx.putImageData(imgData, 0, 0);
		}

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
				// copy so this is suitably aligned for a Uint32Array view
				var tmpu8 = new Uint8Array(delta.subarray(i, i + span));
				var pixelData = this._unpremultiply(tmpu8, tmpu8.length);
				// imgData.data[offset + 1] = 256; // debug - greener start
				for (var j = 0; j < span; ++j)
					imgData.data[offset++] = pixelData[j];
				i += span;
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

	// Update debug overlay for a tile
	_showDebugForTile: function(key) {
		if (!this._debug.debugOn)
			return;

		var tile = this._tiles[key];
		tile._debugTime = this._debug.getTimeArray();
	},

	_queueAcknowledgement: function (tileMsgObj) {
		// Queue acknowledgment, that the tile message arrived
		this._queuedProcessed.push(+tileMsgObj.wireId);
	},

	_onTileMsg: function (textMsg, img) {
		var tileMsgObj = app.socket.parseServerCmd(textMsg);
		this._checkTileMsgObject(tileMsgObj);

		if (this._debug.tileDataOn) {
			this._debug.tileDataAddMessage();
		}

		// a rather different code-path with a png; should have its own msg perhaps.
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
			this._queueAcknowledgement(tileMsgObj);
			return;
		}

		var coords = this._tileMsgToCoords(tileMsgObj);
		var key = this._tileCoordsToKey(coords);
		var tile = this._tiles[key];

		if (!tile)
			tile = this.createTile(coords, key, tileMsgObj.wireId);

		tile.viewId = tileMsgObj.nviewid;
		// update monotonic timestamp
		tile.wireId = +tileMsgObj.wireId;
		if (tile.invalidFrom == tile.wireId)
			window.app.console.debug('Nasty - updated wireId matches old one');

		var hasContent = img != null;

		// obscure case: we could have garbage collected the
		// keyframe content in JS but coolwsd still thinks we have
		// it and now we just have a delta with nothing to apply
		// it to; if so, mark it bad to re-fetch.
		if (img && !img.isKeyframe && !tile.hasKeyframe())
		{
			window.app.console.debug('Unusual: Delta sent - but we have no keyframe for ' + key);
			// force keyframe
			tile.wireId = 0;
			tile.invalidFrom = 0;
			tile.gcErrors++;

			// queue a later fetch of this and any other
			// rogue tiles in this state
			this._fetchKeyframeQueue.push(coords);

			hasContent = false;
		}

		// updates don't need more chattiness with a tileprocessed
		if (hasContent)
		{
			this._applyDelta(tile, img.rawData, img.isKeyframe, true);
			this._tileReady(coords);
		}

		this._queueAcknowledgement(tileMsgObj);
	},

	_sendProcessedResponse: function() {
		var toSend = this._queuedProcessed;
		this._queuedProcessed = [];
		if (toSend.length > 0)
			app.socket.sendMessage('tileprocessed wids=' + toSend.join(','));
		if (this._fetchKeyframeQueue.length > 0)
		{
			window.app.console.warn('re-fetching prematurely GCd keyframes');
			this._sendTileCombineRequest(this._fetchKeyframeQueue);
			this._fetchKeyframeQueue = [];
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

		if (!this._docLayer || !this._map || this._docLayer._emptyTilesCount > 0 || !this._docLayer._canonicalIdInitialized) {
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

					if (visitedTiles[key] ||
					    !this._docLayer._isValidTile(coords) ||
					    !this._docLayer._tileNeedsFetch(key))
						continue;

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
			this._docLayer._addTiles(finalQueue, !immediate);
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

	clear: function (notOtherMsg) {
		var msgs = this._ownMessages;
		Object.keys(msgs).forEach(function (msgType) {
			msgs[msgType] = '';
		});

		if (!notOtherMsg) {
			msgs = this._othersMessages;
			Object.keys(msgs).forEach(function (msgType) {
				msgs[msgType] = [];
			});
		}
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
