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

app.definitions.TableFillMarkerSection = class TableFillMarkerSection extends (
	CanvasSectionObject
) {
	processingOrder: number = app.CSections.TableFillMarker.processingOrder;
	drawingOrder: number = app.CSections.TableFillMarker.drawingOrder;
	zIndex: number = app.CSections.TableFillMarker.zIndex;

	map: any;
	cursorBorderWidth: number = 2;

	_showSection: boolean = true; // Store the internal show/hide section through forced readonly hides...

	constructor() {
		super(app.CSections.TableFillMarker.name);
		this.documentObject = true;
		this.map = window.L.Map.THIS;
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.cellCursorPoint = null;

		this.sectionProperties.dragStartPosition = null;

		var cursorStyle = getComputedStyle(
			this.sectionProperties.docLayer._cursorDataDiv,
		);
		var cursorColor = cursorStyle.getPropertyValue('border-top-color');
		this.backgroundColor = cursorColor ? cursorColor : this.backgroundColor;
		this.cursorBorderWidth = Math.round(
			window.devicePixelRatio *
				parseInt(cursorStyle.getPropertyValue('border-top-width')),
		);
	}

	public onInitialize() {
		if ((<any>window).mode.isDesktop()) {
			this.size = [Math.round(6 * app.dpiScale), Math.round(6 * app.dpiScale)];
		} else {
			this.size = [
				Math.round(16 * app.dpiScale),
				Math.round(16 * app.dpiScale),
			];
		}

		app.events.on(
			'updatepermission',
			this.showHideOnPermissionChange.bind(this),
		);
	}

	private setMarkerPosition() {
		var center: number = 0;
		if (!(<any>window).mode.isDesktop()) {
			center = app.calc.cellCursorRectangle.pWidth * 0.5;
		}

		var position: Array<number> = [0, 0];
		this.setShowSection(true);

		if (this.sectionProperties.cellCursorPoint !== null)
			position = [
				this.sectionProperties.cellCursorPoint[0] - center,
				this.sectionProperties.cellCursorPoint[1],
			];
		else this.setShowSection(false);

		this.setPosition(position[0], position[1]);
	}

	// Give bottom right position of the bottom right cell of table style area, in core pixels.
	// Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCorePixels(point: Array<number>) {
		this.sectionProperties.cellCursorPoint = point;
		this.setMarkerPosition();
	}

	// This is for enhancing contrast of the marker with the background
	// similar to what we have for cell cursors.
	private drawWhiteOuterBorders() {
		this.context.strokeStyle = 'white';
		this.context.lineCap = 'square';
		this.context.lineWidth = 1;

		var desktop: boolean = (<any>window).mode.isDesktop();
		var translation = desktop
			? [this.size[0], this.size[1]]
			: [Math.floor(this.size[0] * 0.5), Math.floor(this.size[1] * 0.5)];
		const adjustForRTL = app.map._docLayer.isCalcRTL();
		const transformX = (xcoord: number) => {
			return adjustForRTL ? this.size[0] - xcoord : xcoord;
		};

		// top white line
		this.context.beginPath();
		this.context.moveTo(transformX(-0.5), -0.5);
		this.context.lineTo(
			transformX(this.size[0] + 0.5 - (desktop ? this.cursorBorderWidth : 0)),
			-0.5,
		);
		this.context.stroke();

		if (!desktop) {
			this.context.beginPath();
			this.context.moveTo(transformX(this.size[0] - 0.5), -0.5);
			this.context.lineTo(
				transformX(this.size[0] - 0.5),
				translation[1] - 0.5 - this.cursorBorderWidth,
			);
			this.context.stroke();
		}

		// bottom white line
		this.context.beginPath();
		this.context.moveTo(transformX(-0.5), -0.5);
		this.context.lineTo(
			transformX(-0.5),
			translation[1] + 0.5 - this.cursorBorderWidth,
		);
		this.context.stroke();
	}

	showHideOnPermissionChange() {
		this.setShowSection(null);
	}

	setShowSection(show: boolean | null) {
		if (show !== null) this._showSection = show;

		if (app.map._permission === 'readonly') {
			super.setShowSection(false);
		} else {
			super.setShowSection(this._showSection);
		}
	}

	public onDraw() {
		this.drawWhiteOuterBorders();
	}

	private getDocumentPositionFromLocal(
		point: cool.SimplePoint,
	): cool.SimplePoint {
		const p2 = point.clone();
		p2.pX += this.position[0];
		p2.pY += this.position[1];
		return p2;
	}

	private getCenterRegardingDocument(): cool.SimplePoint {
		const p2 = new cool.SimplePoint(0, 0);
		p2.pX += this.position[0] + this.size[0] * 0.5;
		p2.pY += this.position[1] + this.size[1] * 0.5;
		return p2;
	}

	private autoScroll(point: cool.SimplePoint) {
		const viewedRectangle = app.activeDocument.activeView.viewedRectangle;
		const viewCenter = viewedRectangle.pCenter;
		const refX =
			point.pX > viewCenter[0] ? viewedRectangle.pX2 : viewedRectangle.pX1;
		const refY =
			point.pY > viewCenter[1] ? viewedRectangle.pY2 : viewedRectangle.pY1;

		if (!app.isXVisibleInTheDisplayedArea(point.x))
			app.activeDocument.activeView.scroll(point.pX - refX, 0);
		else if (!app.isYVisibleInTheDisplayedArea(point.y))
			app.activeDocument.activeView.scroll(0, point.pY - refY);
	}

	public onMouseMove(
		point: cool.SimplePoint,
		dragDistance: Array<number>,
		e: MouseEvent,
	) {
		if (
			dragDistance === null ||
			!this.sectionProperties.docLayer._tableAutoFillAreaPixels
		)
			return; // No dragging or no event handling or auto fill marker is not visible.

		const p2 = this.getDocumentPositionFromLocal(point);
		app.map._docLayer._postMouseEvent('move', p2.x, p2.y, 1, 1, 0);

		if (
			!this.containerObject.isMouseInside() &&
			this.containerObject.isDraggingSomething()
		)
			this.autoScroll(this.getDocumentPositionFromLocal(point));
	}

	public onMouseUp(point: cool.SimplePoint, e: MouseEvent) {
		const p2 = this.getDocumentPositionFromLocal(point);
		app.map._docLayer._postMouseEvent('buttonup', p2.x, p2.y, 1, 1, 0);
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent) {
		// revert coordinates to global and fire event again with position in the center
		// inverse of convertPositionToCanvasLocale
		const p2 = this.getCenterRegardingDocument();

		app.map._docLayer._postMouseEvent('buttondown', p2.x, p2.y, 1, 1, 0);
	}

	public onMouseEnter() {
		this.context.canvas.style.cursor = 'se-resize';
	}

	public onNewDocumentTopLeft() {
		this.setMarkerPosition();
	}
};
