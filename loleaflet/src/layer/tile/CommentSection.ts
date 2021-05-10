/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;

app.definitions.CommentSection =
class CommentSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.CommentList.name;
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = false;
	position: Array<number> = [0, 0];
	size: Array<number> = [200, 0];
	expand: Array<string> = ['bottom'];
	isLocated: boolean = false;
	showSection: boolean = true;
	processingOrder: number = L.CSections.CommentList.processingOrder;
	drawingOrder: number = L.CSections.CommentList.drawingOrder;
	zIndex: number = L.CSections.CommentList.zIndex;
	interactable: boolean = false;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	setPosition: Function; // Implemented by section container. Document objects only.
	map: any;

	constructor () {
		this.map = L.Map.THIS;
		// Below anchor list may be expanded. For example, Writer may have ruler section. Then ruler section should also be added here.
		// If there is column header section, its bottom will be this section's top.
		this.anchor = [[L.CSections.ColumnHeader.name, 'bottom', 'top'], 'right'];
		this.sectionProperties.docLayer = this.map._docLayer;
	}

	public onInitialize () {
		this.backgroundColor = this.containerObject.getClearColor();
	}

	public onResize () {

	}

	public onDraw () {

	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {

	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
	}

	public onMouseEnter () {
	}

	public onMouseLeave () {
	}

	public onNewDocumentTopLeft () {

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