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
 * JSDialog.DrawingArea - drawing area displaying picture sent from the server
 *
 * Example JSON:
 * {
 *     id: 'id',
 *     type: 'drawingarea',
 *     image: 'base64 encoded image',
 *     text: 'alternative text',
 *     loading: true, - show additional spinner div
 *     placeholderText: false,  - 'show text next to image'
 * }
 */

/* global JSDialog $ UNOKey app */

// All builder.callback calls are wrapped via a local `callback` function
// to ensure container.id is always correctly set.
function _drawingAreaControl (parentContainer, data, builder) {
	var container = window.L.DomUtil.create('div', builder.options.cssClass + ' ui-drawing-area-container', parentContainer);
	container.id = data.id;

	if (!data.image)
		return;

	var image = window.L.DomUtil.create('img', builder.options.cssClass + ' ui-drawing-area', container);
	var imageId = data.id + '-img';
	image.id = imageId;
	image.src = data.image.replace(/\\/g, '');
	image.alt = data.text;
	image.draggable = false;
	image.ondragstart = function() { return false; };

	if (data.enabled && data.canFocus) {
		image.tabIndex = 0;
	}

	if (data.text) {
		image.setAttribute('data-cooltip', data.text);

		if (builder.map) {
			window.L.control.attachTooltipEventListener(image, builder.map);
		}
	} else if (data.aria && data.aria.label) {
		container.setAttribute('aria-label', data.aria.label);
		image.alt = '';
	} else if (data.aria && data.aria.description) {
		image.alt = data.aria.description;
	}

	// Line width dialog is affected from delay on image render.
	// So If the image render is delayed, use width and height of the data
	if (JSDialog.isWidgetInModalPopup(data) && image.width == 0 && image.height == 0) {
		image.width = data.imagewidth;
		image.height = data.imageheight;
	}

	if (data.loading && data.loading === 'true') {
		var loaderContainer = window.L.DomUtil.create('div', 'ui-drawing-area-loader-container', container);
		window.L.DomUtil.create('div', 'ui-drawing-area-loader', loaderContainer);
	}
	if (data.placeholderText && data.placeholderText === 'true') {
		var spanContainer = window.L.DomUtil.create('div', 'ui-drawing-area-placeholder-container', container);
		var span = window.L.DomUtil.create('span', 'ui-drawing-area-placeholder', spanContainer);
		span.innerText = data.text;
	}

	var getCoordinatesFromEvent = function (e) {
		var imageElement = document.getElementById(imageId);
		var ret = [0, 0];

		if (e.offsetX) {
			ret[0] = e.offsetX;
			ret[1] = e.offsetY;
		} else if (e.changedTouches && e.changedTouches.length) {
			ret[0] = e.changedTouches[e.changedTouches.length-1].pageX - $(imageElement).offset().left;
			ret[1] = e.changedTouches[e.changedTouches.length-1].pageY - $(imageElement).offset().top;
		}

		ret[0] = ret[0] / imageElement.offsetWidth;
		ret[1] = ret[1] / imageElement.offsetHeight;

		return ret;
	};

	var moveTimer = null;
	var moveFunc = null;

	window.L.DomEvent.on(image, 'dblclick', function(e) {
		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];

		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;
		callback('drawingarea', 'dblclick', container, coordinates, builder);
	}, this);

	window.L.DomEvent.on(image, 'click touchend', function(e) {
		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];

		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;

		callback('drawingarea', 'click', container, coordinates, builder);
	}, this);

	var onMove = function (e) {
		if (moveTimer && moveFunc) {
			clearTimeout(moveTimer);
			moveTimer = null;
			moveFunc();
			moveFunc = null;
		}

		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];
		callback('drawingarea', 'mousemove', container, coordinates, builder);
	};

	var endMove = function (e) {
		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;

		window.removeEventListener('mousemove', onMove);
		window.removeEventListener('mouseup', endMove);

		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];
		callback('drawingarea', 'mouseup', container, coordinates, builder);
	};

	image.addEventListener('mousedown', function (e) {
		moveFunc = function () {
			var pos = getCoordinatesFromEvent(e);
			var coordinates = pos[0] + ';' + pos[1];
			callback('drawingarea', 'mousedown', container, coordinates, builder);
		};

		moveTimer = setTimeout(function () {
			moveFunc();
			moveFunc = null;
			moveTimer = null;
		}, 200);

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', endMove);
	});

	var modifier = 0;

	image.addEventListener('keydown', function(event) {
		if (event.key === 'Enter') {
			callback('drawingarea', 'keypress', container, UNOKey.RETURN | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Escape' || event.key === 'Esc') {
			callback('drawingarea', 'keypress', container, UNOKey.ESCAPE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Left' || event.key === 'ArrowLeft') {
			callback('drawingarea', 'keypress', container, UNOKey.LEFT | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Right' || event.key === 'ArrowRight') {
			callback('drawingarea', 'keypress', container, UNOKey.RIGHT | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Up' || event.key === 'ArrowUp') {
			callback('drawingarea', 'keypress', container, UNOKey.UP | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Down' || event.key === 'ArrowDown') {
			callback('drawingarea', 'keypress', container, UNOKey.DOWN | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Home') {
			callback('drawingarea', 'keypress', container, UNOKey.HOME | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'End') {
			callback('drawingarea', 'keypress', container, UNOKey.END | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Backspace') {
			callback('drawingarea', 'keypress', container, UNOKey.BACKSPACE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Delete') {
			callback('drawingarea', 'keypress', container, UNOKey.DELETE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Space') {
			callback('drawingarea', 'keypress', container, UNOKey.SPACE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Tab') {
			callback('drawingarea', 'keypress', container, UNOKey.TAB | modifier, builder);
		} else if (event.key === 'Shift') {
			modifier = modifier | app.UNOModifier.SHIFT;
			event.preventDefault();
		} else if (event.key === 'Control') {
			modifier = modifier | app.UNOModifier.CTRL;
			event.preventDefault();
		} else if (event.key === 'a' && event.ctrlKey) {
			callback('drawingarea', 'keypress', container, UNOKey.A | app.UNOModifier.CTRL, builder);
		}
	});

	image.addEventListener('keyup', function(event) {
		if (event.key === 'Shift') {
			modifier = modifier & (~app.UNOModifier.SHIFT);
			event.preventDefault();
		} else if (event.key === 'Control') {
			modifier = modifier & (~app.UNOModifier.CTRL);
			event.preventDefault();
		}
	});

	image.addEventListener('blur', function() {
		modifier = 0;
	});

	image.addEventListener('keypress', function(event) {
		if (event.key === 'Enter' ||
			event.key === 'Escape' ||
			event.key === 'Esc' ||
			event.key === 'Left' ||
			event.key === 'ArrowLeft' ||
			event.key === 'Right' ||
			event.key === 'ArrowRight' ||
			event.key === 'Up' ||
			event.key === 'ArrowUp' ||
			event.key === 'Down' ||
			event.key === 'ArrowDown' ||
			event.key === 'Home' ||
			event.key === 'End' ||
			event.key === 'Backspace' ||
			event.key === 'Delete' ||
			event.key === 'Space' ||
			event.key === 'Tab') {
			// skip
		} else {
			var keyCode = event.keyCode;
			if (event.ctrlKey) {
				keyCode = event.key.toUpperCase().charCodeAt(0);
				keyCode = builder.map.keyboard._toUNOKeyCode(keyCode);
				keyCode |= app.UNOModifier.CTRL;
			}

			callback('drawingarea', 'keypress', container, keyCode, builder);
		}

		event.preventDefault();
	});

	// Fix for LibreOfficeKit crash: "sendDialogEvent: no widget id set"
	// Problem: During rapid mouse interactions on drawing areas (Writer->Format->Page Style->Area->Pattern->Pattern Editor),
	// the JSDialog system's _updateWidgetImpl function can clear container.id (set to '') during
	// widget updates, creating a race condition. When event handlers then call builder.callback()
	// with the container object, it has an empty ID, causing dialog events to be sent with
	// empty widget IDs to the core, which triggers an assertion failure.
	// This wrapper ensures container.id is restored from the original data.id before
	// any callback is made, preventing empty widget IDs from being sent in dialog events.
	function callback(...args) {
		if(!container.id) container.id = data.id; // Ensure the container has a valid Id
		builder.callback(...args);
	}

	return false;
}

JSDialog.drawingArea = function (parentContainer, data, builder) {
	var buildInnerData = _drawingAreaControl(parentContainer, data, builder);
	return buildInnerData;
};
