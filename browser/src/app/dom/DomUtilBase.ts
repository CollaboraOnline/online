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
		doc: Document = window.document,
	): HTMLElement | null {
		return typeof id === 'string' ? doc.getElementById(id) : id;
	}

	public static getStyle(
		el: HTMLElement,
		style: string,
		doc: Document = window.document,
	): string | null {
		let value: string | null =
			el.style.getPropertyValue(style) ||
			((el as any).currentStyle && (el as any).currentStyle[style]);

		if ((!value || value === 'auto') && doc.defaultView) {
			const css = doc.defaultView.getComputedStyle(el, null);
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
		data?: any,
		doc: Document = window.document,
	) {
		const el = doc.createElement(tagName);
		el.className = className;

		if (container) {
			container.appendChild(el);
		}

		return el;
	}

	public static createWithId(
		tagName: string,
		id: string,
		container?: HTMLElement,
		data?: any,
		doc: Document = window.document,
	) {
		const el = doc.createElement(tagName);
		el.id = id;

		if (container) {
			container.appendChild(el);
		}

		return el;
	}

	public static remove(el?: HTMLElement): void {
		if (!el) {
			return;
		}

		const parent = el.parentNode;
		if (parent) {
			parent.removeChild(el);
		}
	}
}
