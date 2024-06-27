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

	position(elem, popup, index) {
		let rect = new DOMRect();
		switch (index) {
			case 0:
				rect.x = elem.left + elem.width / 2 - popup.width / 2;
				rect.y = elem.bottom;
				break;
			case 1:
				rect.x = elem.right;
				rect.y = elem.top + elem.height / 2 - popup.height / 2;
				break;
			case 2:
				rect.x = elem.left + elem.width / 2 - popup.width / 2;
				rect.y = elem.top;
				break;
			case 3:
				rect.x = elem.left;
				rect.y = elem.top + elem.height / 2 - popup.height / 2;
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
			rect,
			index = 0;

		this._container.textContent = content;
		if (!this._container.textContent) return;

		rectCont = this._container.getBoundingClientRect();

		do {
			rect = this.position(rectElem, rectCont, index++);
		} while (index < 4 && !L.LOUtil.containsDOMRect(rectView, rect));

		this._container.style.left = rect.left + 'px';
		this._container.style.top = rect.top + 'px';
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
