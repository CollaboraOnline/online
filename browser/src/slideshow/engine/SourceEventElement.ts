/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// TODO:
// need to have access to canvas element for setting cursor style
// need to also the layer with the object that triggers the event
// maybe later rename to LayerEventSource
class SourceEventElement implements MouseClickHandler {
	private sId: string;
	private aSlideShow: SlideShowHandler = null;
	private aElement: any;
	private aEventMultiplexer: EventMultiplexer;
	private bClickHandled = false;
	private bIsPointerOver = false;

	constructor(
		sId: string,
		aSlideShow: SlideShowHandler,
		aElement: any,
		aEventMultiplexer: EventMultiplexer,
	) {
		this.sId = sId;
		this.aSlideShow = aSlideShow;
		this.aElement = aElement;
		this.aEventMultiplexer = aEventMultiplexer;

		// TODO: still make sense ?
		this.aEventMultiplexer.registerMouseClickHandler(this, 1000);
		// TODO handle mouseover, mouseout event for aElement
	}

	getId() {
		return this.sId;
	}

	isOver(cursorX: number, cursorY: number): boolean {
		// TODO check if cursor is over source event object
		window.app.console.log('isOver: x: ' + cursorX + ', y: ' + cursorY);
		return false;
	}

	onMouseEnter() {
		this.bIsPointerOver = true;
		this.setPointerCursor();
	}

	onMouseLeave() {
		this.bIsPointerOver = false;
		this.setDefaultCursor();
	}

	charge() {
		this.bClickHandled = false;
		this.setPointerCursor();
	}

	handleClick(/*aMouseEvent*/) {
		if (!this.bIsPointerOver) return false;

		if (this.bClickHandled) return false;

		this.aEventMultiplexer.notifyEvent(EventTrigger.OnClick, this.getId());
		this.aSlideShow.update();
		this.bClickHandled = true;
		this.setDefaultCursor();
		return true;
	}

	setPointerCursor() {
		if (this.bClickHandled) return;

		// TODO set style cursor to 'cursor: pointer'
	}

	setDefaultCursor() {
		// TODO set style cursor to 'cursor: default'
	}
}
