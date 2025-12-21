/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// window.L.DomUtil contains various utility functions for working with
// DOM.

class DomUtilBase {
	public static get(
		id: string | null,
		document: Document = window.document,
	): HTMLElement | null {
		return typeof id === 'string' ? document.getElementById(id) : id;
	}

	public static getStyle(
		el: HTMLElement,
		style: string,
		document: Document = window.document,
	): string | null {
		let value: string | null =
			el.style.getPropertyValue(style) ||
			((el as any).currentStyle && (el as any).currentStyle[style]);

		if ((!value || value === 'auto') && document.defaultView) {
			const css = document.defaultView.getComputedStyle(el, null);
			value = css ? css.getPropertyValue(style) : null;
		}

		return value === 'auto' ? null : value;
	}

	public static setStyle(el: HTMLElement, style: string, value: string) {
		if (el !== undefined) el.style.setProperty(style, value);
	}

	public static create(
		tagName: string,
		className: string,
		container?: HTMLElement,
		document: Document = window.document,
	) {
		const el = document.createElement(tagName);
		el.className = className;

		if (container) {
			container.appendChild(el);
		}

		return el;
	}
}
