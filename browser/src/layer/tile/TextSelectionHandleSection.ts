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

class TextSelectionHandle extends HTMLObjectSection {

	constructor (sectionName: string, objectWidth: number, objectHeight: number, documentPosition: cool.SimplePoint,  extraClass: string = "", visible: boolean = true) {
		super(sectionName, objectWidth, objectHeight, documentPosition, extraClass, visible);
	}

	onDrag(point: number[]) {
		(<any>window).IgnorePanning = true;
		const candidateX = Math.round((this.myTopLeft[0] + point[0]) / app.dpiScale);
		const candidateY = Math.round((this.myTopLeft[1] + point[1]) / app.dpiScale);

		this.sectionProperties.objectDiv.style.left = candidateX + 'px';
		this.sectionProperties.objectDiv.style.top = candidateY + 'px';

		app.map.fire('handleautoscroll', {pos: { x: candidateX, y: candidateY }, map: app.map});
	}

	setOpacity(value: number) {
		this.getHTMLObject().style.opacity = value;
	}

	onDragEnd(point: number[]) {
		(<any>window).IgnorePanning = undefined;

		let x = this.position[0] + point[0];
		const y = this.position[1] + point[1];
		this.setPosition(x, y);

		app.map.fire('scrollvelocity', {vx: 0, vy: 0});
		const type = this.name === 'selection_start_handle' ? 'start' : 'end';

		if (type === 'start')
			x += 30 / app.dpiScale;

		if (!app.map._docLayer.isCalcRTL()) {
			app.map._docLayer._postSelectTextEvent(type, Math.round(x * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
		}
		else {
			const referenceX = app.file.viewedRectangle.pX1 + (app.file.viewedRectangle.pX2 - this.position[0]);
			app.map._docLayer._postSelectTextEvent(type, Math.round(referenceX * app.pixelsToTwips), Math.round(y * app.pixelsToTwips));
		}
	}

	onMouseMove(point: number[], dragDistance: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			this.onDrag(point);
		}
	}

	onClick(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
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

app.definitions.textSelectionHandleSection = TextSelectionHandle;
