/// <reference path="CPoint.ts" />
/// <reference path="CBounds.ts" />
/// <reference path="CPath.ts" />
/// <reference path="CPolyline.ts" />
/// <reference path="CPolygon.ts" />
/// <reference path="CRectangle.ts" />
/// <reference path="CSplitterLine.ts" />
/// <reference path="../marker/Cursor.ts" />
/* eslint-disable */

// CanvasOverlay handles CPath rendering and mouse events handling via overlay-section of the main canvas.
// where overlays like cell-cursors, cell-selections, edit-cursors are instances of CPath or its subclasses.
class CanvasOverlay {
	private map: any;
	private ctx: CanvasRenderingContext2D;
	private paths: Map<number, any>;
	private bounds: CBounds;
	private tsManager: any;
	private overlaySection: any;

	constructor(mapObject: any, canvasContext: CanvasRenderingContext2D) {
		this.map = mapObject;
		this.ctx = canvasContext;
		this.tsManager = this.map.getTileSectionMgr();
		this.overlaySection = undefined;
		this.paths = new Map<number, CPath>();
		this.updateCanvasBounds();
	}

	onInitialize() {
	}

	onResize() {
		this.paths.forEach(function (path: CPath) {
			path.onResize();
		});
		this.onDraw();
	}

	onDraw() {
		// No need to "erase" previous drawings because tiles are draw first via its onDraw.
		this.draw();
	}

	onMouseMove(position: Array<number>) {
		var mousePos = new CPoint(position[0], position[1]);
		this.paths.forEach(function (path:CPath) {
			var pathBounds = path.getBounds();

			if (!pathBounds.isValid())
				return;

			var mouseOverPath = pathBounds.contains(mousePos);
			if (mouseOverPath && !path.isUnderMouse()) {
				path.onMouseEnter(mousePos);
				path.setUnderMouse(true);
			} else if (!mouseOverPath && path.isUnderMouse()) {
				path.onMouseLeave(mousePos);
				path.setUnderMouse(false);
			}
		});
	}

	setOverlaySection(overlaySection: any) {
		this.overlaySection = overlaySection;
	}

	getTestDivContainer(): HTMLDivElement {
		return this.overlaySection.getTestDivContainer();
	}

	setPenOnOverlay() {
		this.overlaySection.containerObject.setPenPosition(this.overlaySection);
	}

	initPath(path: CPath) {
		var pathId: number = path.getId();
		this.paths.set(pathId, path);
		path.setRenderer(this);
		this.setPenOnOverlay();
		path.updatePathAllPanes();
	}

	removePath(path: CPath) {
		// This does not get called via onDraw, so ask tileSection to "erase" by painting over.
		this.tsManager._tilesSection.onDraw();
		path.setDeleted();
		this.paths.delete(path.getId());
		this.draw();
	}

	updatePath(path: CPath, oldBounds: CBounds) {
		this.redraw(path, oldBounds);
	}

	updateStyle(path: CPath, oldBounds: CBounds) {
		this.redraw(path, oldBounds);
	}

	paintRegion(paintArea: CBounds) {
		this.draw(paintArea);
	}

	getSplitPanesContext(): any {
		return this.map.getSplitPanesContext();
	}

	private isVisible(path: CPath): boolean {
		var pathBounds = path.getBounds();
		if (!pathBounds.isValid())
			return false;
		return this.intersectsVisible(pathBounds);
	}

	private intersectsVisible(queryBounds: CBounds): boolean {
		this.updateCanvasBounds();
		var spc = this.getSplitPanesContext();
		return spc ? spc.intersectsVisible(queryBounds) : this.bounds.intersects(queryBounds);
	}

	private draw(paintArea?: CBounds) {
		var orderedPaths = Array<CPath>();
		this.paths.forEach((path: CPath) => {
			orderedPaths.push(path);
		});

		// Sort in ascending order w.r.t zIndex.
		// TODO: cache this operation away whenever possible.
		orderedPaths.sort((a: CPath, b: CPath): number => {
			return a.zIndex - b.zIndex;
		});

		var renderer = this;
		orderedPaths.forEach((path: CPath) => {
			if (renderer.isVisible(path))
				path.updatePathAllPanes(paintArea);
		});
	}

	private redraw(path: CPath, oldBounds: CBounds) {
		if (!this.isVisible(path) && (!oldBounds.isValid() || !this.intersectsVisible(oldBounds)))
			return;
		// This does not get called via onDraw(ie, tiles aren't painted), so ask tileSection to "erase" by painting over.
		// Repainting the whole canvas is not necessary but finding the minimum area to paint over
		// is potentially expensive to compute (think of overlapped path objects).
		// TODO: We could repaint the area on the canvas occupied by all the visible path-objects
		// and paint tiles just for that, but need a more general version of _tilesSection.onDraw() and callees.
		this.tsManager.clearTilesSection();
		this.tsManager._tilesSection.onDraw();
		this.draw();
	}

	private updateCanvasBounds() {
		var viewBounds: any = this.map.getPixelBoundsCore();
		this.bounds = new CBounds(new CPoint(viewBounds.min.x, viewBounds.min.y), new CPoint(viewBounds.max.x, viewBounds.max.y));
	}

	getBounds(): CBounds {
		this.updateCanvasBounds();
		return this.bounds;
	}

	// Applies canvas translation so that polygons/circles can be drawn using core-pixel coordinates.
	private ctStart(clipArea?: CBounds, paneBounds?: CBounds, fixed?: boolean) {
		this.updateCanvasBounds();
		var cOrigin = new CPoint(0, 0);
		this.ctx.save();

		if (!paneBounds)
			paneBounds = this.bounds.clone();

		if (this.tsManager._inZoomAnim && !fixed) {
			// zoom-animation is in progress : so draw overlay on main canvas
			// at the current frame's zoom level.
			paneBounds = CBounds.fromCompat(paneBounds);
			var splitPos = this.tsManager.getSplitPos();
			var scale = this.tsManager._zoomFrameScale;
			var pinchCenter = this.tsManager._newCenter;

			var center = paneBounds.min.clone();
			if (pinchCenter.x >= paneBounds.min.x && pinchCenter.x <= paneBounds.max.x)
				center.x = pinchCenter.x;
			if (pinchCenter.y >= paneBounds.min.y && pinchCenter.y <= paneBounds.max.y)
				center.y = pinchCenter.y;

			// Compute the new top left in core pixels that ties with the origin of overlay canvas section.
			var newTopLeft = new CPoint(
				Math.max(0,
					-splitPos.x - 1 + (center.x - (center.x - paneBounds.min.x) / scale)),
				Math.max(0,
					-splitPos.y - 1 + (center.y - (center.y - paneBounds.min.y) / scale)));

			// Set canvas section's unscaled origin for the transformation matrix.
			cOrigin.x = -newTopLeft.x;
			cOrigin.y = -newTopLeft.y;

			// Compute clip area which needs to be applied after setting the transformation.
			var clipTopLeft = new CPoint(0, 0);
			// Original pane size.
			var paneSize = paneBounds.getSize();
			var clipSize = paneSize.clone();
			if (paneBounds.min.x) {
				clipTopLeft.x = newTopLeft.x + splitPos.x;
				// Pane's "free" size will shrink(expand) as we zoom in(out)
				// respectively because fixed pane size expand(shrink).
				clipSize.x = (paneSize.x - splitPos.x * (scale - 1)) / scale;
			}
			if (paneBounds.min.y) {
				clipTopLeft.y = newTopLeft.y + splitPos.y;
				// See comment regarding pane width above.
				clipSize.y = (paneSize.y - splitPos.y * (scale - 1)) / scale;
			}
			// Force clip area to the zoom frame area of the pane specified.
			clipArea = new CBounds(
				clipTopLeft,
				clipTopLeft.add(clipSize));

			this.ctx.transform(scale, 0, 0, scale, scale * cOrigin.x, scale * cOrigin.y);

		} else if (this.tsManager._inZoomAnim && fixed) {

			var scale = this.tsManager._zoomFrameScale;
			this.ctx.transform(scale, 0, 0, scale, 0, 0);

			if (clipArea) {
				clipArea = new CBounds(
					clipArea.min.divideBy(scale),
					clipArea.max.divideBy(scale)
				);
			}

		} else {
			if (paneBounds.min.x)
				cOrigin.x = -this.bounds.min.x;
			if (paneBounds.min.y)
				cOrigin.y = -this.bounds.min.y;

			this.ctx.translate(cOrigin.x, cOrigin.y);
		}

		if (clipArea) {
			this.ctx.beginPath();
			var clipSize = clipArea.getSize();
			this.ctx.rect(clipArea.min.x, clipArea.min.y, clipSize.x, clipSize.y);
			this.ctx.clip();
		}
	}

	// Undo the canvas translation done by ctStart().
	private ctEnd() {
		this.ctx.restore();
	}

	updatePoly(path: CPath, closed: boolean = false, clipArea?: CBounds, paneBounds?: CBounds) {
		var i: number;
		var j: number;
		var len2: number;
		var part: CPoint;
		var parts = path.getParts();
		var len: number = parts.length;

		if (!len)
			return;


		this.ctStart(clipArea, paneBounds, path.fixed);
		this.ctx.beginPath();

		for (i = 0; i < len; i++) {
			for (j = 0, len2 = parts[i].length; j < len2; j++) {
				part = parts[i][j];
				this.ctx[j ? 'lineTo' : 'moveTo'](part.x, part.y);
			}
			if (closed) {
				this.ctx.closePath();
			}
		}

		this.fillStroke(path);

		this.ctEnd();
	}

	updateCircle(path: CPath, clipArea?: CBounds, paneBounds?: CBounds) {
		if (path.empty())
			return;

		this.ctStart(clipArea, paneBounds, path.fixed);

		var point = path.point;
		var r: number = path.radius;
		var s: number = (path.radiusY || r) / r;

		if (s !== 1) {
			this.ctx.save();
			this.ctx.scale(1, s);
		}

		this.ctx.beginPath();
		this.ctx.arc(point.x, point.y / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			this.ctx.restore();
		}

		this.fillStroke(path);

		this.ctEnd();
	}

	private fillStroke(path: CPath) {

		if (path.fill) {
			this.ctx.globalAlpha = path.fillOpacity;
			this.ctx.fillStyle = path.fillColor || path.color;
			this.ctx.fill(path.fillRule || 'evenodd');
		}

		if (path.stroke && path.weight !== 0) {
			this.ctx.globalAlpha = path.opacity;

			this.ctx.lineWidth = this.tsManager._inZoomAnim ?
				path.weight / this.tsManager._zoomFrameScale : path.weight;
			this.ctx.strokeStyle = path.color;
			this.ctx.lineCap = path.lineCap;
			this.ctx.lineJoin = path.lineJoin;
			this.ctx.stroke();
		}

	}

	bringToFront(path: CPath) {
		// TODO: Implement this.
	}

	bringToBack(path: CPath) {
		// TODO: Implement this.
	}

	getMap(): any {
		return this.map;
	}
};
