/* -*- js-indent-level: 8 -*- */
/* global cool DomEvent */
/*
 * window.L.DomEvent contains functions for working with DOM events.
 * Inspired by John Resig, Dean Edwards and YUI addEvent implementations.
 */


class DomEventDerived extends DomEvent {

	static disableScrollPropagation(el) {
		return window.L.DomEvent.on(el, 'mousewheel MozMousePixelScroll', window.L.DomEvent.stopPropagation);
	}

	static disableClickPropagation(el) {
		const stop = window.L.DomEvent.stopPropagation;

		window.L.DomEvent.on(el, window.L.Draggable.START.join(' '), stop);

		return window.L.DomEvent.on(el, {
			click: window.L.DomEvent._fakeStop,
			dblclick: stop
		});
	}

	static preventDefault(e) {

		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return DomEventDerived;
	}

	static stop(e) {
		return window.L.DomEvent
			.preventDefault(e)
			.stopPropagation(e);
	}

	static getMousePosition(e, container) {
		if (!container) {
			if (e.clientX === undefined && e.touches !== undefined)
				return new cool.Point(e.touches[0].clientX, e.touches[0].clientY);

			return new cool.Point(e.clientX, e.clientY);
		}

		const rect = container.getBoundingClientRect(); // constant object
		let left = rect.left;
		let top = rect.top;

		// iframe mouse coordinates are relative to the frame area
		// `target`: body element of the iframe; `currentTarget`: content window of the iframe
		if (e.currentTarget && e.currentTarget.frameElement
			&& window.L.DomUtil.hasClass(e.currentTarget.frameElement, 'resize-detector')) {
			left = top = 0;
		}

		// When called for a touchend event, at least in WebKit on iOS and Safari, the
		// touches array will be of zero length. Probably it is a programming logic error to
		// even call this function for a touchend event, as by definition no finger is
		// touching the screen any longer then and thus there is no "mouse position". But
		// let's just least guard against an unhandled exception for now.
		if (e.clientX === undefined && e.touches !== undefined && e.touches.length > 0)
			return new cool.Point(
				e.touches[0].clientX - left - container.clientLeft,
				e.touches[0].clientY - top - container.clientTop);
		else if (e.clientX === undefined && e.changedTouches !== undefined && e.changedTouches.length > 0)
			return new cool.Point(
				e.changedTouches[0].clientX - left - container.clientLeft,
				e.changedTouches[0].clientY - top - container.clientTop);

		return new cool.Point(
			e.clientX - left - container.clientLeft,
			e.clientY - top - container.clientTop);
	}

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
