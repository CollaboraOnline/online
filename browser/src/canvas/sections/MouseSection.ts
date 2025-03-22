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
    Aim is to handle mouse and touch events and send them to core side. Relies on CanvasSectionContainer's event propagation.
    Is bound to tiles section, since it represents the document area.
*/
class MouseSection extends CanvasSectionObject {
	constructor() {
		super();

		this.interactable = true;
		(this.name = L.CSections.Mouse.name), (this.anchor = ['top', 'left']);
		(this.processingOrder = L.CSections.Mouse.processingOrder), // Size and position will be copied (boundSection), this value is not important.
			(this.drawingOrder = L.CSections.Mouse.drawingOrder),
			(this.zIndex = L.CSections.Mouse.zIndex),
			(this.boundToSection = 'tiles');

		this.sectionProperties.LOButtons = {
			left: 1,
			middle: 2,
			right: 4,
		};

		this.sectionProperties.JSButtons = {
			left: 0,
			middle: 1,
			right: 2,
		};
	}

	private initialChecks() {
		if (app.map.uiManager.isUIBlocked() || app.map.dontHandleMouse)
			return false;

		app.idleHandler.notifyActive();

		const docLayer = app.map._docLayer;
		if (
			!docLayer ||
			app.map.rulerActive ||
			(app.map.slideShow && app.map.slideShow.fullscreen) ||
			(app.map.slideShowPresenter && app.map.slideShowPresenter.isFullscreen())
		) {
			return false;
		}

		return true;
	}

	private getModifierAndButtons(e: any) {
		const shift = e.shiftKey ? UNOModifier.SHIFT : 0;
		const ctrl = e.ctrlKey ? UNOModifier.CTRL : 0;
		const alt = e.altKey ? UNOModifier.ALT : 0;
		const cmd = e.metaKey ? UNOModifier.CTRLMAC : 0;
		let modifier = shift | ctrl | alt | cmd;

		let buttons = 0;
		buttons |=
			e.button === this.sectionProperties.JSButtons.left
				? this.sectionProperties.LOButtons.left
				: 0;
		buttons |=
			e.button === this.sectionProperties.JSButtons.middle
				? this.sectionProperties.LOButtons.middle
				: 0;
		buttons |=
			e.button === this.sectionProperties.JSButtons.right
				? this.sectionProperties.LOButtons.right
				: 0;

		// Turn ctrl-left-click into right-click for browsers on macOS
		if (L.Browser.mac) {
			if (
				modifier == UNOModifier.CTRL &&
				buttons == this.sectionProperties.LOButtons.left
			) {
				modifier = 0;
				buttons = this.sectionProperties.LOButtons.right;
			}
		}

		return [modifier, buttons];
	}

	private convertLocalViewPointToTwips(xy: number[]) {
		return MultiPageViewLayout.viewPixelsToTwips(
			xy[0] + this.myTopLeft[0], // + app.file.viewedRectangle.pX1,
			xy[1] + this.myTopLeft[1], // + app.file.viewedRectangle.pY1
		);
	}

	private sendClick(point: Array<number>, e: MouseEvent, count: number) {
		if (!this.initialChecks()) return;

		const [modifier, buttons] = this.getModifierAndButtons(e);

		const [x, y] = this.convertLocalViewPointToTwips(point);

		app.map._docLayer._postMouseEvent(
			'buttondown',
			x,
			y,
			count,
			buttons,
			modifier,
		);
		app.map._docLayer._postMouseEvent(
			'buttonup',
			x,
			y,
			count,
			buttons,
			modifier,
		);
	}

	onDoubleClick(point: Array<number>, e: MouseEvent): void {
		this.sendClick(point, e, 2);
	}

	onClick(point: Array<number>, e: MouseEvent): void {
		this.sendClick(point, e, 1);
	}

	onMouseMove(
		point: Array<number>,
		dragDistance: Array<number>,
		e: MouseEvent,
	): void {
		if (!this.initialChecks) return;

		const [x, y] = this.convertLocalViewPointToTwips(point);
		const [modifier, buttons] = this.getModifierAndButtons(e);

		if (this.containerObject.isDraggingSomething()) {
			// Implement..
		} else {
			app.map._docLayer._postMouseEvent('move', x, y, 1, 0, modifier);
		}
	}
}
