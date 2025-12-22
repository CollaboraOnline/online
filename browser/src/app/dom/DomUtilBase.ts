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

	public static empty(el: HTMLElement): void {
		while (el.firstChild) {
			el.removeChild(el.firstChild);
		}
	}

	public static getClass(el: HTMLElement): string {
		const baseVal = (el.className as any).baseVal;
		return baseVal === undefined ? el.className : baseVal;
	}

	public static hasClass(el: HTMLElement, name: string): boolean {
		if (el.classList !== undefined) {
			return el.classList.contains(name);
		}
		const className = DomUtilBase.getClass(el);
		return (
			className.length > 0 &&
			new RegExp('(^|\\s)' + name + '(\\s|$)').test(className)
		);
	}

	public static setClass(el: HTMLElement, name: string): void {
		if ((el.className as any).baseVal === undefined) {
			el.className = name;
		} else {
			// in case of SVG element
			(el.className as any).baseVal = name;
		}
	}

	public static addClass(el: HTMLElement, name: string): void {
		if (!el) {
			return;
		}

		if (el.classList !== undefined) {
			const classes = app.util.splitWords(name);
			for (let i = 0, len = classes.length; i < len; i++) {
				el.classList.add(classes[i]);
			}
		} else if (!DomUtilBase.hasClass(el, name)) {
			const className = DomUtilBase.getClass(el);
			DomUtilBase.setClass(el, (className ? className + ' ' : '') + name);
		}
	}

	public static removeClass(el: HTMLElement, name: string): void {
		if (!el) {
			return;
		}

		if (el.classList !== undefined) {
			el.classList.remove(name);
		} else {
			DomUtilBase.setClass(
				el,
				app.util.trim(
					(' ' + DomUtilBase.getClass(el) + ' ').replace(' ' + name + ' ', ' '),
				),
			);
		}
	}

	public static removeChildNodes(el: HTMLElement): void {
		while (el.hasChildNodes()) {
			Util.ensureValue(el.lastChild);
			el.removeChild(el.lastChild);
		}
	}

	public static setOpacity(el: HTMLElement, value: number | string): void {
		if ('opacity' in el.style) {
			el.style.opacity = String(value);
		} else if ('filter' in el.style) {
			DomUtilBase._setOpacityIE(el, +value);
		}
	}

	private static _setOpacityIE(el: HTMLElement, value: number): void {
		let filter = undefined;
		const filterName = 'DXImageTransform.Microsoft.Alpha';

		// filters collection throws an error if we try to retrieve a filter that doesn't exist
		try {
			filter = (el as any).filters.item(filterName);
		} catch (e: any) {
			// don't set opacity to 1 if we haven't already set an opacity,
			// it isn't needed and breaks transparent pngs.
			if (value === 1) {
				return;
			}
		}

		value = Math.round(value * 100);

		if (filter) {
			filter.Enabled = value !== 100;
			filter.Opacity = value;
		} else {
			el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
		}
	}
}
