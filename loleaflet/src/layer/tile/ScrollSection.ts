/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

// We are using typescript without modules and compile files individually for now. Typescript needs to know about global definitions.
// We will keep below definitions until we use tsconfig.json.
declare var L: any;

class ScrollSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = null;
	backgroundColor: string = null;
	borderColor: string = null;
	boundToSection: string = L.CSections.Tiles.name;
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
	stopPropagating: Function; // Implemented by container.
	map: any;
	autoScrollTimer: any;

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
		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
		this.sectionProperties.defaultCursorStyle = this.sectionProperties.mapPane.style.cursor;

		this.sectionProperties.documentWidth = 0;
		this.sectionProperties.documentHeight = 0;

		this.sectionProperties.documentTopMax = Infinity;
		this.sectionProperties.documentRightMax = Infinity;

		this.sectionProperties.previousDragDistance = null;

		this.sectionProperties.usableThickness = 20 * this.dpiScale;
		this.sectionProperties.scrollBarThickness = 6 * this.dpiScale;
		this.sectionProperties.edgeOffset = 10 * this.dpiScale;

		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;

		this.sectionProperties.clickScrollVertical = false; // true when user presses on the scroll bar drawing.
		this.sectionProperties.clickScrollHorizontal = false;

		this.sectionProperties.mouseIsOnVerticalScrollBar = false;
		this.sectionProperties.mouseIsOnHorizontalScrollBar = false;

		this.sectionProperties.minimumScrollSize = 80 * this.dpiScale;

		this.sectionProperties.circleSliderRadius = 24 * this.dpiScale; // Radius of the mobile vertical circular slider.
		this.sectionProperties.arrowCornerLength = 10 * this.dpiScale; // Corner length of the arrows inside circular slider.

		// Opacity.
		this.sectionProperties.alphaWhenVisible = 0.5; // Scroll bar is visible but not being used.
		this.sectionProperties.alphaWhenBeingUsed = 0.8; // Scroll bar is being used.

		this.sectionProperties.yOffset = 0;
		this.sectionProperties.xOffset = 0;

		this.sectionProperties.horizontalScrollRightOffset = this.sectionProperties.usableThickness * 2; // To prevent overlapping of the scroll bars.
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
		this.sectionProperties.documentWidth = Math.round(newDocWidth * this.dpiScale);
		this.sectionProperties.documentHeight = Math.round(newDocHeight * this.dpiScale);
	}

	private getVerticalScrollLength () :number {
		if (this.map._docLayer._docType !== 'spreadsheet') {
			return this.size[1];
		}
		else {
			var splitPanesContext: any = this.map.getSplitPanesContext();
			var splitPos: any = splitPanesContext.getSplitPos().clone();
			splitPos.y *= this.dpiScale;
			this.sectionProperties.yOffset = splitPos.y;
			return this.size[1] - splitPos.y;
		}
	}

	private calculateVerticalScrollSize (scrollLength: number) :number {
		var scrollSize = scrollLength * scrollLength / this.sectionProperties.documentHeight;
		if (scrollSize > this.sectionProperties.minimumScrollSize) {
			return scrollSize;
		}
		else {
			return this.sectionProperties.minimumScrollSize;
		}
	}

	public getVerticalScrollProperties () :any {
		var result: any = {};
		result.scrollLength = this.getVerticalScrollLength(); // The length of the railway that the scroll bar moves on up & down.
		result.scrollSize = this.calculateVerticalScrollSize(result.scrollLength);
		result.scrollableLength = result.scrollLength - result.scrollSize;
		result.scrollableHeight = this.sectionProperties.documentHeight - this.size[1];
		result.ratio = result.scrollableHeight / result.scrollableLength; // 1px scrolling = xpx document height.
		result.startY = this.documentTopLeft[1] / result.ratio + this.sectionProperties.scrollBarThickness * 0.5 + this.sectionProperties.yOffset;
		this.sectionProperties.documentTopMax = result.scrollableHeight; // When documentTopLeft[1] value is equal to this value, it means whole document is visible.

		return result;
	}

	private getHorizontalScrollLength () :number {
		if (this.map._docLayer._docType !== 'spreadsheet') {
			return this.size[0] - this.sectionProperties.horizontalScrollRightOffset;
		}
		else {
			var splitPanesContext: any = this.map.getSplitPanesContext();
			var splitPos: any = splitPanesContext.getSplitPos().clone();
			splitPos.x *= this.dpiScale;
			this.sectionProperties.xOffset = splitPos.x;
			return this.size[0] - splitPos.x - this.sectionProperties.horizontalScrollRightOffset;
		}
	}

	private calculateHorizontalScrollSize (scrollLength: number) :number {
		var scrollSize = scrollLength * scrollLength / this.sectionProperties.documentWidth;
		if (scrollSize > this.sectionProperties.minimumScrollSize) {
			return scrollSize;
		}
		else {
			return this.sectionProperties.minimumScrollSize;
		}
	}

	public getHorizontalScrollProperties () :any {
		var result: any = {};
		result.scrollLength = this.getHorizontalScrollLength(); // The length of the railway that the scroll bar moves on up & down.
		result.scrollSize = this.calculateHorizontalScrollSize(result.scrollLength); // Width of the scroll bar.
		result.scrollableLength = result.scrollLength - result.scrollSize;
		result.scrollableWidth = this.sectionProperties.documentWidth - this.size[0];
		result.ratio = result.scrollableWidth / result.scrollableLength;
		result.startX = this.documentTopLeft[0] / result.ratio + this.sectionProperties.scrollBarThickness * 0.5 + this.sectionProperties.xOffset;
		this.sectionProperties.documentRightMax = result.scrollableWidth;

		return result;
	}

	public onUpdateScrollOffset () {
		if (this.map._docLayer._docType === 'spreadsheet')
			this.map._docLayer.refreshViewData();
	}

	private DrawVerticalScrollBarMobile () {
		var scrollProps: any = this.getVerticalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;
		this.context.strokeStyle = '#7E8182';
		this.context.fillStyle = 'white';

		var circleStartY = scrollProps.startY + this.sectionProperties.circleSliderRadius;
		var circleStartX = this.size[0] - this.sectionProperties.circleSliderRadius * 0.5;

		this.context.beginPath();
		this.context.arc(circleStartX, circleStartY, this.sectionProperties.circleSliderRadius, 0, Math.PI * 2, true);
		this.context.fill();
		this.context.stroke();

		this.context.fillStyle = '#7E8182';
		this.context.beginPath();
		var x: number = circleStartX - this.sectionProperties.arrowCornerLength * 0.5;
		var y: number = circleStartY - 5 * this.dpiScale;
		this.context.moveTo(x, y);
		x += this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		x -= this.sectionProperties.arrowCornerLength * 0.5;
		y -= Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		x -= this.sectionProperties.arrowCornerLength * 0.5;
		y += Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		this.context.fill();

		x = circleStartX - this.sectionProperties.arrowCornerLength * 0.5;
		y = circleStartY + 5 * this.dpiScale;
		this.context.moveTo(x, y);
		x += this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		x -= this.sectionProperties.arrowCornerLength * 0.5;
		y += Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		x -= this.sectionProperties.arrowCornerLength * 0.5;
		y -= Math.sin(Math.PI / 3) * this.sectionProperties.arrowCornerLength;
		this.context.lineTo(x, y);
		this.context.fill();

		this.context.globalAlpha = 1.0;
	}

	private drawVerticalScrollBar () {
		var scrollProps: any = this.getVerticalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;
		this.context.fillStyle = '#7E8182';

		var startX = this.size[0] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		var centerX = this.size[0] - this.sectionProperties.edgeOffset - this.sectionProperties.scrollBarThickness * 0.5;
		var centerY = scrollProps.startY;
		var radius = this.sectionProperties.scrollBarThickness * 0.5;

		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, 0, Math.PI, true);
		this.context.fill();

		this.context.fillRect(startX, scrollProps.startY, this.sectionProperties.scrollBarThickness, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness);

		centerY += scrollProps.scrollSize - this.sectionProperties.scrollBarThickness;
		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, 0, Math.PI, false);
		this.context.fill();

		this.context.globalAlpha = 1.0;
	}

	private drawHorizontalScrollBar () {
		var scrollProps: any = this.getHorizontalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollHorizontal ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;
		this.context.fillStyle = '#7E8182';

		var startY = this.size[1] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		var centerX = scrollProps.startX;
		var centerY = this.size[1] - this.sectionProperties.edgeOffset - this.sectionProperties.scrollBarThickness * 0.5;
		var radius = this.sectionProperties.scrollBarThickness * 0.5;

		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, Math.PI * 0.5, Math.PI * 1.5, false);
		this.context.fill();

		this.context.fillRect(scrollProps.startX, startY, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness, this.sectionProperties.scrollBarThickness);

		centerX += scrollProps.scrollSize - this.sectionProperties.scrollBarThickness;
		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, Math.PI * 0.5, Math.PI * 1.5, true);
		this.context.fill();

		this.context.globalAlpha = 1.0;
	}

	public onDraw () {
		if (this.sectionProperties.drawVerticalScrollBar && (this.sectionProperties.clickScrollVertical || this.documentTopLeft[1] >= 0)) {
			if ((<any>window).mode.isMobile())
				this.DrawVerticalScrollBarMobile();
			else
				this.drawVerticalScrollBar();
		}

		if (this.sectionProperties.drawHorizontalScrollBar && this.documentTopLeft[0] >= 0) {
			this.drawHorizontalScrollBar();
		}
	}

	private hideVerticalScrollBar () {
		if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.drawVerticalScrollBar = false;
			this.sectionProperties.mouseIsOnVerticalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;
			this.containerObject.requestReDraw();
		}
	}

	private showVerticalScrollBar () {
		if (!this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.drawVerticalScrollBar = true;
			this.sectionProperties.mouseIsOnVerticalScrollBar = true;
			this.sectionProperties.mapPane.style.cursor = 'pointer';
			this.containerObject.requestReDraw();
		}
	}

	private hideHorizontalScrollBar () {
		if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
			this.sectionProperties.drawHorizontalScrollBar = false;
			this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;
			this.containerObject.requestReDraw();
		}
	}

	private showHorizontalScrollBar () {
		if (!this.sectionProperties.mouseIsOnHorizontalScrollBar) {
			this.sectionProperties.drawHorizontalScrollBar = true;
			this.sectionProperties.mouseIsOnHorizontalScrollBar = true;
			this.sectionProperties.mapPane.style.cursor = 'pointer';
			this.containerObject.requestReDraw();
		}
	}

	private isMouseOnScrollBar (point: Array<number>) {
		if (this.documentTopLeft[1] >= 0) {
			if (point[0] >= this.size[0] - this.sectionProperties.usableThickness) {
				if (point[1] > this.sectionProperties.yOffset) {
					this.showVerticalScrollBar();
				}
				else {
					this.hideVerticalScrollBar();
				}
			}
			else {
				this.hideVerticalScrollBar();
			}
		}

		if (this.documentTopLeft[0] >= 0) {
			if (point[1] >= this.size[1] - this.sectionProperties.usableThickness) {
				if (point[0] <= this.size[0] - this.sectionProperties.horizontalScrollRightOffset && point[0] >= this.sectionProperties.xOffset) {
					this.showHorizontalScrollBar();
				}
				else {
					this.hideHorizontalScrollBar();
				}
			}
			else {
				this.hideHorizontalScrollBar();
			}
		}
	}

	public onMouseLeave () {
		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;
	}

	public scrollVerticalWithOffset (offset: number) {
		if (this.documentTopLeft[1] + offset <= 0) { // We shouldn't scroll document to a negative y value.
			if (this.documentTopLeft[1] > 0)
				this.map.scrollTop(0, {});
		}
		else if (this.documentTopLeft[1] + offset >= this.sectionProperties.documentTopMax) // We should stop at the bottom of the document.
			this.map.scrollTop(this.sectionProperties.documentTopMax / this.dpiScale, {});
		else // Humph, everything is normal.
			this.map.scroll(0, offset / this.dpiScale, {});
	}

	public scrollHorizontalWithOffset (offset: number) {
		if (this.documentTopLeft[0] + offset <= 0){ // We shouldn't scroll document to a negative x value.
			if (this.documentTopLeft[0] > 0)
				this.map.scrollLeft(0, {});
		}
		else if (this.documentTopLeft[0] + offset >= this.sectionProperties.documentRightMax) // We should stop at the right edge of the document.
			this.map.scrollLeft(this.sectionProperties.documentRightMax / this.dpiScale, {});
		else // Humph, everything is normal.
			this.map.scroll(offset / this.dpiScale, 0, {});
	}

	public onMouseMove (position: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.clickScrollVertical && this.containerObject.draggingSomething) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			if (!this.sectionProperties.drawVerticalScrollBar)
				this.sectionProperties.drawVerticalScrollBar = true;

			var scrollProps: any = this.getVerticalScrollProperties();
			var diffY: number = dragDistance[1] - this.sectionProperties.previousDragDistance[1];
			var actualDistance = scrollProps.ratio * diffY;

			this.scrollVerticalWithOffset(actualDistance);
			this.sectionProperties.previousDragDistance[1] = dragDistance[1];
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else if (this.sectionProperties.clickScrollHorizontal && this.containerObject.draggingSomething) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			if (!this.sectionProperties.drawHorizontalScrollBar)
				this.sectionProperties.drawHorizontalScrollBar = true;

			var scrollProps: any = this.getHorizontalScrollProperties();
			var diffX: number = dragDistance[0] - this.sectionProperties.previousDragDistance[0];
			var percentage: number = diffX / scrollProps.scrollLength;
			var actualDistance = this.sectionProperties.documentWidth * percentage;

			this.scrollHorizontalWithOffset(actualDistance);
			this.sectionProperties.previousDragDistance[0] = dragDistance[0];
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else {
			this.isMouseOnScrollBar(position);
		}
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		this.onMouseMove(point, null, e);
		this.isMouseOnScrollBar(point);

		if (this.documentTopLeft[1] >= 0) {
			if (point[0] >= this.size[0] - this.sectionProperties.usableThickness) {
				if (point[1] > this.sectionProperties.yOffset) {
					this.sectionProperties.clickScrollVertical = true;
					this.map.scrollingIsHandled = true;
					e.stopPropagation(); // Don't propagate to map.
					this.stopPropagating(); // Don't propagate to bound sections.
				}
				else {
					this.sectionProperties.clickScrollVertical = false;
				}
			}
			else {
				this.sectionProperties.clickScrollVertical = false;
			}
		}

		if (this.documentTopLeft[0] >= 0) {
			if (point[1] >= this.size[1] - this.sectionProperties.usableThickness) {
				if (point[0] >= this.sectionProperties.xOffset && point[0] <= this.size[0] - this.sectionProperties.horizontalScrollRightOffset) {
					this.sectionProperties.clickScrollHorizontal = true;
					this.map.scrollingIsHandled = true;
					e.stopPropagation(); // Don't propagate to map.
					this.stopPropagating(); // Don't propagate to bound sections.
				}
				else {
					this.sectionProperties.clickScrollHorizontal = false;
				}
			}
			else {
				this.sectionProperties.clickScrollHorizontal = false;
			}
		}
	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		this.map.scrollingIsHandled = false;
		if (this.sectionProperties.clickScrollVertical) {
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
			this.sectionProperties.clickScrollVertical = false;
		}

		if (this.sectionProperties.clickScrollHorizontal) {
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
			this.sectionProperties.clickScrollHorizontal = false;
		}

		this.sectionProperties.previousDragDistance = null;
		this.onMouseMove(point, null, e);
	}

	private performVerticalScroll (delta: number) {
		if (delta > 0)
			this.scrollVerticalWithOffset(30);
		else
			this.scrollVerticalWithOffset(-30);

		this.sectionProperties.drawVerticalScrollBar = true;
		this.containerObject.requestReDraw();
		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;
	}

	private performHorizontalScroll (delta: number) {
		if (delta > 0)
			this.scrollHorizontalWithOffset(30);
		else
			this.scrollHorizontalWithOffset(-30);

		this.sectionProperties.drawHorizontalScrollBar = true;
		this.containerObject.requestReDraw();
		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;
	}

	public onMouseWheel (point: Array<number>, delta: Array<number>, e: MouseEvent) {
		if (e.ctrlKey)
			return;

		if (Math.abs(delta[1]) > Math.abs(delta[0])) {
			if (!e.shiftKey)
				this.performVerticalScroll(delta[1]);
			else
				this.performHorizontalScroll(delta[1]);
		}
		else {
			this.performHorizontalScroll(delta[0]);
		}
	}

	public onMouseEnter () {}
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