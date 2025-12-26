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

	// needed for initializing some static data members and functions.
	private static testProp(props: string[]): string | undefined {
		const style = document.documentElement.style;

		for (let i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return undefined;
	}

	public static setTransform(
		el: HTMLElement,
		offset?: cool.Point,
		scale?: number,
	): void {
		const pos = offset || new cool.Point(0, 0);

		Util.ensureValue(DomUtilBase.TRANSFORM);
		el.style.setProperty(
			DomUtilBase.TRANSFORM,
			'translate3d(' +
				pos.x +
				'px,' +
				pos.y +
				'px' +
				',0)' +
				(scale ? ' scale(' + scale + ')' : ''),
		);
	}

	public static setPosition(
		el: HTMLElement,
		point: cool.Point,
		no3d: boolean = false,
	): void {
		(el as any)._leaflet_pos = point;

		Util.ensureValue(window.L);
		if (window.L.Browser.any3d && !no3d) {
			DomUtilBase.setTransform(el, point);
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	}

	public static getPosition(el: HTMLElement): cool.Point {
		// this method is only used for elements previously positioned using setPosition,
		// so it's safe to cache the position for performance

		return (el as any)._leaflet_pos;
	}

	public static isPortrait(): boolean {
		return (
			window.matchMedia && window.matchMedia('(orientation: portrait)').matches
		);
	}

	// Add/remove a portrait or landscape class from the list of elements.
	public static updateElementsOrientation(elements: string[]): void {
		let remove = 'portrait';
		let add = 'landscape';
		if (DomUtilBase.isPortrait()) {
			remove = 'landscape';
			add = 'portrait';
		}

		for (let i = 0; i < elements.length; ++i) {
			const element = elements[i];
			const domElement = DomUtilBase.get(element);
			if (domElement) {
				DomUtilBase.removeClass(domElement, remove);
				DomUtilBase.addClass(domElement, add);
			} else {
				app.console.warn(
					'updateElementsOrientation(): Cannot find element with id = ' +
						element,
				);
			}
		}
	}

	// prefix style property names
	public static TRANSFORM?: string = DomUtilBase.testProp([
		'transform',
		'WebkitTransform',
		'OTransform',
		'MozTransform',
		'msTransform',
	]);

	public static TRANSFORM_ORIGIN?: string = DomUtilBase.testProp([
		'transformOrigin',
		'msTransformOrigin',
		'WebkitTransformOrigin',
	]);

	private static getTransitionEnd(): string {
		// webkitTransition comes first because some browser versions that drop vendor prefix don't do
		// the same for the transitionend event, in particular the Android 4.1 stock browser
		const transition = DomUtilBase.testProp([
			'webkitTransition',
			'transition',
			'OTransition',
			'MozTransition',
			'msTransition',
		]);
		return transition === 'webkitTransition' || transition === 'OTransition'
			? transition + 'End'
			: 'transitionend';
	}

	public static TRANSITION_END: string = DomUtilBase.getTransitionEnd();

	private static userSelectProperty = DomUtilBase.testProp([
		'userSelect',
		'WebkitUserSelect',
		'OUserSelect',
		'MozUserSelect',
		'msUserSelect',
	]);

	private static _userSelect: any = undefined;

	private static getDisbleTextSelection(): () => void {
		if ('onselectstart' in document) {
			return () => {
				window.L.DomEvent.on(
					window,
					'selectstart',
					window.L.DomEvent.preventDefault,
				);
			};
		}

		return () => {
			if (DomUtilBase.userSelectProperty) {
				const style = document.documentElement.style;
				DomUtilBase._userSelect = style.getPropertyValue(
					DomUtilBase.userSelectProperty,
				);
				style.setProperty(DomUtilBase.userSelectProperty, 'none');
			}
		};
	}

	public static disableTextSelection = DomUtilBase.getDisbleTextSelection();

	private static getEnableTextSelection(): () => void {
		if ('onselectstart' in document) {
			return () => {
				window.L.DomEvent.off(
					window,
					'selectstart',
					window.L.DomEvent.preventDefault,
				);
			};
		}

		return () => {
			if (DomUtilBase.userSelectProperty) {
				document.documentElement.style.setProperty(
					DomUtilBase.userSelectProperty,
					DomUtilBase._userSelect,
				);
				this._userSelect = undefined;
			}
		};
	}

	public static enableTextSelection = DomUtilBase.getEnableTextSelection();

	public static disableImageDrag(): void {
		window.L.DomEvent.on(window, 'dragstart', window.L.DomEvent.preventDefault);
	}
	public static enableImageDrag(): void {
		window.L.DomEvent.off(
			window,
			'dragstart',
			window.L.DomEvent.preventDefault,
		);
	}

	private static _outlineElement?: HTMLElement;
	private static _outlineStyle: string = 'none';

	public static preventOutline(element: HTMLElement): void {
		DomUtilBase.restoreOutline();
		DomUtilBase._outlineElement = element;
		DomUtilBase._outlineStyle = element.style.outline;
		element.style.outline = 'none';
		window.L.DomEvent.on(window, 'keydown', DomUtilBase.restoreOutline);
	}
	public static restoreOutline(): void {
		if (!DomUtilBase._outlineElement) {
			return;
		}
		DomUtilBase._outlineElement.style.outline = DomUtilBase._outlineStyle;
		DomUtilBase._outlineElement = undefined;
		DomUtilBase._outlineStyle = 'none';
		window.L.DomEvent.off(window, 'keydown', DomUtilBase.restoreOutline);
	}
}
