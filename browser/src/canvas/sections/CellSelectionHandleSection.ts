/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class CellSelectionHandle extends app.definitions.canvasSectionObject {
	showSection: false;
	processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder;
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
	documentObject: boolean = true;

	constructor (name: string) {
        super();

		this.sectionProperties.circleRadius = 10 * app.dpiScale;
		this.size = [this.sectionProperties.circleRadius * 2, this.sectionProperties.circleRadius * 2];

		this.name = name; // There will be multiple instances of this class. For the viewer's cursor, name will be owncellcursor. Others will have viewId-cellcursor.
	}

	private onDragEnd(point: number[]) {
		app.map.focus();
		app.map.fire('scrollvelocity', {vx: 0, vy: 0});

		const newPoint = new cool.SimplePoint(0, 0);
		newPoint.pX = this.position[0] + point[0];
		newPoint.pY = this.position[1] + point[1];

		this.sharedOnDragAndEnd(newPoint);
		app.map._docLayer._onUpdateCellResizeMarkers();
		app.map.scrollingIsHandled = false;
	}

	private sharedOnDragAndEnd(point: cool.SimplePoint) {
		const type = this.name === 'cell_selection_handle_start' ? 'start' : 'end';
		app.map._docLayer._postSelectTextEvent(type, point.x, point.y);
	}

	private onDrag(point: number[]) {
		const newPoint = new cool.SimplePoint(0, 0);
		newPoint.pX = this.position[0] + point[0];
		newPoint.pY = this.position[1] + point[1];

		app.map.fire('handleautoscroll', { pos: { x: 0, y: newPoint.cY }, map: app.map });

		this.sharedOnDragAndEnd(newPoint);
	}

	public onDraw() {
		this.context.strokeStyle = app.map.uiManager.getDarkModeState() ? 'white' : 'black';
		this.context.lineWidth = 2;

		this.context.beginPath();
		this.context.arc(this.sectionProperties.circleRadius, this.sectionProperties.circleRadius, this.sectionProperties.circleRadius, 0, 2 * Math.PI);
		this.context.stroke();
	}

	onMouseMove(point: number[], dragDistance: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			app.map.scrollingIsHandled = true;
			this.stopPropagating();
			this.onDrag(point);
		}
	}

	onMouseDown(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			this.onDragEnd(point);
		}
	}
}

app.definitions.cellSelectionHandle = CellSelectionHandle;
