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
		// a black rectangle
		this._cursor = L.DomUtil.create('div', 'blinking-cursor', this._container);

		L.DomEvent
			.disableClickPropagation(this._cursor)
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
		this._cursor.style.height = size.y + 'px';
		this._container.style.top = '-' + (this._container.clientHeight - size.y - 2) / 2 + 'px';
	}
});

L.cursor = function (latlng, options) {
	return new L.Cursor(latlng, options);
};
