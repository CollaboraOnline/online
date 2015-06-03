/*
 * L.Cursor blinking cursor.
 */

L.Cursor = L.Layer.extend({

	options: {
		zIndexOffset: 0,
		opacity: 1
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	onAdd: function (map) {
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

	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		return this.update();
	},

	update: function () {
		if (this._container) {
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos);
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-popup');

		//<span class="blinking-cursor">|</span>
		var span = L.DomUtil.create('span', 'blinking-cursor', this._container);
		span.innerHTML = '|';

		L.DomEvent
			.disableClickPropagation(span)
			.disableScrollPropagation(this._container);

		if (this._container) {
			this.getPane().appendChild(this._container);
		}
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
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

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	}
});

L.cursor = function (latlng, options) {
	return new L.Cursor(latlng, options);
};
