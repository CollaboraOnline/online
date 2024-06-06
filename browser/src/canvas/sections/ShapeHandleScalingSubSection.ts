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
class ShapeHandleScalingSubSection extends HTMLObjectSection {
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    documentObject: boolean = true;
    borderColor: string = 'grey'; // borderColor and backgroundColor are used so we don't need an "onDraw" function for now.
    backgroundColor: string = null;

	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super(sectionName, size[0], size[1], documentPosition, null, true);

		this.getHTMLObject().style.opacity = 0.3;
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

		// Set below immediately after initialization so they are not calculated on mouse move.
		this.sectionProperties.initialAngle = null; // Initial angle of the point (handle) to the center in radians.
		this.sectionProperties.distanceToCenter = null; // Distance to center.

		this.setMousePointerType();
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

	setMousePointerType() {
		if (this.sectionProperties.ownInfo.kind === '1')
			this.sectionProperties.mousePointerType = 'nwse-resize';
		else if (this.sectionProperties.ownInfo.kind === '2')
			this.sectionProperties.mousePointerType = 'ns-resize';
		else if (this.sectionProperties.ownInfo.kind === '3')
			this.sectionProperties.mousePointerType = 'nesw-resize';
		else if (this.sectionProperties.ownInfo.kind === '4')
			this.sectionProperties.mousePointerType = 'ew-resize';
		else if (this.sectionProperties.ownInfo.kind === '5')
			this.sectionProperties.mousePointerType = 'ew-resize';
		else if (this.sectionProperties.ownInfo.kind === '6')
			this.sectionProperties.mousePointerType = 'nesw-resize';
		else if (this.sectionProperties.ownInfo.kind === '7')
			this.sectionProperties.mousePointerType = 'ns-resize';
		else if (this.sectionProperties.ownInfo.kind === '8')
			this.sectionProperties.mousePointerType = 'nwse-resize';
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
			this.stopPropagating();
			e.stopPropagation();

			const parameters = {
				HandleNum: { type: 'long', value: this.sectionProperties.ownInfo.id },
				NewPosX: { type: 'long', value: Math.round((point[0] + this.position[0]) * app.pixelsToTwips) },
				NewPosY: { type: 'long', value: Math.round((point[1] + this.position[1]) * app.pixelsToTwips) }
			};

			app.map.sendUnoCommand('.uno:MoveShapeHandle', parameters);
			this.sectionProperties.parentHandlerSection.hideSVG();
		}
	}

	adjustSVGProperties(shapeRecProps: any) {
		const scale = app.getScale();

		const shapeRecPropsOrg = this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties;

		const scaleX = (shapeRecProps.width / shapeRecPropsOrg.width) * scale;
		const scaleY = (shapeRecProps.height / shapeRecPropsOrg.height) * scale;

		if (this.sectionProperties.parentHandlerSection.sectionProperties.svg) {
			const svg = this.sectionProperties.parentHandlerSection.sectionProperties.svg;
			const selection = app.map._docLayer._graphicSelection;
			const center: number[] = [];
			center.push(shapeRecProps.center[0] - this.documentTopLeft[0]);
			center.push(shapeRecProps.center[1] - this.documentTopLeft[1]);

			svg.style.width = Math.abs(shapeRecProps.width) + 'px';
			svg.style.height = Math.abs(shapeRecProps.height) + 'px';
			svg.style.position = 'absolute';
			svg.style.textAlign = 'left';
			svg.style.alignContent = 'start';
			svg.style.left = center[0] + 'px';
			svg.style.top = center[1] + 'px';
			svg.children[0].setAttribute('preserveAspectRatio', 'none');
			svg.style.preserveAspectRatio = 'none';
			svg.style.transform = 'scale(' + scaleX + ', ' + scaleY  + ')';
			svg.style.display = '';
		}
	}

	calculateNewShapeRectangleProperties(point: number[]) {
		const shapeRecProps: any = JSON.parse(JSON.stringify(this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties));

		const diff = [point[0] - shapeRecProps.center[0], -(point[1] - shapeRecProps.center[1])];
		const length = Math.pow(Math.pow(diff[0], 2) + Math.pow(diff[1], 2), 0.5);
		const pointAngle = Math.atan2(diff[1], diff[0]);
		point[0] = shapeRecProps.center[0] + length * Math.cos(pointAngle - shapeRecProps.angleRadian);
		point[1] = shapeRecProps.center[1] - length * Math.sin(pointAngle - shapeRecProps.angleRadian);

		const rectangle = new cool.SimpleRectangle(
			(shapeRecProps.center[0] - shapeRecProps.width * 0.5) * app.pixelsToTwips,
			(shapeRecProps.center[1] - shapeRecProps.height * 0.5) * app.pixelsToTwips,
			shapeRecProps.width * app.pixelsToTwips,
			shapeRecProps.height * app.pixelsToTwips
		);

		const oldpCenter = rectangle.pCenter;

		if (['1', '4', '6'].includes(this.sectionProperties.ownInfo.kind)) {
			const pX2 = rectangle.pX2;
			rectangle.pX1 = point[0];
			rectangle.pX2 = pX2;
		}
		else if (['3', '5', '8'].includes(this.sectionProperties.ownInfo.kind))
			rectangle.pX2 = point[0];

		if (['1', '2', '3'].includes(this.sectionProperties.ownInfo.kind)) {
			const pY2 = rectangle.pY2;
			rectangle.pY1 = point[1];
			rectangle.pY2 = pY2;
		}
		else if (['6', '7', '8'].includes(this.sectionProperties.ownInfo.kind))
			rectangle.pY2 = point[1];

		const centerAngle = Math.atan2(oldpCenter[1] - rectangle.pCenter[1], rectangle.pCenter[0] - oldpCenter[0]);
		const centerLength = Math.pow(Math.pow(rectangle.pCenter[1] - oldpCenter[1], 2) + Math.pow(rectangle.pCenter[0] - oldpCenter[0], 2), 0.5);

		const x = centerLength * Math.cos(shapeRecProps.angleRadian + centerAngle);
		const y = centerLength * Math.sin(shapeRecProps.angleRadian + centerAngle);

		shapeRecProps.center[0] += x;
		shapeRecProps.center[1] -= y;
		shapeRecProps.width = rectangle.pWidth;
		shapeRecProps.height = rectangle.pHeight;

		return shapeRecProps;
	}

	// While dragging a handle, we want to simulate handles to their final positions.
	moveHandlesOnDrag(point: number[]) {
		const shapeRecProps = this.calculateNewShapeRectangleProperties([
			point[0] + this.myTopLeft[0] + this.documentTopLeft[0],
			point[1] + this.myTopLeft[1] + this.documentTopLeft[1]
		]);

		this.sectionProperties.parentHandlerSection.calculateInitialAnglesOfShapeHandlers(shapeRecProps);

		const halfWidth = this.sectionProperties.parentHandlerSection.sectionProperties.handleWidth * 0.5;
		const halfHeight = this.sectionProperties.parentHandlerSection.sectionProperties.handleHeight * 0.5;
		const subSections = this.sectionProperties.parentHandlerSection.sectionProperties.subSections;

		let x = 0, y = 0;
		let pointAngle = 0;

		for (let i = 0; i < subSections.length; i++) {
			const subSection = subSections[i];

			pointAngle = subSection.sectionProperties.initialAngle + shapeRecProps.angleRadian;
			x = shapeRecProps.center[0] + subSection.sectionProperties.distanceToCenter * Math.cos(pointAngle);
			y = shapeRecProps.center[1] - subSection.sectionProperties.distanceToCenter * Math.sin(pointAngle);
			subSection.setPosition(x - halfWidth, y - halfHeight);
		}
		this.adjustSVGProperties(shapeRecProps);
	}

	onMouseMove(point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.containerObject.isDraggingSomething() && this.containerObject.targetSection === this.name) {
			this.stopPropagating();
			e.stopPropagation();
			this.moveHandlesOnDrag(point);
			this.containerObject.requestReDraw();
			this.sectionProperties.parentHandlerSection.showSVG();
		}
	}
}

app.definitions.shapeHandleScalingSubSection = ShapeHandleScalingSubSection;
