/*
 * L.ProgressOverlay is used to overlay progress images over the map.
 */

L.ProgressOverlay = L.Layer.extend({

	initialize: function (latlng, size) {
		this._latlng = L.latLng(latlng);
		this._size = size;
	},

	onAdd: function () {
		this._initLayout();
		this.update();
	},

	onRemove: function () {
		L.DomUtil.remove(this._container);
	},

	update: function () {
		if (this._container) {
			var offset = this._size.divideBy(2, true);
			var pos = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(pos.subtract(offset));
		}
		return this;
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-progress-layer');
		this._progress = L.DomUtil.create('div', 'leaflet-progress', this._container);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._label = L.DomUtil.create('span', '', this._bar);

		L.DomUtil.setStyle(this._label, 'line-height', this._size.y + 'px');

		this._container.style.width  = this._size.x + 'px';
		this._container.style.height = this._size.y + 'px';

		L.DomEvent
			.disableClickPropagation(this._progress)
			.disableScrollPropagation(this._container);

		if (this._container) {
			this.getPane().appendChild(this._container);
		}
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
	},

	setValue: function (value) {
		this._bar.style.width = value + '%';
		this._label.innerHTML = value + '%';
	}
});

L.progressOverlay = function (latlng, size) {
	return new L.ProgressOverlay(latlng, size);
};
