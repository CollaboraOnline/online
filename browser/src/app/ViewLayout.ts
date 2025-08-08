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

class ScrollProperties {
	yOffset: number = 0;
	verticalScrollLength: number = 0;
	verticalScrollSize: number = 0;
	minimumVerticalScrollSize: number = 80 * app.roundedDpiScale;
	verticalScrollRatio: number = 0;
	startY: number = 0; // Start position of the vertical scroll bar on canvas.
	verticalScrollStep: number = 0; // Quick scroll step.

	xOffset: number = 0;
	horizontalScrollLength: number = 0;
	horizontalScrollSize: number = 0;
	minimumHorizontalScrollSize: number = 80 * app.roundedDpiScale;
	horizontalScrollRatio: number = 0;
	startX: number = 0;
	horizontalScrollStep: number = 0;

	usableThickness: number = 20 * app.roundedDpiScale;
	horizontalScrollRightOffset: number = 20 /*usableThickness*/; // To prevent overlapping of the scroll bars.
	scrollBarThickness: number = 6 * app.roundedDpiScale;
	edgeOffset: number = 0;

	moveBy: number[] | null = null; // Pending move event (pX, pY).
}

class ViewLayoutBase {
	public readonly type: string = 'ViewLayoutBase';

	private lastViewedRectangle: cool.SimpleRectangle; // Previously viewed rectangle.

	protected clientVisibleAreaCommand: string = ''; // Last visible area command. Checked to avoid sending the same command multiple times.
	protected _viewedRectangle: cool.SimpleRectangle; // Currently viewed rectangle.
	protected _viewSize: cool.SimplePoint; // Scrollable area.
	public scrollProperties: ScrollProperties = new ScrollProperties();

	constructor() {
		this._viewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
		this.lastViewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
		this._viewSize = new cool.SimplePoint(0, 0);
	}

	public resetClientVisibleArea(): void {
		this.lastViewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
	}

	public sendClientVisibleArea(forceUpdate: boolean = false): void {
		if (!app.map._docLoaded) return;

		var splitPos = app.map._docLayer._splitPanesContext
			? app.map._docLayer._splitPanesContext.getSplitPos()
			: new L.Point(0, 0);

		var visibleArea = app.map.getPixelBounds();
		visibleArea = new L.Bounds(
			app.map._docLayer._pixelsToTwips(visibleArea.min),
			app.map._docLayer._pixelsToTwips(visibleArea.max),
		);
		splitPos = app.map._docLayer._corePixelsToTwips(splitPos);
		var size = visibleArea.getSize();
		var visibleTopLeft = visibleArea.min;
		var newClientVisibleAreaCommand =
			'clientvisiblearea x=' +
			Math.round(visibleTopLeft.x) +
			' y=' +
			Math.round(visibleTopLeft.y) +
			' width=' +
			Math.round(size.x) +
			' height=' +
			Math.round(size.y) +
			' splitx=' +
			Math.round(splitPos.x) +
			' splity=' +
			Math.round(splitPos.y);

		if (this.clientVisibleAreaCommand !== newClientVisibleAreaCommand) {
			// Only update on some change
			if (app.map._docLayer._ySplitter) {
				app.map._docLayer._ySplitter.onPositionChange();
			}
			if (app.map._docLayer._xSplitter) {
				app.map._docLayer._xSplitter.onPositionChange();
			}
			// Visible area is dirty, update it on the server
			app.socket.sendMessage(newClientVisibleAreaCommand);
			if (app.map.contextToolbar) app.map.contextToolbar.hideContextToolbar(); // hide context toolbar when scroll/window resize etc...
			if (!app.map._fatal && app.idleHandler._active && app.socket.connected())
				this.clientVisibleAreaCommand = newClientVisibleAreaCommand;
		}
	}

	public getLastPanDirection(): Array<number> {
		var dx: number = this._viewedRectangle.pX1 - this.lastViewedRectangle.pX1;
		var dy: number = this._viewedRectangle.pY1 - this.lastViewedRectangle.pY1;
		return [Math.sign(dx), Math.sign(dy)];
	}

	public get viewedRectangle() {
		return this._viewedRectangle;
	}

	public set viewedRectangle(rectangle: cool.SimpleRectangle) {
		this._viewedRectangle = rectangle;

		// maintain a view of where we're panning to.
		if (!this._viewedRectangle.equals(this.lastViewedRectangle.toArray()))
			this.lastViewedRectangle = this._viewedRectangle.clone();

		app.sectionContainer.onNewDocumentTopLeft();
		app.sectionContainer.requestReDraw();
	}

	public get viewSize() {
		return this._viewSize;
	}

	public set viewSize(size: cool.SimplePoint) {
		this._viewSize = size;
	}

	private getDocumentAnchorSection(): CanvasSectionObject {
		return app.sectionContainer.getDocumentAnchorSection();
	}

	private calculateHorizontalScrollLength(
		documentAnchor: CanvasSectionObject,
	): void {
		const result: number = documentAnchor.size[0];
		this.scrollProperties.xOffset = documentAnchor.myTopLeft[0];

		if (app.map._docLayer._docType !== 'spreadsheet') {
			this.scrollProperties.horizontalScrollLength =
				result - this.scrollProperties.horizontalScrollRightOffset;
		} else {
			var splitPanesContext: any = app.map.getSplitPanesContext();
			var splitPos = { x: 0, y: 0 };
			if (splitPanesContext) {
				splitPos = splitPanesContext.getSplitPos().clone();
				splitPos.x = Math.round(splitPos.x * app.dpiScale);
			}

			this.scrollProperties.xOffset += splitPos.x;
			this.scrollProperties.horizontalScrollLength =
				result - splitPos.x - this.scrollProperties.horizontalScrollRightOffset;
		}
	}

	private calculateVerticalScrollLength(
		documentAnchor: CanvasSectionObject,
	): void {
		const result: number = documentAnchor.size[1];
		this.scrollProperties.yOffset = documentAnchor.myTopLeft[1];

		if (app.map._docLayer._docType !== 'spreadsheet') {
			this.scrollProperties.verticalScrollLength = result;
		} else {
			const splitPanesContext: any = app.map.getSplitPanesContext();
			let splitPos = { x: 0, y: 0 };
			if (splitPanesContext) {
				splitPos = splitPanesContext.getSplitPos().clone();
				splitPos.y = Math.round(splitPos.y * app.dpiScale);
			}

			this.scrollProperties.yOffset += splitPos.y;
			this.scrollProperties.verticalScrollLength = result - splitPos.y;
		}
	}

	public refreshScrollProperties(): any {
		const documentAnchor = this.getDocumentAnchorSection();

		// The length of the railway that the scroll bar moves on up & down or left & right.
		this.calculateVerticalScrollLength(documentAnchor);
		this.calculateHorizontalScrollLength(documentAnchor);

		// Sizes of the scroll bars.
		this.scrollProperties.verticalScrollSize = Math.round(
			Math.pow(this.scrollProperties.verticalScrollLength, 2) /
				app.activeDocument.activeView.viewSize.pY,
		);
		this.scrollProperties.horizontalScrollSize = Math.round(
			Math.pow(this.scrollProperties.horizontalScrollLength, 2) /
				app.activeDocument.activeView.viewSize.pX,
		);

		if (
			this.scrollProperties.horizontalScrollSize <
			this.scrollProperties.minimumHorizontalScrollSize
		)
			this.scrollProperties.horizontalScrollSize =
				this.scrollProperties.minimumHorizontalScrollSize;

		if (
			this.scrollProperties.verticalScrollSize <
			this.scrollProperties.minimumVerticalScrollSize
		)
			this.scrollProperties.verticalScrollSize =
				this.scrollProperties.minimumVerticalScrollSize;

		// 1px scrolling = xpx document height / width.
		this.scrollProperties.horizontalScrollRatio =
			(app.activeDocument.activeView.viewSize.pX - documentAnchor.size[0]) /
			(this.scrollProperties.horizontalScrollLength -
				this.scrollProperties.horizontalScrollSize);
		this.scrollProperties.verticalScrollRatio =
			(app.activeDocument.activeView.viewSize.pY - documentAnchor.size[1]) /
			(this.scrollProperties.verticalScrollLength -
				this.scrollProperties.verticalScrollSize);

		// The start position of scroll bars on canvas.
		this.scrollProperties.startX =
			app.activeDocument.activeView.viewedRectangle.pX1 /
				this.scrollProperties.horizontalScrollRatio +
			this.scrollProperties.xOffset;

		this.scrollProperties.startY =
			app.activeDocument.activeView.viewedRectangle.pY1 /
				this.scrollProperties.verticalScrollRatio +
			this.scrollProperties.yOffset;

		// Properties for quick scrolling.
		this.scrollProperties.verticalScrollStep = documentAnchor.size[1] / 2;
		this.scrollProperties.horizontalScrollStep = documentAnchor.size[0] / 2;
	}

	private scrollHorizontal(pX: number): void {
		const scrollProps: ScrollProperties = this.scrollProperties;

		let control = scrollProps.moveBy ? scrollProps.moveBy[0] : 0; // Add pending offset.
		control /= scrollProps.horizontalScrollRatio; // Convert to scroll bar position diff.

		const psX = pX / scrollProps.horizontalScrollRatio;

		if (document.documentElement.dir === 'rtl') pX = -pX;

		const endPosition =
			scrollProps.startX - scrollProps.xOffset + control + psX;

		if (pX > 0) {
			if (
				endPosition + scrollProps.horizontalScrollSize >
				scrollProps.horizontalScrollLength
			)
				pX =
					(scrollProps.horizontalScrollLength -
						scrollProps.horizontalScrollSize -
						scrollProps.startX +
						scrollProps.xOffset -
						control) *
					scrollProps.horizontalScrollRatio;

			if (pX < 0) pX = 0;
		} else {
			if (endPosition < 0)
				pX =
					(scrollProps.startX - scrollProps.xOffset + control) *
					-1 *
					scrollProps.horizontalScrollRatio;

			if (pX > 0) pX = 0;
		}

		if (scrollProps.moveBy !== null)
			scrollProps.moveBy[0] += pX; // Add offset to the pending move event.
		else scrollProps.moveBy = [pX, 0]; // Create a new pending move event.
	}

	// For scrolling with screen offset.
	// This function shouldn't care about the document content, size etc.
	// All this cares is the current scroll position and the scroll length.
	// For making a portion of the document visible, use other methods.
	private scrollVertical(pY: number): void {
		const scrollProps: ScrollProperties = this.scrollProperties;

		let control = scrollProps.moveBy ? scrollProps.moveBy[1] : 0; // Add pending offset.
		control /= scrollProps.verticalScrollRatio; // Convert to scroll bar position diff.

		const psY = pY / scrollProps.verticalScrollRatio;

		const endPosition =
			scrollProps.startY - scrollProps.yOffset + control + psY;

		if (pY > 0) {
			if (
				endPosition + scrollProps.verticalScrollSize >
				scrollProps.verticalScrollLength
			)
				pY =
					(scrollProps.verticalScrollLength -
						scrollProps.verticalScrollSize -
						scrollProps.startY +
						scrollProps.yOffset -
						control) *
					scrollProps.verticalScrollRatio;

			if (pY < 0) pY = 0;
		} else {
			if (endPosition < 0)
				pY =
					(scrollProps.startY - scrollProps.yOffset + control) *
					-1 *
					scrollProps.verticalScrollRatio;

			if (pY > 0) pY = 0;
		}

		if (scrollProps.moveBy !== null)
			scrollProps.moveBy[1] += pY; // Add offset to the pending move event.
		else scrollProps.moveBy = [0, pY]; // Create a new pending move event.
	}

	public canScrollHorizontal(documentAnchor: CanvasSectionObject): boolean {
		return this.viewSize.pX > documentAnchor.size[0];
	}

	public canScrollVertical(documentAnchor: CanvasSectionObject): boolean {
		return this.viewSize.pY > documentAnchor.size[1];
	}

	public scroll(pX: number, pY: number): void {
		this.refreshScrollProperties();
		const documentAnchor = this.getDocumentAnchorSection();

		if (pX !== 0 && this.canScrollHorizontal(documentAnchor))
			this.scrollHorizontal(pX);

		if (pY !== 0 && this.canScrollVertical(documentAnchor))
			this.scrollVertical(pY);

		app.sectionContainer.requestReDraw();
	}

	public scrollTo(pX: number, pY: number): void {
		this.refreshScrollProperties();

		this.scrollProperties.moveBy = null;

		pX -= this.viewedRectangle.pX1;
		pY -= this.viewedRectangle.pY1;

		this.scroll(pX, pY);
	}
}
