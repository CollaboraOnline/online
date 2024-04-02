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
declare var app: any;

app.definitions.AutoFillMarkerSection =
class AutoFillMarkerSection extends CanvasSectionObject {
	map: any;
	cursorBorderWidth: number = 2;
	selectionBorderWidth: number = 1;

	isCalcRTL: () => boolean;

	constructor () {
		super({
			name: L.CSections.AutoFillMarker.name,
			anchor: [],
			position: new Array<number>(0),
			size: new Array<number>(0),
			expand: '',
			showSection: true,
			processingOrder: L.CSections.AutoFillMarker.processingOrder,
			drawingOrder: L.CSections.AutoFillMarker.drawingOrder,
			zIndex: L.CSections.AutoFillMarker.zIndex,
			interactable: true,
			sectionProperties: {}
		});

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
	}

	public onResize () {
		return;
	}

	private setMarkerPosition () {
		var center: number = 0;
		if (!(<any>window).mode.isDesktop() && this.map._docLayer._cellCursorPixels) {
			center = app.file.calc.cellCursor.rectangle.pWidth * 0.5;
		}

		var position: Array<number> = [0, 0];
		this.showSection = true;

		if (this.sectionProperties.selectedAreaPoint !== null)
			position = [this.sectionProperties.selectedAreaPoint[0] - center, this.sectionProperties.selectedAreaPoint[1]];
		else if (this.sectionProperties.cellCursorPoint !== null)
			position = [this.sectionProperties.cellCursorPoint[0] - center, this.sectionProperties.cellCursorPoint[1]];
		else
			this.showSection = false;

		// At this point, position is calculated without taking splitter into account.
		var splitPosCore = {x: 0, y: 0};
		if (this.map._docLayer.getSplitPanesContext())
			splitPosCore = this.map._docLayer.getSplitPanesContext().getSplitPos();

		splitPosCore.x *= app.dpiScale;
		splitPosCore.y *= app.dpiScale;

		if (position[0] <= splitPosCore.x)
			position[0] += this.documentTopLeft[0];
		else if (position[0] - this.documentTopLeft[0] <= splitPosCore.x)
			this.showSection = false;

		if (position[1] <= splitPosCore.y)
			position[1] += this.documentTopLeft[1];
		else if (position[1] - this.documentTopLeft[1] <= splitPosCore.y)
			this.showSection = false;

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
		const adjustForRTL = this.isCalcRTL();
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
			this.context.moveTo(transformX(this.size[0] - 0.5 - (desktop ? borderWidth : 0)), -0.5);
			this.context.lineTo(transformX(this.size[0] - 0.5 - (desktop ? borderWidth : 0)), translation[1] - 0.5 - borderWidth);
			this.context.stroke();
		}

		// bottom white line
		this.context.beginPath();
		this.context.moveTo(transformX(-0.5), -0.5);
		this.context.lineTo(transformX(-0.5), translation[1] + 0.5 - borderWidth);
		this.context.stroke();
	}

	public onDraw () {
		this.drawWhiteOuterBorders();
	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
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

		point[0] = this.sectionProperties.dragStartPosition[0] + dragDistance[0];
		point[1] = this.sectionProperties.dragStartPosition[1] + dragDistance[1];
		pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));

		this.sectionProperties.docLayer._postMouseEvent('move', pos.x, pos.y, 1, 1, 0);

		this.map.scrollingIsHandled = true;
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.draggingStarted) {
			this.sectionProperties.draggingStarted = false;
			point[0] += this.myTopLeft[0] + this.size[0] * 0.5;
			point[1] += this.myTopLeft[1] + this.size[1] * 0.5;
			var pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));
			this.sectionProperties.docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
		}

		this.map.scrollingIsHandled = false;
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = false;
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		if ((<any>window).mode.isDesktop()) {
			if (this.sectionProperties.inMouseDown)
				return;

			this.sectionProperties.inMouseDown = true;

			// revert coordinates to global and fire event again with position in the center
			// inverse of convertPositionToCanvasLocale
			var canvasClientRect = this.containerObject.getCanvasBoundingClientRect();
			point[0] = (this.myTopLeft[0] + this.size[0] * 0.5 + 1) / app.dpiScale + canvasClientRect.left;
			point[1] = (this.myTopLeft[1] + this.size[1] * 0.5 + 1) / app.dpiScale + canvasClientRect.top;

			var newPoint = {
				clientX: point[0],
				clientY: point[1],
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
		this.sectionProperties.mapPane.style.cursor = 'crosshair';
	}

	public onMouseLeave () {
		this.sectionProperties.mapPane.style.cursor = 'default';
	}

	public onNewDocumentTopLeft () {
		this.setMarkerPosition();
	}

	public onMouseWheel () { return; }
	public onClick () { return; }
	public onDoubleClick (point: Array<number>, e: MouseEvent) {
		this.sectionProperties.dragStartPosition = this.sectionProperties.docLayer._cellAutoFillAreaPixels.getCenter();
		var pos = new L.Point(this.sectionProperties.dragStartPosition[0], this.sectionProperties.dragStartPosition[1]);
		pos = this.sectionProperties.docLayer._corePixelsToTwips(pos);
		this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 2, 1, 0);
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}
	public onContextMenu () { return; }
	public onMultiTouchStart () { return; }
	public onMultiTouchMove () { return; }
	public onMultiTouchEnd () { return; }
};
