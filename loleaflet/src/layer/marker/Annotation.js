/*
 * L.Annotation
 */

L.Annotation = L.Layer.extend({
	options: {
		minWidth: 240,
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

		map._panes.popupPane.appendChild(this._container);
		this.update();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		map._panes.popupPane.removeChild(this._container);
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

	isEdit: function () {
		return this._editNode && this._editNode.style.display !== 'none';
	},

	focus: function () {
		this._editText.focus();
	},

	_initLayout: function () {
		var container = this._container =
			L.DomUtil.create('div', 'loleaflet-annotation');
		var wrapper = this._wrapper =
			L.DomUtil.create('div', 'loleaflet-annotation-content-wrapper', container);
		var table = L.DomUtil.create('table', 'loleaflet-annotation-table', wrapper);
		var tbody = L.DomUtil.create('tbody', '', table);
		var tr = L.DomUtil.create('tr', '', tbody);
		var tdImg = L.DomUtil.create('td', 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create('td', 'loleaflet-annotation-author', tr);
		var tdMenu = L.DomUtil.create('td', '', tr);
		var imgAuthor = L.DomUtil.create('img', '', tdImg);
		imgAuthor.src = L.Icon.Default.imagePath + '/user.png';
		L.DomUtil.create('div', 'loleaflet-annotation-userline', tdImg);
		this._contentAuthor = L.DomUtil.create('div', 'loleaflet-annotation-content-author', tdAuthor);
		this._contentDate = L.DomUtil.create('div', 'loleaflet-annotation-date', tdAuthor);
		var divMenu = L.DomUtil.create('div', 'loleaflet-annotation-menu', tdMenu);
		divMenu.annotation = this;
		this._contentNode = L.DomUtil.create('div', 'loleaflet-annotation-content', wrapper);
		this._editNode = L.DomUtil.create('div', 'loleaflet-annotation-edit', wrapper);
		this._contentText = L.DomUtil.create('div', '', this._contentNode);
		this._editText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this._editNode);

		var buttons = L.DomUtil.create('div', '', this._editNode);
		var button = L.DomUtil.create('input', 'loleaflet-controls', buttons);
		button.type = 'button';
		button.value = _(' Save ');
		L.DomEvent.on(button, 'click', this._onSaveClick, this);
		button = L.DomUtil.create('input', 'loleaflet-controls', buttons);
		button.type = 'button';
		button.value = _('Cancel');
		L.DomEvent.on(button, 'click', this._onCancelClick, this);
		L.DomEvent.disableScrollPropagation(this._container);

		this._container.style.visibility = 'hidden';
		this._editNode.style.display = 'none';

		var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup'];
		L.DomEvent.on(container, 'click', this._onMouseClick, this);
		L.DomEvent.on(container, 'mouseleave', this._onMouseLeave, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], L.DomEvent.stopPropagation, this);
		}
	},

	_onCancelClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._editText.value = this._contentText.innerHTML;
		this.show();
		this._map.fire('AnnotationCancel', {annotation: this});
	},

	_onMouseClick: function (e) {
		var target = e.target || e.srcElement;
		L.DomEvent.stopPropagation(e);
		if (L.DomUtil.hasClass(target, 'loleaflet-annotation-menu')) {
			$(target).contextMenu();
			return;
		}
		L.DomEvent.stopPropagation(e);
		this._map.fire('AnnotationClick', {annotation: this});
	},

	_onMouseLeave: function (e) {
		var layerPoint = this._map.mouseEventToLayerPoint(e),
		    latlng = this._map.layerPointToLatLng(layerPoint);
		L.DomEvent.stopPropagation(e);
		if (this._contextMenu || this.isEdit()) {
			return;
		}
		this.fire('AnnotationMouseLeave', {
			originalEvent: e,
			latlng: latlng,
			layerPoint: layerPoint
		});
	},

	_onSaveClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.text = this._contentText.innerHTML = this._editText.value;
		this.show();
		this._map.fire('AnnotationSave', {annotation: this});
	},

	_updateLayout: function () {
		var style = this._wrapper.style;
		var width = Math.min(this._wrapper.offsetWidth, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';
	},

	_updateContent: function () {
		this._contentText.innerHTML = this._editText.innerHTML = this._data.text;
		this._contentAuthor.innerHTML = this._data.author;
		this._contentDate.innerHTML = this._data.dateTime;
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};
