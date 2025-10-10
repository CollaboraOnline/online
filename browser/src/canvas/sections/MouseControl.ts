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
	borderColor: string = 'green';
	boundToSection: string = app.CSections.Tiles.name;

	mouseMoveTimer: any | null = null;
	currentPosition: cool.SimplePoint = new cool.SimplePoint(0, 0);

	constructor(name: string) {
		super(name);
	}

	private readModifier(e: MouseEvent) {
		let modifier = 0;
		const shift = e.shiftKey ? app.UNOModifier.SHIFT : 0;
		const ctrl = e.ctrlKey ? app.UNOModifier.CTRL : 0;
		const alt = e.altKey ? app.UNOModifier.ALT : 0;
		const cmd = e.metaKey ? app.UNOModifier.CTRLMAC : 0;
		modifier = shift | ctrl | alt | cmd;

		return modifier;
	}

	private readButtons(e: MouseEvent) {
		let buttons = 0;
		buttons |= e.button === app.JSButtons.left ? app.LOButtons.left : 0;
		buttons |= e.button === app.JSButtons.middle ? app.LOButtons.middle : 0;
		buttons |= e.button === app.JSButtons.right ? app.LOButtons.right : 0;

		return buttons;
	}

	public onContextMenu(e: MouseEvent): void {
		const buttons = app.LOButtons.right;
		const modifier = this.readModifier(e);
		if (modifier === 0) {
			app.map._docLayer._postMouseEvent(
				'buttondown',
				this.currentPosition.x,
				this.currentPosition.y,
				1,
				buttons,
				modifier,
			);
		}
	}

	// Gets the mouse position on browser page in CSS pixels.
	public getMousePagePosition() {
		const boundingClientRectangle = this.context.canvas.getBoundingClientRect();
		return {
			x: this.currentPosition.cX + boundingClientRectangle.left,
			y: this.currentPosition.cY + boundingClientRectangle.top,
		};
	}

	public onMouseMove(
		point: cool.SimplePoint,
		dragDistance: Array<number>,
		e: MouseEvent,
	): void {
		this.currentPosition.pX =
			app.activeDocument.activeView.viewedRectangle.pX1 + point.pX;
		this.currentPosition.pY =
			app.activeDocument.activeView.viewedRectangle.pY1 + point.pY;

		clearTimeout(this.mouseMoveTimer);

		this.mouseMoveTimer = setTimeout(() => {
			app.map._docLayer._postMouseEvent(
				'move',
				this.currentPosition.x,
				this.currentPosition.y,
				1,
				0,
				this.readModifier(e),
			);
		}, 100);
	}

	onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		TileManager.resetPreFetching(false);
	}

	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		console.error('onmouseup');
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
