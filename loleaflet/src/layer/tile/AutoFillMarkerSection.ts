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
	name: string = L.CSections.AutoFillMarker;
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
	map: any;

	constructor () {
		this.map = L.Map.THIS;

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.tsManager = this.sectionProperties.docLayer._painter;
	}

	public onInitialize () {

	}

	public onResize () {

	}

	public onDraw () {

	}

	public onMouseWheel () {}
	public onMouseMove () {}
	public onMouseDown () {}
	public onMouseUp () {}
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