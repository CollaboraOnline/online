/* eslint-disable */

/*
 * CPath is the base class for all vector paths like polygons and circles.
 */

abstract class CPath {
	stroke: boolean = true;
	color: string = '#3388ff';
	weight: number = 3;
	opacity: number = 1;
	lineCap: CanvasLineCap = 'round';
	lineJoin: CanvasLineJoin = 'round';
	fill: boolean = false;
	fillColor: string = this.color;
	fillOpacity: number = 0.2;
	fillRule: CanvasFillRule = 'evenodd';
	interactive: boolean = true;
	fixed: boolean = false;
	cursorType: string;

	radius: number = 0;
	radiusY: number = 0;
	point: CPoint;
	zIndex: number = 0;

	static countObjects: number = 0;
	static isTouchDevice: boolean = false; // Need to set this from current L.Browser.touch
	private id: number;
	private isDeleted: boolean = false;
	protected renderer: CanvasOverlay = null;

	constructor(options: any) {
		this.setStyleOptions(options);

		this.radius = options.radius !== undefined ? options.radius : this.radius;
		this.radiusY = options.radiusY !== undefined ? options.radiusY : this.radiusY;
		this.point = options.point !== undefined ? options.point : this.point;

		CPath.countObjects += 1;
		this.id = CPath.countObjects;
		this.zIndex = this.id;
	}

	setStyleOptions(options: any) {
		this.stroke = options.stroke !== undefined ? options.stroke : this.stroke;
		this.color = options.color !== undefined ? options.color : this.color;
		this.weight = options.weight !== undefined ? options.weight : this.weight;
		this.opacity = options.opacity !== undefined ? options.opacity : this.opacity;
		this.lineCap = options.lineCap !== undefined ? options.lineCap : this.lineCap;
		this.lineJoin = options.lineJoin !== undefined ? options.lineJoin : this.lineJoin;
		this.fill = options.fill !== undefined ? options.fill : this.fill;
		this.fillColor = options.fillColor !== undefined ? options.fillColor : this.fillColor;
		this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : this.fillOpacity;
		this.fillRule = options.fillRule !== undefined ? options.fillRule : this.fillRule;
		this.cursorType = options.cursorType !== undefined ? options.cursorType : this.cursorType;
		this.interactive = options.interactive !== undefined ? options.interactive : this.interactive;
		this.fixed = options.fixed !== undefined ? options.fixed : this.fixed;
	}

	setRenderer(rendererObj: CanvasOverlay) {
		this.renderer = rendererObj;
	}

	getId(): number {
		return this.id;
	}

	setDeleted() {
		this.isDeleted = true;
	}

	redraw() {
		if (this.renderer)
			this.renderer.updatePath(this);
	}

	setStyle(style: any) {
		this.setStyleOptions(style);
		if (this.renderer) {
			this.renderer.updateStyle(this);
		}
	}

	updatePathAllPanes(paintArea?: CBounds) {
		var viewBounds = this.renderer.getBounds().clone();

		var splitPanesContext = this.renderer.getSplitPanesContext();
		var paneBoundsList: Array<CBounds> = splitPanesContext ?
		    splitPanesContext.getPxBoundList() :
			[viewBounds];
		var paneProperties = splitPanesContext ? splitPanesContext.getPanesProperties() :
			[{ xFixed : false, yFixed: false }];

		for (var i = 0; i < paneBoundsList.length; ++i) {
			var panePaintArea = paintArea ? paintArea.clone() : paneBoundsList[i].clone();
			if (paintArea) {
				var paneArea = paneBoundsList[i];

				if (!paneArea.intersects(panePaintArea))
					continue;

				panePaintArea.min.x = Math.max(panePaintArea.min.x, paneArea.min.x);
				panePaintArea.min.y = Math.max(panePaintArea.min.y, paneArea.min.y);

				panePaintArea.max.x = Math.min(panePaintArea.max.x, paneArea.max.x);
				panePaintArea.max.y = Math.min(panePaintArea.max.y, paneArea.max.y);
			}

			this.updatePath(panePaintArea, paneProperties[i].xFixed, paneProperties[i].yFixed);
		}
	}

	updatePath(paintArea?: CBounds, paneXFixed?: boolean, paneYFixed?: boolean) {
		// Overridden in implementations.
	}

	bringToFront() {
		if (this.renderer) {
			this.renderer.bringToFront(this);
		}
	}

	bringToBack() {
		if (this.renderer) {
			this.renderer.bringToBack(this);
		}
	}

	getBounds(): CBounds {
		// Overridden in implementations.
		return undefined;
	}

	empty(): boolean {
		// Overridden in implementations.
		return true;
	}

	getParts(): Array<Array<CPoint>> {
		// Overridden in implementations.
		return Array<Array<CPoint>>();
	}

	clickTolerance(): number {
		// used when doing hit detection for Canvas layers
		return (this.stroke ? this.weight / 2 : 0) + (CPath.isTouchDevice ? 10 : 0);
	}

	setCursorType(cursorType: string) {
		// TODO: Implement this using move-move + hover handler.
		this.cursorType = cursorType;
	}

};