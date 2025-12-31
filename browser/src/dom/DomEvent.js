/* -*- js-indent-level: 8 -*- */
/* global DomEvent */
/*
 * window.L.DomEvent contains functions for working with DOM events.
 * Inspired by John Resig, Dean Edwards and YUI addEvent implementations.
 */


class DomEventDerived extends DomEvent {

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

DomEventDerived.addListener = DomEventDerived.on;
DomEventDerived.removeListener = DomEventDerived.off;

window.L.DomEvent = DomEventDerived;
