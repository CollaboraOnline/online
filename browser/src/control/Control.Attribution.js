/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.Attribution is used for displaying attribution on the map (added by default).
 */

L.Control.Attribution = L.Control.extend({
	options: {
		position: 'bottomright',
		prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function () {
		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
			L.DomEvent.disableClickPropagation(this._container);
		}

		this._update();

		return this._container;
	},

	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		this._container.innerHTML = this.options.prefix;
	}
});

L.control.attribution = function (options) {
	return new L.Control.Attribution(options);
};
