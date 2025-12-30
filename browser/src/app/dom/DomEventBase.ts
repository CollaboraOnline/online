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

class DomEvent {
	public static on(
		obj: any,
		types: string | DomEventHandlerObject,
		fn: DomEventHandler | any,
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
		fn: DomEventHandler | any,
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
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	private static _off(
		obj: any,
		type: string,
		fn: DomEventHandler,
		context: any,
	): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static stopPropagation(e: Event): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static disableMouseClickPropagation(el: any): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static disableScrollPropagation(el: any): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static disableClickPropagation(el: any): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static preventDefault(e: Event): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static stop(e: Event): typeof DomEvent {
		console.assert(false, 'This function should not be called!');
		return DomEvent;
	}

	public static getMousePosition(
		e: Event,
		container?: HTMLElement,
	): cool.Point {
		console.assert(false, 'This function should not be called!');
		return new cool.Point(0, 0);
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
}
