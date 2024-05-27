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
	This class is for the sub sections (handles) of ShapeHandlesSection.
	Shape is rendered on the core side. Only the handles are drawn here and modification commands are sent to the core side.
*/

// This will be HTMLObjectSection until we remove map element. Because map is catching the events before canvas sections for now - so we need object section's div element.
// Same goes for the mirrored events.
class ShapeHandleCustomSubSection extends HTMLObjectSection {
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    documentObject: boolean = true;
    backgroundColor: string = null;

	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super(sectionName, size[0], size[1], documentPosition, null, true);

		this.getHTMLObject().style.opacity = 0.5;
		this.getHTMLObject().style.backgroundColor = 'yellow';
		this.getHTMLObject().style.borderRadius = '50%';
		this.getHTMLObject().remove();
		document.getElementById('map').appendChild(this.getHTMLObject());

		this.mirrorEventsFromSourceToCanvasSectionContainer(this.getHTMLObject());

        this.name = sectionName;
        this.size = size;
        this.position = [documentPosition.pX, documentPosition.pY];

		this.sectionProperties.parentHandlerSection = parentHandlerSection;
		this.sectionProperties.ownInfo = ownInfo;
		this.sectionProperties.mouseIsInside = false;
		this.sectionProperties.mousePointerType = null;
		this.sectionProperties.previousCursorStyle = null;

		this.sectionProperties.mousePointerType = 'grab';
	}

	mirrorEventsFromSourceToCanvasSectionContainer (sourceElement: HTMLElement): void {
		sourceElement.addEventListener('mousedown', function (e) { app.sectionContainer.onMouseDown(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('click', function (e) { app.sectionContainer.onClick(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('dblclick', function (e) { app.sectionContainer.onDoubleClick(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('contextmenu', function (e) { app.sectionContainer.onContextMenu(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('wheel', function (e) { app.sectionContainer.onMouseWheel(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('mouseleave', function (e) { app.sectionContainer.onMouseLeave(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('mouseenter', function (e) { app.sectionContainer.onMouseEnter(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchstart', function (e) { app.sectionContainer.onTouchStart(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchmove', function (e) { app.sectionContainer.onTouchMove(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchend', function (e) { app.sectionContainer.onTouchEnd(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchcancel', function (e) { app.sectionContainer.onTouchCancel(e); e.stopPropagation(); }, true);
	}

	onMouseEnter(point: number[], e: MouseEvent) {
		this.backgroundColor = 'grey';
		this.sectionProperties.previousCursorStyle = this.getHTMLObject().style.cursor;
		this.getHTMLObject().style.cursor = this.sectionProperties.mousePointerType;
		this.stopPropagating();
		e.stopPropagation();
		this.containerObject.requestReDraw();
	}

	onMouseLeave(point: number[], e: MouseEvent) {
		this.getHTMLObject().style.cursor = this.sectionProperties.previousCursorStyle;
		this.backgroundColor = null;
		this.stopPropagating();
		e.stopPropagation();
		this.containerObject.requestReDraw();

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
	}

	onMouseMove(point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			e.stopPropagation();
		}
	}
}

app.definitions.shapeHandleCustomSubSection = ShapeHandleCustomSubSection;
