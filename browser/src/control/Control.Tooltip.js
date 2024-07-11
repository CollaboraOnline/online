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

/*
 * Class Tooltip - tooltip manager
 */

/* global */

class Tooltip {
	constructor(options) {
		this._options = L.extend({ timeout: 150 }, options);
		this._container = L.DomUtil.create('div', 'cooltip-text', document.body);
		this._container.id = 'cooltip';
		this._container.addEventListener(
			'mouseenter',
			L.bind(this.mouseEnter, this),
		);
		this._container.addEventListener(
			'mouseleave',
			L.bind(this.mouseLeave, this),
		);
	}

	beginShow(elem) {
		if (this._cancel) return;

		clearTimeout(this._showTimeout);
		this._showTimeout = setTimeout(
			L.bind(this.show, this, elem),
			this._options.timeout,
		);
	}

	beginHide(elem) {
		if (this._cancel) return;

		clearTimeout(this._hideTimeout);
		if (this._current)
			this._hideTimeout = setTimeout(
				L.bind(this.hide, this, elem),
				this._options.timeout,
			);
	}

	/**
	 * Calculate one of the 8 different position
	 * of the tooltip, around the elem parameter
	 *
	 * - bottom-right, bottom-left, top-right, top-left
	 * - and their left/right aligned versions
	 *
	 * @param elem - element that the cursor is over
	 * @param popup - tooltip rectangle
	 * @param index - used to determine one of the 8 tooltip location
	 * @returns tooltip rectangle with its location calculated
	 */
	position(elem, popup, index) {
		let rect = new DOMRect();
		switch (index) {
			case 0: // below cursor, bottom-right (aligned to left)
				rect.x = elem.left;
				rect.y = elem.bottom + 12;
				break;
			case 1: // below cursor, bottom-left (aligned to right)
				rect.x = elem.right - popup.width;
				rect.y = elem.bottom + 12;
				break;
			case 2: // above cursor, top-right (aligned to left)
				rect.x = elem.left;
				rect.y = elem.top - popup.height - 8;
				break;
			case 3: // above cursor, top-left (aligned to right)
				rect.x = elem.right - popup.width;
				rect.y = elem.top - popup.height - 8;
				break;
			case 4: // below cursor, bottom-right
				rect.x = elem.right;
				rect.y = elem.bottom + 4;
				break;
			case 5: // below cursor, bottom-left
				rect.x = elem.left - popup.width;
				rect.y = elem.bottom + 4;
				break;
			case 6: // above cursor, top-right
				rect.x = elem.right;
				rect.y = elem.top - popup.height - 4;
				break;
			case 7: // above cursor, top-left
				rect.x = elem.left - popup.width;
				rect.y = elem.top - popup.height - 4;
				break;
			default:
				break;
		}

		rect.width = popup.width;
		rect.height = popup.height;

		return rect;
	}

	show(elem) {
		let content = elem.dataset.cooltip,
			rectView = new DOMRect(0, 0, window.innerWidth, window.innerHeight),
			rectElem = elem.getBoundingClientRect(),
			rectCont,
			rectTooltip,
			index = 0;

		this._container.textContent = content;
		if (!this._container.textContent) return;

		rectCont = this._container.getBoundingClientRect();

		do {
			rectTooltip = this.position(rectElem, rectCont, index++);
		} while (index < 8 && !L.LOUtil.containsDOMRect(rectView, rectTooltip));
		// containsDOMRect() checks if the tooltip box(rectTooltip) is inside the boundaries of the window(rectView)

		this._container.style.left = rectTooltip.left + 'px';
		this._container.style.top = rectTooltip.top + 'px';
		this._container.style.visibility = 'visible';
		this._current = elem;
	}

	hide() {
		if (this._cancel) return;

		this._container.style.visibility = 'hidden';
		this._current = null;
	}

	mouseEnter() {
		if (this._current) {
			this._cancel = true;
			clearTimeout(this._hideTimeout);
			clearTimeout(this._showTimeout);
		}
	}

	mouseLeave() {
		this._cancel = false;
		this.beginHide();
	}
}

L.control.tooltip = function (options) {
	return new Tooltip(options);
};
