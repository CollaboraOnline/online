/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

// We are using typescript without modules and compile files individually for now. Typescript needs to know about global definitions.
// We will keep below definitions until we use tsconfig.json.
declare var L: any;
declare var app: any;

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
	isAnimating: boolean = false; // This variable is set by the CanvasSectionContainer class.
	windowSection = true; // This section covers the entire canvas.
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by container.
	startAnimating: Function; // Implemented by container.
	resetAnimation: Function; // Implemented by container.
	map: any;
	autoScrollTimer: any;
	pendingScrollEvent: any = null;

	constructor () {
		this.name = L.CSections.Scroll.name;
		this.processingOrder = L.CSections.Scroll.processingOrder;
		this.drawingOrder = L.CSections.Scroll.drawingOrder;
		this.zIndex = L.CSections.Scroll.zIndex;

		this.map = L.Map.THIS;

		this.map.on('scrollto', this.onScrollTo, this);
		this.map.on('scrollby', this.onScrollBy, this);
		this.map.on('scrollvelocity', this.onScrollVelocity, this);
		this.map.on('handleautoscroll', this.onHandleAutoScroll, this);
		this.map.on('updatescrolloffset', this.onUpdateScrollOffset, this);
	}

	public onInitialize () {
		this.sectionProperties.roundedDpi = Math.round(this.dpiScale);
		if (this.sectionProperties.roundedDpi === 0)
			this.sectionProperties.roundedDpi = 1;

		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
		this.sectionProperties.defaultCursorStyle = this.sectionProperties.mapPane.style.cursor;

		this.sectionProperties.yMax = 0;
		this.sectionProperties.yMin = 0;
		this.sectionProperties.xMax = 0;
		this.sectionProperties.xMin = 0;

		this.sectionProperties.previousDragDistance = null;

		this.sectionProperties.usableThickness = 20 * this.sectionProperties.roundedDpi;
		this.sectionProperties.scrollBarThickness = 12 * this.sectionProperties.roundedDpi;
		this.sectionProperties.edgeOffset = 10 * this.sectionProperties.roundedDpi;

		this.sectionProperties.drawVerticalScrollBar = ((<any>window).mode.isDesktop() ? true: false);
		this.sectionProperties.drawHorizontalScrollBar = ((<any>window).mode.isDesktop() ? true: false);

		this.sectionProperties.clickScrollVertical = false; // true when user presses on the scroll bar drawing.
		this.sectionProperties.clickScrollHorizontal = false;

		this.sectionProperties.mouseIsOnVerticalScrollBar = false;
		this.sectionProperties.mouseIsOnHorizontalScrollBar = false;

		this.sectionProperties.minimumScrollSize = 80 * this.sectionProperties.roundedDpi;

		this.sectionProperties.circleSliderRadius = 24 * this.sectionProperties.roundedDpi; // Radius of the mobile vertical circular slider.
		this.sectionProperties.arrowCornerLength = 10 * this.sectionProperties.roundedDpi; // Corner length of the arrows inside circular slider.

		// Opacity.
		this.sectionProperties.alphaWhenVisible = 0.5; // Scroll bar is visible but not being used.
		this.sectionProperties.alphaWhenBeingUsed = 0.8; // Scroll bar is being used.
		this.sectionProperties.currentAlpha = 1.0; // This variable will be updated while animating. When not animating, this will be equal to one of the above variables.

		// Durations.
		this.sectionProperties.idleDuration = 2000; // In miliseconds. Scroll bar will be visible for this period of time after being used.
		this.sectionProperties.fadeOutStartingTime = 1800; // After this period, scroll bar starts to disappear. This duration is included in "idleDuration".
		this.sectionProperties.fadeOutDuration = this.sectionProperties.idleDuration - this.sectionProperties.fadeOutStartingTime;

		this.sectionProperties.yOffset = 0;
		this.sectionProperties.xOffset = 0;

		this.sectionProperties.horizontalScrollRightOffset = this.sectionProperties.usableThickness * 2; // To prevent overlapping of the scroll bars.

		this.sectionProperties.animatingVerticalScrollBar = false;
		this.sectionProperties.animatingHorizontalScrollBar = false;

		this.sectionProperties.pointerSyncWithVerticalScrollBar = true;
		this.sectionProperties.pointerSyncWithHorizontalScrollBar = true;
		// When user moves the pointer outside of the scroll area, we don't want to let them scroll the document.
		// Because in that case, mouse pointer is not parallel with the scroll bar.
		// We wait for the user to move the pointer to a position parallel with the scroll bar.
		// When user does it, we again let the scroll bar work. But if we let the scroll bar work as soon as it sees the pointer,
		// feature becomes fragile. That 1 pixel of intersection may be broken easily.
		// So, when the pointer is de-sync with the scroll bar, we will put a spacer to force the pointer go inside into the allowed area a bit more.
		this.sectionProperties.pointerReCaptureSpacer = 30 * this.sectionProperties.roundedDpi;
	}

	public completePendingScroll() {
		if (this.pendingScrollEvent) {
			this.onScrollTo(this.pendingScrollEvent, true /* force */)
			this.pendingScrollEvent = null;
		}
	}

	public onScrollTo (e: any, force: boolean = false) {
		if (!force && !this.containerObject.drawingAllowed()) {
			// Only remember the last scroll-to position.
			this.pendingScrollEvent = e;
			return;
		}
		// Triggered by the document (e.g. search result out of the viewing area).
		this.map.scrollTop(e.y, {});
		this.map.scrollLeft(e.x, {});
	}

	public onScrollBy (e: any) {
		if (this.map._docLayer._docType !== 'spreadsheet')
			this.map.panBy(new L.Point(e.x, e.y), {animate: false});
		else {
			// For Calc, top position shouldn't be below zero, for others, we can activate a similar check if needed (while keeping in mind that top position may be below zero for others).
			var docTopLef = this.containerObject.getDocumentTopLeft();

			// Some early exits.
			if (e.y < 0 && docTopLef[1] === 0) // Don't scroll to negative values.
				return;

			if (e.x < 0 && docTopLef[0] === 0)
				return;

			var diff = Math.round(e.y * app.dpiScale);

			if (docTopLef[1] + diff < 0) {
				e.y = Math.round(-1 * docTopLef[1] / app.dpiScale);
			}

			diff = Math.round(e.x * app.dpiScale);
			if (docTopLef[0] + diff < 0) {
				e.x = Math.round(-1 * docTopLef[0] / app.dpiScale);
			}
			this.map.panBy(new L.Point(e.x, e.y), {animate: false});
		}
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
				// Unfortunately, dragging outside the map doesn't work for the map element.
				// We will keep this until we remove leaflet.
				if (L.Map.THIS.mouse && L.Map.THIS.mouse._mouseDown && this.containerObject.targetBoundSectionListContains(L.CSections.Tiles.name) && (<any>window).mode.isDesktop() && this.containerObject.draggingSomething && L.Map.THIS._docLayer._docType === 'spreadsheet') {
					var temp = this.containerObject.positionOnMouseDown;
					var tempPos = [temp[0] * app.dpiScale, temp[1] * app.dpiScale];
					var docTopLeft = app.sectionContainer.getDocumentTopLeft();
					tempPos = [tempPos[0] + docTopLeft[0], tempPos[1] + docTopLeft[1]];
					tempPos = [Math.round(tempPos[0] * app.pixelsToTwips), Math.round(tempPos[1] * app.pixelsToTwips)];
					L.Map.THIS._docLayer._postMouseEvent('move', tempPos[0], tempPos[1], 1, 1, 0);
				}
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

	private getVerticalScrollLength () :number {
		var result: number = this.containerObject.getDocumentAnchorSection().size[1];
		this.sectionProperties.yOffset = this.containerObject.getDocumentAnchorSection().myTopLeft[1];

		if (this.map._docLayer._docType !== 'spreadsheet') {
			return result;
		}
		else {
			var splitPanesContext: any = this.map.getSplitPanesContext();
			var splitPos = {x: 0, y: 0};
			if (splitPanesContext) {
				splitPos = splitPanesContext.getSplitPos().clone();
				splitPos.y = Math.round(splitPos.y * this.dpiScale);
			}

			this.sectionProperties.yOffset += splitPos.y;
			return result - splitPos.y;
		}
	}

	private calculateVerticalScrollSize (scrollLength: number) :number {
		var scrollSize = Math.round(scrollLength * scrollLength / app.view.size.pixels[1]);
		return Math.round(scrollSize);
	}

	private calculateYMinMax () {
		var diff: number = Math.round(app.view.size.pixels[1] - this.containerObject.getDocumentAnchorSection().size[1]);

		if (diff >= 0) {
			this.sectionProperties.yMin = 0;
			this.sectionProperties.yMax = diff;
			if ((<any>window).mode.isDesktop())
				this.sectionProperties.drawVerticalScrollBar = true;
		}
		else {
			diff = Math.round((app.view.size.pixels[1] - this.containerObject.getDocumentAnchorSection().size[1]) * 0.5);
			this.sectionProperties.yMin = diff;
			this.sectionProperties.yMax = diff;
			if (app.view.size.pixels[1] >  0) {
				if (this.map._docLayer._docType !== 'spreadsheet' || !(<any>window).mode.isDesktop())
					this.sectionProperties.drawVerticalScrollBar = false;
			}
		}
	}

	public getVerticalScrollProperties () :any {
		this.calculateYMinMax()
		var result: any = {};
		result.scrollLength = this.getVerticalScrollLength(); // The length of the railway that the scroll bar moves on up & down.
		result.scrollSize = this.calculateVerticalScrollSize(result.scrollLength); // Size of the scroll bar.

		if (result.scrollSize < this.sectionProperties.minimumScrollSize) {
			var diff: number = this.sectionProperties.minimumScrollSize - result.scrollSize;
			result.scrollLength -= diff;
			result.scrollSize = this.sectionProperties.minimumScrollSize;
		}

		result.ratio = app.view.size.pixels[1] / result.scrollLength; // 1px scrolling = xpx document height.
		result.startY = Math.round(this.documentTopLeft[1] / result.ratio + this.sectionProperties.scrollBarThickness * 0.5 + this.sectionProperties.yOffset);

		return result;
	}

	private getHorizontalScrollLength () :number {
		var result: number = this.containerObject.getDocumentAnchorSection().size[0];
		this.sectionProperties.xOffset = this.containerObject.getDocumentAnchorSection().myTopLeft[0];

		if (this.map._docLayer._docType !== 'spreadsheet') {
			return result - this.sectionProperties.horizontalScrollRightOffset;
		}
		else {
			var splitPanesContext: any = this.map.getSplitPanesContext();
			var splitPos = {x: 0, y: 0};
			if (splitPanesContext) {
				splitPos = splitPanesContext.getSplitPos().clone();
				splitPos.x = Math.round(splitPos.x * this.dpiScale);
			}

			this.sectionProperties.xOffset += splitPos.x;
			return result - splitPos.x - this.sectionProperties.horizontalScrollRightOffset;
		}
	}

	private calculateHorizontalScrollSize (scrollLength: number) :number {
		var scrollSize = Math.round(scrollLength * scrollLength / app.view.size.pixels[0]);
		return scrollSize;
	}

	private calculateXMinMax () {
		var diff: number = Math.round(app.view.size.pixels[0] - this.containerObject.getDocumentAnchorSection().size[0]);

		if (diff >= 0) {
			this.sectionProperties.xMin = 0;
			this.sectionProperties.xMax = diff;
			if ((<any>window).mode.isDesktop())
				this.sectionProperties.drawHorizontalScrollBar = true;
		}
		else {
			diff = Math.round((app.view.size.pixels[0] - this.containerObject.getDocumentAnchorSection().size[0]) * 0.5);
			this.sectionProperties.xMin = diff;
			this.sectionProperties.xMax = diff;
			if (app.view.size.pixels[0] >  0) {
				if (this.map._docLayer._docType !== 'spreadsheet' || !(<any>window).mode.isDesktop())
					this.sectionProperties.drawHorizontalScrollBar = false;
			}
		}
	}

	public getHorizontalScrollProperties () :any {
		this.calculateXMinMax()
		var result: any = {};
		result.scrollLength = this.getHorizontalScrollLength(); // The length of the railway that the scroll bar moves on left & right.
		result.scrollSize = this.calculateHorizontalScrollSize(result.scrollLength); // Width of the scroll bar.

		if (result.scrollSize < this.sectionProperties.minimumScrollSize) {
			var diff: number = this.sectionProperties.minimumScrollSize - result.scrollSize;
			result.scrollLength -= diff;
			result.scrollSize = this.sectionProperties.minimumScrollSize;
		}

		result.ratio = app.view.size.pixels[0] / result.scrollLength;
		result.startX = Math.round(this.documentTopLeft[0] / result.ratio + this.sectionProperties.scrollBarThickness * 0.5 + this.sectionProperties.xOffset);

		return result;
	}

	public onUpdateScrollOffset () {
		if (this.map._docLayer._docType === 'spreadsheet')
			this.map._docLayer.refreshViewData();
	}

	private DrawVerticalScrollBarMobile () {
		var scrollProps: any = this.getVerticalScrollProperties();

		if (this.sectionProperties.animatingVerticalScrollBar)
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		else
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
		var y: number = circleStartY - 5 * this.sectionProperties.roundedDpi;
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
		y = circleStartY + 5 * this.sectionProperties.roundedDpi;
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

		if (this.sectionProperties.animatingVerticalScrollBar)
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		else
			this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;

		this.context.fillStyle = '#7E8182';

		var startX = this.size[0] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

        this.context.fillRect(startX, scrollProps.startY, this.sectionProperties.scrollBarThickness, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness);

		this.context.globalAlpha = 1.0;
	}

	private drawHorizontalScrollBar () {
		var scrollProps: any = this.getHorizontalScrollProperties();

		if (this.sectionProperties.animatingHorizontalScrollBar)
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		else
			this.context.globalAlpha = this.sectionProperties.clickScrollHorizontal ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;

		this.context.fillStyle = '#7E8182';

		var startY = this.size[1] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		this.context.fillRect(scrollProps.startX, startY, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness, this.sectionProperties.scrollBarThickness);

		this.context.globalAlpha = 1.0;
	}

	private calculateCurrentAlpha (elapsedTime: number) {
		if (elapsedTime >= this.sectionProperties.fadeOutStartingTime) {
			this.sectionProperties.currentAlpha = Math.max((1 - ((elapsedTime - this.sectionProperties.fadeOutStartingTime) / this.sectionProperties.fadeOutDuration)) * this.sectionProperties.alphaWhenVisible, 0.1);
		}
		else {
			this.sectionProperties.currentAlpha = this.sectionProperties.alphaWhenVisible;
		}
	}

	public onDraw (frameCount: number, elapsedTime: number) {
		if (this.isAnimating && frameCount >= 0)
			this.calculateCurrentAlpha(elapsedTime);

		if ((this.sectionProperties.drawVerticalScrollBar || this.sectionProperties.animatingVerticalScrollBar)) {
			if ((<any>window).mode.isMobile())
				this.DrawVerticalScrollBarMobile();
			else
				this.drawVerticalScrollBar();
		}

		if ((this.sectionProperties.drawHorizontalScrollBar || this.sectionProperties.animatingHorizontalScrollBar)) {
			this.drawHorizontalScrollBar();
		}
	}

	public onAnimationEnded (frameCount: number, elapsedTime: number) {
		this.sectionProperties.animatingVerticalScrollBar = false;
		this.sectionProperties.animatingHorizontalScrollBar = false;
	}

	private fadeOutHorizontalScrollBar () {
		if (this.isAnimating) {
			this.resetAnimation();
			this.sectionProperties.animatingHorizontalScrollBar = true;
		}
		else {
			var options: any = {
				duration: this.sectionProperties.idleDuration
			};

			this.sectionProperties.animatingHorizontalScrollBar = this.startAnimating(options);
		}
	}

	private fadeOutVerticalScrollBar () {
		if (this.isAnimating) {
			this.resetAnimation();
			this.sectionProperties.animatingVerticalScrollBar = true;
		}
		else {
			var options: any = {
				duration: this.sectionProperties.idleDuration
			};

			this.sectionProperties.animatingVerticalScrollBar = this.startAnimating(options);
		}
	}

	private hideVerticalScrollBar () {
		if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.mouseIsOnVerticalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;

			if (!(<any>window).mode.isDesktop()) { // On desktop, we don't want to hide the vertical scroll bar.
				this.sectionProperties.drawVerticalScrollBar = false;
				this.fadeOutVerticalScrollBar();
			}

			// just in case if we have blinking cursor visible
			// we need to change cursor from default style
			if (this.map._docLayer._cursorMarker)
				this.map._docLayer._cursorMarker.setMouseCursor();
		}
	}

	private showVerticalScrollBar () {
		if (this.isAnimating && this.sectionProperties.animatingVerticalScrollBar)
			this.containerObject.stopAnimating();

		if (!this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.drawVerticalScrollBar = true;
			this.sectionProperties.mouseIsOnVerticalScrollBar = true;
			this.sectionProperties.mapPane.style.cursor = 'pointer';
			this.containerObject.requestReDraw();
		}
	}

	private hideHorizontalScrollBar () {
		if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
			this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;

			if (!(<any>window).mode.isDesktop()) {
				this.sectionProperties.drawHorizontalScrollBar = false;
				this.fadeOutHorizontalScrollBar();
			}

			// just in case if we have blinking cursor visible
			// we need to change cursor from default style
			if (this.map._docLayer._cursorMarker)
				this.map._docLayer._cursorMarker.setMouseCursor();
		}
	}

	private showHorizontalScrollBar () {
		if (this.isAnimating && this.sectionProperties.animatingHorizontalScrollBar)
			this.containerObject.stopAnimating();

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
		this.hideVerticalScrollBar();
		this.hideHorizontalScrollBar();
	}

	public scrollVerticalWithOffset (offset: number) {
        var go = true;
		if (offset > 0) {
            if (this.documentTopLeft[1] + offset > this.sectionProperties.yMax)
                offset = this.sectionProperties.yMax - this.documentTopLeft[1];
            if (offset < 0)
                go = false;
		}
		else {
			if (this.documentTopLeft[1] + offset < this.sectionProperties.yMin)
				offset = this.sectionProperties.yMin - this.documentTopLeft[1];
			if (offset > 0)
				go = false;
		}

		if (go) {
			this.map.scroll(0, offset / this.dpiScale, {});
			this.onUpdateScrollOffset();
		}
	}

	public scrollHorizontalWithOffset (offset: number) {
		var go = true;
		if (offset > 0) {
            if (this.documentTopLeft[0] + offset > this.sectionProperties.xMax)
				offset = this.sectionProperties.xMax - this.documentTopLeft[0];
            if (offset < 0)
                go = false;
		}
		else {
			if (this.documentTopLeft[0] + offset < this.sectionProperties.xMin)
				offset = this.sectionProperties.xMin - this.documentTopLeft[0];
			if (offset > 0)
				go = false;
		}

		if (go) {
			this.map.scroll(offset / this.dpiScale, 0, {});
			this.onUpdateScrollOffset();
		}
	}

	private isMouseInsideDocumentAnchor (point: Array<number>): boolean {
		var docSection = this.containerObject.getDocumentAnchorSection();
		return this.containerObject.doesSectionIncludePoint(docSection, point);
	}

	private isMousePointerSycnWithVerticalScrollBar (scrollProps: any, position: Array<number>): boolean {
		// Keep this desktop-only for now.
		if (!(<any>window).mode.isDesktop())
			return true;

		var spacer = 0;
		if (!this.sectionProperties.pointerSyncWithVerticalScrollBar) {
			spacer = this.sectionProperties.pointerReCaptureSpacer;
		}

		// Scrolling is enabled only when mouse pointer is inside between start point and end point of the scroll bar.
		// Check if the mouse pointer is below the start point of the scroll bar.
		var pointerIsSyncWithScrollBar = scrollProps.startY + spacer < position[1];

		if (pointerIsSyncWithScrollBar) {
			// Check if the mouse is above the end point of the scroll bar.
			pointerIsSyncWithScrollBar = scrollProps.startY + scrollProps.scrollSize - this.sectionProperties.scrollBarThickness - spacer > position[1];
		}

		pointerIsSyncWithScrollBar = pointerIsSyncWithScrollBar || (this.isMouseInsideDocumentAnchor(position) && spacer === 0);

		this.sectionProperties.pointerSyncWithVerticalScrollBar = pointerIsSyncWithScrollBar;
		return pointerIsSyncWithScrollBar;
	}

	private isMousePointerSycnWithHorizontalScrollBar (scrollProps: any, position: Array<number>): boolean {
		// Keep this desktop-only for now.
		if (!(<any>window).mode.isDesktop())
			return true;

		var spacer = 0;
		if (!this.sectionProperties.pointerSyncWithHorizontalScrollBar) {
			spacer = this.sectionProperties.pointerReCaptureSpacer;
		}

		// Scrolling is enabled only when mouse pointer is inside between start point and end point of the scroll bar.
		// Check if the mouse pointer is on the right of the start point of the scroll bar.
		var pointerIsSyncWithScrollBar = scrollProps.startX + spacer < position[0];

		if (pointerIsSyncWithScrollBar) {
			// Check if the mouse is on the left of the end point of the scroll bar.
			pointerIsSyncWithScrollBar = scrollProps.startX + scrollProps.scrollSize - this.sectionProperties.scrollBarThickness - spacer > position[0];
		}

		pointerIsSyncWithScrollBar = pointerIsSyncWithScrollBar || (this.isMouseInsideDocumentAnchor(position) && spacer === 0);

		this.sectionProperties.pointerSyncWithHorizontalScrollBar = pointerIsSyncWithScrollBar;
		return pointerIsSyncWithScrollBar;
	}

	public onMouseMove (position: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.clickScrollVertical && this.containerObject.draggingSomething) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			this.showVerticalScrollBar();

			var scrollProps: any = this.getVerticalScrollProperties();

			var diffY: number = dragDistance[1] - this.sectionProperties.previousDragDistance[1];
			var actualDistance = scrollProps.ratio * diffY;

			if (this.isMousePointerSycnWithVerticalScrollBar(scrollProps, position))
				this.scrollVerticalWithOffset(actualDistance);

			this.sectionProperties.previousDragDistance[1] = dragDistance[1];

			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else if (this.sectionProperties.clickScrollHorizontal && this.containerObject.draggingSomething) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			this.showHorizontalScrollBar();

			var scrollProps: any = this.getHorizontalScrollProperties();
			var diffX: number = dragDistance[0] - this.sectionProperties.previousDragDistance[0];
			var actualDistance = scrollProps.ratio * diffX;

			if (this.isMousePointerSycnWithHorizontalScrollBar(scrollProps, position))
				this.scrollHorizontalWithOffset(actualDistance);

			this.sectionProperties.previousDragDistance[0] = dragDistance[0];
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else {
			this.isMouseOnScrollBar(position);
		}
	}

	/*
		When user presses the button while the mouse pointer is on the railway of the scroll bar but not on the scroll bar directly,
		we quickly scroll the document to that position.
	*/
	private quickScrollVertical (point: Array<number>) {
		// Desktop only for now.
		if (!(<any>window).mode.isDesktop())
			return;

		var props = this.getVerticalScrollProperties();
		var midY = (props.startY + props.startY + props.scrollSize - this.sectionProperties.scrollBarThickness) * 0.5;
		var offset = Math.round((point[1] - midY) * props.ratio);
		this.scrollVerticalWithOffset(offset);
	}

	/*
		When user presses the button while the mouse pointer is on the railway of the scroll bar but not on the scroll bar directly,
		we quickly scroll the document to that position.
	*/
	private quickScrollHorizontal (point: Array<number>) {
		// Desktop only for now.
		if (!(<any>window).mode.isDesktop())
			return;

		var props = this.getHorizontalScrollProperties();
		var midX = (props.startX + props.startX + props.scrollSize - this.sectionProperties.scrollBarThickness) * 0.5;
		var offset = Math.round((point[0] - midX) * props.ratio);
		this.scrollHorizontalWithOffset(offset);
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		this.onMouseMove(point, null, e);
		this.isMouseOnScrollBar(point);

		if (this.documentTopLeft[1] >= 0) {
			if (point[0] >= this.size[0] - this.sectionProperties.usableThickness) {
				if (point[1] > this.sectionProperties.yOffset) {
					this.sectionProperties.clickScrollVertical = true;
					this.map.scrollingIsHandled = true;
					this.quickScrollVertical(point);
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
					this.quickScrollHorizontal(point);
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
			this.sectionProperties.pointerSyncWithVerticalScrollBar = true; // Default.
		}
		else if (this.sectionProperties.clickScrollHorizontal) {
			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
			this.sectionProperties.clickScrollHorizontal = false;
			this.sectionProperties.pointerSyncWithHorizontalScrollBar = true; // Default.
		}

		// Unfortunately, dragging outside the map doesn't work for the map element.
		// We will keep this until we remove leaflet.
		else if (L.Map.THIS.mouse && L.Map.THIS.mouse._mouseDown && this.containerObject.targetBoundSectionListContains(L.CSections.Tiles.name) && (<any>window).mode.isDesktop() && this.containerObject.draggingSomething && L.Map.THIS._docLayer._docType === 'spreadsheet') {
			var temp = this.containerObject.positionOnMouseUp;
			var tempPos = [temp[0] * app.dpiScale, temp[1] * app.dpiScale];
			var docTopLeft = app.sectionContainer.getDocumentTopLeft();
			tempPos = [tempPos[0] + docTopLeft[0], tempPos[1] + docTopLeft[1]];
			tempPos = [Math.round(tempPos[0] * app.pixelsToTwips), Math.round(tempPos[1] * app.pixelsToTwips)];
			this.onScrollVelocity({ vx: 0, vy: 0 }); // Cancel auto scrolling.
			L.Map.THIS.mouse._mouseDown = false;
			L.Map.THIS._docLayer._postMouseEvent('buttonup', tempPos[0], tempPos[1], 1, 1, 0);
		}

		this.sectionProperties.previousDragDistance = null;
		this.onMouseMove(point, null, e);
	}

	private performVerticalScroll (delta: number) {
		this.scrollVerticalWithOffset(delta);
		if (!this.sectionProperties.drawVerticalScrollBar) {
			if (this.isAnimating) {
				this.resetAnimation();
				this.sectionProperties.animatingVerticalScrollBar = true;
			}
			else
				this.fadeOutVerticalScrollBar();
		}
	}

	private performHorizontalScroll (delta: number) {
		this.scrollHorizontalWithOffset(delta);
		if (!this.sectionProperties.drawHorizontalScrollBar) {
			if (this.isAnimating) {
				this.resetAnimation();
				this.sectionProperties.animatingHorizontalScrollBar = true;
			}
			else
				this.fadeOutHorizontalScrollBar();
		}
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