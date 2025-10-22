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
	localPositionOnMouseDown: cool.SimplePoint | null = null;
	mouseDownSent: boolean = false;

	inSwipeAction: boolean = false;
	swipeVelocity: number[] = [0, 0];
	swipeTimeStamp: number = 0;
	amplitude: number[] = [0, 0];
	touchstart: number = 0;

	pinchStartCenter: any;
	zoom: any;
	origCenter: any;
	pinchLength: number = 0;

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

	public onContextMenu(point: cool.SimplePoint, e: MouseEvent): void {
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
		const pagePosition = this.currentPosition.clone();
		pagePosition.pX -= app.activeDocument.activeView.viewedRectangle.pX1;
		pagePosition.pY -= app.activeDocument.activeView.viewedRectangle.pY1;
		return {
			x: pagePosition.cX + boundingClientRectangle.left,
			y: pagePosition.cY + boundingClientRectangle.top,
		};
	}

	// This useful when a section handles the event but wants to set the document mouse position.
	public setMousePosition(point: cool.SimplePoint) {
		this.currentPosition = point.clone();
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
			const textCursor = app.file.textCursor.visible && app.calc.cellCursorRectangle.pContainsPoint(this.currentPosition.pToArray());

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

	private cancelSwipe() {
		this.inSwipeAction = false;
		this.containerObject.stopAnimating();
	}

	onDraw(frameCount?: number, elapsedTime?: number): void {
		if (this.inSwipeAction && this.containerObject.getAnimatingSectionName() === this.name) {
			const elapsed = Date.now() - this.swipeTimeStamp;
			const delta = [this.amplitude[0] * Math.exp(-elapsed / 650), this.amplitude[1] * Math.exp(-elapsed / 650)];

			if (Math.abs(delta[0]) > 0.2 || Math.abs(delta[1]) > 0.2) {
				app.activeDocument.activeView.scrollTo(app.activeDocument.activeView.viewedRectangle.pX1 + delta[0], app.activeDocument.activeView.viewedRectangle.pY1 + delta[1]);
				app.sectionContainer.requestReDraw();
			}
			else
				this.cancelSwipe();
		}
	}

	// Comment from original author:
	/*
		Code and maths for the ergonomic scrolling is inspired by formulas at
		https://ariya.io/2013/11/javascript-kinetic-scrolling-part-2
		Some constants are changed based on the testing/experimenting/trial-error
	*/
	private swipe(e: any): void {
		const velocityX = app.map._docLayer.isCalcRTL() ? -e.velocityX : e.velocityX;
		const pointVelocity = [velocityX, e.velocityY];

		if (this.inSwipeAction) {
			this.swipeVelocity[0] += pointVelocity[0];
			this.swipeVelocity[1] += pointVelocity[1];
		}
		else {
			this.swipeVelocity = pointVelocity;
			this.inSwipeAction = true;
		}

		this.amplitude = [this.swipeVelocity[0] * 0.1, this.swipeVelocity[1] * 0.1];
		this.swipeTimeStamp = Date.now();

		this.startAnimating({ defer: true });

		app.idleHandler.notifyActive();
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
		}
		else if (e.type === 'touchmove' && this.positionOnMouseDown) {
			// For non-touch events, we can select text etc, so we send the mouse button events to core while dragging.
			// Users can scroll the view using keyboard or mouse wheel, or the scroll bars in those devices.
			// On touch devices, dragging (touchmove) is used to scroll the view.
			// We don't send the mouse button down and up events to core while dragging (touchmove). Instead, we scroll the view.
			const diff = this.currentPosition.clone();
			diff.x -= this.positionOnMouseDown.x;
			diff.y -= this.positionOnMouseDown.y;

			const viewedRectangle = app.activeDocument.activeView.viewedRectangle.clone();

			// Use scrollTo, or repeating events break the scrolling.
			app.activeDocument.activeView.scrollTo(viewedRectangle.pX1 - diff.pX, viewedRectangle.pY1 - diff.pY);
		}
		else {
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

		if (e.type === 'touchstart') { // For swipe action.
			this.localPositionOnMouseDown = point.clone();
			this.touchstart = Date.now();
		}
	}

	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		this.refreshPosition(point);

		if (this.mouseDownSent) {
			app.map._docLayer._postMouseEvent(
				'buttonup',
				this.currentPosition.x,
				this.currentPosition.y,
				1,
				this.readButtons(e),
				this.readModifier(e),
			);
		}
		else if (e.type === 'touchend' && this.localPositionOnMouseDown) { // For swipe action.
			const diff = new cool.SimplePoint(this.localPositionOnMouseDown.x - point.x, this.localPositionOnMouseDown.y - point.y);
			const timeDiff = Date.now() - this.touchstart;

			if (timeDiff < 200 && (Math.abs(diff.cX) > 5 || Math.abs(diff.cY) > 5))
				this.swipe({ velocityX: diff.pX, velocityY: diff.pY });
			else if (this.containerObject.getAnimatingSectionName() === this.name)
				this.cancelSwipe();

			this.localPositionOnMouseDown = null;
		}

		this.positionOnMouseDown = null;
		this.mouseDownSent = false;

		if (this.containerObject.isDraggingSomething())
			app.map.focus();
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
			app.map.focus();
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

	onMultiTouchStart(e: TouchEvent): void {
		if (this.inSwipeAction)
			this.containerObject.stopAnimating();

		if (e.touches.length !== 2)
			return;

		const centerX = Math.round((e.touches[0].clientX + e.touches[1].clientX) * 0.5);
		const centerY = Math.round((e.touches[0].clientY + e.touches[1].clientY) * 0.5);

		if (isNaN(centerX) || isNaN(centerY))
			return;

		this.pinchLength = Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY , 2));

		this.pinchStartCenter = { x: centerX, y: centerY };
		const _pinchStartLatLng = app.map.mouseEventToLatLng({ clientX: centerX, clientY: centerY });
		app.map._docLayer.preZoomAnimation(_pinchStartLatLng);
	}

	onMultiTouchMove(point: cool.SimplePoint, dragDistance: number, e: TouchEvent): void {
		const centerX = Math.round((e.touches[0].clientX + e.touches[1].clientX) * 0.5);
		const centerY = Math.round((e.touches[0].clientY + e.touches[1].clientY) * 0.5);

		if (!this.pinchStartCenter || isNaN(centerX) || isNaN(centerY))
			return;

		// we need to invert the offset or the map is moved in the opposite direction
		var offset = { x: centerX - this.pinchStartCenter.x, y: centerY - this.pinchStartCenter.y };
		var center = { x: this.pinchStartCenter.x - offset.x, y: this.pinchStartCenter.y - offset.y };

		const newPinchLength = Math.sqrt(Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) + Math.pow(e.touches[0].clientY - e.touches[1].clientY , 2));
		const diff = newPinchLength - this.pinchLength;
		this.zoom = app.map.getZoom() + diff * 0.01;
		this.zoom = app.map._limitZoom(this.zoom);

		this.origCenter = app.map.mouseEventToLatLng({ clientX: center.x, clientY: center.y });

		if (app.map._docLayer.zoomStep)
			app.map._docLayer.zoomStep(this.zoom, this.origCenter);

		app.idleHandler.notifyActive();
	}

	onMultiTouchEnd(e: TouchEvent): void {
		var oldZoom = app.map.getZoom();
		var zoomDelta = this.zoom - oldZoom;
		var finalZoom = app.map._limitZoom(zoomDelta > 0 ? Math.ceil(this.zoom) : Math.floor(this.zoom));

		this.pinchStartCenter = undefined;

		if (app.map._docLayer.zoomStepEnd) {
			app.map._docLayer.zoomStepEnd(finalZoom, this.origCenter,
				function (newMapCenter: any) { // mapUpdater
					app.map.setView(newMapCenter, finalZoom);
				},
				// showMarkers
				function () {
					app.map._docLayer.postZoomAnimation();
				});
		}
	}
}
