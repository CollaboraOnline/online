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

/*
 * window.L.DomEvent contains functions for working with DOM events.
 */

type DomEventHandler = (e: Event) => void;
interface DomEventHandlerObject {
	[name: string]: DomEventHandler;
}

const eventsKey = '_browser_events';

class DomEvent {
	public static on(
		obj: any,
		types: string | DomEventHandlerObject,
		fn?: DomEventHandler | any,
		context?: any,
	): typeof DomEvent {
		if (typeof types === 'object') {
			for (const type in types) {
				this._on(obj, type, types[type], fn);
			}
		} else {
			const typeList = app.util.splitWords(types);
			const len = typeList.length;
			for (let i = 0; i < len; i++) {
				this._on(obj, typeList[i], fn, context);
			}
		}

		return this;
	}

	public static off(
		obj: any,
		types: string | DomEventHandlerObject,
		fn?: DomEventHandler | any,
		context?: any,
	): typeof DomEvent {
		if (typeof types === 'object') {
			for (const type in types) {
				this._off(obj, type, types[type], fn);
			}
		} else {
			const typeList = app.util.splitWords(types);
			const len = typeList.length;

			for (let i = 0; i < len; i++) {
				this._off(obj, types[i], fn, context);
			}
		}

		return this;
	}

	private static _on(
		obj: any,
		type: string,
		fn: DomEventHandler,
		context: any,
	): typeof DomEvent {
		const id =
			type +
			app.util.stamp(fn as any) +
			(context ? '_' + app.util.stamp(context) : '');

		if (obj[eventsKey] && obj[eventsKey][id]) {
			return this;
		}

		let handler = function (e: Event) {
			return fn.call(context || obj, e || window.event);
		};

		const originalHandler = handler;

		if (window.L.Browser.pointer && type.indexOf('touch') === 0) {
			this.addPointerListener(obj, type, handler, id);
		} // double-tap listener is no more.
		else if (type === 'trplclick' || type === 'qdrplclick') {
			this.addMultiClickListener(obj, handler, id, type);
		} else if ('addEventListener' in obj) {
			if (type === 'mousewheel') {
				obj.addEventListener('DOMMouseScroll', handler, false);
				obj.addEventListener(type, handler, false);
			} else if (type === 'mouseenter' || type === 'mouseleave') {
				handler = (e: Event): void => {
					e = e || window.event;
					if (this._checkMouse(obj, e)) {
						originalHandler(e);
					}
				};
				obj.addEventListener(
					type === 'mouseenter' ? 'mouseover' : 'mouseout',
					handler,
					false,
				);
			} else {
				if (type === 'click' && window.L.Browser.android) {
					handler = (e: Event): void => {
						return this._filterClick(e, originalHandler);
					};
				}
				obj.addEventListener(type, handler, false);
			}
		} else if ('attachEvent' in obj) {
			obj.attachEvent('on' + type, handler);
		}

		obj[eventsKey] = obj[eventsKey] || {};
		obj[eventsKey][id] = handler;

		return this;
	}

	private static _off(
		obj: any,
		type: string,
		fn: DomEventHandler,
		context: any,
	): typeof DomEvent {
		const id =
				type +
				app.util.stamp(fn as any) +
				(context ? '_' + app.util.stamp(context) : ''),
			handler = obj[eventsKey] && obj[eventsKey][id];

		if (!handler) {
			return this;
		}

		if (window.L.Browser.pointer && type.indexOf('touch') === 0) {
			this.removePointerListener(obj, type, id);
		} // Double tap listener is no more.
		else if (type === 'trplclick' || type === 'qdrplclick') {
			this.removeMultiClickListener(obj, id, type);
		} else if ('removeEventListener' in obj) {
			if (type === 'mousewheel') {
				obj.removeEventListener('DOMMouseScroll', handler, false);
				obj.removeEventListener(type, handler, false);
			} else {
				obj.removeEventListener(
					type === 'mouseenter'
						? 'mouseover'
						: type === 'mouseleave'
							? 'mouseout'
							: type,
					handler,
					false,
				);
			}
		} else if ('detachEvent' in obj) {
			obj.detachEvent('on' + type, handler);
		}

		obj[eventsKey][id] = null;

		return this;
	}

	public static stopPropagation(e: Event): typeof DomEvent {
		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
		this._skipped(e);

		return this;
	}

	public static disableMouseClickPropagation(el: any): typeof DomEvent {
		const stop = window.touch.mouseOnly(this.stopPropagation as any);

		this.on(el, window.L.Draggable.START.join(' '), stop);

		return this.on(el, {
			click: window.touch.mouseOnly(this._fakeStop as any),
			dblclick: stop,
		});
	}

	public static disableScrollPropagation(el: any): typeof DomEvent {
		return this.on(el, 'mousewheel MozMousePixelScroll', this.stopPropagation);
	}

	public static disableClickPropagation(el: any): typeof DomEvent {
		const stop = this.stopPropagation;

		this.on(el, window.L.Draggable.START.join(' '), stop);

		return window.L.DomEvent.on(el, {
			click: this._fakeStop,
			dblclick: stop,
		});
	}

	public static preventDefault(e: Event): typeof DomEvent {
		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return this;
	}

	public static stop(e: Event): typeof DomEvent {
		return this.preventDefault(e).stopPropagation(e);
	}

	public static getMousePosition(
		e: MouseEvent | TouchEvent,
		container?: HTMLElement,
	): cool.Point {
		if (!container) {
			if (e instanceof TouchEvent)
				return new cool.Point(e.touches[0].clientX, e.touches[0].clientY);

			return new cool.Point(e.clientX, e.clientY);
		}

		const rect = container.getBoundingClientRect(); // constant object
		let left = rect.left;
		let top = rect.top;

		// iframe mouse coordinates are relative to the frame area
		// `target`: body element of the iframe; `currentTarget`: content window of the iframe
		if (
			e.currentTarget &&
			(e.currentTarget as any).frameElement &&
			DomUtil.hasClass((e.currentTarget as any).frameElement, 'resize-detector')
		) {
			left = top = 0;
		}

		// When called for a touchend event, at least in WebKit on iOS and Safari, the
		// touches array will be of zero length. Probably it is a programming logic error to
		// even call this function for a touchend event, as by definition no finger is
		// touching the screen any longer then and thus there is no "mouse position". But
		// let's just least guard against an unhandled exception for now.
		if (e instanceof TouchEvent) {
			if (e.touches.length > 0)
				return new cool.Point(
					e.touches[0].clientX - left - container.clientLeft,
					e.touches[0].clientY - top - container.clientTop,
				);
			else if (e.changedTouches !== undefined && e.changedTouches.length > 0)
				return new cool.Point(
					e.changedTouches[0].clientX - left - container.clientLeft,
					e.changedTouches[0].clientY - top - container.clientTop,
				);
			else {
				app.console.assert('Should not be here!');
				return new cool.Point(0, 0);
			}
		}
		return new cool.Point(
			e.clientX - left - container.clientLeft,
			e.clientY - top - container.clientTop,
		);
	}

	public static getWheelDelta(e: Event): number {
		console.assert(false, 'This function should not be called!');
		return 0;
	}

	private static _fakeStop(e: Event): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _skipped(e: Event): boolean {
		console.assert(false, 'This function should not be called!');
		return false;
	}

	private static _checkMouse(el: any, e: Event): boolean {
		console.assert(false, 'This function should not be called!');
		return false;
	}

	private static _filterClick(e: Event, handler: DomEventHandler): void {
		console.assert(false, 'This function should not be called!');
	}

	// ----------------
	// Pointer Handlers
	// ----------------

	public static addPointerListener(
		obj: any,
		type: string,
		handler: DomEventHandler,
		id: string,
	): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return this;
	}

	public static removePointerListener(
		obj: any,
		type: string,
		id: string,
	): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return this;
	}

	private static _addPointerStart(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _globalPointerDown(e: Event): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _globalPointerMove(e: Event): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _globalPointerUp(e: Event): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _handlePointer(e: Event, handler: DomEventHandler): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _addPointerMove(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		console.assert(false, 'This function should not be called!');
	}

	private static _addPointerEnd(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		console.assert(false, 'This function should not be called!');
	}

	// -------------------
	// MultiClick Handlers
	// -------------------

	public static addMultiClickListener(
		obj: any,
		handler: DomEventHandler,
		id: string,
		type: string,
	): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return this;
	}

	public static removeMultiClickListener(
		obj: any,
		id: string,
		type?: string,
	): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return this;
	}
}
