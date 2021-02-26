/// <reference path="CEventsHandler.ts" />
/* eslint-disable */

declare var L: any;

/*
 * CPath is the base class for all vector paths like polygons and circles used to draw overlay
 * objects like cell-cursors, cell-selections etc.
 */

abstract class CPath extends CEventsHandler {
	name: string = "";
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
	fixed: boolean = false; // CPath coordinates are the same as overlay section coordinates.
	cursorType: string;
	thickness: number = 2;
	toCompatUnits: Function;

	radius: number = 0;
	radiusY: number = 0;
	point: CPoint;
	zIndex: number = 0;

	static countObjects: number = 0;
	static isTouchDevice: boolean = false; // Need to set this from current L.Browser.touch
	private id: number;
	private isDeleted: boolean = false;
	private testDiv: HTMLDivElement;
	protected renderer: CanvasOverlay = null;
	protected underMouse: boolean = false;
	private popup: any;
	private popupHandlersAdded: boolean = false;
	private popupTimer: NodeJS.Timeout;

	constructor(options: any) {
		super();
		this.setStyleOptions(options);

		this.radius = options.radius !== undefined ? options.radius : this.radius;
		this.radiusY = options.radiusY !== undefined ? options.radiusY : this.radiusY;
		this.point = options.point !== undefined ? options.point : this.point;
		this.toCompatUnits = options.toCompatUnits !== undefined ? options.toCompatUnits : this.toCompatUnits;

		CPath.countObjects += 1;
		this.id = CPath.countObjects;
		this.zIndex = this.id;
		this.addSupportedEvents(['popupopen', 'popupclose']);
	}

	setStyleOptions(options: any) {
		this.name = options.name !== undefined ? options.name : this.name;
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
		this.thickness = options.thickness !== undefined ? options.thickness : this.thickness;
		this.interactive = options.interactive !== undefined ? options.interactive : this.interactive;
		this.fixed = options.fixed !== undefined ? options.fixed : this.fixed;
	}

	setRenderer(rendererObj: CanvasOverlay) {
		this.renderer = rendererObj;
		if (this.renderer) {
			this.addPathTestDiv();
		}
		this.fire('add');
	}

	// Adds a div for cypress-tests (if active) for this CPath if not already done.
	private addPathTestDiv() {
		var testContainer = this.renderer.getTestDivContainer();
		if (testContainer && !this.testDiv) {
			this.testDiv = document.createElement('div');
			this.testDiv.id = 'test-div-overlay-' + this.name;
			testContainer.appendChild(this.testDiv);
		}
	}

	// Used by cypress tests to assert on the bounds of CPaths.
	protected updateTestData() {
		if (!this.testDiv)
			return;
		var bounds = this.getBounds();
		if (this.empty() || !bounds.isValid()) {
			this.testDiv.innerText = '{}';
			return;
		}

		var topLeft = bounds.getTopLeft();
		var size = bounds.getSize();
		this.testDiv.innerText = JSON.stringify({
			top: topLeft.y,
			left: topLeft.x,
			width: size.x,
			height: size.y
		});
	}

	getId(): number {
		return this.id;
	}

	setDeleted() {
		this.fire('remove');
		this.isDeleted = true;
		if (this.testDiv) {
			this.testDiv.remove();
			this.testDiv = undefined;
		}
	}

	isUnderMouse(): boolean {
		return this.underMouse;
	}

	setUnderMouse(isUnder: boolean) {
		this.underMouse = isUnder;
	}

	onMouseEnter(position: CPoint) {
		this.fire('mouseenter');
	}

	onMouseLeave(position: CPoint) {
		this.fire('mouseleave');
	}

	redraw(oldBounds: CBounds) {
		if (this.renderer)
			this.renderer.updatePath(this, oldBounds);
	}

	setStyle(style: any) {
		var oldBounds = this.getBounds();
		this.setStyleOptions(style);
		if (this.renderer) {
			this.renderer.updateStyle(this, oldBounds);
		}
	}

	updatePathAllPanes(paintArea?: CBounds) {
		var viewBounds = this.renderer.getBounds().clone();

		if (this.fixed) {
			// Ignore freeze-panes.
			var fixedMapArea = new CBounds(
				new CPoint(0, 0),
				viewBounds.getSize()
			)
			this.updatePath(fixedMapArea, fixedMapArea);
			this.updateTestData();
			return;
		}

		var splitPanesContext = this.renderer.getSplitPanesContext();
		var paneBoundsList: Array<CBounds> = splitPanesContext ?
			splitPanesContext.getPxBoundList() :
			[viewBounds];

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

			this.updatePath(panePaintArea, paneBoundsList[i]);
		}

		this.updateTestData();
	}

	updatePath(paintArea?: CBounds, paneBounds?: CBounds) {
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

	onResize() {
		// Overridden in implementations.
	}

	getMap(): any {
		if (this.renderer) {
			return this.renderer.getMap();
		}
	}

	// Popup related methods
	bindPopup(content: any, options: any): CPath {

		if (content instanceof L.Popup) {
			this.popup = content;
		} else {
			if (!this.popup || options) {
				this.popup = new L.Popup(options, this);
			}
			this.popup.setContent(content);
		}

		if (!this.popupHandlersAdded) {
			this.on('add', this.firstPopup);
			this.on('remove', this.closePopup);
			this.on('mouseenter', this.openPopup);
			this.on('mouseleave', this.delayClosePopup);

			this.popupHandlersAdded = true;
		}

		return this;
	}

	unbindPopup(): CPath {
		if (this.popup) {
			this.popup = null;
			this.off('add', this.firstPopup);
			this.off('remove', this.closePopup);
			this.off('mouseenter', this.openPopup);
			this.off('mouseleave', this.delayClosePopup);

			this.popupHandlersAdded = false;
		}
		return this;
	}

	protected firstPopup() {
		if (this.popup) {
			var center = this.getBounds().getCenter();
			this.openPopup({
				latlng: this.toCompatUnits([center.x, center.y])
			});
		}
	}

	protected closePopup() {
		if (this.popup) {
			this.popup._close();
		}
		return this;
	}

	protected delayClosePopup() {
		clearTimeout(this.popupTimer);
		this.popupTimer = setTimeout(this.closePopup.bind(this), 3000);
	}

	protected openPopup(e: any) {
		if (!this.getMap().hasLayer(this.popup)) {
			this.popup.setLatLng(e.latlng);
			this.getMap().openPopup(this.popup);
			this.delayClosePopup();
		}
	}

};