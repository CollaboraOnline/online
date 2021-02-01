/// <reference path="CPoint.ts" />
/// <reference path="CBounds.ts" />
/// <reference path="CPath.ts" />
/// <reference path="CPolyline.ts" />
/// <reference path="CPolygon.ts" />
/* eslint-disable */

// CanvasOverlay handles CPath rendering and mouse events handling via overlay-section of the main canvas.
class CanvasOverlay {
	private map: any;
	private ctx: CanvasRenderingContext2D;
	private paths: Map<number, any>;
	private bounds: CBounds;
	private tsManager: any;

	constructor(mapObject: any, canvasContext: CanvasRenderingContext2D) {
		this.map = mapObject;
		this.ctx = canvasContext;
		this.tsManager = this.map.getTileSectionMgr();
		this.paths = new Map<number, CPath>();
		this.updateCanvasBounds();
	}

	onInitialize() {
	}

	onResize() {
		this.onDraw();
	}

	onDraw() {
		// No need to "erase" previous drawings because tiles are draw first via its onDraw.
		this.draw();
	}

	initPath(path: CPath) {
		var pathId: number = path.getId();
		this.paths.set(pathId, path);
		path.setRenderer(this);
		path.updatePathAllPanes();
	}

	removePath(path: CPath) {
		// This does not get called via onDraw, so ask tileSection to "erase" by painting over.
		this.tsManager._onTilesSectionDraw();
		path.setDeleted();
		this.paths.delete(path.getId());
		this.draw();
	}

	updatePath(path: CPath) {
		this.redraw(path);
	}

	updateStyle(path: CPath) {
		this.redraw(path);
	}

	paintRegion(paintArea: CBounds) {
		this.draw(paintArea);
	}

	getSplitPanesContext(): any {
		return this.map.getSplitPanesContext();
	}

	private isVisible(path: CPath): boolean {
		var pathBounds = path.getBounds();
		this.updateCanvasBounds();
		var spc = this.getSplitPanesContext();
		return spc ? spc.intersectsVisible(pathBounds) : this.bounds.intersects(pathBounds);
	}

	private draw(paintArea?: CBounds) {
		var orderedPaths = Array<CPath>();
		this.paths.forEach((path: CPath) => {
			orderedPaths.push(path);
		});

		// Sort in ascending order w.r.t zIndex.
		// TODO: cache this operation away whenever possible.
		orderedPaths.sort((a: CPath, b: CPath) : number => {
			return a.zIndex - b.zIndex;
		});

		var renderer = this;
		orderedPaths.forEach((path: CPath) => {
			if (renderer.isVisible(path))
				path.updatePathAllPanes(paintArea);
		});
	}

	private redraw(path: CPath) {
		if (!this.isVisible(path))
			return;
		// This does not get called via onDraw(ie, tiles aren't painted), so ask tileSection to "erase" by painting over.
		// Repainting the whole canvas is not necessary but finding the minimum area to paint over
		// is potentially expensive to compute (think of overlapped path objects).
		// TODO: We could repaint the area on the canvas occupied by all the visible path-objects
		// and paint tiles just for that, but need a more general version of _onTilesSectionDraw() and callees.
		this.tsManager._onTilesSectionDraw();
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
	private ctStart(paneXFixed?: boolean, paneYFixed?: boolean, clipArea?: CBounds) {
		this.updateCanvasBounds();
		var docTopLeft = this.bounds.getTopLeft();
		var cOrigin = new CPoint(0, 0);

		this.ctx.save();

		if (!paneXFixed)
			cOrigin.x = -docTopLeft.x;
		if (!paneYFixed)
			cOrigin.y = -docTopLeft.y;

		this.ctx.translate(cOrigin.x, cOrigin.y);
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

	updatePoly(path: CPath, closed: boolean = false, paneXFixed?: boolean, paneYFixed?: boolean, clipArea?: CBounds) {
		var i: number;
		var j: number;
		var len2: number;
		var part: CPoint;
		var parts = path.getParts();
		var len: number = parts.length;

		if (!len)
			return;


		this.ctStart(paneXFixed, paneYFixed, clipArea);
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

	updateCircle(path: CPath, paneXFixed?: boolean, paneYFixed?: boolean) {
		if (path.empty())
			return;

		this.ctStart(paneXFixed, paneYFixed);

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

			this.ctx.lineWidth = path.weight;
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
};
