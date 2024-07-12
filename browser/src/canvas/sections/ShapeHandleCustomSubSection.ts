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

/*
	This class is for custom handlers of shapes.
*/

class ShapeHandleCustomSubSection extends CanvasSectionObject {
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    documentObject: boolean = true;

	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super();

        this.size = size;
		this.name = sectionName;

		this.sectionProperties.position = documentPosition.clone();
		this.sectionProperties.parentHandlerSection = parentHandlerSection;
		this.sectionProperties.ownInfo = ownInfo;
		this.sectionProperties.previousCursorStyle = null;

		this.sectionProperties.mousePointerType = 'grab';
		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));
	}

	onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: cool.Bounds): void {
		this.context.fillStyle = 'yellow';
		this.context.strokeStyle = 'black';
		this.context.beginPath();
		this.context.arc(this.size[0] * 0.5, this.size[1] * 0.5, this.size[0] * 0.5, 0, Math.PI * 2);
		this.context.closePath();
		this.context.fill();
		this.context.stroke();
	}

	onInitialize(): void {
		this.setPosition(this.sectionProperties.position.pX, this.sectionProperties.position.pY);
	}

	onMouseEnter(point: number[], e: MouseEvent) {
		app.map.dontHandleMouse = true;
		this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.mousePointerType;
		this.stopPropagating();
		e.stopPropagation();
		this.containerObject.requestReDraw();
	}

	onMouseLeave(point: number[], e: MouseEvent) {
		app.map.dontHandleMouse = false;
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.previousCursorStyle;
		this.stopPropagating();
		e.stopPropagation();
		this.containerObject.requestReDraw();
	}

	onMouseDown(point: Array<number>, e: MouseEvent): void {
		(window as any).IgnorePanning = true;
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			const parameters = {
				HandleNum: { type: 'long', value: this.sectionProperties.ownInfo.id },
				NewPosX: { type: 'long', value: Math.round((point[0] + this.position[0]) * app.pixelsToTwips) },
				NewPosY: { type: 'long', value: Math.round((point[1] + this.position[1]) * app.pixelsToTwips) }
			};

			app.map.sendUnoCommand('.uno:MoveShapeHandle', parameters);

			this.stopPropagating();
			e.stopPropagation();
		}

		(window as any).IgnorePanning = false;
	}

	onMouseMove(point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			e.stopPropagation();
		}
	}
}

app.definitions.shapeHandleCustomSubSection = ShapeHandleCustomSubSection;
