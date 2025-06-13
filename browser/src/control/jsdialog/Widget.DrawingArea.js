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

/* global JSDialog $ UNOKey UNOModifier app */

function _setupItemInfo(itemInfo, data) {
	const columns = Math.floor(data.imagewidth / itemInfo.innerWidth);
	const hSpacing =
		(data.imagewidth - itemInfo.innerWidth * columns) / (2 * columns);

	const rows = Math.floor(data.imageheight / itemInfo.innerHeight);
	const vSpacing =
		(data.imageheight - itemInfo.innerHeight * rows) / (2 * rows);

	itemInfo.outerWidth = itemInfo.innerWidth + 2 * hSpacing;
	itemInfo.outerHeight = itemInfo.innerHeight + 2 * vSpacing;
	itemInfo.hSpacing = hSpacing;
	itemInfo.vSpacing = vSpacing;
	itemInfo.rows = rows;
	itemInfo.columns = columns;
}

function _getItemPos(pos, itemInfo) {
	const width = itemInfo.outerWidth;
	const height = itemInfo.outerHeight;
	const c = Math.floor(pos[0] / width);
	const r = Math.floor(pos[1] / height);
	return [r, c]; // row, column
}

function _isCurrentItem(curItem, item) {
	return curItem[0] === item[0] && curItem[1] === item[1];
}

function _isOverItem(pos, item, itemInfo) {
	const x = item[1] * itemInfo.outerWidth + itemInfo.hSpacing;
	const y = item[0] * itemInfo.outerHeight + itemInfo.vSpacing;
	const witdh = itemInfo.innerWidth;
	const height = itemInfo.innerHeight;

	return (
		pos[0] >= x && pos[0] <= x + witdh && pos[1] >= y && pos[1] <= y + height
	);
}

function _drawingAreaControl (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-drawing-area-container', parentContainer);
	container.id = data.id;

	if (!data.image)
		return;

	var image = L.DomUtil.create('img', builder.options.cssClass + ' ui-drawing-area', container);
	var imageId = data.id + '-img';
	image.id = imageId;
	image.src = data.image.replace(/\\/g, '');
	image.alt = data.text;
	image.tabIndex = 0;
	image.draggable = false;
	image.ondragstart = function() { return false; };

	if (data.text) {
		image.setAttribute('data-cooltip', data.text);

		if (builder.map) {
			L.control.attachTooltipEventListener(image, builder.map);
		}
	} else if (data.aria && data.aria.label) {
		image.setAttribute('aria-label', data.aria.label);
	}

	// Line width dialog is affected from delay on image render.
	// So If the image render is delayed, use width and height of the data
	if (JSDialog.isWidgetInModalPopup(data) && image.width == 0 && image.height == 0) {
		image.width = data.imagewidth;
		image.height = data.imageheight;
	}

	if (data.loading && data.loading === 'true') {
		var loaderContainer = L.DomUtil.create('div', 'ui-drawing-area-loader-container', container);
		L.DomUtil.create('div', 'ui-drawing-area-loader', loaderContainer);
	}
	if (data.placeholderText && data.placeholderText === 'true') {
		var spanContainer = L.DomUtil.create('div', 'ui-drawing-area-placeholder-container', container);
		var span = L.DomUtil.create('span', 'ui-drawing-area-placeholder', spanContainer);
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

	L.DomEvent.on(image, 'dblclick', function(e) {
		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];

		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;
		builder.callback('drawingarea', 'dblclick', container, coordinates, builder);
	}, this);

	L.DomEvent.on(image, 'click touchend', function(e) {
		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];

		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;

		builder.callback('drawingarea', 'click', container, coordinates, builder);
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
		builder.callback('drawingarea', 'mousemove', container, coordinates, builder);
	};

	var endMove = function (e) {
		clearTimeout(moveTimer);
		moveTimer = null;
		moveFunc = null;

		window.removeEventListener('mousemove', onMove);
		window.removeEventListener('mouseup', endMove);

		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];
		builder.callback('drawingarea', 'mouseup', container, coordinates, builder);
	};

	image.addEventListener('mousedown', function (e) {
		moveFunc = function () {
			var pos = getCoordinatesFromEvent(e);
			var coordinates = pos[0] + ';' + pos[1];
			builder.callback('drawingarea', 'mousedown', container, coordinates, builder);
		};

		moveTimer = setTimeout(function () {
			moveFunc();
			moveFunc = null;
			moveTimer = null;
		}, 200);

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', endMove);
	});

	var itemInfo = app.valuesets[data.id];
	if (itemInfo) {
		_setupItemInfo(itemInfo, data);

		// simulate mouse enter event
		image.addEventListener('mousemove', function (e) {
			// normPos is in [0,1] coordinates
			const normPos = getCoordinatesFromEvent(e);
			const pos = [normPos[0] * data.imagewidth, normPos[1] * data.imageheight];

			const item = _getItemPos(pos, itemInfo);

			const currentItem = itemInfo.currentItem;
			if (currentItem && _isCurrentItem(currentItem, item)) {
				return;
			}

			if (_isOverItem(pos, item, itemInfo)) {
				itemInfo.currentItem = item;

				const x = (item[1] + 0.5) / itemInfo.columns;
				const y = (item[0] + 0.5) / itemInfo.rows;

				const coordinates = x + ';' + y;
				builder.callback('drawingarea', 'mousemove', container, coordinates, builder);
			}
		});

		image.addEventListener('mouseleave', function (e) {
			itemInfo.currentItem = null;

			const pos = getCoordinatesFromEvent(e);
			const coordinates = pos[0] + ';' + pos[1];
			builder.callback('drawingarea', 'mousemove', container, coordinates, builder);
		});
	}

	var modifier = 0;

	image.addEventListener('keydown', function(event) {
		if (event.key === 'Enter') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.RETURN | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Escape' || event.key === 'Esc') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.ESCAPE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Left' || event.key === 'ArrowLeft') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.LEFT | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Right' || event.key === 'ArrowRight') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.RIGHT | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Up' || event.key === 'ArrowUp') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.UP | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Down' || event.key === 'ArrowDown') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.DOWN | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Home') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.HOME | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'End') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.END | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Backspace') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.BACKSPACE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Delete') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.DELETE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Space') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.SPACE | modifier, builder);
			event.preventDefault();
		} else if (event.key === 'Tab') {
			builder.callback('drawingarea', 'keypress', container, UNOKey.TAB | modifier, builder);
		} else if (event.key === 'Shift') {
			modifier = modifier | UNOModifier.SHIFT;
			event.preventDefault();
		} else if (event.key === 'Control') {
			modifier = modifier | UNOModifier.CTRL;
			event.preventDefault();
		} else if (event.key === 'a' && event.ctrlKey) {
			builder.callback('drawingarea', 'keypress', container, UNOKey.A | UNOModifier.CTRL, builder);
		}
	});

	image.addEventListener('keyup', function(event) {
		if (event.key === 'Shift') {
			modifier = modifier & (~UNOModifier.SHIFT);
			event.preventDefault();
		} else if (event.key === 'Control') {
			modifier = modifier & (~UNOModifier.CTRL);
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
				keyCode |= UNOModifier.CTRL;
			}

			builder.callback('drawingarea', 'keypress', container, keyCode, builder);
		}

		event.preventDefault();
	});

	return false;
}

JSDialog.drawingArea = function (parentContainer, data, builder) {
	var buildInnerData = _drawingAreaControl(parentContainer, data, builder);
	return buildInnerData;
};
