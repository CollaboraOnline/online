/*
 * L.Annotation
 */

L.Annotation = L.Layer.extend({
	options: {
		minWidth: 160,
		maxHeight: 50,
		imgSize: L.point([32, 32]),
		noMenu: false
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
		if (this._data.textSelected) {
			this._map.removeLayer(this._data.textSelected);
		}
		this._map = null;
	},

	update: function () {
		if (!this._map) { return; }

		this._updateContent();
		this._updateLayout();
		this._updatePosition();
	},

	setData: function (data) {
		if (this._data.textSelected) {
			this._map.removeLayer(this._data.textSelected);
		}
		this._data = data;
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
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
		if (this._data.textSelected && !this._map.hasLayer(this._data.textSelected)) {
			this._map.addLayer(this._data.textSelected);
		}
	},

	hide: function () {
		this._container.style.visibility = 'hidden';
		this._contentNode.style.display = 'none';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
		if (this._data.textSelected && this._map.hasLayer(this._data.textSelected)) {
			this._map.removeLayer(this._data.textSelected);
		}
	},

	edit: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = 'none';
		this._nodeModify.style.display = '';
		this._nodeReply.style.display = 'none';
		return this;
	},

	reply: function () {
		this._container.style.visibility = '';
		this._contentNode.style.display = '';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = '';
		return this;
	},

	isEdit: function () {
		return (this._nodeModify && this._nodeModify.style.display !== 'none') ||
		       (this._nodeReply && this._nodeReply.style.display !== 'none');
	},

	focus: function () {
		this._nodeModifyText.focus();
		this._nodeReplyText.focus();
	},

	parentOf: function(comment) {
		return this._data.id === comment._data.parent;
	},

	_createButton: function(container, value, handler) {
		var button = L.DomUtil.create('input', 'loleaflet-controls', container);
		button.type = 'button';
		button.value = value;
		L.DomEvent.on(button, 'mousedown', L.DomEvent.preventDefault);
		L.DomEvent.on(button, 'click', handler, this);
	},

	_initLayout: function () {
		var buttons,
		    tagTd = 'td',
		    tagDiv = 'div',
		    empty = '',
		    click = 'click',
		    tagTextArea = 'textarea',
		    cancel = _('Cancel'),
		    classTextArea = 'loleaflet-annotation-textarea',
		    classEdit = 'loleaflet-annotation-edit';
		var container = this._container =
		    L.DomUtil.create(tagDiv, 'loleaflet-annotation');
		if (this._data.trackchange) {
			var wrapper = this._wrapper = L.DomUtil.create(tagDiv, 'loleaflet-annotation-redline-content-wrapper', container);
		} else {
			wrapper = this._wrapper = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-wrapper', container);
		}
		this._author = L.DomUtil.create('table', 'loleaflet-annotation-table', wrapper);
		var tbody = L.DomUtil.create('tbody', empty, this._author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', empty, tdImg);
		imgAuthor.setAttribute('src', L.Icon.Default.imagePath + '/user.png');
		imgAuthor.setAttribute('width', this.options.imgSize.x);
		imgAuthor.setAttribute('height', this.options.imgSize.y);
		L.DomUtil.create(tagDiv, 'loleaflet-annotation-userline', tdImg);
		this._contentAuthor = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-author', tdAuthor);
		this._contentDate = L.DomUtil.create(tagDiv, 'loleaflet-annotation-date', tdAuthor);

		if (this._data.trackchange) {
			var tdAccept = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var acceptButton = L.DomUtil.create('button', 'loleaflet-redline-accept-button', tdAccept);
			var tdReject = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var rejectButton = L.DomUtil.create('button', 'loleaflet-redline-reject-button', tdReject);

			acceptButton.title = _('Accept change');
			L.DomEvent.on(acceptButton, click, function() {
				this._map.fire('RedlineAccept', {id: this._data.id});
			}, this);

			rejectButton.title = _('Reject change');
			L.DomEvent.on(rejectButton, click, function() {
				this._map.fire('RedlineReject', {id: this._data.id});
			}, this);
		}

		if (this.options.noMenu !== true && this._map._permission !== 'readonly') {
			var tdMenu = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var divMenu = L.DomUtil.create(tagDiv, this._data.trackchange ? 'loleaflet-annotation-menu-redline' : 'loleaflet-annotation-menu', tdMenu);
			divMenu.title = _('Open menu');
			divMenu.annotation = this;
		}
		if (this._data.trackchange) {
			this._captionNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-caption', wrapper);
			this._captionText = L.DomUtil.create(tagDiv, empty, this._captionNode);
		}
		this._contentNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content', wrapper);
		this._nodeModify = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeModifyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeModify);
		this._contentText = L.DomUtil.create(tagDiv, empty, this._contentNode);
		this._nodeReply = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeReplyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeReply);

		buttons = L.DomUtil.create(tagDiv, empty, this._nodeModify);
		L.DomEvent.on(this._nodeModifyText, 'blur', this._onLostFocus, this);
		this._createButton(buttons, _('Save'), this._onSaveComment);
		this._createButton(buttons, cancel, this._onCancelClick);
		buttons = L.DomUtil.create(tagDiv, empty, this._nodeReply);
		this._createButton(buttons, _('Reply'), this._onReplyClick);
		this._createButton(buttons, cancel, this._onCancelClick);
		L.DomEvent.disableScrollPropagation(this._container);

		this._container.style.visibility = 'hidden';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';

		var events = [click, 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup'];
		L.DomEvent.on(container, click, this._onMouseClick, this);
		L.DomEvent.on(container, 'mouseleave', this._onMouseLeave, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], L.DomEvent.stopPropagation, this);
		}
	},

	_onCancelClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._nodeModifyText.value = this._contentText.innerHTML;
		this.show();
		this._map.fire('AnnotationCancel', {annotation: this});
	},

	_onSaveComment: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.text = this._contentText.innerHTML = this._nodeModifyText.value;
		this.show();
		this._map.fire('AnnotationSave', {annotation: this});
	},

	_onLostFocus: function (e) {
		if (this._contentText.innerHTML !== this._nodeModifyText.value) {
			this._onSaveComment(e);
		}
	},

	_onMouseClick: function (e) {
		var target = e.target || e.srcElement;
		L.DomEvent.stopPropagation(e);
		if (L.DomUtil.hasClass(target, 'loleaflet-annotation-menu') || L.DomUtil.hasClass(target, 'loleaflet-annotation-menu-redline')) {
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

	_onReplyClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.reply = this._nodeReplyText.value;
		this._nodeReplyText.value = null;
		this.show();
		this._map.fire('AnnotationReply', {annotation: this});
	},

	_updateLayout: function () {
		var style = this._wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	},

	_updateContent: function () {
		if (!(this._data.dateTime instanceof Date)) {
			this._data.dateTime = new Date(this._data.dateTime.replace(/,.*/, 'Z'));
		}
		this._contentText.innerHTML = this._nodeModifyText.innerHTML = this._data.text;
		this._contentAuthor.innerHTML = this._data.author;
		this._contentDate.innerHTML = this._data.dateTime.toDateString();
		if (this._data.trackchange) {
			this._captionText.innerHTML = this._data.description;
		}
	},

	_updatePosition: function () {
		var pos = this._map.latLngToLayerPoint(this._latlng);
		L.DomUtil.setPosition(this._container, pos);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};
