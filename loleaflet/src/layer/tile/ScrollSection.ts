/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

// We are using typescript without modules and compile files individually for now. Typescript needs to know about global definitions.
// We will keep below definitions until we use tsconfig.json.
declare var L: any;
declare var $: any;
declare var Hammer: any;

class ScrollSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = null;
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<string> = new Array(0);
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false;
	processingOrder: number = null;
	drawingOrder: number = null;
	zIndex: number = null;
	interactable: boolean = true;
	sectionProperties: any = {};
	map: any;
	documentWidth: number = 0;
	documentHeight: number = 0;
	autoScrollTimer: any;
	hammer: any;
	scrollContainer: any;
	drawScrollBar: boolean = false;
	previousDragDistance: Array<number> = null;
	documentTopMax: number = Infinity;

	constructor () {
		this.name = L.CSections.Scroll.name;
		this.anchor = ['top', 'right'];
		this.position = [0, 0];
		this.size = [30 * window.devicePixelRatio, 0];
		this.expand = ['bottom'];
		this.processingOrder = L.CSections.Scroll.processingOrder;
		this.drawingOrder = L.CSections.Scroll.drawingOrder;
		this.zIndex = L.CSections.Scroll.zIndex;

		this.map = L.Map.THIS;

		this.map.on('scrollto', this.onScrollTo, this);
		this.map.on('scrollby', this.onScrollBy, this);
		this.map.on('scrollvelocity', this.onScrollVelocity, this);
		this.map.on('handleautoscroll', this.onHandleAutoScroll, this);
		this.map.on('docsize', this.onUpdateSize, this);
		this.map.on('updatescrolloffset', this.onUpdateScrollOffset, this);
	}

	public onInitialize () {
		this.scrollContainer = L.DomUtil.create('div', 'scroll-container', this.map._container.parentElement);

		if (!this.hammer && this.map.touchGesture) {
			this.hammer = new Hammer(this.scrollContainer);
			this.hammer.get('pan').set({
				direction: Hammer.DIRECTION_ALL
			});
			this.hammer.get('swipe').set({ threshold: 5 });

			if (L.Browser.touch)
				L.DomEvent.on(this.scrollContainer, 'touchmove', L.DomEvent.preventDefault);

			var mapTouchGesture = this.map.touchGesture;
			this.hammer.on('panstart', L.bind(mapTouchGesture._onPanStart, mapTouchGesture));
			this.hammer.on('pan', L.bind(mapTouchGesture._onPan, mapTouchGesture));
			this.hammer.on('panend', L.bind(mapTouchGesture._onPanEnd, mapTouchGesture));
			this.hammer.on('swipe', L.bind(mapTouchGesture._onSwipe, mapTouchGesture));
		}
	}

	public onScrollTo (e: any) {
		// Triggered by the document (e.g. search result out of the viewing area).
		this.map.scrollTop(e.y, {});
		this.map.scrollLeft(e.x, {});
	}

	public onScrollBy (e: any) {
		e.y *= (-1);
		var y = '+=' + e.y;
		if (e.y < 0) {
			y = '-=' + Math.abs(e.y);
		}
		e.x *= (-1);
		var x = '+=' + e.x;
		if (e.x < 0) {
			x = '-=' + Math.abs(e.x);
		}

		this.onScrollTo({x: x, y: y});
	}

	public onScrollVelocity (e: any) {
		if (e.vx === 0 && e.vy === 0) {
			clearInterval(this.autoScrollTimer);
			this.autoScrollTimer = null;
			this.map.isAutoScrolling = false;
		} else {
			clearInterval(this.autoScrollTimer);
			this.map.isAutoScrolling = true;
			this.autoScrollTimer = setInterval(L.bind(function() {
				this.onScrollBy({x: e.vx, y: e.vy});
			}, this), 100);
		}
	}

	public onHandleAutoScroll (e :any) {
		var vx = 0;
		var vy = 0;

		if (e.pos.y > e.map._size.y - 50) {
			vy = 50;
		} else if (e.pos.y < 50) {
			vy = -50;
		}
		if (e.pos.x > e.map._size.x - 50) {
			vx = 50;
		} else if (e.pos.x < 50) {
			vx = -50;
		}

		this.onScrollVelocity({vx: vx, vy: vy});
	}

	public onUpdateSize (e: any) {
		// we need to avoid precision issues in comparison (in the end values are pixels)
		var newDocWidth = Math.ceil(e.x);
		var newDocHeight = Math.ceil(e.y);

		// Don't get them through L.DomUtil.getStyle because precision is no more than 6 digits
		this.documentWidth = newDocWidth;
		this.documentHeight = newDocHeight;
	}

	public getScrollProperties () :any {
		var result: any = {};
		// Scroll bar starts at tiles section's top right point
		var tilesSection: any = this.containerObject.getSectionWithName(L.CSections.Tiles.name);
		result.startY = 0;
		if (tilesSection)
			result.startY += tilesSection.myTopLeft[1];

		result.scrollLength = this.size[1] - result.startY; // The length of the railway that the scroll bar moves on up & down.
		result.percentage = this.documentTopLeft[1] / this.documentHeight; // % of the top position of the scroll bar.
		result.scrollSize = result.scrollLength * (result.scrollLength / this.documentHeight); // Height of the scroll bar.
		this.documentTopMax = this.documentHeight - result.scrollLength; // When documentTopLeft[1] value is equal to this value, it means whole document is visible.
		result.documentTopMax = this.documentTopMax;

		if (result.scrollSize > this.documentHeight)
			result.scrollSize = this.documentHeight; // This shouldn't happen.
		else if (result.scrollSize < 100 * this.dpiScale)
			result.scrollSize = 100 * this.dpiScale; // This can happen if document height is a big number.

		return result;
	}

	public onUpdateScrollOffset () {
		if (this.map._docLayer._docType === 'spreadsheet')
			this.map._docLayer.refreshViewData();
	}

	public onDraw () {
		if (!this.drawScrollBar)
			return;

		// When documentTopLeft[1] is below zero, no scroll bar is needed, because whole document is visible (user must have zoomed-out).
		if (this.documentTopLeft[1] < 0)
			return;

		var scrollProps: any = this.getScrollProperties();

		this.context.fillStyle = 'red';
		this.context.strokeStyle = 'grey';

		this.context.beginPath();
		this.context.fillRect(0, scrollProps.startY + scrollProps.scrollLength * scrollProps.percentage, this.size[0], scrollProps.scrollSize);
		this.context.rect(0, scrollProps.startY + scrollProps.scrollLength * scrollProps.percentage, this.size[0], scrollProps.scrollSize);
		this.context.stroke();
	}

	public onMouseEnter () {
		this.drawScrollBar = true;
		this.containerObject.requestReDraw();
	}

	public onMouseLeave () {
		this.drawScrollBar = false;
		this.containerObject.requestReDraw();
	}

	public scrollWithOffset (offset: number) {
		if (this.documentTopLeft[1] + offset <= 0) // We shouldn't scroll document to a negative y value.
			this.map.scrollTop(0, {});
		else if (this.documentTopLeft[1] + offset >= this.documentTopMax) // We should stop at the bottom of the document.
			this.map.scrollTop(this.documentTopMax, {});
		else // Humph, everything is normal.
			this.map.scroll(0, offset, {});
	}

	public onMouseMove (position: Array<number>, dragDistance: Array<number>) {
		if (this.containerObject.draggingSomething) {
			if (!this.previousDragDistance) {
				this.previousDragDistance = [0, 0];
			}

			var scrollProps: any = this.getScrollProperties();
			var diffY: number = dragDistance[1] - this.previousDragDistance[1];
			var percentage: number = diffY / scrollProps.scrollLength;
			var actualDistance = this.documentHeight * percentage;

			this.scrollWithOffset(actualDistance);
			this.previousDragDistance[1] = dragDistance[1];
		}
	}

	public onMouseUp () {
		this.previousDragDistance = null;
		this.drawScrollBar = false;
	}

	public onMouseWheel (point: Array<number>, delta: number) {
		if (delta > 0)
			this.scrollWithOffset(30);
		else
			this.scrollWithOffset(-30);

		this.drawScrollBar = true;
		this.containerObject.requestReDraw();
		this.drawScrollBar = false;
	}

	public onMouseDown () {
		this.drawScrollBar = true;
	}

	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
	public onResize () {}
	public onNewDocumentTopLeft () {}
}

L.getNewScrollSection = function () {
	return new ScrollSection();
}