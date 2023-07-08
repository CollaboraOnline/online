/* -*- tab-width: 4 -*- */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var $: any;
declare var Hammer: any;
declare var app: any;

class TilesSection extends CanvasSectionObject {
	map: any;
	isJSDOM: boolean = false; // testing
	checkpattern: any;

	constructor () {
		super({
			name: L.CSections.Tiles.name,
			// Below anchor list may be expanded. For example, Writer may have ruler section. Then ruler section should also be added here.
			anchor: [[L.CSections.ColumnHeader.name, 'bottom', 'top'], [L.CSections.RowHeader.name, 'right', 'left']],
			position: [0, 0], // This section's myTopLeft will be anchored to other sections^. No initial position is needed.
			size: [0, 0], // Going to be expanded, no initial width or height is necessary.
			expand: 'top left bottom right',
			processingOrder: L.CSections.Tiles.processingOrder,
			drawingOrder: L.CSections.Tiles.drawingOrder,
			zIndex: L.CSections.Tiles.zIndex,
			interactable: true,
			sectionProperties: {},
		});

		this.map = L.Map.THIS;

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.tsManager = this.sectionProperties.docLayer._painter;
		this.sectionProperties.pageBackgroundInnerMargin = 0; // In core pixels. We don't want backgrounds to have exact same borders with tiles for not making them visible when tiles are rendered.
		this.sectionProperties.pageBackgroundBorderColor = 'lightgrey';
		this.sectionProperties.pageBackgroundTextColor = 'grey';
		this.sectionProperties.pageBackgroundFont = String(40 * app.roundedDpiScale) + 'px Arial';

		this.isJSDOM = typeof window === 'object' && window.name === 'nodejs';

		this.checkpattern = this.makeCheckPattern();
	}

	private makeCheckPattern() {
		var canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		var drawctx = canvas.getContext('2d');
		var patternOn = true;
		for (var y = 0; y < 256; y+=32) {
			for (var x = 0; x < 256; x+=32) {
				if (patternOn)
					drawctx.fillStyle = 'darkgray';
				else
					drawctx.fillStyle = 'gray';
				patternOn = !patternOn;
				drawctx.fillRect(x, y, 32, 32);
			}
			patternOn = !patternOn;
		}
		return canvas;
	}

	public onInitialize () {
		this.onResize();
	}

	public onResize () {
		var tileSize = this.sectionProperties.docLayer._getTileSize();
		var borderSize = 3;
		this.sectionProperties.osCanvasExtraSize = 2 * borderSize * tileSize;
	}

	paintWithPanes (tile: any, ctx: any, async: boolean, now: Date) {
		var tileTopLeft = tile.coords.getPos();
		var tileBounds = new L.Bounds(tileTopLeft, tileTopLeft.add(ctx.tileSize));

		for (var i = 0; i < ctx.paneBoundsList.length; ++i) {
			// co-ordinates of this pane in core document pixels
			var paneBounds = ctx.paneBoundsList[i];
			// co-ordinates of the main-(bottom right) pane in core document pixels
			var viewBounds = ctx.viewBounds;

			// into real pixel-land ...
			paneBounds.round();
			viewBounds.round();

			if (paneBounds.intersects(tileBounds)) {
				var paneOffset = paneBounds.getTopLeft(); // allocates
				// Cute way to detect the in-canvas pixel offset of each pane
				paneOffset.x = Math.min(paneOffset.x, viewBounds.min.x);
				paneOffset.y = Math.min(paneOffset.y, viewBounds.min.y);

				this.drawTileInPane(tile, tileBounds, paneBounds, paneOffset, this.context, async, now);
			}
		}
	}

	private beforeDraw(canvasCtx: CanvasRenderingContext2D): void {
		const mirrorTile: boolean = this.isCalcRTL();
		if (mirrorTile) {
			canvasCtx.save();
			canvasCtx.translate(this.size[0], 0);
			canvasCtx.scale(-1, 1);
		}
	}

	private afterDraw(canvasCtx: CanvasRenderingContext2D): void {
		const mirrorTile: boolean = this.isCalcRTL();
		if (mirrorTile) {
			canvasCtx.restore();
		}
	}

	drawTileInPane (tile: any, tileBounds: any, paneBounds: any, paneOffset: any, canvasCtx: CanvasRenderingContext2D, clearBackground: boolean, now: Date) {
		// intersect - to avoid state thrash through clipping
		var crop = new L.Bounds(tileBounds.min, tileBounds.max);
		crop.min.x = Math.max(paneBounds.min.x, tileBounds.min.x);
		crop.min.y = Math.max(paneBounds.min.y, tileBounds.min.y);
		crop.max.x = Math.min(paneBounds.max.x, tileBounds.max.x);
		crop.max.y = Math.min(paneBounds.max.y, tileBounds.max.y);

		var cropWidth = crop.max.x - crop.min.x;
		var cropHeight = crop.max.y - crop.min.y;

		if (cropWidth && cropHeight) {
			if (clearBackground || this.containerObject.isZoomChanged() || canvasCtx !== this.context) {
				// Whole canvas is not cleared after zoom has changed, so clear it per tile as they arrive.
				canvasCtx.fillStyle = this.containerObject.getClearColor();
				this.beforeDraw(canvasCtx);
				canvasCtx.fillRect(
					crop.min.x - paneOffset.x,
					crop.min.y - paneOffset.y,
					cropWidth, cropHeight);
				this.afterDraw(canvasCtx);
				var gridSection = this.containerObject.getSectionWithName(L.CSections.CalcGrid.name);
				gridSection.onDrawArea(crop, paneOffset, canvasCtx);
			}

			this.beforeDraw(canvasCtx);
			this.drawTileToCanvasCrop(tile, now, canvasCtx,
									  crop.min.x - tileBounds.min.x,
									  crop.min.y - tileBounds.min.y,
									  cropWidth, cropHeight,
									  crop.min.x - paneOffset.x,
									  crop.min.y - paneOffset.y,
									  cropWidth, cropHeight);
			this.afterDraw(canvasCtx);
		}
	}

	pdfViewDrawTileBorders (tile: any, offset: any, tileSize: number) {
		this.context.strokeStyle = 'red';
		this.context.strokeRect(offset.x, offset.y, tileSize, tileSize);
		this.context.font = '20px Verdana';
		this.context.fillStyle = 'black';
		this.context.fillText(tile.coords.x + ' ' + tile.coords.y + ' ' + tile.coords.part, Math.round(offset.x + tileSize * 0.5), Math.round(offset.y + tileSize * 0.5));
	}

	paintSimple (tile: any, ctx: any, async: boolean, now: Date) {
		ctx.viewBounds.round();
		var offset = new L.Point(tile.coords.getPos().x - ctx.viewBounds.min.x, tile.coords.getPos().y - ctx.viewBounds.min.y);

		if ((async || this.containerObject.isZoomChanged()) && !app.file.fileBasedView) {
			// Non Calc tiles(handled by paintSimple) can have transparent pixels,
			// so clear before paint if the call is an async one.
			// For the full view area repaint, whole canvas is cleared by section container.
			// Whole canvas is not cleared after zoom has changed, so clear it per tile as they arrive even if not async.
			this.context.fillStyle = this.containerObject.getClearColor();
			this.context.fillRect(offset.x, offset.y, ctx.tileSize.x, ctx.tileSize.y);
		}

		var tileSizeX;
		var tileSizeY;
		if (app.file.fileBasedView) {
			tileSizeX = tileSizeY = this.sectionProperties.docLayer._tileSize;
			var ratio = tileSizeX / this.sectionProperties.docLayer._tileHeightTwips;
			var partHeightPixels = Math.round((this.sectionProperties.docLayer._partHeightTwips + this.sectionProperties.docLayer._spaceBetweenParts) * ratio);

			offset.y = tile.coords.part * partHeightPixels + tile.coords.y - this.documentTopLeft[1];
		} else {
			tileSizeX = ctx.tileSize.x;
			tileSizeY = ctx.tileSize.y;
		}

		this.drawTileToCanvas(tile, now, this.context, offset.x, offset.y, tileSizeX, tileSizeY);
	}

	public paint (tile: any, ctx: any, async: boolean, now: Date) {
		if (this.containerObject.isInZoomAnimation() || this.sectionProperties.tsManager.waitForTiles())
			return;

		if (!ctx)
			ctx = this.sectionProperties.tsManager._paintContext();

		this.containerObject.setPenPosition(this);

		if (ctx.paneBoundsActive === true)
			this.paintWithPanes(tile, ctx, async, now);
		else
			this.paintSimple(tile, ctx, async, now);
	}

	private forEachTileInView(zoom: number, part: number, mode: number, ctx: any,
		callback: (tile: any, coords: any) => boolean) {
		var docLayer = this.sectionProperties.docLayer;
		var tileRanges = ctx.paneBoundsList.map(docLayer._pxBoundsToTileRange, docLayer);

		if (app.file.fileBasedView) {
			var coordList: Array<any> = this.sectionProperties.docLayer._updateFileBasedView(true);

			for (var k: number = 0; k < coordList.length; k++) {
				var key = coordList[k].key();
				var tile = docLayer._tiles[key];
				if (!callback(tile, coordList[k]))
					return;
			}
		}
		else {
			for (var rangeIdx = 0; rangeIdx < tileRanges.length; ++rangeIdx) {
				var tileRange = tileRanges[rangeIdx];
				for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
					for (var i: number = tileRange.min.x; i <= tileRange.max.x; ++i) {
						var coords = new L.TileCoordData(
							i * ctx.tileSize.x,
							j * ctx.tileSize.y,
							zoom,
							part,
							mode);

						var key = coords.key();
						var tile = docLayer._tiles[key];

						if (!callback(tile, coords))
							return;
					}
				}
			}
		}
	}

	public haveAllTilesInView(zoom?: number, part?: number, mode?: number, ctx?: any): boolean {
		zoom = zoom || Math.round(this.map.getZoom());
		part = part || this.sectionProperties.docLayer._selectedPart;
		ctx = ctx || this.sectionProperties.tsManager._paintContext();

		var allTilesFetched = true;
		this.forEachTileInView(zoom, part, mode, ctx, function (tile: any): boolean {
			// Ensure all tile are available.
			if (!tile || tile.needsFetch()) {
				allTilesFetched = false;
				return false; // stop search.
			}
			return true; // continue checking remaining tiles.
		});

		return allTilesFetched;
	}

	private drawPageBackgroundWriter (ctx: any, rectangle: any, pageNumber: number) {
		rectangle = [Math.round(rectangle[0] * app.twipsToPixels), Math.round(rectangle[1] * app.twipsToPixels), Math.round(rectangle[2] * app.twipsToPixels), Math.round(rectangle[3] * app.twipsToPixels)];

		this.context.fillStyle = this.containerObject.getDocumentBackgroundColor(); // used to be pageBackgroundFillColorWriter (see below)
		this.context.fillRect(rectangle[0] - ctx.viewBounds.min.x + this.sectionProperties.pageBackgroundInnerMargin,
			rectangle[1] - ctx.viewBounds.min.y + this.sectionProperties.pageBackgroundInnerMargin,
			rectangle[2] - this.sectionProperties.pageBackgroundInnerMargin,
			rectangle[3] - this.sectionProperties.pageBackgroundInnerMargin);

		// We don't want to render page numbers to the background of pages any more. In this case we could set pageBackgroundFillColorWriter value once for all pages. I'll keep it for now.
		//this.context.fillStyle = this.sectionProperties.pageBackgroundTextColor;
		//this.context.fillText(String(pageNumber), Math.round((2 * rectangle[0] + rectangle[2]) * 0.5) - ctx.viewBounds.min.x, Math.round((2 * rectangle[1] + rectangle[3]) * 0.5) - ctx.viewBounds.min.y, rectangle[2] * 0.4);
	}

	private drawPageBackgroundFileBasedView (ctx: any, top: number, bottom: number) {
		var partHeightPixels: number = Math.round(this.map._docLayer._partHeightTwips * app.twipsToPixels);
		var gap: number = Math.round(this.map._docLayer._spaceBetweenParts * app.twipsToPixels);
		var partWidthPixels: number = Math.round(this.map._docLayer._partWidthTwips * app.twipsToPixels);
		var startY: number = (partHeightPixels + gap) * (top > 0 ? top -1: 0);
		var rectangle: Array<number>;

		for (var i: number = 0; i <= bottom - top; i++) {
			rectangle = [0, startY, partWidthPixels, partHeightPixels];

			this.context.strokeRect(
				rectangle[0] - ctx.viewBounds.min.x + this.sectionProperties.pageBackgroundInnerMargin,
				rectangle[1] - ctx.viewBounds.min.y + this.sectionProperties.pageBackgroundInnerMargin,
				rectangle[2] - this.sectionProperties.pageBackgroundInnerMargin,
				rectangle[3] - this.sectionProperties.pageBackgroundInnerMargin);

			this.context.fillText(String(i + top + 1),
				Math.round((2 * rectangle[0] + rectangle[2]) * 0.5) - ctx.viewBounds.min.x,
				Math.round((2 * rectangle[1] + rectangle[3]) * 0.5) - ctx.viewBounds.min.y,
				rectangle[2] * 0.4);

			startY += partHeightPixels + gap;
		}
	}

	private drawPageBackgrounds (ctx: any) {
		if (this.map._docLayer._docType !== 'text' && !app.file.fileBasedView)
			return; // For now, Writer and PDF view only.

		/* Note: Probably, Calc won't need this function but in case this is activated for Calc:
				* If the font change of context affects Calc drawings (headers etc), then one should set the font there.
				* Creating a temp variable like "oldFont" here is not a good solution in that case.
		*/

		if (!this.containerObject.getDocumentAnchorSection())
			return;

		this.context.fillStyle = this.sectionProperties.pageBackgroundTextColor;
		this.context.strokeStyle = this.sectionProperties.pageBackgroundBorderColor;
		this.context.lineWidth = app.roundedDpiScale;

		this.context.font = this.sectionProperties.pageBackgroundFont;

		if (this.map._docLayer._docType === 'text') {
			var viewRectangleTwips = [this.documentTopLeft[0], this.documentTopLeft[1], this.containerObject.getDocumentAnchorSection().size[0], this.containerObject.getDocumentAnchorSection().size[1]];
			viewRectangleTwips = viewRectangleTwips.map(function(element: number) {
				return Math.round(element * app.pixelsToTwips);
			});

			for (var i: number = 0; i < app.file.writer.pageRectangleList.length; i++) {
				var rectangle: any = app.file.writer.pageRectangleList[i];
				if ((rectangle[1] > viewRectangleTwips[1] && rectangle[1] < viewRectangleTwips[1] + viewRectangleTwips[3]) ||
					(rectangle[1] + rectangle[3] > viewRectangleTwips[1] && rectangle[1] + rectangle[3] < viewRectangleTwips[1] + viewRectangleTwips[3]) ||
					(rectangle[1] < viewRectangleTwips[1] && rectangle[1] + rectangle[3] > viewRectangleTwips[1] + viewRectangleTwips[3])) {

					this.drawPageBackgroundWriter(ctx, rectangle.slice(), i + 1);
				}
			}
		}
		else if (app.file.fileBasedView) { // Writer and fileBasedView can not be "true" at the same time.
			// PDF view supports only same-sized pages for now. So we can use simple math instead of a loop.
			var partHeightPixels: number = Math.round((this.map._docLayer._partHeightTwips + this.map._docLayer._spaceBetweenParts) * app.twipsToPixels);
			var visibleBounds: Array<number> = this.containerObject.getDocumentBounds();
			var topVisible: number = Math.floor(visibleBounds[1] / partHeightPixels);
			var bottomVisible: number = Math.ceil(visibleBounds[3] / partHeightPixels);

			// Check existence of pages.
			topVisible = topVisible >= 0 ? topVisible : 0;
			bottomVisible = bottomVisible < this.map._docLayer._parts ? bottomVisible : this.map._docLayer._parts - 1;

			if (!isNaN(partHeightPixels) && partHeightPixels > 0)
				this.drawPageBackgroundFileBasedView(ctx, topVisible, bottomVisible);
		}
	}

	public onDraw () {
		if (this.containerObject.isInZoomAnimation())
			return;

		if (this.containerObject.testing) {
			this.containerObject.createUpdateSingleDivElement(this);
		}

		var zoom = Math.round(this.map.getZoom());
		var part = this.sectionProperties.docLayer._selectedPart;
		var mode = this.sectionProperties.docLayer._selectedMode;

		// Calculate all this here intead of doing it per tile.
		var ctx = this.sectionProperties.tsManager._paintContext();

		if (this.sectionProperties.tsManager.waitForTiles()) {
			if (!this.haveAllTilesInView(zoom, part, mode, ctx))
				return;
		} else if (!this.containerObject.isZoomChanged()) {
			// Don't show page border and page numbers (drawn by drawPageBackgrounds) if zoom is changing
			// after a zoom animation.
			this.drawPageBackgrounds(ctx);
		}

		var docLayer = this.sectionProperties.docLayer;
		var doneTiles = new Set();
		var now = new Date();
		var debugForcePaint = this.sectionProperties.docLayer._debug;
		this.forEachTileInView(zoom, part, mode, ctx, function (tile: any, coords: any): boolean {
			if (doneTiles.has(coords.key()))
				return true;

			// Ensure tile is within document bounds.
			if (tile && docLayer._isValidTile(coords)) {
				if (!this.isJSDOM) { // perf-test code
					if (tile.hasContent() || debugForcePaint) { // Ensure tile is loaded
						this.paint(tile, ctx, false /* async? */, now);
					}
					else if (this.sectionProperties.docLayer._debug) {
						// when debugging draw a checkerboard for the missing tile
						var oldcanvas = tile.canvas;
						tile.canvas = this.checkpattern;
						this.paint(tile, ctx, false /* async? */, now);
						tile.canvas = oldcanvas;
					}
				}
			}
			doneTiles.add(coords.key());
			return true; // continue with remaining tiles.
		}.bind(this));
	}

	public onClick(point: Array<number>, e: MouseEvent) {
		// Slides pane is not focusable, we are using a variable to follow its focused state.
		// Until the pane is focusable, we will need to keep below check here.
		if (this.map._docLayer._docType === 'presentation' || this.map._docLayer._docType === 'drawing')
			this.map._docLayer._preview.partsFocused = false; // Parts (slide preview pane) is no longer focused, we need to set this here to avoid unwanted behavior.
	}

	// Return the fraction of intersection area with area1.
	static getTileIntersectionAreaFraction(tileBounds: any, viewBounds: any): number {

		var size = tileBounds.getSize();
		if (size.x <= 0 || size.y <= 0)
			return 0;

		var intersection = new L.Bounds(
			new L.Point(
				Math.max(tileBounds.min.x, viewBounds.min.x),
				Math.max(tileBounds.min.y, viewBounds.min.y)),
			new L.Point(
				Math.min(tileBounds.max.x, viewBounds.max.x),
				Math.min(tileBounds.max.y, viewBounds.max.y))
		);

		var interSize = intersection.getSize();
		return Math.max(0, interSize.x) * Math.max(0, interSize.y) / (size.x * size.y);
	}

	private forEachTileInArea(area: any, zoom: number, part: number, mode: number, ctx: any,
		callback: (tile: any, coords: any, section: TilesSection) => boolean) {
		var docLayer = this.sectionProperties.docLayer;

		if (app.file.fileBasedView) {
			var coordList: Array<any> = docLayer._updateFileBasedView(true, area, zoom);

			for (var k: number = 0; k < coordList.length; k++) {
				var coords = coordList[k];
				var key = coords.key();
				var tile = docLayer._tiles[key];
				if (tile)
					callback(tile, coords, this);
			}

			return;
		}

		var tileRange = docLayer._pxBoundsToTileRange(area);

		for (var j = tileRange.min.y; j <= tileRange.max.y; ++j) {
			for (var i = tileRange.min.x; i <= tileRange.max.x; ++i) {
				var coords = new L.TileCoordData(
					i * ctx.tileSize.x,
					j * ctx.tileSize.y,
					zoom,
					part,
					mode);

				var key = coords.key();
				var tile = docLayer._tiles[key];
				if (tile)
					callback(tile, coords, this);
			}
		}
	}

	/**
	 * Used for rendering a zoom-out frame, to determine which zoom level tiles
	 * to use for rendering.
	 *
	 * @param area specifies the document area in core-pixels at the current
	 * zoom level.
	 *
	 * @returns the zoom-level with maximum tile content.
	 */
	private zoomLevelWithMaxContentInArea(area: any,
		areaZoom: number, part: number, mode: number, ctx: any): number {

		var frameScale = this.sectionProperties.tsManager._zoomFrameScale;
		var docLayer = this.sectionProperties.docLayer;
		var targetZoom = Math.round(this.map.getScaleZoom(frameScale, areaZoom));
		var bestZoomLevel = targetZoom;
		var availAreaScoreAtBestZL = -Infinity; // Higher the better.
		var area = area.clone();
		if (area.min.x < 0)
			area.min.x = 0;
		if (area.min.y < 0)
			area.min.y = 0;

		var minZoom = <number> this.map.options.minZoom;
		var maxZoom = <number> this.map.options.maxZoom;
		for (var zoom = minZoom; zoom <= maxZoom; ++zoom) {
			var availAreaScore = 0; // Higher the better.
			var hasTiles = false;

			// To scale up missing-area scores to maxZoom as we need an
			// good resolution integer score at the end.
			var dimensionCorrection = this.map.zoomToFactor(maxZoom - zoom + this.map.options.zoom);

			// Compute area for zoom-level 'zoom'.
			var areaAtZoom = this.scaleBoundsForZoom(area, zoom, areaZoom);
			//console.log('DEBUG:: areaAtZoom = ' + areaAtZoom);
			var relScale = this.map.getZoomScale(zoom, areaZoom);

			this.forEachTileInArea(areaAtZoom, zoom, part, mode, ctx, function(tile, coords, section) {
				if (tile && tile.canvas) {
					var tilePos = coords.getPos();

					if (app.file.fileBasedView) {
						var ratio = ctx.tileSize.y * relScale / docLayer._tileHeightTwips;
						var partHeightPixels = Math.round((docLayer._partHeightTwips + docLayer._spaceBetweenParts) * ratio);
						tilePos.y = coords.part * partHeightPixels + tilePos.y;
					}

					var tileBounds = new L.Bounds(tilePos, tilePos.add(ctx.tileSize));
					var interFrac = TilesSection.getTileIntersectionAreaFraction(tileBounds, areaAtZoom);

					// Add to score how much of tile area is available.
					availAreaScore += interFrac;
					if (!hasTiles)
						hasTiles = true;
				}

				return true;
			});

			// Scale up with a correction factor to make area scores comparable b/w zoom levels.
			availAreaScore = hasTiles ? Math.round(availAreaScore
				* dimensionCorrection /* width */
				* dimensionCorrection /* height */
				/ 10 /* resolution control */) : -Infinity;

			// Accept this zoom if it has a lower missing-area score
			// In case of a tie we prefer tiles from a zoom level closer to targetZoom.
			if (availAreaScore > availAreaScoreAtBestZL ||
				(availAreaScore == availAreaScoreAtBestZL && Math.abs(targetZoom - bestZoomLevel) > Math.abs(targetZoom - zoom))) {
				availAreaScoreAtBestZL = availAreaScore;
				bestZoomLevel = zoom;
			}
		}

		return bestZoomLevel;
	}

	public ensureCanvas(tile: any, now: Date)
	{
		this.sectionProperties.docLayer.ensureCanvas(tile, now);
	}

	public drawTileToCanvas(tile: any, now: Date, canvas: CanvasRenderingContext2D,
							dx: number, dy: number, dWidth: number, dHeight: number)
	{
		this.ensureCanvas(tile, now);
		this.drawTileToCanvasCrop(tile, now, canvas,
								  0, 0, tile.canvas.width, tile.canvas.height,
								  dx, dy, dWidth, dHeight);
	}

	public drawTileToCanvasCrop(tile: any, now: Date, canvas: CanvasRenderingContext2D,
								sx: number, sy: number, sWidth: number, sHeight: number,
								dx: number, dy: number, dWidth: number, dHeight: number)
	{
		this.ensureCanvas(tile, now);

		/* if (!(tile.wireId % 4)) // great for debugging tile grid alignment.
				canvas.drawImage(this.checkpattern, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
		else */
		canvas.drawImage(tile.canvas, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

		if (this.sectionProperties.docLayer._debug)
		{
			this.beforeDraw(canvas);

			// clipping push - normally we avoid clipping for perf.
			canvas.save();
			const clipRegion = new Path2D();
			clipRegion.rect(dx, dy, dWidth, dHeight);
			canvas.clip(clipRegion);

			// want to render our bits 'inside' the tile - but we may have only part of it.
			// so offset our rendering and rely on clipping to help.
			const ox = -sx;
			const oy = -sy;
			const tSize = 256;

			// blue boundary line on tiles
			canvas.lineWidth = 1;
			canvas.strokeStyle = 'rgba(0, 0, 255, 0.8)';
			canvas.beginPath();
			canvas.moveTo(ox + dx + 0.5, oy + dy + 0.5);
			canvas.lineTo(ox + dx + 0.5, oy + dy + tSize + 0.5);
			canvas.lineTo(ox + dx + tSize + 0.5, oy + dy + tSize + 0.5);
			canvas.lineTo(ox + dx + tSize + 0.5, oy + dy + 0.5);
			canvas.lineTo(ox + dx + 0.5, oy + dy + 0.5);
			canvas.stroke();

			// state of the tile
			if (!tile.hasContent())
				canvas.fillStyle = 'rgba(255, 0, 0, 0.8)';   // red
			else if (tile.needsFetch())
				canvas.fillStyle = 'rgba(255, 255, 0, 0.8)'; // yellow
			else // present
				canvas.fillStyle = 'rgba(0, 255, 0, 0.5)';   // green
			canvas.fillRect(ox + dx + 1.5, oy + dy + 1.5, 12, 12);

			// deltas graph
			if (tile.deltaCount)
			{
				canvas.fillStyle = 'rgba(0, 0, 128, 0.3)';
				var deltaSize = 4;
				var maxDeltas = (tSize - 16) / deltaSize;
				var rowBlock = Math.floor(tile.deltaCount / maxDeltas);
				var rowLeft = tile.deltaCount % maxDeltas;
				if (rowBlock > 0)
					canvas.fillRect(ox + dx + 1.5 + 14, oy + dy + 1.5, maxDeltas * deltaSize, rowBlock * deltaSize);
				else
					canvas.fillRect(ox + dx + 1.5 + 14, oy + dy + 1.5 + rowBlock * deltaSize, rowLeft * deltaSize, deltaSize);
			}

			// Metrics on-top of the tile:
			var lines = [
				'wireId: ' + tile.wireId,
				'invalidFrom: ' + tile.invalidFrom,
				'nviewid: ' + tile.viewId,
				'requested: ' + tile._debugInvalidateCount,
				'rec-tiles: ' + tile._debugLoadTile,
				'recv-delta: ' + tile._debugLoadDelta,
				'rawdeltas: ' + (tile.rawDeltas ? tile.rawDeltas.length : 0)
			];
// FIXME: generate metrics of how long a tile has been visible & invalid for.
//			if (tile._debugTime && tile._debugTime.date !== 0)
//					lines.push(this.sectionProperties.docLayer._debugSetTimes(tile._debugTime, +new Date() - tile._debugTime.date));

			const startY = tSize - 12 * lines.length;

			// background
			canvas.fillStyle = 'rgba(220, 220, 220, 0.5)'; // greyish
			canvas.fillRect(ox + dx + 1.5, oy + dy + startY - 12.0, 100, 12 * lines.length + 8.0);

			canvas.font = '12px sans';
			canvas.fillStyle = 'rgba(0, 0, 0, 1.0)';   // black
			canvas.textAlign = 'left';
			for (var i = 0 ; i < lines.length; ++i)
					canvas.fillText(lines[i], ox + dx + 5.5, oy + dy + startY + i*12);

			canvas.restore();
			this.afterDraw(canvas);
		}
	}

	// Called by tsManager to draw a zoom animation frame.
	public drawZoomFrame(ctx?: any) {
		var tsManager = this.sectionProperties.tsManager;
		if (!tsManager._inZoomAnim)
			return;

		var scale = tsManager._zoomFrameScale;
		if (!scale || !tsManager._newCenter)
			return;

		ctx = ctx || this.sectionProperties.tsManager._paintContext();
		var docLayer = this.sectionProperties.docLayer;
		var zoom = Math.round(this.map.getZoom());
		var part = docLayer._selectedPart;
		var mode = docLayer._selectedMode;
		var splitPos = ctx.splitPos;

		this.containerObject.setPenPosition(this);
		var viewSize = ctx.viewBounds.getSize();
		// clear the document area first.
		this.context.fillStyle = this.containerObject.getClearColor();
		this.context.fillRect(0, 0, viewSize.x, viewSize.y);

		var paneBoundsList = ctx.paneBoundsList;

		for (var k = 0; k < paneBoundsList.length ; ++k) {
			var paneBounds = paneBoundsList[k];
			var paneSize = paneBounds.getSize();

			// Calculate top-left in doc core-pixels for the frame.
			var docPos = tsManager._getZoomDocPos(tsManager._newCenter, paneBounds, splitPos, scale, false /* findFreePaneCenter? */);

			var destPos = new L.Point(0, 0);
			var docAreaSize = paneSize.divideBy(scale);
			if (paneBoundsList.length > 1) {
				if (paneBounds.min.x) {
					// Pane is free to move in X direction.
					destPos.x = splitPos.x;
					paneSize.x -= splitPos.x;
				} else {
					// Pane is fixed in X direction.
					docAreaSize.x = paneSize.x;
				}

				if (paneBounds.min.y) {
					// Pane is free to move in Y direction.
					destPos.y = splitPos.y;
					paneSize.y -= splitPos.y;
				} else {
					// Pane is fixed in Y direction.
					docAreaSize.y = paneSize.y;
				}
			}

			var docRange = new L.Bounds(docPos.topLeft, docPos.topLeft.add(docAreaSize));
			if (tsManager._calcGridSection) {
				tsManager._calcGridSection.onDrawArea(docRange, docRange.min.subtract(destPos), this.context);
			}
			var canvasContext = this.context;

			var bestZoomSrc = zoom;
			var sheetGeometry = docLayer.sheetGeometry;
			var useSheetGeometry = false;
			if (scale < 1.0) {
				useSheetGeometry = !!sheetGeometry;
				bestZoomSrc = this.zoomLevelWithMaxContentInArea(docRange, zoom, part, mode, ctx);
			}

			var docRangeScaled = (bestZoomSrc == zoom) ? docRange : this.scaleBoundsForZoom(docRange, bestZoomSrc, zoom);
			var destPosScaled = (bestZoomSrc == zoom) ? destPos : this.scalePosForZoom(destPos, bestZoomSrc, zoom);
			var relScale = (bestZoomSrc == zoom) ? 1 : this.map.getZoomScale(bestZoomSrc, zoom);

			this.beforeDraw(canvasContext);
			var now = new Date();
			this.forEachTileInArea(docRangeScaled, bestZoomSrc, part, mode, ctx, function (tile, coords, section): boolean {
				if (!tile || !tile.hasContent() || !docLayer._isValidTile(coords))
					return false;

				var tileCoords = tile.coords.getPos();
				if (app.file.fileBasedView) {
					var ratio = ctx.tileSize.y * relScale / docLayer._tileHeightTwips;
					var partHeightPixels = Math.round((docLayer._partHeightTwips + docLayer._spaceBetweenParts) * ratio);
					tileCoords.y = tile.coords.part * partHeightPixels + tileCoords.y;
				}
				var tileBounds = new L.Bounds(tileCoords, tileCoords.add(ctx.tileSize));

				var crop = new L.Bounds(tileBounds.min, tileBounds.max);
				crop.min.x = Math.max(docRangeScaled.min.x, tileBounds.min.x);
				crop.min.y = Math.max(docRangeScaled.min.y, tileBounds.min.y);
				crop.max.x = Math.min(docRangeScaled.max.x, tileBounds.max.x);
				crop.max.y = Math.min(docRangeScaled.max.y, tileBounds.max.y);

				var cropWidth = crop.max.x - crop.min.x;
				var cropHeight = crop.max.y - crop.min.y;

				var tileOffset = crop.min.subtract(tileBounds.min);
				var paneOffset = crop.min.subtract(docRangeScaled.min.subtract(destPosScaled));
				if (cropWidth && cropHeight) {
						section.drawTileToCanvasCrop(
								tile, now, canvasContext,
								tileOffset.x, tileOffset.y, // source x, y
								cropWidth, cropHeight, // source size
								// Destination x, y, w, h (In non-Chrome browsers it leaves lines without the 0.5 correction).
								Math.floor(paneOffset.x / relScale * scale) + 0.5, // Destination x
								Math.floor(paneOffset.y / relScale * scale) + 0.5, // Destination y
								Math.floor((cropWidth / relScale) * scale) + 1.5,    // Destination width
								Math.floor((cropHeight / relScale) * scale) + 1.5);    // Destination height
				}

				return true;
			}); // end of forEachTileInArea call.
			this.afterDraw(canvasContext);

		} // End of pane bounds list loop.

	}

	private scalePosForZoom(pos: any, toZoom: number, fromZoom: number): any {
		var docLayer = this.sectionProperties.docLayer;
		var convScale = this.map.getZoomScale(toZoom, fromZoom);

		if (docLayer.sheetGeometry) {
			var toScale = convScale * docLayer._tileSize * 15.0 / docLayer._tileWidthTwips;
			toScale = docLayer._tileSize * 15.0 / Math.round(15.0 * docLayer._tileSize / toScale);
			var posScaled = docLayer.sheetGeometry.getCorePixelsAtZoom(pos, toScale);
			return posScaled;
		}

		return pos.multiplyBy(convScale);
	}

	private scaleBoundsForZoom(corePxBounds: any, toZoom: number, fromZoom: number) {
		var docLayer = this.sectionProperties.docLayer;
		var convScale = this.map.getZoomScale(toZoom, fromZoom);

		if (docLayer.sheetGeometry) {

			var topLeft = this.scalePosForZoom(corePxBounds.min, toZoom, fromZoom);
			var size = corePxBounds.getSize().multiplyBy(convScale);
			return new L.Bounds(
				topLeft,
				topLeft.add(size)
			);
		}

		return new L.Bounds(
			corePxBounds.min.multiplyBy(convScale),
			corePxBounds.max.multiplyBy(convScale)
		);
	}
}

L.getNewTilesSection = function () {
	return new TilesSection();
};
