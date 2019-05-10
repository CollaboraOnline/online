/*
 * Similar to DomEvent.DoubleTap.js (which implements the 'dblclick' event for
 * touchscreens), this implements the 'contextmenu' event on long touchscreen
 * press for combination of browsers/input devices that don't - namely,
 * Safari on iOS devices.
 *
 * This has been mostly copy-pasted from map/handler/Map.Tap.js and should be
 * refactored somehow.
 */
L.DomEvent.enableLongTap = function enableLongTap(el, tolerance, timeout) {
	// Skip non-touchscreens and browsers which implement PointerEvent
	if (!L.Browser.touch || L.Browser.pointer) {
		return;
	}

	// Prevent double handling
	if (el._hasLongTapContextMenus) {
		return;
	}
	el._hasLongTapContextMenus = true;

	// Default value for the 'tolerance' parameter: 15 pixels
	// This is the amount of pixels that the touch can move around during
	// a long tap, and still fire contextmenu events.
	if (!tolerance) {
		tolerance = 15;
	}

	// Default value for the 'timeout' parameter: 2000 milliseconds
	// This is how long a user has to hold down the touch to trigger the
	// contextmenu event
	if (!timeout) {
		timeout = 2000;
	}

	var holdTimeout;
	var fireClick = true; // Whether to fire a click event on touchup
	var startPos; // Position of the touch on touchstart
	var newPos; // Position of the touch on the last touchmove

	function onDown(ev) {
		if (!ev.touches) {
			return;
		}

		L.DomEvent.preventDefault(ev);
		fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (ev.touches.length > 1) {
			fireClick = false;
			clearTimeout(holdTimeout);
			return;
		}

		var first = ev.touches[0],
		    target = first.target;

		startPos = newPos = L.point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (target.tagName && target.tagName.toLowerCase() === 'a') {
			L.DomUtil.addClass(target, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		holdTimeout = setTimeout(function() {
			if (isTapValid()) {
				fireClick = false;
				onUp();
				simulateEvent('contextmenu', first);
			}
		}, timeout);

		simulateEvent('mousedown', first);

		L.DomEvent.on(el, {
			touchmove: onMove,
			touchend: onUp
		});
	}

	function isTapValid() {
		return newPos.distanceTo(startPos) <= tolerance;
	}

	function onUp(ev) {
		clearTimeout(holdTimeout);

		L.DomEvent.off(el, {
			touchmove: onMove,
			touchend: onUp
		});

		if (fireClick && ev && ev.changedTouches) {
			var first = ev.changedTouches[0],
			    target = first.target;

			if (target && target.tagName && el.tagName.toLowerCase() === 'a') {
				L.DomUtil.removeClass(target, 'leaflet-active');
			}

			simulateEvent('mouseup', first);

			// simulate click if the touch didn't move too much
			if (isTapValid()) {
				simulateEvent('click', first);
			}
		}
	}

	function onMove(ev) {
		var first = ev.touches[0];
		newPos = new L.Point(first.clientX, first.clientY);
		simulateEvent('mousemove', first);
	}

	function simulateEvent(type, ev) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		ev.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
			type,
			true,
			true,
			window,
			1,
			ev.screenX,
			ev.screenY,
			ev.clientX,
			ev.clientY,
			false,
			false,
			false,
			false,
			0,
			null
		);

		console.log('dispatching simulated contextmenu event: ', simulatedEvent);

		ev.target.dispatchEvent(simulatedEvent);
	}

	L.DomEvent.on(el, 'touchstart', onDown, this);
};
