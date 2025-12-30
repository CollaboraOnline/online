/* -*- js-indent-level: 8 -*- */
/* global DomEvent */
/*
 * window.L.DomEvent contains functions for working with DOM events.
 * Inspired by John Resig, Dean Edwards and YUI addEvent implementations.
 */


class DomEventDerived extends DomEvent {

	static getWheelDelta(e) {

		let delta = 0;

		if (e.wheelDelta) {
			delta = e.wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	}

	static _fakeStop(e) {
		// fakes stopPropagation by setting a special event flag, checked/reset with window.L.DomEvent._skipped(e)
		window.L.DomEvent._skipEvents[e.type] = true;
	}

	static _skipped(e) {
		const skipped = this._skipEvents[e.type];
		// reset when checking, as it's only used in map container and propagates outside of the map
		this._skipEvents[e.type] = false;
		return skipped;
	}

	// check if element really left/entered the event target (for mouseenter/mouseleave)
	static _checkMouse(el, e) {

		let related = e.relatedTarget;

		if (!related) { return true; }

		try {
			while (related && (related !== el)) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}
		return (related !== el);
	}

	// this is a horrible workaround for a bug in Android where a single touch triggers two click events
	static _filterClick(e, handler) {
		const timeStamp = (e.timeStamp || e.originalEvent.timeStamp);
		const elapsed = window.L.DomEvent._lastClick && (timeStamp - window.L.DomEvent._lastClick);

		// are they closer together than 500ms yet more than 100ms?
		// Android typically triggers them ~300ms apart while multiple listeners
		// on the same event should be triggered far faster;
		// or check if click is simulated on the element, and if it is, reject any non-simulated events

		if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
			window.L.DomEvent.stop(e);
			return;
		}
		window.L.DomEvent._lastClick = timeStamp;

		handler(e);
	}
}

DomEventDerived._skipEvents = {};
DomEventDerived.addListener = DomEventDerived.on;
DomEventDerived.removeListener = DomEventDerived.off;

window.L.DomEvent = DomEventDerived;
