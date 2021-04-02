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
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = L.CSections.Tiles.name;
	anchor: Array<any> = new Array(0);
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false;
	processingOrder: number = L.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = L.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = L.CSections.AutoFillMarker.zIndex;
	interactable: boolean = true;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	map: any;

	constructor () {
		this.map = L.Map.THIS;

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.draggingStarted = false;
		this.sectionProperties.cursorRectangle = null; // Selected area or cell cursor, in core pixels.
		this.sectionProperties.autoFillRectangle = null; // Autofill marker's rectangle.
		this.sectionProperties.dragStartPosition = null;
		this.sectionProperties.handlingMouseEvent = false;
	}

	public onInitialize () {

	}

	public onResize () {

	}

	public onDraw () {
		if (this.sectionProperties.docLayer) {
			if (this.sectionProperties.docLayer._cellSelectionAreaPixels)
				this.sectionProperties.cursorRectangle = this.sectionProperties.docLayer._cellSelectionAreaPixels.clone();
			else if (this.sectionProperties.docLayer._cellCursorPixels)
				this.sectionProperties.cursorRectangle = this.sectionProperties.docLayer._cellCursorPixels.clone();
			else
				this.sectionProperties.cursorRectangle = null;

			if (this.sectionProperties.cursorRectangle) {
				var topLeft: Array<number>;
				var size: number;
				if ((<any>window).mode.isDesktop()) {
					size = 4 * this.dpiScale;
					this.sectionProperties.cursorRectangle.moveBy(-size, -size);
					topLeft = [this.sectionProperties.cursorRectangle.getX2(), this.sectionProperties.cursorRectangle.getY2()];

				}
				else {
					size = 8 * this.dpiScale;
					this.sectionProperties.cursorRectangle.moveBy(-size, -size);
					topLeft = [this.sectionProperties.cursorRectangle.getX2() - this.sectionProperties.cursorRectangle.getWidth() * 0.5, this.sectionProperties.cursorRectangle.getY2()];
				}

				this.context.fillStyle = 'black';
				this.context.fillRect(topLeft[0] - this.documentTopLeft[0], topLeft[1] - this.documentTopLeft[1], 2 * size, 2 * size);

				this.sectionProperties.autoFillRectangle = L.LOUtil.createRectangle(topLeft[0], topLeft[1], size * 2, size * 2);
			}
			else {
				this.sectionProperties.autoFillRectangle = null;
			}
		}
	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (dragDistance === null || !this.sectionProperties.docLayer._cellAutoFillAreaPixels || !this.sectionProperties.handlingMouseEvent)
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

		console.log('pos:' + JSON.stringify(pos));
		this.sectionProperties.docLayer._postMouseEvent('move', pos.x, pos.y, 1, 1, 0);

		if (this.sectionProperties.handlingMouseEvent) {
			this.map.scrollingIsHandled = true;
			this.stopPropagating(); // Stop propagating to sections.
			e.stopPropagation(); // Stop native event.
		}
	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.draggingStarted) {
			this.sectionProperties.draggingStarted = false;
			point[0] += this.sectionProperties.cursorRectangle.getWidth() * 0.5;
			point[1] += this.sectionProperties.cursorRectangle.getHeight() * 0.5;
			var pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));
			this.sectionProperties.docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
		}

		this.map.scrollingIsHandled = false;

		if (this.sectionProperties.handlingMouseEvent) {
			this.stopPropagating();
			e.stopPropagation();
			this.sectionProperties.handlingMouseEvent = false;
			(<any>window).IgnorePanning = false;
		}
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		// Just to be safe. We don't need this, but it makes no harm.
		this.sectionProperties.handlingMouseEvent = false;

		if (this.sectionProperties.docLayer._cellAutoFillAreaPixels && this.sectionProperties.autoFillRectangle) {
			if (this.sectionProperties.autoFillRectangle.containsPoint(point[0] + this.documentTopLeft[0], point[1] + this.documentTopLeft[1])) {
				this.sectionProperties.handlingMouseEvent = true;
				this.stopPropagating();
				e.stopPropagation();
				(<any>window).IgnorePanning = true; // We'll keep this until we have consistent sections and remove map element.
			}
		}
	}

	public onMouseWheel () {}
	public onMouseEnter () {}
	public onMouseLeave () {}
	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
	public onNewDocumentTopLeft () {}
}