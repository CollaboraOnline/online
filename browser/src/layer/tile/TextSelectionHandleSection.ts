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

	onDrag(point: number[], dragDistance: number[], e: MouseEvent) {
		(<any>window).IgnorePanning = true;
		this.setPosition(point[0], point[1]);
		app.map.fire('handleautoscroll', {pos: { x: point[0] / app.dpiScale, y: point[1] / app.dpiScale }, map: app.map});
	}

	setOpacity(value: number) {
		this.getHTMLObject().style.opacity = value;
	}

	onDragEnd(point: number[], e: MouseEvent) {
		(<any>window).IgnorePanning = undefined;

		app.map.fire('scrollvelocity', {vx: 0, vy: 0});

		if (this.name === 'selection_start_handle') {
			app.map._docLayer._postSelectTextEvent('start', point[0] * app.pixelsToTwips, point[1] * app.pixelsToTwips);
		}
		else if (this.name === 'selection_end_handle') {
			app.map._docLayer._postSelectTextEvent('end', point[0] * app.pixelsToTwips, point[1] * app.pixelsToTwips);
		}
	}

	onMouseMove(point: number[], dragDistance: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			this.onDrag(point, dragDistance, e);
		}
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.containerObject.isDraggingSomething()) {
			this.onDragEnd(point, e);
		}
	}
}

app.definitions.textSelectionHandleSection = TextSelectionHandle;
