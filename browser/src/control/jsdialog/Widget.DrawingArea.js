/* -*- js-indent-level: 8 -*- */
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
 *
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 */

/* global JSDialog $ */

function _drawingAreaControl (parentContainer, data, builder) {
	var container = L.DomUtil.create('div', builder.options.cssClass + ' ui-drawing-area-container', parentContainer);
	container.id = data.id;

	if (!data.image)
		return;

	var image = L.DomUtil.create('img', builder.options.cssClass + ' ui-drawing-area', container);
	image.src = data.image.replace(/\\/g, '');
	image.alt = data.text;
	image.title = data.text;
	builder.map.uiManager.enableTooltip(image);

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
		var ret = [0, 0];

		if (e.offsetX) {
			ret[0] = e.offsetX;
			ret[1] = e.offsetY;
		} else if (e.changedTouches && e.changedTouches.length) {
			ret[0] = e.changedTouches[e.changedTouches.length-1].pageX - $(image).offset().left;
			ret[1] = e.changedTouches[e.changedTouches.length-1].pageY - $(image).offset().top;
		}

		ret[0] = ret[0] / image.offsetWidth;
		ret[1] = ret[1] / image.offsetHeight;

		return ret;
	};

	var tapTimer = null;
	L.DomEvent.on(image, 'click touchend', function(e) {
		var pos = getCoordinatesFromEvent(e);
		var coordinates = pos[0] + ';' + pos[1];

		if (tapTimer == null) {
			tapTimer = setTimeout(function () {
				tapTimer = null;
				builder.callback('drawingarea', 'click', container, coordinates, builder);
			}, 300);
		} else {
			clearTimeout(tapTimer);
			tapTimer = null;
			builder.callback('drawingarea', 'click', container, coordinates, builder);
			builder.callback('drawingarea', 'dblclick', container, coordinates, builder);
		}
	}, this);

	return false;
}

JSDialog.drawingArea = function (parentContainer, data, builder) {
	var buildInnerData = _drawingAreaControl(parentContainer, data, builder);
	return buildInnerData;
};
