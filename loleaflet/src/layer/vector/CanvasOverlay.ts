/* eslint-disable */

// CanvasOverlay handles CPath rendering and mouse events handling via overlay-section of the main canvas.
class CanvasOverlay {
	private map: any;
	private ctx: CanvasRenderingContext2D;
	private paths: Map<number, any>;
	private bounds: Array<number>;
	private docTopLeft: Array<number> = [0, 0];
	private tsManager: any;

	constructor(mapObject: any, canvasContext: CanvasRenderingContext2D) {
		this.map = mapObject;
		this.ctx = canvasContext;
		this.tsManager = this.map.getTileSectionMgr();
		this.paths = new Map<number, any>();
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

	initPath(path: any) {
		var pathId: number = path.getId();
		this.paths.set(pathId, path);
	}

	removePath(path: any) {
		// This does not get called via onDraw, so ask tileSection to "erase" by painting over.
		this.tsManager._onTilesSectionDraw();
		path.setDeleted();
		this.paths.delete(path.getId());
	}

	updatePath(path: any) {
		this.redraw(path);
	}

	updateStyle(path: any) {
		this.redraw(path);
	}

	private static intersects(bound1: Array<number>, bound2: Array<number>): boolean {
		// check if both X and Y segments intersect.
		return (bound2[2] >= bound1[0] && bound2[0] <= bound1[2] &&
			bound2[3] >= bound1[1] && bound2[1] <= bound1[3]);
	}

	private isVisible(path: any): boolean {
		var pathBounds = path.getBounds();
		this.updateCanvasBounds();
		return CanvasOverlay.intersects(pathBounds, this.bounds);
	}

	private draw() {
		this.paths.forEach((path: any) => {
			path.updatePath();
		});
	}

	private redraw(path: any) {
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
		this.bounds = Array(viewBounds.min.x, viewBounds.min.y, viewBounds.max.x, viewBounds.max.y);
	}

	// Applies canvas translation so that polygons/circles can be drawn using core-pixel coordinates.
	private ctStart() {
		this.updateCanvasBounds();
		this.docTopLeft = Array(this.bounds[0], this.bounds[1]);
		this.ctx.translate(this.docTopLeft[0], this.docTopLeft[1]);
	}

	// Undo the canvas translation done by ctStart().
	private ctEnd() {
		this.ctx.translate(-this.docTopLeft[0], -this.docTopLeft[0]);
	}

	updatePoly(path: any, closed: boolean) {
		var i: number;
		var j: number;
		var len2: number;
		var part: any;
		var parts: Array<any> = path.getParts();
		var len: number = parts.length;

		if (!len)
			return;

		this.ctStart();
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

	updateCircle(path: any) {
		if (path.empty())
			return;

		this.ctStart();

		var point: Array<number> = path.point;
		var r: number = path.radius;
		var s: number = (path._radiusY || r) / r;

		if (s !== 1) {
			this.ctx.save();
			this.ctx.scale(1, s);
		}

		this.ctx.beginPath();
		this.ctx.arc(point[0], point[1] / s, r, 0, Math.PI * 2, false);

		if (s !== 1) {
			this.ctx.restore();
		}

		this.fillStroke(path);

		this.ctEnd();
	}

	private fillStroke(path: any) {
		var options: any = path.options;

		if (options.fill) {
			this.ctx.globalAlpha = options.fillOpacity;
			this.ctx.fillStyle = options.fillColor || options.color;
			this.ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke && options.weight !== 0) {
			this.ctx.globalAlpha = options.opacity;

			this.ctx.lineWidth = options.weight;
			this.ctx.strokeStyle = options.color;
			this.ctx.lineCap = options.lineCap;
			this.ctx.lineJoin = options.lineJoin;
			this.ctx.stroke();
		}

	}
};
