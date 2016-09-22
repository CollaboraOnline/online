/*
 * L.ProgressOverlay is used to overlay progress images over the map.
 */

L.ProgressOverlay = L.Layer.extend({

	options: {
		spinnerSpeed: 1.5
	},

	initialize: function (latlng, size) {
		this._latlng = L.latLng(latlng);
		this._size = size;
		this._initLayout();
	},

	onAdd: function () {
		if (this._container) {
			this.getPane().appendChild(this._container);
			this.update();
		}

		this._spinnerInterval = L.LOUtil.startSpinner(this._spinnerCanvas, this.options.spinnerSpeed);
		this._map.on('moveend', this.update, this);
	},

	onRemove: function () {
		if (this._container) {
			this.getPane().removeChild(this._container);
		}

		if (this._spinnerInterval) {
			clearInterval(this._spinnerInterval);
		}
	},

	update: function () {
		if (this._container && this._map) {
			var origin = new L.Point(0, 0);
			var paneOffset = this._map.layerPointToContainerPoint(origin);
			var sizeOffset = this._size.divideBy(2, true);
			var position = this._map.latLngToLayerPoint(this._latlng).round();
			this._setPos(position.subtract(paneOffset).subtract(sizeOffset));
		}
	},

	_initLayout: function () {
		this._container = L.DomUtil.create('div', 'leaflet-progress-layer');
		this._spinner = L.DomUtil.create('div', 'leaflet-progress-spinner', this._container);
		this._spinnerCanvas = L.DomUtil.create('canvas', 'leaflet-progress-spinner-canvas', this._spinner);
		this._label = L.DomUtil.create('div', 'leaflet-progress-label', this._container);
		this._progress = L.DomUtil.create('div', 'leaflet-progress', this._container);
		this._bar = L.DomUtil.create('span', '', this._progress);
		this._value = L.DomUtil.create('span', '', this._bar);

		L.DomUtil.setStyle(this._value, 'line-height', this._size.y + 'px');

		this._container.style.width  = this._size.x + 'px';

		L.DomEvent
			.disableClickPropagation(this._progress)
			.disableScrollPropagation(this._container);
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._container, pos);
	},

	setLabel: function (label) {
		if (this._label.innerHTML !== label) {
			this._label.innerHTML = label;
		}
	},

	setBar: function (bar) {
		if (bar) {
			this._progress.style.visibility = '';
		}
		else {
			this._progress.style.visibility = 'hidden';
		}
	},

	setValue: function (value) {
		this._bar.style.width = value + '%';
		this._value.innerHTML = value + '%';
	}
});

L.progressOverlay = function (latlng, size) {
	return new L.ProgressOverlay(latlng, size);
};
