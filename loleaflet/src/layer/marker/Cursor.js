/*
 * L.Cursor blinking cursor.
 */

L.Cursor = L.Layer.extend({

	options: {
		opacity: 1
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	onAdd: function () {
		this._initLayout();
		this.update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	getEvents: function () {
		var events = {viewreset: this.update};

		return events;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		var oldLatLng = this._latlng;
		this._latlng = L.latLng(latlng);
		this.update();
		return this.fire('move', {oldLatLng: oldLatLng, latlng: this._latlng});
	},

	update: function () {
		if (this._container) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-cursor');

		//<span class="blinking-cursor">|</span>
		this._span = L.DomUtil.create('span', 'blinking-cursor', this._container);
		this._span.innerHTML = '|';

		L.DomEvent
			.disableClickPropagation(this._span)
			.disableScrollPropagation(this._container);

		if (this._container) {
			this.getPane().appendChild(this._container);
		}
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);

		this._zIndex = pos.y + this.options.zIndexOffset;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		var opacity = this.options.opacity;
		L.DomUtil.setOpacity(this._container, opacity);
	},

	setSize: function (size) {
		this._container.style.lineHeight = size.y + 'px';
		this._span.style.fontSize = size.y - 2 + 'px';
	}
});

L.cursor = function (latlng, options) {
	return new L.Cursor(latlng, options);
};
