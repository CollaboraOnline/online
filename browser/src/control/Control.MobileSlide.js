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
 * L.Control.MobileSlide is used to add new slide button on the Impress document.
 */

L.Control.MobileSlide = L.Control.extend({
	options: {
		position: 'bottomright'
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initLayout();
		}

		return this._container;
	},

	onRemove: function () {
		this._map = undefined;
	},

	_onAddSlide: function () {
		this._map.insertPage();
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
		this._createButton('+', '', 'leaflet-control-zoom-in',  this._container, this._onAddSlide,  this);
		return this._container;
	},

	_createButton: function (html, title, className, container, fnOnClick, context) {
		var button = L.DomUtil.create('a', className, container);
		button.innerHTML = html;
		button.href = '#';
		button.title = title;

		L.DomEvent
		    .on(button, 'click', L.DomEvent.stopPropagation)
		    .on(button, 'mousedown', L.DomEvent.stopPropagation)
		    .on(button, 'click', L.DomEvent.preventDefault)
		    .on(button, 'click', this._map.focus, this._map)
		    .on(button, 'click', fnOnClick, context);

		return button;
	},
});

L.control.mobileSlide = function (options) {
	return new L.Control.MobileSlide(options);
};

