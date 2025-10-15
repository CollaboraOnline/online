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
	boundToSection: string = app.CSections.Tiles.name;

	mouseMoveTimer: any | null = null;
	clickTimer: any | null = null;
	currentPosition: cool.SimplePoint = new cool.SimplePoint(0, 0);
	clickCount: number = 0;
	positionOnMouseDown: cool.SimplePoint | null = null;
	mouseDownSent: boolean = false;

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

	private refreshPosition(point: cool.SimplePoint) {
		this.currentPosition.pX =
			app.activeDocument.activeView.viewedRectangle.pX1 + point.pX;
		this.currentPosition.pY =
			app.activeDocument.activeView.viewedRectangle.pY1 + point.pY;
	}

	private sendMouseMove(count: number, buttons: number, modifier: number) {
		app.map._docLayer._postMouseEvent(
			'move',
			this.currentPosition.x,
			this.currentPosition.y,
			count,
			buttons,
			modifier,
		);
	}

	private setCursorType() {
		// If we have blinking cursor visible
		// we need to change cursor from default style
		if (app.map._docLayer._cursorMarker)
			app.map._docLayer._cursorMarker.setMouseCursor();
		else if (app.map._docLayer._docType === 'spreadsheet') {
			const textCursor = app.file.textCursor.visible && app.file.textCursor.visible && app.calc.cellCursorRectangle.pContainsPoint(this.currentPosition.pToArray());

			if (textCursor) {
				const change = this.context.canvas.style.cursor !== 'text' || this.context.canvas.classList.contains('spreadsheet-cursor');
				if (change) {
					this.context.canvas.classList.remove('spreadsheet-cursor');
					this.context.canvas.style.cursor = 'text';
				}
			}
			else {
				const change = this.context.canvas.style.cursor !== '' || !this.context.canvas.classList.contains('spreadsheet-cursor');
				if (change) {
					this.context.canvas.style.cursor = '';
					this.context.canvas.classList.add('spreadsheet-cursor');
				}
			}
		}
	}

	public onMouseMove(
		point: cool.SimplePoint,
		dragDistance: Array<number>,
		e: MouseEvent,
	): void {
		this.setCursorType();

		this.refreshPosition(point);

		if (this.clickTimer) return;

		clearTimeout(this.mouseMoveTimer);

		const count = 1;
		const buttons = this.readButtons(e);
		const modifier = this.readModifier(e);

		if (!this.containerObject.isDraggingSomething()) {
			this.mouseMoveTimer = setTimeout(() => {
				this.sendMouseMove(count, buttons, modifier);
			}, 100);
		} else {
			if (!this.mouseDownSent && this.positionOnMouseDown) {
				app.map._docLayer._postMouseEvent(
					'buttondown',
					this.positionOnMouseDown.x,
					this.positionOnMouseDown.y,
					count,
					buttons,
					modifier,
				);
				this.mouseDownSent = true;
			}

			this.sendMouseMove(count, buttons, modifier);
		}
	}

	onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		this.refreshPosition(point);
		this.positionOnMouseDown = this.currentPosition.clone();
	}

	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		this.refreshPosition(point);

		if (this.mouseDownSent)
			app.map._docLayer._postMouseEvent(
				'buttonup',
				this.currentPosition.x,
				this.currentPosition.y,
				1,
				this.readButtons(e),
				this.readModifier(e),
			);

		this.positionOnMouseDown = null;
		this.mouseDownSent = false;
	}

	onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		if (app.map._docLayer._docType === 'spreadsheet') {
			this.context.canvas.classList.add('spreadsheet-cursor');
		}
		this.context.canvas.style.cursor = '';
	}

	onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		// Normally, we don't change the cursor style on mouse leave.
		// That is responsibility of the new target section.
		// But this is a class name and we need to remove it.
		if (app.map._docLayer._docType === 'spreadsheet') {
			this.context.canvas.classList.remove('spreadsheet-cursor');
		}
	}

	onMouseWheel(
		point: cool.SimplePoint,
		delta: Array<number>,
		e: WheelEvent,
	): void {
		console.log('onmousewheel');
	}

	onClick(point: cool.SimplePoint, e: MouseEvent): void {
		app.map.fire('closepopups');

		this.refreshPosition(point);
		this.clickCount++;

		const buttons = this.readButtons(e);
		const modifier = this.readModifier(e);
		const sendingPosition = this.currentPosition.clone();

		if (this.clickTimer) clearTimeout(this.clickTimer);
		else { // Old code always sends the first click, so do we.
			app.map._docLayer._postMouseEvent('buttondown', sendingPosition.x, sendingPosition.y, 1, buttons, modifier);
			app.map._docLayer._postMouseEvent('buttonup', sendingPosition.x, sendingPosition.y, 1, buttons, modifier);
		}

		this.clickTimer = setTimeout(() => {
			app.map._docLayer._postMouseEvent(
				'buttondown',
				sendingPosition.x,
				sendingPosition.y,
				this.clickCount,
				buttons,
				modifier,
			);
			app.map._docLayer._postMouseEvent(
				'buttonup',
				sendingPosition.x,
				sendingPosition.y,
				this.clickCount,
				buttons,
				modifier,
			);
			this.clickTimer = null;
			this.clickCount = 0;
		}, 250);
	}
}
