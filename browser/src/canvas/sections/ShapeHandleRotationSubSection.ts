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

class ShapeHandleRotationSubSection extends CanvasSectionObject {
	processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    documentObject: boolean = true;

	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super();

		this.name = sectionName;
		this.size = size;

		this.sectionProperties.position = documentPosition.clone();
        this.sectionProperties.parentHandlerSection = parentHandlerSection;
		this.sectionProperties.ownInfo = ownInfo;
		this.sectionProperties.mouseIsInside = false;
		this.sectionProperties.previousCursorStyle = null;
		this.sectionProperties.lastDraggingDistance = null;
		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
		this.sectionProperties.previousCursorStyle = null;
		this.sectionProperties.cursorStyle = 'pointer';
	}

	calculateAngle(center: cool.SimplePoint, target: cool.SimplePoint): number {
		let angle = Math.atan2(target.y - center.y, target.x - center.x);

		while (angle < 0)
			angle += 2 * Math.PI;

		while (angle > Math.PI * 2)
			angle -= Math.PI * 2;

		angle = (angle * 180) / Math.PI;
		angle *= 100; // Core side multiplies degrees with 100.

		return angle;
	}

	onInitialize(): void {
		this.setPosition(this.sectionProperties.position.pX, this.sectionProperties.position.pY);
	}

	onMouseEnter(point: Array<number>, e: MouseEvent): void {
		app.map.dontHandleMouse = true;
		this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.cursorStyle;
	}

	onMouseLeave(point: Array<number>, e: MouseEvent): void {
		app.map.dontHandleMouse = false;
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.previousCursorStyle;
	}

	onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: cool.Bounds): void {
		this.context.fillStyle = 'white';
		this.context.strokeStyle = 'black';
		this.context.beginPath();
		this.context.arc(this.size[0] * 0.5, this.size[1] * 0.5, this.size[0] * 0.5, 0, Math.PI * 2);
		this.context.closePath();
		this.context.fill();
		this.context.stroke();
	}

	// This is called after dragging the rotation handler. It re-calculates initial angle with the handler's new position.
	getAngleDifference(): number {
		const dragDistanceInTwips = [this.sectionProperties.lastDraggingDistance[0] * app.pixelsToTwips, this.sectionProperties.lastDraggingDistance[1] * app.pixelsToTwips];
		const draggedToPoint = new app.definitions.simplePoint(dragDistanceInTwips[0], dragDistanceInTwips[1]);

		draggedToPoint.pX += this.position[0];
		draggedToPoint.pY += this.position[1];

		const selectionCenter = new app.definitions.simplePoint(app.map._docLayer._graphicSelection.center[0], app.map._docLayer._graphicSelection.center[1]);

		const initialPoint = this.sectionProperties.ownInfo.initialPosition;
		const initialAngle = this.calculateAngle(selectionCenter, initialPoint);
		const newAngle = this.calculateAngle(selectionCenter, draggedToPoint);

		return initialAngle - newAngle;
	}

	onMouseDown(point: Array<number>, e: MouseEvent): void {
		(window as any).IgnorePanning = true;
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			if (this.sectionProperties.lastDraggingDistance) {
				const center = app.map._docLayer._graphicSelection.center;

				const commandParameters = {
					'TransformRotationDeltaAngle': {
						'type': 'long',
						'value': this.getAngleDifference()
					},
					'TransformRotationX': {
						'type': 'long',
						'value': center[0]
					},
					'TransformRotationY': {
						'type': 'long',
						'value': center[1]
					}
				};

				app.map.sendUnoCommand('.uno:TransformDialog ', commandParameters);
			}
			this.sectionProperties.parentHandlerSection.hideSVG();
		}

		(window as any).IgnorePanning = false;
	}

	onMouseMove(position: number[], distance: number[]) {
		if (this.containerObject.isDraggingSomething()) {
			this.sectionProperties.lastDraggingDistance = distance;

			if (this.containerObject.isDraggingSomething() && this.sectionProperties.parentHandlerSection.sectionProperties.svg) {
				this.sectionProperties.parentHandlerSection.sectionProperties.svg.style.opacity = 0.5;
				const angleDifference = (-this.getAngleDifference() / 100) * app.dpiScale;
				this.sectionProperties.parentHandlerSection.sectionProperties.svg.style.transform = 'rotate(' + angleDifference + 'deg)';
				this.containerObject.requestReDraw();
				this.sectionProperties.parentHandlerSection.showSVG();
			}
		}
	}
}

app.definitions.shapeHandleRotationSubSection = ShapeHandleRotationSubSection;
