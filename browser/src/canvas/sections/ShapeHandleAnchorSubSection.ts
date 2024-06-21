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

class ShapeHandleAnchorSubSection extends HTMLObjectSection {
	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super(sectionName, size[0], size[1], documentPosition, 'anchor-marker');

		this.getHTMLObject().style.opacity = 1;
		this.getHTMLObject().remove();
		document.getElementById('map').appendChild(this.getHTMLObject());

		app.definitions.shapeHandlesSection.mirrorEventsFromSourceToCanvasSectionContainer(this.getHTMLObject());

        this.sectionProperties.parentHandlerSection = parentHandlerSection;
		this.sectionProperties.ownInfo = ownInfo;
		this.sectionProperties.mouseIsInside = false;
	}

	onMouseEnter() {
		this.backgroundColor = 'grey';
		this.containerObject.requestReDraw();
	}

	onMouseLeave() {
		this.backgroundColor = null;
		this.containerObject.requestReDraw();
	}

	tableMouseUp(point: number[], e: MouseEvent) {
		const parameters = {
			'TransformPosX': {
				'type': 'long',
				'value': Math.round((point[0] + this.position[0]) * app.pixelsToTwips)
			},
			'TransformPosY': {
				'type': 'long',
				'value': Math.round((point[1] + this.position[1]) * app.pixelsToTwips)
			}
		};

		app.map.sendUnoCommand('.uno:TransformDialog', parameters);
	}

	shapeMouseUp(point: number[], e: MouseEvent) {
		const parameters = {
			'HandleNum': {
				'type': 'long',
				'value': this.sectionProperties.ownInfo.id
			},
			'NewPosX': {
				'type': 'long',
				'value': Math.round((point[0] + this.position[0]) * app.pixelsToTwips)
			},
			'NewPosY': {
				'type': 'long',
				'value': Math.round((point[1] + this.position[1]) * app.pixelsToTwips)
			}
		};

		app.map.sendUnoCommand('.uno:MoveShapeHandle', parameters);
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			// Tables don't have parent sections. This is used for separating table anchors from other anchors.
			if (this.sectionProperties.parentHandlerSection) {
				this.shapeMouseUp(point, e);
			}
			else {
				this.tableMouseUp(point, e);
			}
		}
	}

	onMouseMove(point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (this.containerObject.isDraggingSomething()) {
			// Show preview in its final position.
			let svg;
			let initialPosition;
			if (this.sectionProperties.parentHandlerSection) {
				this.sectionProperties.parentHandlerSection.showSVG();
				svg = this.sectionProperties.parentHandlerSection.sectionProperties.svg;
				initialPosition = this.sectionProperties.parentHandlerSection.sectionProperties.svgPosition;
			}
			else {
				// Table..
				svg = document.getElementById('canvas-container').querySelector('svg');
				svg.style.display = '';
				if (!this.sectionProperties.initialPosition) {
					this.sectionProperties.initialPosition = [parseFloat(svg.style.left.replace('px', '')), parseFloat(svg.style.top.replace('px', ''))];
				}
				initialPosition = this.sectionProperties.initialPosition;
			}
			svg.style.left = (dragDistance[0] + initialPosition[0]) / app.dpiScale + 'px';
			svg.style.top = (dragDistance[1] + initialPosition[1]) / app.dpiScale + 'px';

			this.stopPropagating();
			e.stopPropagation();
		}
	}
}

app.definitions.shapeHandleAnchorSubSection = ShapeHandleAnchorSubSection;
