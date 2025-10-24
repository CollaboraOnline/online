// @ts-strict-ignore
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


app.definitions.AutoFillMarkerSection =
class AutoFillMarkerSection extends CanvasSectionObject {
	processingOrder: number = app.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = app.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = app.CSections.AutoFillMarker.zIndex;

	map: any;
	cursorBorderWidth: number = 2;
	selectionBorderWidth: number = 1;

	_showSection: boolean = true; // Store the internal show/hide section through forced readonly hides...

	constructor () {
		super(app.CSections.AutoFillMarker.name);
		this.documentObject = true;
		this.map = window.L.Map.THIS;
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.selectedAreaPoint = null;
		this.sectionProperties.cellCursorPoint = null;

		this.sectionProperties.dragStartPosition = null;

		var cursorStyle = getComputedStyle(this.sectionProperties.docLayer._cursorDataDiv);
		var selectionStyle = getComputedStyle(this.sectionProperties.docLayer._selectionsDataDiv);
		var cursorColor = cursorStyle.getPropertyValue('border-top-color');
		this.backgroundColor = cursorColor ? cursorColor : this.backgroundColor;
		this.cursorBorderWidth = Math.round(window.devicePixelRatio * parseInt(cursorStyle.getPropertyValue('border-top-width')));
		this.selectionBorderWidth = Math.round(window.devicePixelRatio * parseInt(selectionStyle.getPropertyValue('border-top-width')));
	}

	public onInitialize () {
		if ((<any>window).mode.isDesktop()) {
			this.size = [Math.round(6 * app.dpiScale), Math.round(6 * app.dpiScale)];
		}
		else {
			this.size = [Math.round(16 * app.dpiScale), Math.round(16 * app.dpiScale)];
		}

		app.events.on('updatepermission', this.showHideOnPermissionChange.bind(this));
	}

	private setMarkerPosition () {
		var center: number = 0;
		if (!(<any>window).mode.isDesktop()) {
			center = app.calc.cellCursorRectangle.pWidth * 0.5;
		}

		var position: Array<number> = [0, 0];
		this.setShowSection(true);

		if (this.sectionProperties.selectedAreaPoint !== null)
			position = [this.sectionProperties.selectedAreaPoint[0] - center, this.sectionProperties.selectedAreaPoint[1]];
		else if (this.sectionProperties.cellCursorPoint !== null)
			position = [this.sectionProperties.cellCursorPoint[0] - center, this.sectionProperties.cellCursorPoint[1]];
		else
			this.setShowSection(false);

		this.setPosition(position[0], position[1]);
	}

	private calculatePositionFromPoint (point: Array<number>) {
		var calcPoint: Array<number>;
		if (point === null) {
			calcPoint = null;
		}
		else {
			var translation = [Math.floor(this.size[0] * 0.5), Math.floor(this.size[1] * 0.5)];
			calcPoint = [point[0] - translation[0], point[1] - translation[1]];
		}
		return calcPoint;
	}

	// Give bottom right position of selected area, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellSelection (point: Array<number>) {
	       this.sectionProperties.selectedAreaPoint = this.calculatePositionFromPoint(point);
	       this.setMarkerPosition();
	}

	// Give bottom right position of cell cursor, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellCursor (point: Array<number>) {
	       this.sectionProperties.cellCursorPoint = this.calculatePositionFromPoint(point);
	       this.setMarkerPosition();
	}

	// This is for enhancing contrast of the marker with the background
	// similar to what we have for cell cursors.
	private drawWhiteOuterBorders () {
		this.context.strokeStyle = 'white';
		this.context.lineCap = 'square';
		this.context.lineWidth = 1;

		var desktop: boolean = (<any>window).mode.isDesktop();
		var translation = desktop ?
			[this.size[0], this.size[1]] :
			[Math.floor(this.size[0] * 0.5), Math.floor(this.size[1] * 0.5)];
		const adjustForRTL = app.map._docLayer.isCalcRTL();
		const transformX = (xcoord: number) => {
			return adjustForRTL ? this.size[0] - xcoord : xcoord;
		};

		// top white line
		this.context.beginPath();
		this.context.moveTo(transformX(-0.5), -0.5);
		var borderWidth = this.sectionProperties.selectedAreaPoint ? this.selectionBorderWidth : this.cursorBorderWidth;
		this.context.lineTo(transformX(this.size[0] + 0.5 - (desktop ? borderWidth : 0)), - 0.5);
		this.context.stroke();

		if (!desktop) {
			this.context.beginPath();
			this.context.moveTo(transformX(this.size[0] - 0.5), -0.5);
			this.context.lineTo(transformX(this.size[0] - 0.5), translation[1] - 0.5 - borderWidth);
			this.context.stroke();
		}

		// bottom white line
		this.context.beginPath();
		this.context.moveTo(transformX(-0.5), -0.5);
		this.context.lineTo(transformX(-0.5), translation[1] + 0.5 - borderWidth);
		this.context.stroke();
	}

	showHideOnPermissionChange() {
		this.setShowSection(null);
	}

	setShowSection(show: boolean) {
		if (show !== null)
			this._showSection = show;

		if (app.map._permission === 'readonly') {
			super.setShowSection(false);
		} else {
			super.setShowSection(this._showSection);
		}
	}

	public onDraw () {
		this.drawWhiteOuterBorders();
	}

	private getDocumentPositionFromLocal(point: cool.SimplePoint): cool.SimplePoint {
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
		const refX = point.pX > viewCenter[0] ? viewedRectangle.pX2 : viewedRectangle.pX1;
		const refY = point.pY > viewCenter[1] ? viewedRectangle.pY2 : viewedRectangle.pY1;

		if (!app.isXVisibleInTheDisplayedArea(point.x))
			app.activeDocument.activeView.scroll(point.pX - refX, 0);
		else if (!app.isYVisibleInTheDisplayedArea(point.y))
			app.activeDocument.activeView.scroll(0, point.pY - refY);
	}

	public onMouseMove (point: cool.SimplePoint, dragDistance: Array<number>, e: MouseEvent) {
		if (dragDistance === null || !this.sectionProperties.docLayer._cellAutoFillAreaPixels)
			return; // No dragging or no event handling or auto fill marker is not visible.

		const p2 = this.getDocumentPositionFromLocal(point);
		app.map._docLayer._postMouseEvent('move', p2.x, p2.y, 1, 1, 0);

		if (!this.containerObject.isMouseInside() && this.containerObject.isDraggingSomething())
			this.autoScroll(this.getDocumentPositionFromLocal(point));
	}

	public onMouseUp (point: cool.SimplePoint, e: MouseEvent) {
		const p2 = this.getDocumentPositionFromLocal(point);
		app.map._docLayer._postMouseEvent('buttonup', p2.x, p2.y, 1, 1, 0);
	}

	public onMouseDown (point: cool.SimplePoint, e: MouseEvent) {
		// revert coordinates to global and fire event again with position in the center
		// inverse of convertPositionToCanvasLocale
		const p2 = this.getCenterRegardingDocument();

		app.map._docLayer._postMouseEvent('buttondown', p2.x, p2.y, 1, 1, 0);
	}

	public onMouseEnter () {
		this.context.canvas.style.cursor = 'crosshair';
	}

	public onNewDocumentTopLeft () {
		this.setMarkerPosition();
	}

	public onDoubleClick (point: cool.SimplePoint, e: MouseEvent) {
		const pos = this.getCenterRegardingDocument();
		this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 2, 1, 0);
		this.sectionProperties.docLayer._postMouseEvent('buttonup', pos.x, pos.y, 2, 1, 0);
	}
};
