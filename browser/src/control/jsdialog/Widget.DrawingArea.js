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
	L.DomEvent.on(image, 'click touchend', function(e) {
		var x = 0;
		var y = 0;

		if (e.offsetX) {
			x = e.offsetX;
			y = e.offsetY;
		} else if (e.changedTouches && e.changedTouches.length) {
			x = e.changedTouches[e.changedTouches.length-1].pageX - $(image).offset().left;
			y = e.changedTouches[e.changedTouches.length-1].pageY - $(image).offset().top;
		}

		var coordinates = (x / image.offsetWidth) + ';' + (y / image.offsetHeight);
		builder.callback('drawingarea', 'click', container, coordinates, builder);
	}, this);

	return false;
}

JSDialog.drawingArea = function (parentContainer, data, builder) {
	var buildInnerData = _drawingAreaControl(parentContainer, data, builder);
	return buildInnerData;
};
