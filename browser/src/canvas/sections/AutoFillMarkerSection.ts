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

declare var L: any;

app.definitions.AutoFillMarkerSection =
class AutoFillMarkerSection extends CanvasSectionObject {
	processingOrder: number = L.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = L.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = L.CSections.AutoFillMarker.zIndex;

	map: any;
	cursorBorderWidth: number = 2;
	selectionBorderWidth: number = 1;

	_showSection: boolean = true; // Store the internal show/hide section through forced readonly hides...

	constructor () {
		super(L.CSections.AutoFillMarker.name);
		this.documentObject = true;
		this.map = L.Map.THIS;
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.selectedAreaPoint = null;
		this.sectionProperties.cellCursorPoint = null;
		this.sectionProperties.inMouseDown = false;

		this.sectionProperties.draggingStarted = false;
		this.sectionProperties.dragStartPosition = null;

		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));

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

	public onMouseMove (point: cool.SimplePoint, dragDistance: Array<number>, e: MouseEvent) {
		if ((<any>window).mode.isDesktop())
			return;

		if (dragDistance === null || !this.sectionProperties.docLayer._cellAutoFillAreaPixels)
			return; // No dragging or no event handling or auto fill marker is not visible.

		var pos: any;

		if (!this.sectionProperties.draggingStarted) { // Is it first move?
			this.sectionProperties.draggingStarted = true;
			this.sectionProperties.dragStartPosition = this.sectionProperties.docLayer._cellAutoFillAreaPixels.getCenter();
			pos = new L.Point(this.sectionProperties.dragStartPosition[0], this.sectionProperties.dragStartPosition[1]);
			pos = this.sectionProperties.docLayer._corePixelsToTwips(pos);
			this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
		}

		point.pX = this.sectionProperties.dragStartPosition[0] + dragDistance[0];
		point.pY = this.sectionProperties.dragStartPosition[1] + dragDistance[1];

		this.sectionProperties.docLayer._postMouseEvent('move', point.x, point.y, 1, 1, 0);

		this.map.scrollingIsHandled = true;
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}

	public onMouseUp (point: cool.SimplePoint, e: MouseEvent) {
		if (this.sectionProperties.draggingStarted) {
			this.sectionProperties.draggingStarted = false;
			point.pX += this.myTopLeft[0] + this.size[0] * 0.5;
			point.pY += this.myTopLeft[1] + this.size[1] * 0.5;
			this.sectionProperties.docLayer._postMouseEvent('buttonup', point.x, point.y, 1, 1, 0);
		}

		this.map.scrollingIsHandled = false;
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = false;
	}

	public onMouseDown (point: cool.SimplePoint, e: MouseEvent) {
		if ((<any>window).mode.isDesktop()) {
			if (this.sectionProperties.inMouseDown)
				return;

			this.sectionProperties.inMouseDown = true;

			// revert coordinates to global and fire event again with position in the center
			// inverse of convertPositionToCanvasLocale
			var canvasClientRect = this.containerObject.getCanvasBoundingClientRect();
			point.pX = (this.myTopLeft[0] + this.size[0] * 0.5 + 1) / app.dpiScale + canvasClientRect.left;
			point.pY = (this.myTopLeft[1] + this.size[1] * 0.5 + 1) / app.dpiScale + canvasClientRect.top;

			var newPoint = {
				clientX: point.pX,
				clientY: point.pY,
			};

			var newEvent = this.sectionProperties.docLayer._createNewMouseEvent('mousedown', newPoint);
			this.sectionProperties.mapPane.dispatchEvent(newEvent);
		}

		// Just to be safe. We don't need this, but it makes no harm.
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = true; // We'll keep this until we have consistent sections and remove map element.

		this.sectionProperties.inMouseDown = false;
	}

	public onMouseEnter () {
		const grid: any = document.querySelector('.leaflet-map-pane');
		grid.classList.remove('spreadsheet-cursor');
		grid.style.cursor = 'crosshair';
	}

	public onMouseLeave () {
		const grid: any = document.querySelector('.leaflet-map-pane');
		grid.classList.add('spreadsheet-cursor');
	}

	public onNewDocumentTopLeft () {
		this.setMarkerPosition();
	}

	public onDoubleClick (point: cool.SimplePoint, e: MouseEvent) {
		this.sectionProperties.dragStartPosition = this.sectionProperties.docLayer._cellAutoFillAreaPixels.getCenter();
		var pos = new L.Point(this.sectionProperties.dragStartPosition[0], this.sectionProperties.dragStartPosition[1]);
		pos = this.sectionProperties.docLayer._corePixelsToTwips(pos);
		this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 2, 1, 0);
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}
};
