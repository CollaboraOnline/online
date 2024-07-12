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

class ShapeHandleScalingSubSection extends CanvasSectionObject {
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder + 1; // Handle events before the parent section.
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    documentObject: boolean = true;

	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super();

        this.size = size;
		this.sectionProperties.position = documentPosition.clone();
		this.name = sectionName;

		this.sectionProperties.parentHandlerSection = parentHandlerSection;
		this.sectionProperties.ownInfo = ownInfo;
		this.sectionProperties.mousePointerType = null;
		this.sectionProperties.previousCursorStyle = null;

		this.sectionProperties.initialAngle = null; // Initial angle of the point (handle) to the center in radians.
		this.sectionProperties.distanceToCenter = null; // Distance to center.
		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));

		this.setMousePointerType();
	}

	onInitialize(): void {
		this.setPosition(this.sectionProperties.position.pX, this.sectionProperties.position.pY);
	}

	onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: cool.Bounds): void {
		this.context.fillStyle = 'wheat';
		this.context.strokeStyle = 'black';
		this.context.beginPath();
		this.context.arc(this.size[0] * 0.5, this.size[1] * 0.5, this.size[0] * 0.5, 0, Math.PI * 2);
		this.context.closePath();
		this.context.fill();
		this.context.stroke();
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
		app.map.dontHandleMouse = true;
		e.stopPropagation();
		this.stopPropagating();
		this.sectionProperties.previousCursorStyle = this.sectionProperties.mapPane.style.cursor;
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.mousePointerType;
		this.containerObject.requestReDraw();
	}

	onMouseLeave(point: number[], e: MouseEvent) {
		app.map.dontHandleMouse = false;
		e.stopPropagation();
		this.stopPropagating();
		this.sectionProperties.mapPane.style.cursor = this.sectionProperties.previousCursorStyle;
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

		(window as any).IgnorePanning = false;
	}

	adjustSVGProperties(shapeRecProps: any) {
		if (this.sectionProperties.parentHandlerSection.sectionProperties.svg) {
			const svg = this.sectionProperties.parentHandlerSection.sectionProperties.svg;

			const scaleX = shapeRecProps.width / this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.width;
			const scaleY = shapeRecProps.height / this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.height;

			let diffX = shapeRecProps.center[0] - this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.center[0];
			let diffY = shapeRecProps.center[1] - this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.center[1];

			diffX = diffX / app.dpiScale;
			diffY = diffY / app.dpiScale;

			svg.children[0].style.transform = 'translate(' + Math.round(diffX) + 'px, ' + Math.round(diffY) + 'px)' + 'rotate(' + -shapeRecProps.angleRadian + 'rad) scale(' + scaleX + ', ' + scaleY + ') rotate(' + shapeRecProps.angleRadian + 'rad)';

			this.sectionProperties.parentHandlerSection.showSVG();
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
			point[0] + this.myTopLeft[0] + this.documentTopLeft[0] - this.containerObject.getDocumentAnchor()[0],
			point[1] + this.myTopLeft[1] + this.documentTopLeft[1] - this.containerObject.getDocumentAnchor()[1]
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
			(window as any).IgnorePanning = true;
			this.stopPropagating();
			e.stopPropagation();
			this.sectionProperties.parentHandlerSection.sectionProperties.svg.style.opacity = 0.5;
			this.moveHandlesOnDrag(point);
			this.containerObject.requestReDraw();
			this.sectionProperties.parentHandlerSection.showSVG();
		}
		else
			(window as any).IgnorePanning = false;
	}
}

app.definitions.shapeHandleScalingSubSection = ShapeHandleScalingSubSection;
