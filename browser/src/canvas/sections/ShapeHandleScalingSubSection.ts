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

	constructor(parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any, cropModeEnabled: boolean) {
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
		this.sectionProperties.cropModeEnabled = cropModeEnabled;
		this.sectionProperties.cropCursor = 'url(' + L.LOUtil.getURL("images/cursors/crop.png") + ') 8 8, auto';

		this.setMousePointerType();

		app.events.on('TextCursorVisibility', this.onTextCursorVisibility.bind(this));
	}

	onInitialize(): void {
		this.setPosition(this.sectionProperties.position.pX, this.sectionProperties.position.pY);
	}

	onTextCursorVisibility(event: any): void {
		if (event.detail.visible) {
			this.setShowSection(false);
			this.interactable = false;
		}
		else {
			this.setShowSection(true);
			this.interactable = true;
		}
	}

	onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: cool.Bounds): void {
		this.context.fillStyle = 'wheat';
		this.context.strokeStyle = 'black';
		this.context.beginPath();
		if (this.sectionProperties.cropModeEnabled)
			this.drawCropHandles();
		else
			this.context.arc(this.size[0] * 0.5, this.size[1] * 0.5, this.size[0] * 0.5, 0, Math.PI * 2);
		this.context.closePath();
		this.context.fill();
		this.context.stroke();
	}

	drawCropCornerHandle() {
		const markerWidth = this.size[0];
		const halfMarkerWidth = markerWidth * 0.5;
		const shapeAngle = this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.angleRadian;
		let x = halfMarkerWidth, y = halfMarkerWidth;
		this.context.translate(x, y);
		this.context.rotate(shapeAngle * -1);
		this.context.translate(-x, -y)
		this.context.moveTo(x, y);
		x += markerWidth;
		this.context.lineTo(x, y);
		y += halfMarkerWidth;
		this.context.lineTo(x, y);
		x -= halfMarkerWidth;
		this.context.lineTo(x, y);
		y += halfMarkerWidth;
		this.context.lineTo(x, y);
		x -= halfMarkerWidth;
		this.context.lineTo(x, y);
	}

	drawCropSideHandle() {
		const markerWidth = this.size[0];
		const halfMarkerWidth = markerWidth * 0.5;
		const shapeAngle = this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties.angleRadian;
		let x = halfMarkerWidth, y = halfMarkerWidth;
		this.context.translate(x, y);
		this.context.rotate(shapeAngle * -1);
		this.context.translate(-x, -y)
		this.context.moveTo(x, y);
		x += markerWidth;
		this.context.lineTo(x, y);
		y += halfMarkerWidth;
		this.context.lineTo(x, y);
		x -= markerWidth;
		this.context.lineTo(x, y);
	}

	drawCropHandles() {
		const markerWidth = this.size[0];
		this.context.save();
		switch (this.sectionProperties.ownInfo.kind) {
			case '1':
				this.drawCropCornerHandle();
				break;
			case '2':
				this.drawCropSideHandle();
				break;
			case '3':
				this.context.rotate(Math.PI / 2);
				this.context.translate(0, -markerWidth);
				this.drawCropCornerHandle();
				break;
			case '4':
				this.context.rotate(-Math.PI / 2);
				this.context.translate(-markerWidth, 0);
				this.drawCropSideHandle();
				break;
			case '5':
				this.context.rotate(Math.PI / 2);
				this.context.translate(0, -markerWidth);
				this.drawCropSideHandle();
				break;
			case '6':
				this.context.rotate(-Math.PI / 2);
				this.context.translate(-markerWidth, 0);
				this.drawCropCornerHandle();
				break;
			case '7':
				this.context.rotate(Math.PI);
				this.context.translate(-markerWidth, -markerWidth);
				this.drawCropSideHandle();
				break;
			case '8':
				this.context.rotate(Math.PI);
				this.context.translate(-markerWidth, -markerWidth);
				this.drawCropCornerHandle();
				break;
		}
		this.context.restore();
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
		if (this.sectionProperties.cropModeEnabled)
			this.sectionProperties.mapPane.style.cursor = this.sectionProperties.cropCursor;
		else
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

	private overrideHandle(kind: string): [string, number, number] {
		const handle = {
			id: this.sectionProperties.ownInfo.id,
			x: this.position[0],
			y: this.position[1],
		};
		const subSections = this.sectionProperties.parentHandlerSection.sectionProperties.subSections;

		if (kind === '5') {
			handle.id = '7';
			handle.y = subSections['7'].position[1];
		} else if (kind === '4') {
			handle.id = '5';
			handle.y = subSections['5'].position[1];
		} else if (kind === '2') {
			handle.id = '2';
			handle.x = subSections['2'].position[0];
		} else if (kind === '7') {
			handle.id = '7';
			handle.x = subSections['7'].position[0];
		}

		return [handle.id, handle.x, handle.y];
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			e.stopPropagation();

			const keepRatio = e.ctrlKey && e.shiftKey;
			let handleId = this.sectionProperties.ownInfo.id;
			const parentHandlerSection = this.sectionProperties.parentHandlerSection;

			let x = parentHandlerSection.sectionProperties.closestX ?? point[0] + this.position[0];
			let y = parentHandlerSection.sectionProperties.closestY ?? point[1] + this.position[1];

			if (keepRatio) {
				[handleId, x, y] = this.overrideHandle(this.sectionProperties.ownInfo.kind);
			}

			const parameters = {
				HandleNum: { type: 'long', value: handleId },
				NewPosX: { type: 'long', value: Math.round(x * app.pixelsToTwips) },
				NewPosY: { type: 'long', value: Math.round(y * app.pixelsToTwips) }
			};

			app.map.sendUnoCommand('.uno:MoveShapeHandle', parameters);
			parentHandlerSection.hideSVG();
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

	private calculateRatioPoint(point: number[], shapeRecProps: any) {
		const isVerticalHandler = ['2', '7'].includes(this.sectionProperties.ownInfo.kind);

		const primaryDelta = isVerticalHandler
		    ? point[1] - shapeRecProps.center[1]
		    : point[0] - shapeRecProps.center[0];

		const aspectRatio = isVerticalHandler
		    ? shapeRecProps.width / shapeRecProps.height
		    : shapeRecProps.height / shapeRecProps.width;

		const secondaryDelta = primaryDelta * aspectRatio;

		const direction = ['3', '4', '6', '2'].includes(this.sectionProperties.ownInfo.kind) ? -1 : 1;

		if (isVerticalHandler) {
		    point[0] = shapeRecProps.center[0] + secondaryDelta * direction;
		} else {
		    point[1] = shapeRecProps.center[1] + secondaryDelta * direction;
		}

		return point;
	}

	calculateNewShapeRectangleProperties(point: number[], e: MouseEvent) {
		const shapeRecProps: any = JSON.parse(JSON.stringify(this.sectionProperties.parentHandlerSection.sectionProperties.shapeRectangleProperties));
		const keepRatio = e.ctrlKey && e.shiftKey;

		if (keepRatio) {
			point = this.calculateRatioPoint(point, shapeRecProps);
		}

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

		if (keepRatio) {
			if (['4', '5'].includes(this.sectionProperties.ownInfo.kind)) {
				rectangle.pY2 = point[1];
			} else if (['2', '7'].includes(this.sectionProperties.ownInfo.kind)) {
				rectangle.pX2 = point[0];
			}
		}

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
	moveHandlesOnDrag(point: number[], e: MouseEvent) {
		const shapeRecProps = this.calculateNewShapeRectangleProperties([
			point[0] + this.myTopLeft[0] + this.documentTopLeft[0] - this.containerObject.getDocumentAnchor()[0],
			point[1] + this.myTopLeft[1] + this.documentTopLeft[1] - this.containerObject.getDocumentAnchor()[1]
		], e);

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

		if (!this.sectionProperties.cropModeEnabled)
			this.adjustSVGProperties(shapeRecProps);
	}

	onMouseMove(point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.containerObject.isDraggingSomething()) {
			(window as any).IgnorePanning = true;
			this.stopPropagating();
			e.stopPropagation();
			this.sectionProperties.parentHandlerSection.sectionProperties.svg.style.opacity = 0.5;
			this.moveHandlesOnDrag(point, e);

			// Here we are checking a point, so the size 0. dragDistance is also 0 because we already set the new position (moveHandlesOnDrag).
			this.sectionProperties.parentHandlerSection.checkHelperLinesAndSnapPoints([0, 0], this.position, [0, 0]);

			this.containerObject.requestReDraw();
			this.sectionProperties.parentHandlerSection.showSVG();
		}
		else
			(window as any).IgnorePanning = false;
	}
}

app.definitions.shapeHandleScalingSubSection = ShapeHandleScalingSubSection;
