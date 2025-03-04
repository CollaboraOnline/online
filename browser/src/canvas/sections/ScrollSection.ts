/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* See CanvasSectionContainer.ts for explanations. */

// We will keep below definitions until we use tsconfig.json.
declare var L: any;
declare var app: any;

namespace cool {

export class ScrollSection extends CanvasSectionObject {
	// Scrolling animation constants. Unlabelled units are fractions of the line
	// height, so that they're somewhat DPI-independent.
	static readonly scrollAnimationAcceleration: number = 0.2;
	static readonly scrollAnimationMaxVelocity: number = 2.5;
	static readonly scrollAnimationMaxDelta: number = 75;
	static readonly scrollDirectTimeoutMs: number = 100;

	name: string = L.CSections.Scroll.name;
	processingOrder: number = L.CSections.Scroll.processingOrder
	drawingOrder: number = L.CSections.Scroll.drawingOrder;
	zIndex: number = L.CSections.Scroll.zIndex;
	windowSection: boolean = true; // This section covers the entire canvas.

	map: any;
	autoScrollTimer: any;
	pendingScrollEvent: any = null;
	stepByStepScrolling: boolean = false; // quick scroll will move "page up/down" not "jump to"

	isRTL: () => boolean;

	constructor (isRTL?: () => boolean) {
		super();


		this.map = L.Map.THIS;

		this.isRTL = isRTL ?? (() => false);

		this.map.on('scrollto', this.onScrollTo, this);
		this.map.on('scrollby', this.onScrollBy, this);
		this.map.on('scrollvelocity', this.onScrollVelocity, this);
		this.map.on('handleautoscroll', this.onHandleAutoScroll, this);
		this.map.on('updatescrolloffset', this.onUpdateScrollOffset, this);
	}

	public onInitialize (): void {
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
		this.sectionProperties.defaultCursorStyle = this.sectionProperties.mapPane.style.cursor;

		this.sectionProperties.yMax = 0;
		this.sectionProperties.yMin = 0;
		this.sectionProperties.xMax = 0;
		this.sectionProperties.xMin = 0;

		this.sectionProperties.previousDragDistance = null;

		this.sectionProperties.usableThickness = 20 * app.roundedDpiScale;
		this.sectionProperties.scrollBarThickness = 6 * app.roundedDpiScale;
		this.sectionProperties.edgeOffset = 0;

		this.sectionProperties.drawScrollBarRailway = true;
		this.sectionProperties.scrollBarRailwayThickness = 12 * app.roundedDpiScale;
		this.sectionProperties.scrollBarRailwayAlpha = this.map._docLayer._docType === 'spreadsheet' ? 1.0 : 0.5;
		this.sectionProperties.scrollBarRailwayColor = '#EFEFEF';

		this.sectionProperties.drawVerticalScrollBar = ((<any>window).mode.isDesktop() ? true: false);
		this.sectionProperties.drawHorizontalScrollBar = ((<any>window).mode.isDesktop() ? true: false);

		this.sectionProperties.clickScrollVertical = false; // true when user presses on the scroll bar drawing.
		this.sectionProperties.clickScrollHorizontal = false;

		this.sectionProperties.mouseIsOnVerticalScrollBar = false;
		this.sectionProperties.mouseIsOnHorizontalScrollBar = false;

		this.sectionProperties.minimumScrollSize = 80 * app.roundedDpiScale;

		this.sectionProperties.circleSliderRadius = 24 * app.roundedDpiScale; // Radius of the mobile vertical circular slider.
		this.sectionProperties.arrowCornerLength = 10 * app.roundedDpiScale; // Corner length of the arrows inside circular slider.

		// Opacity.
		this.sectionProperties.alphaWhenVisible = 0.5; // Scroll bar is visible but not being used.
		this.sectionProperties.alphaWhenBeingUsed = 0.8; // Scroll bar is being used.
		this.sectionProperties.currentAlpha = 1.0; // This variable will be updated while animating. When not animating, this will be equal to one of the above variables.

		// Durations.
		this.sectionProperties.idleDuration = 2000; // In milliseconds. Scroll bar will be visible for this period of time after being used.
		this.sectionProperties.fadeOutStartingTime = 1800; // After this period, scroll bar starts to disappear. This duration is included in "idleDuration".
		this.sectionProperties.fadeOutDuration = this.sectionProperties.idleDuration - this.sectionProperties.fadeOutStartingTime;

		this.sectionProperties.yOffset = 0;
		this.sectionProperties.xOffset = 0;

		this.sectionProperties.horizontalScrollRightOffset = this.sectionProperties.usableThickness * 2; // To prevent overlapping of the scroll bars.

		this.sectionProperties.animatingVerticalScrollBar = false;
		this.sectionProperties.animatingHorizontalScrollBar = false;
		this.sectionProperties.animatingScroll = false;

		this.sectionProperties.animateWheelScroll = (<any>window).mode.isDesktop();
		this.sectionProperties.scrollAnimationDelta = [0, 0];
		this.sectionProperties.scrollAnimationVelocity = [0, 0];
		this.sectionProperties.scrollAnimationDisableTimeout = null;

		this.sectionProperties.pointerSyncWithVerticalScrollBar = true;
		this.sectionProperties.pointerSyncWithHorizontalScrollBar = true;
		this.sectionProperties.pointerReCaptureSpacer = null; // Clicked point of the scroll bar.

		// Step by step scrolling interval in ms
		this.sectionProperties.stepDuration = 50;
		this.sectionProperties.quickScrollHorizontalTimer = null;
	}

	public completePendingScroll(): void {
		if (this.pendingScrollEvent) {
			this.onScrollTo(this.pendingScrollEvent, true /* force */);
			this.pendingScrollEvent = null;
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onScrollTo (e: any, force: boolean = false): void {
		if (!force && !this.containerObject.drawingAllowed()) {
			// Only remember the last scroll-to position.
			this.pendingScrollEvent = e;
			return;
		}
		// Triggered by the document (e.g. search result out of the viewing area).
		if (this.map.scrollTop && this.map.scrollLeft) {
			this.map.scrollTop(e.y, {});
			this.map.scrollLeft(e.x, {});
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onScrollBy (e: any): void {
		if (this.map._docLayer._docType !== 'spreadsheet') {
			this.scrollVerticalWithOffset(e.y);
			this.scrollHorizontalWithOffset(e.x);
		} else {
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

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onScrollVelocity (e: any): void {
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
				if (L.Map.THIS.mouse
				&& L.Map.THIS.mouse._mouseDown
				&& this.containerObject.targetBoundSectionListContains(L.CSections.Tiles.name)
				&& (<any>window).mode.isDesktop()
				&& this.containerObject.isDraggingSomething()
				&& L.Map.THIS._docLayer._docType === 'spreadsheet') {
					var temp = [e.pos.x, e.pos.y];
					var tempPos = [(this.isRTL() ? this.map._size.x - temp[0] : temp[0]) * app.dpiScale, temp[1] * app.dpiScale];
					var docTopLeft = app.sectionContainer.getDocumentTopLeft();
					tempPos = [tempPos[0] + docTopLeft[0], tempPos[1] + docTopLeft[1]];
					tempPos = [Math.round(tempPos[0] * app.pixelsToTwips), Math.round(tempPos[1] * app.pixelsToTwips)];
					L.Map.THIS._docLayer._postMouseEvent('move', tempPos[0], tempPos[1], 1, 1, 0);
				}
			}, this), 100);
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onHandleAutoScroll (e :any): void {
		var vx = 0;
		var vy = 0;

		if (e.pos.y > e.map._size.y - 50) {
			vy = 50;
		} else if (e.pos.y < 50 && e.map._getTopLeftPoint().y > 50) {
			vy = -50;
		}

		const mousePosX: number = this.isRTL() ? e.map._size.x - e.pos.x : e.pos.x;
		const mapLeft: number = this.isRTL() ? e.map._size.x - e.map._getTopLeftPoint().x : e.map._getTopLeftPoint().x;
		if (mousePosX > e.map._size.x - 50) {
			vx = 50;
		} else if (mousePosX < 50 && mapLeft > 50) {
			vx = -50;
		}

		this.onScrollVelocity({ vx: vx, vy: vy, pos: e.pos });
	}

	private getVerticalScrollLength (): number {
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
				splitPos.y = Math.round(splitPos.y * app.dpiScale);
			}

			this.sectionProperties.yOffset += splitPos.y;
			return result - splitPos.y;
		}
	}

	private calculateVerticalScrollSize (scrollLength: number) :number {
		var scrollSize = Math.round(scrollLength * scrollLength / app.view.size.pY);
		return Math.round(scrollSize);
	}

	private calculateYMinMax () {
		var diff: number = Math.round(app.view.size.pY - this.containerObject.getDocumentAnchorSection().size[1]);

		if (diff >= 0) {
			this.sectionProperties.yMin = 0;
			this.sectionProperties.yMax = diff;
			if ((<any>window).mode.isDesktop())
				this.sectionProperties.drawVerticalScrollBar = true;
		}
		else {
			diff = Math.round((app.view.size.pY - this.containerObject.getDocumentAnchorSection().size[1]) * 0.5);
			this.sectionProperties.yMin = diff;
			this.sectionProperties.yMax = diff;
			if (app.view.size.pY >  0) {
				if (this.map._docLayer._docType !== 'spreadsheet' || !(<any>window).mode.isDesktop())
					this.sectionProperties.drawVerticalScrollBar = false;
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public getVerticalScrollProperties (): any {
		this.calculateYMinMax();
		var result: any = {};
		result.scrollLength = this.getVerticalScrollLength(); // The length of the railway that the scroll bar moves on up & down.
		result.scrollSize = this.calculateVerticalScrollSize(result.scrollLength); // Size of the scroll bar.

		if (result.scrollSize < this.sectionProperties.minimumScrollSize) {
			var diff: number = this.sectionProperties.minimumScrollSize - result.scrollSize;
			result.scrollLength -= diff;
			result.scrollSize = this.sectionProperties.minimumScrollSize;
		}

		result.ratio = app.view.size.pY / result.scrollLength; // 1px scrolling = xpx document height.
		result.startY = Math.round(this.documentTopLeft[1] / result.ratio + this.sectionProperties.yOffset);

		result.verticalScrollStep = this.size[1] / 2;

		return result;
	}

	private getHorizontalScrollLength (): number {
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
				splitPos.x = Math.round(splitPos.x * app.dpiScale);
			}

			this.sectionProperties.xOffset += splitPos.x;
			return result - splitPos.x - this.sectionProperties.horizontalScrollRightOffset;
		}
	}

	private calculateHorizontalScrollSize (scrollLength: number): number {
		var scrollSize = Math.round(scrollLength * scrollLength / app.view.size.pX);
		return scrollSize;
	}

	private calculateXMinMax (): void {
		var diff: number = Math.round(app.view.size.pX - this.containerObject.getDocumentAnchorSection().size[0]);

		if (diff >= 0) {
			this.sectionProperties.xMin = 0;
			this.sectionProperties.xMax = diff;
			if ((<any>window).mode.isDesktop())
				this.sectionProperties.drawHorizontalScrollBar = true;
		}
		else {
			diff = Math.round((app.view.size.pX - this.containerObject.getDocumentAnchorSection().size[0]) * 0.5);
			this.sectionProperties.xMin = diff;
			this.sectionProperties.xMax = diff;
			if (app.view.size.pX >  0) {
				if (this.map._docLayer._docType !== 'spreadsheet' || !(<any>window).mode.isDesktop())
					this.sectionProperties.drawHorizontalScrollBar = false;
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public getHorizontalScrollProperties (): any {
		this.calculateXMinMax();
		var result: any = {};
		result.scrollLength = this.getHorizontalScrollLength(); // The length of the railway that the scroll bar moves on left & right.
		result.scrollSize = this.calculateHorizontalScrollSize(result.scrollLength); // Width of the scroll bar.

		if (result.scrollSize < this.sectionProperties.minimumScrollSize) {
			var diff: number = this.sectionProperties.minimumScrollSize - result.scrollSize;
			result.scrollLength -= diff;
			result.scrollSize = this.sectionProperties.minimumScrollSize;
		}

		result.ratio = app.view.size.pX / result.scrollLength;
		result.startX = Math.round(this.documentTopLeft[0] / result.ratio + this.sectionProperties.xOffset);

		result.horizontalScrollStep = this.size[0] / 2;

		return result;
	}

	public onUpdateScrollOffset (): void {
		if (this.map._docLayer._docType === 'spreadsheet') {
			this.map._docLayer.refreshViewData();
			this.map._docLayer.updateScrollLimit();
		}
	}

	private DrawVerticalScrollBarMobile (): void {
		var scrollProps: any = this.getVerticalScrollProperties();

		if (this.sectionProperties.animatingVerticalScrollBar)
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		else
			this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;

		this.context.strokeStyle = '#7E8182';
		this.context.fillStyle = 'white';

		var circleStartY = scrollProps.startY + this.sectionProperties.circleSliderRadius;
		var circleStartX = this.isRTL()
			? this.sectionProperties.circleSliderRadius * 0.5
			: this.size[0] - this.sectionProperties.circleSliderRadius * 0.5;

		this.context.beginPath();
		this.context.arc(circleStartX, circleStartY, this.sectionProperties.circleSliderRadius, 0, Math.PI * 2, true);
		this.context.fill();
		this.context.stroke();

		this.context.fillStyle = '#7E8182';
		this.context.beginPath();
		var x: number = circleStartX - this.sectionProperties.arrowCornerLength * 0.5;
		var y: number = circleStartY - 5 * app.roundedDpiScale;
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
		y = circleStartY + 5 * app.roundedDpiScale;
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

	private drawVerticalScrollBar (): void {
		var scrollProps: any = this.getVerticalScrollProperties();
		const isDarkBackground = this.map.uiManager.isBackgroundDark();
		const docType = this.sectionProperties.docLayer._docType;

		var startX = this.isRTL() ? this.sectionProperties.edgeOffset : this.size[0] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		if (isDarkBackground && (docType === 'text' || docType === 'drawing')) {
			this.sectionProperties.scrollBarRailwayColor = 'transparent';
		}

		if (this.sectionProperties.drawScrollBarRailway) {
			this.context.globalAlpha = this.sectionProperties.scrollBarRailwayAlpha;
			this.context.fillStyle = this.sectionProperties.scrollBarRailwayColor;
			this.context.fillRect(
				startX,
				this.sectionProperties.yMin + this.sectionProperties.yOffset,
				this.sectionProperties.scrollBarRailwayThickness,
				this.sectionProperties.yMax - this.sectionProperties.yMin - this.sectionProperties.yOffset
			);
		}

		if (this.sectionProperties.animatingVerticalScrollBar) {
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		} else {
			this.context.globalAlpha = this.sectionProperties.clickScrollVertical ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;
		}

		this.context.fillStyle = '#7E8182';


		this.context.fillRect(startX, scrollProps.startY, this.sectionProperties.scrollBarThickness, scrollProps.scrollSize - this.sectionProperties.scrollBarThickness);

		this.context.globalAlpha = 1.0;

		if (this.containerObject.testing) {
			var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-vertical-scrollbar');
			if (!element) {
				element = document.createElement('div');
				element.id = 'test-div-vertical-scrollbar';
				document.body.appendChild(element);
			}
			element.textContent = String(scrollProps.startY);
			element.style.display = 'none';
			element.style.position = 'fixed';
			element.style.zIndex = '-1';
		}
	}

	private drawHorizontalScrollBar (): void {
		var scrollProps: any = this.getHorizontalScrollProperties();

		var startY = this.size[1] - this.sectionProperties.scrollBarThickness - this.sectionProperties.edgeOffset;

		const sizeX = scrollProps.scrollSize - this.sectionProperties.scrollBarThickness;
		const docWidth: number = this.map.getPixelBoundsCore().getSize().x;
		const startX = this.isRTL() ? docWidth - scrollProps.startX - sizeX : scrollProps.startX;

		if (this.sectionProperties.drawScrollBarRailway) {
			this.context.globalAlpha = this.sectionProperties.scrollBarRailwayAlpha;
			this.context.fillStyle = this.sectionProperties.scrollBarRailwayColor;
			this.context.fillRect(
				this.sectionProperties.xMin + this.sectionProperties.xOffset,
				startY,
				this.sectionProperties.xMax - this.sectionProperties.xMin - this.sectionProperties.xOffset,
				this.sectionProperties.scrollBarRailwayThickness
			);
		}

		if (this.sectionProperties.animatingHorizontalScrollBar)
			this.context.globalAlpha = this.sectionProperties.currentAlpha;
		else
			this.context.globalAlpha = this.sectionProperties.clickScrollHorizontal ? this.sectionProperties.alphaWhenBeingUsed: this.sectionProperties.alphaWhenVisible;

		this.context.fillStyle = '#7E8182';


		this.context.fillRect(startX, startY, sizeX, this.sectionProperties.scrollBarThickness);

		this.context.globalAlpha = 1.0;

		if (this.containerObject.testing) {
			var element: HTMLDivElement = <HTMLDivElement>document.getElementById('test-div-horizontal-scrollbar');
			if (!element) {
				element = document.createElement('div');
				element.id = 'test-div-horizontal-scrollbar';
				document.body.appendChild(element);
			}
			element.textContent = String(scrollProps.startX);
			element.style.display = 'none';
			element.style.position = 'fixed';
			element.style.zIndex = '-1';
		}

	}

	private calculateCurrentAlpha (elapsedTime: number): void {
		if (elapsedTime >= this.sectionProperties.fadeOutStartingTime) {
			this.sectionProperties.currentAlpha = Math.max((1 - ((elapsedTime - this.sectionProperties.fadeOutStartingTime) / this.sectionProperties.fadeOutDuration)) * this.sectionProperties.alphaWhenVisible, 0.1);
		}
		else {
			this.sectionProperties.currentAlpha = this.sectionProperties.alphaWhenVisible;
		}
	}

	public onDraw (frameCount: number, elapsedTime: number): void {
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

		if (this.sectionProperties.animatingScroll) {
			const lineHeight = this.containerObject.getScrollLineHeight();
			const accel = lineHeight * ScrollSection.scrollAnimationAcceleration;
			const maxDelta = lineHeight * ScrollSection.scrollAnimationMaxVelocity;

			// Calculate horizontal and vertical scroll deltas for this animation step
			const deltas = [0, 0];
			for (let i = 0; i < 2; ++i) {
				const sign = this.sectionProperties.scrollAnimationDelta[i] > 0 ? 1 : -1;

				this.sectionProperties.scrollAnimationVelocity[i] += accel * sign;
				if (Math.abs(this.sectionProperties.scrollAnimationVelocity[i]) > maxDelta)
					this.sectionProperties.scrollAnimationVelocity[i] = sign * maxDelta;

				deltas[i] = this.sectionProperties.scrollAnimationVelocity[i];
				if (Math.abs(deltas[i]) >= Math.abs(this.sectionProperties.scrollAnimationDelta[i])) {
					deltas[i] = this.sectionProperties.scrollAnimationDelta[i];
					this.sectionProperties.scrollAnimationDelta[i] = 0;
					this.sectionProperties.scrollAnimationVelocity[i] = 0;
				} else
					this.sectionProperties.scrollAnimationDelta[i] -= deltas[i];
			}

			// Perform scrolling, if necessary
			if (deltas[0] !== 0)
				this.scrollHorizontalWithOffset(deltas[0]);
			if (deltas[1] !== 0)
				this.scrollVerticalWithOffset(deltas[1]);

			if (this.sectionProperties.scrollAnimationDelta.reduce((a: number, x: number) => a + x, 0) === 0) {
				// Animated scroll is an endless animation, so if no other animations
				// are running, make sure to stop animating.
				this.containerObject.stopAnimating();
				this.sectionProperties.animatingScroll = false;
			}
		}
	}

	public onAnimationEnded (frameCount: number, elapsedTime: number): void {
		this.sectionProperties.animatingVerticalScrollBar = false;
		this.sectionProperties.animatingHorizontalScrollBar = false;
		this.sectionProperties.animatingScroll = false;
		this.sectionProperties.scrollAnimationDelta = [0, 0];
		this.sectionProperties.scrollAnimationVelocity = [0, 0];
	}

	private fadeOutHorizontalScrollBar (): void {
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

	private fadeOutVerticalScrollBar (): void {
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

	private increaseScrollBarThickness () : void {
		this.sectionProperties.scrollBarThickness = 8 * app.roundedDpiScale;
		this.containerObject.requestReDraw();
	}

	private decreaseScrollBarThickness () : void {
		this.sectionProperties.scrollBarThickness = 6 * app.roundedDpiScale;
		this.containerObject.requestReDraw();
	}

	private hideVerticalScrollBar (): void {
		if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.mouseIsOnVerticalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;

			this.decreaseScrollBarThickness();

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

	private showVerticalScrollBar (): void {
		if (this.isAnimating && this.sectionProperties.animatingVerticalScrollBar)
			this.containerObject.stopAnimating();

		if (!this.sectionProperties.mouseIsOnVerticalScrollBar) {
			this.sectionProperties.drawVerticalScrollBar = true;
			this.sectionProperties.mouseIsOnVerticalScrollBar = true;
			this.sectionProperties.mapPane.style.cursor = 'pointer';

			// Prevent Instant Mouse hover
			setTimeout(() => {
				if (this.sectionProperties.mouseIsOnVerticalScrollBar) {
					this.increaseScrollBarThickness();
				}
			}, 100);

			if (!this.containerObject.isDraggingSomething() && !(<any>window).mode.isDesktop())
				this.containerObject.requestReDraw();
		}
	}

	private hideHorizontalScrollBar (): void {
		if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
			this.sectionProperties.mouseIsOnHorizontalScrollBar = false;
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.defaultCursorStyle;

			this.decreaseScrollBarThickness();

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

	private showHorizontalScrollBar (): void {
		if (this.isAnimating && this.sectionProperties.animatingHorizontalScrollBar)
			this.containerObject.stopAnimating();

		if (!this.sectionProperties.mouseIsOnHorizontalScrollBar) {
			this.sectionProperties.drawHorizontalScrollBar = true;
			this.sectionProperties.mouseIsOnHorizontalScrollBar = true;
			this.sectionProperties.mapPane.style.cursor = 'pointer';

			// Prevent Instant Mouse hover
			setTimeout(() => {
				if (this.sectionProperties.mouseIsOnHorizontalScrollBar) {
					this.increaseScrollBarThickness();
				}
			}, 100);

			if (!this.containerObject.isDraggingSomething() && !(<any>window).mode.isDesktop())
				this.containerObject.requestReDraw();
		}
	}

	private isMouseOnScrollBar (point: Array<number>): void {
		const mirrorX = this.isRTL();
		if (this.documentTopLeft[1] >= 0) {
			if ((!mirrorX && point[0] >= this.size[0] - this.sectionProperties.usableThickness)
				|| (mirrorX && point[0] <= this.sectionProperties.usableThickness)) {
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
				if ((!mirrorX && point[0] <= this.size[0] - this.sectionProperties.horizontalScrollRightOffset && point[0] >= this.sectionProperties.xOffset)
					|| (mirrorX && point[0] >= this.sectionProperties.horizontalScrollRightOffset && point[0] >= this.sectionProperties.xOffset)) {
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

	public onMouseLeave (): void {
		this.hideVerticalScrollBar();
		this.hideHorizontalScrollBar();
	}

	public scrollVerticalWithOffset (offset: number): boolean {
		this.calculateYMinMax();

		if (offset > 0) {
			if (this.documentTopLeft[1] + offset > this.sectionProperties.yMax)
				offset = this.sectionProperties.yMax - this.documentTopLeft[1];
			if (offset <= 0)
				return false;
		}
		else {
			if (this.documentTopLeft[1] + offset < this.sectionProperties.yMin)
				offset = this.sectionProperties.yMin - this.documentTopLeft[1];
			if (offset >= 0)
				return false;
		}

		app.sectionContainer.pauseDrawing();
		this.map.scroll(0, offset / app.dpiScale, {});
		this.onUpdateScrollOffset();
		app.sectionContainer.resumeDrawing();

		if (app.file.fileBasedView) this.map._docLayer._checkSelectedPart();

		return true;
	}

	public scrollHorizontalWithOffset (offset: number): void {
		this.calculateXMinMax();

		if (this.isRTL()) {
			offset = -offset;
		}

		var go = true;
		if (offset > 0) {
			if (this.documentTopLeft[0] + offset > this.sectionProperties.xMax)
				offset = this.sectionProperties.xMax - this.documentTopLeft[0];
			if (offset <= 0)
				go = false;
		}
		else {
			if (this.documentTopLeft[0] + offset < this.sectionProperties.xMin)
				offset = this.sectionProperties.xMin - this.documentTopLeft[0];
			if (offset >= 0)
				go = false;
		}

		if (go) {
			app.sectionContainer.pauseDrawing();
			this.map.scroll(offset / app.dpiScale, 0, {});
			this.onUpdateScrollOffset();
			app.sectionContainer.resumeDrawing();
		}
	}

	private isMouseInsideDocumentAnchor (point: Array<number>): boolean {
		var docSection = this.containerObject.getDocumentAnchorSection();
		return this.containerObject.doesSectionIncludePoint(docSection, point);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private isMousePointerSyncedWithVerticalScrollBar (scrollProps: any, position: Array<number>): boolean {
		// Keep this desktop-only for now.
		if (!(<any>window).mode.isDesktop())
			return true;

		var spacer = 0;
		if (!this.sectionProperties.pointerSyncWithVerticalScrollBar) {
			spacer = this.sectionProperties.pointerReCaptureSpacer;
		}

		var pointerIsSyncWithScrollBar = false;
		if (this.sectionProperties.pointerSyncWithVerticalScrollBar) {
			pointerIsSyncWithScrollBar = scrollProps.startY < position[1] && scrollProps.startY + scrollProps.scrollSize - this.sectionProperties.scrollBarThickness > position[1];
			pointerIsSyncWithScrollBar = pointerIsSyncWithScrollBar || (this.isMouseInsideDocumentAnchor(position) && spacer === 0);
		}
		else {
			// See if the scroll bar is on top or bottom.
			var docAncSectionY = this.containerObject.getDocumentAnchorSection().myTopLeft[1];
			if (scrollProps.startY < 30 * window.app.roundedDpiScale + docAncSectionY) {
				pointerIsSyncWithScrollBar = scrollProps.startY + spacer < position[1];
			}
			else {
				pointerIsSyncWithScrollBar = scrollProps.startY + spacer > position[1];
			}
		}

		this.sectionProperties.pointerSyncWithVerticalScrollBar = pointerIsSyncWithScrollBar;
		return pointerIsSyncWithScrollBar;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private isMousePointerSyncedWithHorizontalScrollBar (scrollProps: any, position: Array<number>): boolean {
		// Keep this desktop-only for now.
		if (!(<any>window).mode.isDesktop())
			return true;

		var spacer = 0;
		if (!this.sectionProperties.pointerSyncWithHorizontalScrollBar) {
			spacer = this.sectionProperties.pointerReCaptureSpacer;
		}

		const sizeX = scrollProps.scrollSize - this.sectionProperties.scrollBarThickness;
		const docWidth: number = this.map.getPixelBoundsCore().getSize().x;
		const startX = this.isRTL() ? docWidth - scrollProps.startX - sizeX : scrollProps.startX;
		const endX = startX + sizeX;

		var pointerIsSyncWithScrollBar = false;
		if (this.sectionProperties.pointerSyncWithHorizontalScrollBar) {
			pointerIsSyncWithScrollBar = position[0] > startX && position[0] < endX;
			pointerIsSyncWithScrollBar = pointerIsSyncWithScrollBar || (this.isMouseInsideDocumentAnchor(position) && spacer === 0);
		}
		else {
			// See if the scroll bar is on left or right.
			var docAncSectionX = this.containerObject.getDocumentAnchorSection().myTopLeft[0];
			if (startX < 30 * window.app.roundedDpiScale + docAncSectionX) {
				pointerIsSyncWithScrollBar = startX + spacer < position[0];
			}
			else {
				pointerIsSyncWithScrollBar = startX + spacer > position[0];
			}
		}

		this.sectionProperties.pointerSyncWithHorizontalScrollBar = pointerIsSyncWithScrollBar;
		return pointerIsSyncWithScrollBar;
	}

	public onMouseMove (position: Array<number>, dragDistance: Array<number>, e: MouseEvent): void {
		this.clearQuickScrollTimeout();

		if (this.sectionProperties.clickScrollVertical && this.containerObject.isDraggingSomething()) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			this.showVerticalScrollBar();

			var scrollProps: any = this.getVerticalScrollProperties();

			var diffY: number = dragDistance[1] - this.sectionProperties.previousDragDistance[1];
			var actualDistance = scrollProps.ratio * diffY;

			if (this.isMousePointerSyncedWithVerticalScrollBar(scrollProps, position))
				this.scrollVerticalWithOffset(actualDistance);

			this.sectionProperties.previousDragDistance[1] = dragDistance[1];

			e.stopPropagation(); // Don't propagate to map.
			this.stopPropagating(); // Don't propagate to bound sections.
		}
		else if (this.sectionProperties.clickScrollHorizontal && this.containerObject.isDraggingSomething()) {
			if (!this.sectionProperties.previousDragDistance) {
				this.sectionProperties.previousDragDistance = [0, 0];
			}

			this.showHorizontalScrollBar();

			var scrollProps: any = this.getHorizontalScrollProperties();
			var diffX: number = dragDistance[0] - this.sectionProperties.previousDragDistance[0];
			var actualDistance = scrollProps.ratio * diffX;

			if (this.isMousePointerSyncedWithHorizontalScrollBar(scrollProps, position))
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
	private quickScrollVertical (point: Array<number>, originalSign?: number): void {
		// Desktop only for now.
		if (!(<any>window).mode.isDesktop())
			return;

		L.DomUtil.addClass(document.documentElement, 'prevent-select');
		var props = this.getVerticalScrollProperties();
		var midY = (props.startY + props.startY + props.scrollSize - this.sectionProperties.scrollBarThickness) * 0.5;

		if (this.stepByStepScrolling) {
			var sign = (point[1] - (props.startY + props.scrollSize)) > 0
				? 1 : ((point[1] - props.startY) < 0 ? -1 : 0);
			var offset = props.verticalScrollStep * sign;

			if (this.sectionProperties.quickScrollVerticalTimer)
				clearTimeout(this.sectionProperties.quickScrollVerticalTimer);
			if (this.sectionProperties.clickScrollVertical)
				this.sectionProperties.quickScrollVerticalTimer = setTimeout(() => {
					if (!originalSign || originalSign === sign) {
						this.quickScrollVertical(point, sign);
					}
				}, this.sectionProperties.stepDuration);
		} else {
			offset = Math.round((point[1] - midY) * props.ratio);
		}

		this.scrollVerticalWithOffset(offset);
	}

	/*
		When user presses the button while the mouse pointer is on the railway of the scroll bar but not on the scroll bar directly,
		we quickly scroll the document to that position.
	*/
	private quickScrollHorizontal (point: Array<number>, originalSign?: number): void {
		// Desktop only for now.
		if (!(<any>window).mode.isDesktop())
			return;

		L.DomUtil.addClass(document.documentElement, 'prevent-select');
		var props = this.getHorizontalScrollProperties();
		const sizeX = props.scrollSize - this.sectionProperties.scrollBarThickness;
		const docWidth: number = this.map.getPixelBoundsCore().getSize().x;
		const startX = this.isRTL() ? docWidth - props.startX - sizeX : props.startX;
		var midX = startX + sizeX * 0.5;

		if (this.stepByStepScrolling) {
			var sign = (point[0] - (startX + sizeX)) > 0
				? 1 : ((point[0] - startX) < 0 ? -1 : 0);
			var offset = props.horizontalScrollStep * sign;

			if (this.sectionProperties.quickScrollHorizontalTimer)
				clearTimeout(this.sectionProperties.quickScrollHorizontalTimer);
			if (this.sectionProperties.clickScrollHorizontal)
				this.sectionProperties.quickScrollHorizontalTimer = setTimeout(() => {
					if (!originalSign || originalSign === sign) {
						this.quickScrollHorizontal(point, sign);
					}
				}, this.sectionProperties.stepDuration);
		} else {
			offset = Math.round((point[0] - midX) * props.ratio);
		}

		this.scrollHorizontalWithOffset(offset);
	}

	private getLocalYOnVerticalScrollBar (point: Array<number>): number {
		var props = this.getVerticalScrollProperties();
		return point[1] - props.startY;
	}

	private getLocalXOnHorizontalScrollBar (point: Array<number>): number {
		var props = this.getHorizontalScrollProperties();
		return point[0] - props.startX;
	}

	private clearQuickScrollTimeout() {
		if (this.sectionProperties.quickScrollVerticalTimer) {
			clearTimeout(this.sectionProperties.quickScrollVerticalTimer);
			this.sectionProperties.quickScrollVerticalTimer = null;
		}
		if (this.sectionProperties.quickScrollHorizontalTimer) {
			clearTimeout(this.sectionProperties.quickScrollHorizontalTimer);
			this.sectionProperties.quickScrollHorizontalTimer = null;
		}
	}

	public onMouseDown (point: Array<number>, e: MouseEvent): void {
		this.clearQuickScrollTimeout();
		this.onMouseMove(point, null, e);
		this.isMouseOnScrollBar(point);

		const mirrorX = this.isRTL();

		if (this.documentTopLeft[1] >= 0) {
			if ((!mirrorX && point[0] >= this.size[0] - this.sectionProperties.usableThickness)
				|| (mirrorX && point[0] <= this.sectionProperties.usableThickness)) {
				if (point[1] > this.sectionProperties.yOffset) {
					this.sectionProperties.clickScrollVertical = true;
					this.map.scrollingIsHandled = true;
					this.quickScrollVertical(point);
					this.sectionProperties.pointerReCaptureSpacer = this.getLocalYOnVerticalScrollBar(point);
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
				if ((!mirrorX && point[0] >= this.sectionProperties.xOffset && point[0] <= this.size[0] - this.sectionProperties.horizontalScrollRightOffset)
					|| (mirrorX && point[0] >= this.sectionProperties.xOffset && point[0] >= this.sectionProperties.horizontalScrollRightOffset)) {
					this.sectionProperties.clickScrollHorizontal = true;
					this.map.scrollingIsHandled = true;
					this.quickScrollHorizontal(point);
					this.sectionProperties.pointerReCaptureSpacer = this.getLocalXOnHorizontalScrollBar(point);
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

	public onMouseUp (point: Array<number>, e: MouseEvent): void {
		L.DomUtil.removeClass(document.documentElement, 'prevent-select');
		this.map.scrollingIsHandled = false;
		this.clearQuickScrollTimeout();

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
		else if (L.Map.THIS.mouse && L.Map.THIS.mouse._mouseDown
			&& this.containerObject.targetBoundSectionListContains(L.CSections.Tiles.name)
			&& (<any>window).mode.isDesktop()
			&& this.containerObject.isDraggingSomething()
			&& L.Map.THIS._docLayer._docType === 'spreadsheet') {

			var temp = this.containerObject.getPositionOnMouseUp();
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

	private performVerticalScroll (delta: number): void {
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

	private performHorizontalScroll (delta: number): void {
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

	public onClick(point: Array<number>, e: MouseEvent): void {
		if (this.isAnimating && this.sectionProperties.animatingWheelScrollVertical)
			this.containerObject.stopAnimating();
	}

	private animateScroll(delta: [number, number]): void {
		const maxDelta = ScrollSection.scrollAnimationMaxDelta * this.containerObject.getScrollLineHeight();
		for (let i = 0; i < 2; ++i) {
			if ((delta[i] > 0) !== (this.sectionProperties.scrollAnimationDelta[i] > 0)) {
				// Stop animation on scroll change direction
				this.sectionProperties.scrollAnimationVelocity[i] = 0;
				this.sectionProperties.scrollAnimationDelta[i] = 0;
			}

			this.sectionProperties.scrollAnimationDelta[i] += delta[i];

			// Don't let the delta get too big, or the user will be able to
			// accumulate a long scrolling animation and it'd feel weird.
			if (Math.abs(this.sectionProperties.scrollAnimationDelta[i]) > maxDelta) {
				this.sectionProperties.scrollAnimationDelta[i] = delta[i] > 0 ?
					maxDelta : -maxDelta;
			}
		}

		if (!this.sectionProperties.animatingScroll) {
			// We're about to start a duration-less animation, so we need to
			// make sure the animation is reset first.
			this.resetAnimation();
			this.startAnimating({});
			this.sectionProperties.animatingScroll = true;
		}
	}

	public onMouseWheel (point: Array<number>, delta: Array<number>, e: MouseEvent): void {
		if (e.ctrlKey) return;

		this.map.fire('closepopups'); // close all popups when scrolling

		let hscroll = 0, vscroll = 0;
		if (Math.abs(delta[1]) > Math.abs(delta[0])) {
			if (e.shiftKey)
				hscroll = delta[1];
			else
				vscroll = delta[1];
		} else
			hscroll = delta[0];

		// We don't want to animate in the case of touchpad events. If the
		// incoming delta has a fractional component, we stop animating. This
		// is only true in the case of trackpad events.
		// FIXME: It would be good to properly confirm this across different
		// browsers, OS's and window managers/compositors.
		const shouldAnimate =
			this.sectionProperties.animateWheelScroll
			&& !this.sectionProperties.scrollAnimationDisableTimeout
			&& Math.max(Math.abs(hscroll), Math.abs(vscroll)) % 1 === 0;

		if (shouldAnimate)
			this.animateScroll([hscroll, vscroll]);
		else {
			this.containerObject.stopAnimating();
			if (this.sectionProperties.scrollAnimationDisableTimeout)
				clearTimeout(this.sectionProperties.scrollAnimationDisableTimeout);
			this.sectionProperties.scrollAnimationDisableTimeout =
				setTimeout(() => { this.sectionProperties.scrollAnimationDisableTimeout = null; },
					ScrollSection.scrollDirectTimeoutMs);

			if (hscroll !== 0) this.performHorizontalScroll(hscroll);
			if (vscroll !== 0) this.performVerticalScroll(vscroll);
		}
	}
}

}

L.getNewScrollSection = function (isRTL?: () => boolean) {
	return new cool.ScrollSection(isRTL);
};
