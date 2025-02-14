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
 * Evented is a base class that Map/Layer classes inherit from to
 * handle custom events.
 */

interface EventBaseType {
	type: string;
	target: any;
	[name: string]: any;
}

type CEventListener = (e: EventBaseType) => void;

interface CallbackWithContext {
	fn: CEventListener;
	ctx: any;
}

interface CallbackWithoutContext {
	fn: CEventListener;
}

class Evented extends BaseClass {
	private _events: Map<string, Map<string, CallbackWithContext>>;
	private _numEvents: Map<string, number>;

	private _eventsNoContext: Map<string, Array<CallbackWithoutContext>>;
	private _eventParents: Map<number, Evented>;

	constructor() {
		super();
		this._events = new Map();
		this._numEvents = new Map();
		this._eventsNoContext = new Map();
		this._eventParents = new Map();
	}

	public on(
		types: Map<string, CEventListener> | string,
		fn: CEventListener | any,
		context: any,
	): Evented {
		// types can be a map of types/handlers
		if (types instanceof Map) {
			for (const [type, listener] of types) {
				// we don't process space-separated events here for performance;
				// it's a hot path since Layer uses the on(obj) syntax
				this._on(type, listener, fn);
			}
		} else {
			// types can be a string of space-separated words
			const parts: string[] = Util.splitWords(types);

			for (var i = 0, len = parts.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}

		return this;
	}

	public off(
		types?: Map<string, CEventListener> | string,
		fn?: CEventListener | any,
		context?: any,
	): Evented {
		if (!types) {
			// clear all listeners if called without arguments
			this._events.clear();
			this._eventsNoContext.clear();
			this._numEvents.clear();
		} else if (types instanceof Map) {
			for (var type in types) {
				this._off(type, types.get(type), fn);
			}
		} else {
			const parts: string[] = Util.splitWords(types);

			for (var i = 0, len = parts.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}

		return this;
	}

	// attach listener
	private _on(type: string, fn: CEventListener, context: any): void {
		let contextId = 0;
		if (context && context !== this) {
			contextId = Util.stamp(context);
		}

		if (contextId) {
			// store listeners with custom context in a separate hash (if it has an id);
			// gives a major performance boost when firing and removing events (e.g. on map object)

			if (!this._events.has(type)) {
				this._events.set(type, new Map());
			}
			const typeIndex = this._events.get(type);
			const id: string = Util.stamp(fn as unknown as IDAble) + '_' + contextId;

			if (!typeIndex.has(id)) {
				typeIndex.set(id, { fn: fn, ctx: context });

				// keep track of the number of keys in the index to quickly check if it's empty
				const count = this._numEvents.has(type) ? this._numEvents.get(type) : 0;

				this._numEvents.set(type, count + 1);
			}
		} else {
			// individual layers mostly use "this" for context and don't fire listeners too often
			// so simple array makes the memory footprint better while not degrading performance

			// eslint-disable-next-line no-lonely-if
			if (!this._eventsNoContext.has(type)) {
				this._eventsNoContext.set(type, [{ fn: fn }]);
			} else {
				this._eventsNoContext.get(type).push({ fn: fn });
			}
		}
	}

	private _off(type: string, fn: CEventListener, context: any): void {
		if (!this._events.size) {
			return;
		}

		if (!fn) {
			// clear all listeners for a type if function isn't specified
			this._events.delete(type);
			this._numEvents.delete(type);
			this._eventsNoContext.delete(type);
			return;
		}

		let contextId = 0;
		if (context && context !== this) {
			contextId = Util.stamp(context);
		}

		let listener: CallbackWithContext | CallbackWithoutContext;
		if (contextId) {
			const id: string = Util.stamp(fn as unknown as IDAble) + '_' + contextId;
			const listeners = this._events.get(type);

			if (listeners && listeners.get(id)) {
				listener = listeners.get(id);
				listeners.delete(id);
				this._numEvents.set(type, this._numEvents.get(type) - 1);
			}
		} else {
			const listeners = this._eventsNoContext.get(type);

			if (listeners) {
				const len = listeners.length;
				for (let i = 0; i < len; i++) {
					if (listeners[i].fn === fn) {
						listener = listeners[i];
						listeners.splice(i, 1);
						break;
					}
				}
			}
		}

		// set the removed listener to noop so that's not called if remove happens in fire
		if (listener) {
			listener.fn = Util.falseFn;
		}
	}

	public fire(type: string, data?: any, propagate?: boolean): Evented {
		if (!this.listens(type, propagate)) {
			return this;
		}

		const event = { ...data, type: type, target: this };

		if (this._events.size) {
			const typeIndex = this._events.get(type);
			const simpleListeners = this._eventsNoContext.get(type);

			if (simpleListeners) {
				// make sure adding/removing listeners inside other listeners won't cause infinite loop
				const listeners = simpleListeners.slice();

				for (let i = 0, len = listeners.length; i < len; i++) {
					listeners[i].fn.call(this, event);
				}
			}

			// fire event for the context-indexed listeners as well
			for (const [_, value] of typeIndex) {
				value.fn.call(value.ctx, event);
			}
		}

		if (propagate) {
			// propagate the event to parents (set with addEventParent)
			this._propagateEvent(event);
		}

		return this;
	}

	// adds a parent to propagate events to (when you fire with true as a 3rd argument)
	public addEventParent(obj: Evented): Evented {
		this._eventParents.set(Util.stamp(obj), obj);
		return this;
	}

	public removeEventParent(obj: Evented): Evented {
		if (this._eventParents.size) {
			this._eventParents.delete(Util.stamp(obj));
		}
		return this;
	}

	public listens(type: string, propagate?: boolean): boolean {
		if (
			(this._events.size || this._eventsNoContext.size) &&
			(this._eventsNoContext.has(type) || this._events.has(type))
		) {
			return true;
		}

		if (propagate) {
			// also check parents for listeners if event propagates
			for (const [_, parent] of this._eventParents) {
				if (parent.listens(type, propagate)) {
					return true;
				}
			}
		}
		return false;
	}

	public once(
		types: Map<string, CEventListener> | string,
		fn: CEventListener | any,
		context: any,
	): Evented {
		if (types instanceof Map) {
			for (const [type, value] of types) {
				this.once(type, value, fn);
			}
			return this;
		}

		var handler = function () {
			this.off(types, fn, context).off(types, handler, context);
		}.bind(this);

		// add a listener that's executed once and removed after that
		return this.on(types, fn, context).on(types, handler, context);
	}

	private _propagateEvent(e: EventBaseType): void {
		for (const [_, parent] of this._eventParents) {
			parent.fire(e.type, { layer: e.target, ...e }, true);
		}
	}
}
