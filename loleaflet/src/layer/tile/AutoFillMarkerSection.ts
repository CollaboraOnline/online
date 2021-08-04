/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;

app.definitions.AutoFillMarkerSection =
class AutoFillMarkerSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.AutoFillMarker.name;
	backgroundColor: string = 'black';
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = true;
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false;
	showSection: boolean = true;
	processingOrder: number = L.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = L.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = L.CSections.AutoFillMarker.zIndex;
	interactable: boolean = true;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	setPosition: Function; // Implemented by section container. Document objects only.
	map: any;

	constructor () {
		this.map = L.Map.THIS;

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.selectedAreaPoint = null;
		this.sectionProperties.cellCursorPoint = null;

		this.sectionProperties.draggingStarted = false;
		this.sectionProperties.dragStartPosition = null;

		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
	}

	public onInitialize () {
		if ((<any>window).mode.isDesktop()) {
			this.size = [Math.round(8 * this.dpiScale), Math.round(8 * this.dpiScale)];
		}
		else {
			this.size = [Math.round(16 * this.dpiScale), Math.round(16 * this.dpiScale)];
		}
	}

	public onResize () {

	}

	private setMarkerPosition () {
		var center: number = 0;
		if (!(<any>window).mode.isDesktop() && this.map._docLayer._cellCursorPixels) {
			center = this.map._docLayer._cellCursorPixels.getWidth() * 0.5;
		}

		var position: Array<number> = [0, 0];
		this.showSection = true;

		if (this.sectionProperties.selectedAreaPoint !== null)
			position = [this.sectionProperties.selectedAreaPoint[0] - center, this.sectionProperties.selectedAreaPoint[1]];
		else if (this.sectionProperties.cellCursorPoint !== null)
			position = [this.sectionProperties.cellCursorPoint[0] - center, this.sectionProperties.cellCursorPoint[1]];
		else
			this.showSection = false;

		// At this point, position is calculated without taking splitter into account.
		var splitPosCore = {x: 0, y: 0};
		if (this.map._docLayer.getSplitPanesContext())
			splitPosCore = this.map._docLayer.getSplitPanesContext().getSplitPos();

		splitPosCore.x *= this.dpiScale;
		splitPosCore.y *= this.dpiScale;

		if (position[0] <= splitPosCore.x)
			position[0] += this.documentTopLeft[0];
		else if (position[0] - this.documentTopLeft[0] <= splitPosCore.x)
			this.showSection = false;

		if (position[1] <= splitPosCore.y)
			position[1] += this.documentTopLeft[1];
		else if (position[1] - this.documentTopLeft[1] <= splitPosCore.y)
			this.showSection = false;

		this.setPosition(position[0], position[1]);
	}

	// Give bottom right position of selected area, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellSelection (point: Array<number>) {
		if (point === null) {
			this.sectionProperties.selectedAreaPoint = null;
		}
		else {
			this.sectionProperties.selectedAreaPoint = [point[0] - this.size[0] * 0.5, point[1] - this.size[1] * 0.5];
		}
		this.setMarkerPosition();
	}

	// Give bottom right position of cell cursor, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellCursor (point: Array<number>) {
		if (point === null) {
			this.sectionProperties.cellCursorPoint = null;
		}
		else {
			this.sectionProperties.cellCursorPoint = [point[0] - this.size[0] * 0.5, point[1] - this.size[1] * 0.5];
		}
		this.setMarkerPosition();
	}

	public onDraw () {

	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (dragDistance === null || !this.sectionProperties.docLayer._cellAutoFillAreaPixels)
			return; // No dragging or no event handling or auto fill marker is not visible.

		var pos: any;

		if (!this.sectionProperties.draggingStarted) { // Is it first move?
			this.sectionProperties.draggingStarted = true;
			this.sectionProperties.dragStartPosition = this.sectionProperties.docLayer._cellAutoFillAreaPixels.getCenter();
			pos = new L.Point(this.sectionProperties.dragStartPosition[0], this.sectionProperties.dragStartPosition[1]);
			pos = this.sectionProperties.docLayer._corePixelsToTwips(pos);
			this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
		}

		point[0] = this.sectionProperties.dragStartPosition[0] + dragDistance[0];
		point[1] = this.sectionProperties.dragStartPosition[1] + dragDistance[1];
		pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));

		this.map.scrollingIsHandled = true;
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.draggingStarted) {
			this.sectionProperties.draggingStarted = false;
			point[0] += this.myTopLeft[0] + this.size[0] * 0.5;
			point[1] += this.myTopLeft[1] + this.size[1] * 0.5;
			var pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));
			this.sectionProperties.docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
		}

		this.map.scrollingIsHandled = false;
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = false;
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		// Just to be safe. We don't need this, but it makes no harm.
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = true; // We'll keep this until we have consistent sections and remove map element.
	}

	public onMouseEnter () {
		this.sectionProperties.mapPane.style.cursor = 'crosshair';
	}

	public onMouseLeave () {
		this.sectionProperties.mapPane.style.cursor = 'default';
	}

	public onNewDocumentTopLeft () {
		this.setMarkerPosition();
	}

	public onMouseWheel () {}
	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}
