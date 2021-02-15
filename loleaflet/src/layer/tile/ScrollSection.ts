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
	map: any;
	documentWidth: number = 0;
	documentHeight: number = 0;
	autoScrollTimer: any;
	previousDragDistance: Array<number> = null;
	documentTopMax: number = Infinity;
	documentRightMax: number = Infinity;
	stopPropagating: Function; // Implemented by container.

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
		this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;

		this.sectionProperties.usableThickness = 20 * this.dpiScale;
		this.sectionProperties.scrollBarThickness = 6 * this.dpiScale;
		this.sectionProperties.edgeOffset = 10 * this.dpiScale;

		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;

		this.sectionProperties.clickScrollVertical = false; // true when user presses on the scroll bar drawing.
		this.sectionProperties.clickScrollHorizontal = false;

		this.sectionProperties.mouseIsOnVerticalScrollBar = false;
		this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
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
		this.documentWidth = Math.round(newDocWidth * this.dpiScale);
		this.documentHeight = Math.round(newDocHeight * this.dpiScale);
	}

	public getVerticalScrollProperties () :any {
		var result: any = {};
		result.scrollLength = this.size[1]; // The length of the railway that the scroll bar moves on up & down.
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

	public getHorizontalScrollProperties () :any {
		var result: any = {};
		result.scrollLength = this.size[0]; // The length of the railway that the scroll bar moves on up & down.
		result.percentage = this.documentTopLeft[0] / this.documentWidth; // % of the top position of the scroll bar.
		result.scrollSize = result.scrollLength * (result.scrollLength / this.documentWidth); // Height of the scroll bar.
		this.documentRightMax = this.documentWidth - result.scrollLength; // When documentTopLeft[0] value is equal to this value, it means whole document is visible.
		result.documentRightMax = this.documentRightMax;

		if (result.scrollSize > this.documentWidth)
			result.scrollSize = this.documentWidth; // This shouldn't happen.
		else if (result.scrollSize < 100 * this.dpiScale)
			result.scrollSize = 100 * this.dpiScale; // This can happen if document width is a big number.

		return result;
	}

	public onUpdateScrollOffset () {
		if (this.map._docLayer._docType === 'spreadsheet')
			this.map._docLayer.refreshViewData();
	}

	private DrawVerticalScrollBarMobile () {
		var scrollProps: any = this.getVerticalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? 0.8: 0.5;
		this.context.strokeStyle = '#7E8182';
		this.context.fillStyle = 'white';

		var circleRadius = 24 * this.dpiScale;
		var circleStartY = scrollProps.scrollLength * scrollProps.percentage + circleRadius;
		var circleStartX = this.size[0] - circleRadius * 0.5;

		this.context.beginPath();
		this.context.arc(circleStartX, circleStartY, circleRadius, 0, Math.PI * 2, true);
		this.context.fill();
		this.context.stroke();

		var cornerLength = 10 * this.dpiScale;

		this.context.fillStyle = '#7E8182';
		this.context.beginPath();
		var x: number = circleStartX - cornerLength * 0.5;
		var y: number = circleStartY - 5 * this.dpiScale;
		this.context.moveTo(x, y);
		x += cornerLength;
		this.context.lineTo(x, y);
		x -= cornerLength * 0.5;
		y -= Math.sin(Math.PI / 3) * cornerLength;
		this.context.lineTo(x, y);
		x -= cornerLength * 0.5;
		y += Math.sin(Math.PI / 3) * cornerLength;
		this.context.lineTo(x, y);
		this.context.fill();

		x = circleStartX - cornerLength * 0.5;
		y = circleStartY + 5 * this.dpiScale;
		this.context.moveTo(x, y);
		x += cornerLength;
		this.context.lineTo(x, y);
		x -= cornerLength * 0.5;
		y += Math.sin(Math.PI / 3) * cornerLength;
		this.context.lineTo(x, y);
		x -= cornerLength * 0.5;
		y -= Math.sin(Math.PI / 3) * cornerLength;
		this.context.lineTo(x, y);
		this.context.fill();

		this.context.globalAlpha = 1.0;
	}

	private drawVerticalScrollBar () {
		var scrollProps: any = this.getVerticalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? 0.8: 0.5;
		this.context.fillStyle = '#7E8182';

		var startX = this.size[0] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;
		var startY = scrollProps.scrollLength * scrollProps.percentage + this.sectionProperties.scrollBarThickness * 0.5;

		var centerX = this.size[0] - this.sectionProperties.edgeOffset - this.sectionProperties.scrollBarThickness * 0.5;
		var centerY = startY;
		var radius = this.sectionProperties.scrollBarThickness * 0.5;

		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, 0, Math.PI, true);
		this.context.fill();

		this.context.fillRect(startX, startY, this.sectionProperties.scrollBarThickness, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness);

		centerY += scrollProps.scrollSize - this.sectionProperties.scrollBarThickness;
		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, 0, Math.PI, false);
		this.context.fill();

		this.context.globalAlpha = 1.0;
	}

	private drawHorizontalScrollBar () {
		if (!this.sectionProperties.drawHorizontalScrollBar)
			return;

		if (this.documentTopLeft[0] < 0)
			return;

		var scrollProps: any = this.getHorizontalScrollProperties();
		this.context.globalAlpha = this.sectionProperties.clickScrollHorizontal ? 0.8: 0.5;
		this.context.fillStyle = '#7E8182';

		var startX = scrollProps.scrollLength * scrollProps.percentage + this.sectionProperties.scrollBarThickness * 0.5;
		var startY = this.size[1] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		var centerX = startX;
		var centerY = this.size[1] - this.sectionProperties.edgeOffset - this.sectionProperties.scrollBarThickness * 0.5;
		var radius = this.sectionProperties.scrollBarThickness * 0.5;

		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, Math.PI * 0.5, Math.PI * 1.5, false);
		this.context.fill();

		this.context.fillRect(startX, startY, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness, this.sectionProperties.scrollBarThickness);

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

		this.drawHorizontalScrollBar();
	}

	private isMouseOnScrollBar (point: Array<number>) {
		if (this.documentTopLeft[1] >= 0) {
			if (point[0] >= this.size[0] - this.sectionProperties.usableThickness) {
				if (!this.sectionProperties.mouseIsOnVerticalScrollBar) {
					this.sectionProperties.drawVerticalScrollBar = true;
					this.sectionProperties.mouseIsOnVerticalScrollBar = true;
					this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;
					this.sectionProperties.mapPane.style.cursor = 'pointer';
					this.containerObject.requestReDraw();
				}
			}
			else {
				if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
					this.sectionProperties.drawVerticalScrollBar = false;
					this.sectionProperties.mouseIsOnVerticalScrollBar = false;
					this.sectionProperties.mapPane.style.cursor = this.sectionProperties.previousCursorStyle;
					this.containerObject.requestReDraw();
				}
			}
		}

		if (this.documentTopLeft[0] >= 0) {
			if (point[1] >= this.size[1] - this.sectionProperties.usableThickness) {
				if (!this.sectionProperties.mouseIsOnHorizontalScrollBar) {
					this.sectionProperties.drawHorizontalScrollBar = true;
					this.sectionProperties.mouseIsOnHorizontalScrollBar = true;
					this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;
					this.sectionProperties.mapPane.style.cursor = 'pointer';
					this.containerObject.requestReDraw();
				}
			}
			else {
				if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
					this.sectionProperties.drawHorizontalScrollBar = false;
					this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
					this.sectionProperties.mapPane.style.cursor = this.sectionProperties.previousCursorStyle;
					this.containerObject.requestReDraw();
				}
			}
		}
	}

	public onMouseLeave () {
		this.sectionProperties.drawVerticalScrollBar = false;
		this.sectionProperties.drawHorizontalScrollBar = false;
	}

	public scrollVerticalWithOffset (offset: number) {
		offset /= this.dpiScale;

		if (this.documentTopLeft[1] + offset <= 0) // We shouldn't scroll document to a negative y value.
			this.map.scrollTop(0, {});
		else if (this.documentTopLeft[1] + offset >= this.documentTopMax) // We should stop at the bottom of the document.
			this.map.scrollTop(this.documentTopMax / this.dpiScale, {});
		else // Humph, everything is normal.
			this.map.scroll(0, offset, {});
	}

	public scrollHorizontalWithOffset (offset: number) {
		offset /= this.dpiScale;

		if (this.documentTopLeft[0] + offset <= 0) // We shouldn't scroll document to a negative x value.
			this.map.scrollLeft(0, {});
		else if (this.documentTopLeft[0] + offset >= this.documentRightMax) // We should stop at the right edge of the document.
			this.map.scrollLeft(this.documentRightMax / this.dpiScale, {});
		else // Humph, everything is normal.
			this.map.scroll(offset, 0, {});
	}

	public onMouseMove (position: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.clickScrollVertical && this.containerObject.draggingSomething) {
			if (!this.previousDragDistance) {
				this.previousDragDistance = [0, 0];
			}

			var scrollProps: any = this.getVerticalScrollProperties();
			var diffY: number = dragDistance[1] - this.previousDragDistance[1];
			var percentage: number = diffY / scrollProps.scrollLength;
			var actualDistance = this.documentHeight * percentage;

			this.scrollVerticalWithOffset(actualDistance);
			this.previousDragDistance[1] = dragDistance[1];
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else if (this.sectionProperties.clickScrollHorizontal && this.containerObject.draggingSomething) {
			if (!this.previousDragDistance) {
				this.previousDragDistance = [0, 0];
			}

			var scrollProps: any = this.getHorizontalScrollProperties();
			var diffX: number = dragDistance[0] - this.previousDragDistance[0];
			var percentage: number = diffX / scrollProps.scrollLength;
			var actualDistance = this.documentWidth * percentage;

			this.scrollHorizontalWithOffset(actualDistance);
			this.previousDragDistance[0] = dragDistance[0];
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
				this.sectionProperties.clickScrollVertical = true;
				this.map.scrollingIsHandled = true;
				e.stopPropagation(); // Don't propagate to map.
				this.stopPropagating(); // Don't propagate to bound sections.
			}
			else {
				this.sectionProperties.clickScrollVertical = false;
			}
		}

		if (this.documentTopLeft[0] >= 0) {
			if (point[1] >= this.size[1] - this.sectionProperties.usableThickness) {
				this.sectionProperties.clickScrollHorizontal = true;
				this.map.scrollingIsHandled = true;
				e.stopPropagation(); // Don't propagate to map.
				this.stopPropagating(); // Don't propagate to bound sections.
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

		this.previousDragDistance = null;
		this.onMouseMove(point, null, e);
	}

	public onMouseWheel (point: Array<number>, delta: number, e: MouseEvent) {
		if (e.ctrlKey)
			return;

		if (!e.shiftKey) {
			if (delta > 0)
				this.scrollVerticalWithOffset(30);
			else
				this.scrollVerticalWithOffset(-30);

			this.sectionProperties.drawVerticalScrollBar = true;
			this.containerObject.requestReDraw();
			this.sectionProperties.drawVerticalScrollBar = false;
			this.sectionProperties.drawHorizontalScrollBar = false;
		}
		else {
			if (delta > 0)
				this.scrollHorizontalWithOffset(30);
			else
				this.scrollHorizontalWithOffset(-30);

			this.sectionProperties.drawHorizontalScrollBar = true;
			this.containerObject.requestReDraw();
			this.sectionProperties.drawHorizontalScrollBar = false;
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