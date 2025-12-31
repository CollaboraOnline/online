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
	private static _skipEvents: { [name: string]: boolean } = {};
	private static _lastClick?: DOMHighResTimeStamp;

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
					if (this._checkMouse(obj, e as MouseEvent)) {
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

	public static getWheelDelta(e: WheelEvent): number {
		let delta = 0;

		if ((e as any).wheelDelta) {
			delta = (e as any).wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	}

	private static _fakeStop(e: Event): void {
		// fakes stopPropagation by setting a special event flag, checked/reset with window.L.DomEvent._skipped(e)
		this._skipEvents[e.type] = true;
	}

	private static _skipped(e: Event): boolean {
		const skipped = this._skipEvents[e.type];
		// reset when checking, as it's only used in map container and propagates outside of the map
		this._skipEvents[e.type] = false;
		return skipped;
	}

	// check if element really left/entered the event target (for mouseenter/mouseleave)
	private static _checkMouse(el: any, e: MouseEvent): boolean {
		let related = e.relatedTarget as Node | null;

		if (!related) {
			return true;
		}

		try {
			while (related && related !== el) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}
		return related !== el;
	}

	// this is a horrible workaround for a bug in Android where a single touch triggers two click events
	private static _filterClick(e: Event, handler: DomEventHandler): void {
		const timeStamp = e.timeStamp || (e as any).originalEvent.timeStamp;
		const elapsed = this._lastClick && timeStamp - this._lastClick;

		// are they closer together than 500ms yet more than 100ms?
		// Android typically triggers them ~300ms apart while multiple listeners
		// on the same event should be triggered far faster;
		// or check if click is simulated on the element, and if it is, reject any non-simulated events

		const ee: any = e;
		if (
			(elapsed && elapsed > 100 && elapsed < 500) ||
			(ee.target._simulatedClick && !ee._simulated)
		) {
			this.stop(e);
			return;
		}
		this._lastClick = timeStamp;

		handler(e);
	}

	public static addListener = this.on;
	public static removeListener = this.off;

	// ----------------
	// Pointer Handlers
	// ----------------

	public static POINTER_DOWN: string = window.L.Browser.msPointer
		? 'MSPointerDown'
		: 'pointerdown';
	public static POINTER_MOVE: string = window.L.Browser.msPointer
		? 'MSPointerMove'
		: 'pointermove';
	public static POINTER_UP: string = window.L.Browser.msPointer
		? 'MSPointerUp'
		: 'pointerup';
	public static POINTER_CANCEL: string = window.L.Browser.msPointer
		? 'MSPointerCancel'
		: 'pointercancel';

	private static _pointers: { [name: string]: any } = {};
	private static _pointersCount: 0;
	private static _pointerDocListener: boolean = false;

	// Provides a touch events wrapper for (ms)pointer events.
	// ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890
	public static addPointerListener(
		obj: any,
		type: string,
		handler: DomEventHandler,
		id: string,
	): typeof DomEvent {
		if (type === 'touchstart') {
			this._addPointerStart(obj, handler, id);
		} else if (type === 'touchmove') {
			this._addPointerMove(obj, handler, id);
		} else if (type === 'touchend') {
			this._addPointerEnd(obj, handler, id);
		}

		return this;
	}

	public static removePointerListener(
		obj: any,
		type: string,
		id: string,
	): typeof DomEvent {
		const handler = obj['_leaflet_' + type + id];

		if (type === 'touchstart') {
			obj.removeEventListener(this.POINTER_DOWN, handler, false);
		} else if (type === 'touchmove') {
			obj.removeEventListener(this.POINTER_MOVE, handler, false);
		} else if (type === 'touchend') {
			obj.removeEventListener(this.POINTER_UP, handler, false);
			obj.removeEventListener(this.POINTER_CANCEL, handler, false);
		}

		return this;
	}

	private static _addPointerStart(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		const onDown = (e: Event): void => {
			this.preventDefault(e);
			this._handlePointer(e as PointerEvent, handler);
		};

		obj['_leaflet_touchstart' + id] = onDown;
		obj.addEventListener(this.POINTER_DOWN, onDown, false);

		// need to keep track of what pointers and how many are active to provide e.touches emulation
		if (!this._pointerDocListener) {
			const pointerUp = (e: Event): void => {
				this._globalPointerUp(e as PointerEvent);
			};

			// we listen documentElement as any drags that end by moving the touch off the screen get fired there
			document.documentElement.addEventListener(
				this.POINTER_DOWN,
				(e: Event): void => {
					this._globalPointerDown(e as PointerEvent);
				},
				true,
			);
			document.documentElement.addEventListener(
				this.POINTER_MOVE,
				(e: Event): void => {
					this._globalPointerMove(e as PointerEvent);
				},
				true,
			);
			document.documentElement.addEventListener(
				this.POINTER_UP,
				pointerUp,
				true,
			);
			document.documentElement.addEventListener(
				this.POINTER_CANCEL,
				pointerUp,
				true,
			);

			this._pointerDocListener = true;
		}
	}

	private static _globalPointerDown(e: PointerEvent): void {
		this._pointers[e.pointerId] = e;
		this._pointersCount++;
	}

	private static _globalPointerMove(e: PointerEvent): void {
		if (this._pointers[e.pointerId]) {
			this._pointers[e.pointerId] = e;
		}
	}

	private static _globalPointerUp(e: PointerEvent): void {
		delete this._pointers[e.pointerId];
		this._pointersCount--;
	}

	private static _handlePointer(
		e: PointerEvent,
		handler: DomEventHandler,
	): void {
		const ee: any = e;
		ee.touches = [];
		for (const i in this._pointers) {
			ee.touches.push(this._pointers[i]);
		}
		ee.changedTouches = [e];

		handler(e);
	}

	private static _addPointerMove(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		const onMove = (e: PointerEvent): void => {
			// don't fire touch moves when mouse isn't down
			if (
				(e.pointerType === (e as any).MSPOINTER_TYPE_MOUSE ||
					e.pointerType === 'mouse') &&
				e.buttons === 0
			) {
				return;
			}

			this._handlePointer(e, handler);
		};

		obj['_leaflet_touchmove' + id] = onMove;
		obj.addEventListener(this.POINTER_MOVE, onMove, false);
	}

	private static _addPointerEnd(
		obj: any,
		handler: DomEventHandler,
		id: string,
	): void {
		const onUp = (e: PointerEvent): void => {
			this._handlePointer(e, handler);
		};

		obj['_leaflet_touchend' + id] = onUp;
		obj.addEventListener(this.POINTER_UP, onUp, false);
		obj.addEventListener(this.POINTER_CANCEL, onUp, false);
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
