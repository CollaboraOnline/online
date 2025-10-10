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
	MouseControl class is for handling mouse events if no other section (bound to tiles)
	handles it. This section is responsible for sending events to core side.
	This section is bound to tiles section. Tiles section represents the document view.
	Since this MouseControl class will handle mouse events that need to be sent to the core side,
	binding this class to tiles is normal. This class shouldn't cover all the canvas but only the document area.
*/

class MouseControl extends CanvasSectionObject {
	zIndex: number = app.CSections.MouseControl.zIndex;
	drawingOrder: number = app.CSections.MouseControl.drawingOrder;
	processingOrder: number = app.CSections.MouseControl.processingOrder;
	borderColor: string = 'dark green';
	boundToSection: string = app.CSections.Tiles.name;

	onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		console.error('onmousedown');
	}

	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		console.error('onmouseup');
	}

	onMouseMove(
		point: cool.SimplePoint,
		dragDistance: Array<number>,
		e: MouseEvent,
	): void {
		console.error('onmousemove');
	}

	onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		console.error('onmouseenter');
	}

	onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		console.error('onmouseleave');
	}

	onMouseWheel(
		point: cool.SimplePoint,
		delta: Array<number>,
		e: WheelEvent,
	): void {
		console.error('onmousewheel');
	}
}
