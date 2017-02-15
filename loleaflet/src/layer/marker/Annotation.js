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
		map._panes.markerPane.removeChild(this._container);
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
		this._contentNode.style.display = '';
		this._editNode.style.display = 'none';
	},

	edit: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = 'none';
		this._editNode.style.display = '';
		return this;
	},

	focus: function () {
		this._editText.focus();
	},

	_initLayout: function () {
		var container = this._container =
			L.DomUtil.create('div', 'loleaflet-annotation');
		var wrapper = this._wrapper =
			L.DomUtil.create('div', 'loleaflet-annotation-content-wrapper', container);

		L.DomEvent.disableScrollPropagation(this._container);
		this._contentNode = L.DomUtil.create('div', 'loleaflet-annotation-content', wrapper);
		this._editNode = L.DomUtil.create('div', 'loleaflet-annotation-edit', wrapper);

		this._contentNode.setAttribute('id', this._data.id);
		this._contentText = L.DomUtil.create('div', '', this._contentNode);
		this._contentAuthor = L.DomUtil.create('div', '', this._contentNode);
		this._contentDate = L.DomUtil.create('div', '', this._contentNode);

		this._editText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this._editNode);
		this._editAuthor = L.DomUtil.create('div', '', this._editNode);
		this._editDate = L.DomUtil.create('div', '', this._editNode);

		var buttons = L.DomUtil.create('div', '', this._editNode);
		var button = L.DomUtil.create('input', 'loleaflet-controls', buttons);
		button.type = 'button';
		button.value = _(' Save ');
		L.DomEvent.on(button, 'click', this._onSaveClick, this);
		button = L.DomUtil.create('input', 'loleaflet-controls', buttons);
		button.type = 'button';
		button.value = _('Cancel');
		L.DomEvent.on(button, 'click', this._onCancelClick, this);

		this._container.style.visibility = 'hidden';
		this._editNode.style.display = 'none';

		var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup'];
		L.DomEvent.on(container, 'click', this._onMouseClick, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], L.DomEvent.stopPropagation, this);
		}
	},

	_onCancelClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._editText.value = this._contentText.innerHTML;
		this.show();
		this._map.fire('AnnotationCancel', {id: this._data.id});
	},

	_onMouseClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._map.fire('AnnotationClick', {id: this._data.id});
	},

	_onSaveClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.text = this._contentText.innerHTML = this._editText.value;
		this.show();
		this._map.fire('AnnotationSave', {id: this._data.id});
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
		this._contentNode.setAttribute('id', this._data.id);
		this._contentText.innerHTML = this._editText.innerHTML = this._data.text;
		this._contentAuthor.innerHTML = this._editAuthor.innerHTML = this._data.author;
		this._contentDate.innerHTML = this._editDate.innerHTML = this._data.dateTime;
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};

