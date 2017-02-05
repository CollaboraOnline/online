/*
 * L.Annotation
 */

L.Annotation = L.Layer.extend({
	options: {
		minWidth: 200,
		maxHeight: 50
	},

	initialize: function (latlng, data, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._data = data;
	},

	onAdd: function (map) {
		this._map = map;
		if (!this._container) {
			this._initLayout();
		}

		map._panes.markerPane.appendChild(this._container);
		this.update();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		map._panes.makerPane.removeChild(this._container);
		this._map = null;
	},

	update: function () {
		if (!this._map) { return; }

		this._updateContent();
		this._updateLayout();
		this._updatePosition();
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		if (this._map) {
			this._updatePosition();
		}
		return this;
	},

	getBounds: function () {
		var point = this._map.latLngToLayerPoint(this._latlng);
		return L.bounds(point, point.add(L.point(this._container.offsetWidth, this._container.offsetHeight)));
	},

	show: function () {
		this._container.style.visibility = '';
	},

	_initLayout: function () {
		var container = this._container =
			L.DomUtil.create('div', 'loleaflet-annotation');
		var wrapper = this._wrapper =
			L.DomUtil.create('div', 'loleaflet-annotation-content-wrapper', container);

		this._contentNode = L.DomUtil.create('div', 'loleaflet-annotation-content', wrapper);
		L.DomEvent.disableScrollPropagation(this._contentNode);

		this._text = document.createElement('span');
		this._author = document.createElement('span');
		this._dateTime = document.createElement('span');
		this._contentNode.appendChild(this._text);
		this._contentNode.appendChild(document.createElement('br'));
		this._contentNode.appendChild(document.createElement('br'));
		this._contentNode.appendChild(this._author);
		this._contentNode.appendChild(document.createElement('br'));
		this._contentNode.appendChild(this._dateTime);
		this._container.style.visibility = 'hidden';

		var events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];
		L.DomEvent.on(container, 'click', this._onMouseClick, this);

		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], this._stopMouseEvent, this);
		}
	},

	_onMouseClick: function (e) {
		this._map.fire('AnnotationClick', {id: this._data.id});
	},

	_stopMouseEvent: function (e) {
		if (e.type !== 'mousedown') {
			L.DomEvent.stopPropagation(e);
		} else {
			L.DomEvent.preventDefault(e);
		}
	},

	_updateLayout: function () {
		var style = this._contentNode.style;
		var width = Math.max(this._contentNode.offsetWidth, this.options.minWidth);
		var height = Math.max(this._contentNode.offsetHeight, this.options.maxHeight);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';
		style.height = height + 'px';
	},

	_updateContent: function () {
		this._text.innerHTML = this._data.text;
		this._author.innerHTML = this._data.author;
		this._dateTime.innerHTML = this._data.dateTime;
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};

