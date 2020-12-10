/* -*- js-indent-level: 8 -*- */
/*
 * L.Annotation
 */

/* global $ Autolinker L _ Hammer */

L.Annotation = L.Layer.extend({
	options: {
		minWidth: 160,
		maxHeight: 50,
		imgSize: L.point([32, 32]),
		margin: L.point([40, 40]),
		noMenu: false
	},

	initialize: function (latlng, data, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
		this._data = data;
		this._skipCheckBounds = false;
		this._annotationMarker = null;
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
			this._data.textSelected.removeEventParent(map);
			map.removeLayer(this._data.textSelected);
		}
		this.hideMarker();
		this._annotationMarker = null;
		this._map = null;
	},

	update: function () {
		if (!this._map) { return; }

		this._updateContent();
		this._updateLayout();
		this._updatePosition();
		this._updateAnnotationMarker();
	},

	setData: function (data) {
		if (this._data.textSelected) {
			this._data.textSelected.removeEventParent(this._map);
			this._map.removeLayer(this._data.textSelected);
		}
		this._data = data;
	},

	setLatLng: function (latlng, skipCheckBounds) {
		if (!this._latlng.equals(latlng)) {
			this._skipCheckBounds = !!skipCheckBounds;
			this._latlng = latlng;
			this._updatePosition();
			this._skipCheckBounds = false;
		}
		return this;
	},

	/// Returns two points: the top-left (min) and the bottom-right (max).
	getBounds: function () {
		var point = this._map.latLngToLayerPoint(this._latlng);
		return L.bounds(point, point.add(L.point(this._container.offsetWidth, this._container.offsetHeight)));
	},

	getMargin: function () {
		return this.options.margin;
	},

	show: function () {
		if (this._data.textSelected && this._map.hasLayer && !this._map.hasLayer(this._data.textSelected)) {
			this._map.addLayer(this._data.textSelected);
		}
		this.showMarker();
		if (window.mode.isMobile())
			return;

		this._container.style.visibility = '';
		this._contentNode.style.display = '';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
	},

	hide: function () {
		this._container.style.visibility = 'hidden';
		this._contentNode.style.display = 'none';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';
		if (this._data.textSelected && this._map.hasLayer(this._data.textSelected)) {
			this._map.removeLayer(this._data.textSelected);
		}
		this.hideMarker();
	},

	showMarker: function () {
		if (this._annotationMarker != null) {
			this._map.addLayer(this._annotationMarker);
		}
	},

	hideMarker: function () {
		if (this._annotationMarker != null) {
			this._map.removeLayer(this._annotationMarker);
		}
	},

	isVisible: function () {
		return (this._container.style && this._container.style.visibility === '');
	},

	edit: function () {
		this._nodeModify.style.display = '';
		this._nodeReply.style.display = 'none';
		this._container.style.visibility = '';
		this._contentNode.style.display = 'none';
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
		$(this._container).addClass('annotation-active');
		this._nodeModifyText.focus();
		this._nodeReplyText.focus();
	},

	parentOf: function(comment) {
		return this._data.id === comment._data.parent;
	},

	onZoom: function(scaleFactor) {
		var authorImageWidth = Math.round(this.options.imgSize.x * scaleFactor);
		var authorImageHeight = Math.round(this.options.imgSize.y * scaleFactor);
		this._authorAvatarImg.setAttribute('width', authorImageWidth);
		this._authorAvatarImg.setAttribute('height', authorImageHeight);
	},

	_checkBounds: function () {
		if (this._skipCheckBounds || !this._map || this._map.animatingZoom || !this.isVisible()) {
			return;
		}
		var maxBounds = this._map.getLayerMaxBounds();
		var thisBounds = this.getBounds();
		if (!maxBounds.contains(thisBounds)) {
			var docBounds = this._map.getLayerDocBounds();
			var delta = L.point(Math.max(thisBounds.max.x - docBounds.max.x, 0), Math.max(thisBounds.max.y - docBounds.max.y, 0));
			if (delta.x > 0) {
				delta.x += this.options.margin.x;
			}
			if (delta.y > 0) {
				delta.y += this.options.margin.y;
			}
			this._map.fire('updatemaxbounds', {
				sizeChanged: true,
				extraSize: delta
			});
		}
	},

	_createButton: function(container, id, value, handler) {
		var button = L.DomUtil.create('input', 'annotation-button', container);
		button.id = id;
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
		var rowResolved = L.DomUtil.create('tr', empty, tbody);
		var tdResolved = L.DomUtil.create(tagTd, 'loleaflet-annotation-resolved', rowResolved);
		var pResolved = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-resolved', tdResolved);
		this._resolved = pResolved;

		this._updateResolvedField(this._data.resolved);

		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg'));
		imgAuthor.setAttribute('width', this.options.imgSize.x);
		imgAuthor.setAttribute('height', this.options.imgSize.y);
		imgAuthor.onerror = function () { imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg')); };
		this._authorAvatarImg = imgAuthor;
		this._authorAvatartdImg = tdImg;
		this._contentAuthor = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-author', tdAuthor);
		this._contentDate = L.DomUtil.create(tagDiv, 'loleaflet-annotation-date', tdAuthor);

		if (this._data.trackchange && !this._map.isPermissionReadOnly()) {
			var tdAccept = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var acceptButton = this._acceptButton = L.DomUtil.create('button', 'loleaflet-redline-accept-button', tdAccept);
			var tdReject = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var rejectButton = this._rejectButton = L.DomUtil.create('button', 'loleaflet-redline-reject-button', tdReject);
			var acceptButtonTooltipText = _('Accept change');
			var rejectButtonTooltipText = _('Reject change');

			acceptButton.dataset.title = acceptButtonTooltipText;
			acceptButton.setAttribute('aria-label', acceptButtonTooltipText);
			L.DomEvent.on(acceptButton, click, function() {
				this._map.fire('RedlineAccept', {id: this._data.id});
			}, this);

			rejectButton.dataset.title = rejectButtonTooltipText;
			rejectButton.setAttribute('aria-label', rejectButtonTooltipText);
			L.DomEvent.on(rejectButton, click, function() {
				this._map.fire('RedlineReject', {id: this._data.id});
			}, this);
		}

		if (this.options.noMenu !== true && this._map.isPermissionEditForComments()) {
			var tdMenu = L.DomUtil.create(tagTd, 'loleaflet-annotation-menubar', tr);
			var divMenu = this._menu = L.DomUtil.create(tagDiv, this._data.trackchange ? 'loleaflet-annotation-menu-redline' : 'loleaflet-annotation-menu', tdMenu);
			var divMenuTooltipText = _('Open menu');
			divMenu.dataset.title = divMenuTooltipText;
			divMenu.setAttribute('aria-label', divMenuTooltipText);
			divMenu.annotation = this;
		}
		if (this._data.trackchange) {
			this._captionNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-caption', wrapper);
			this._captionText = L.DomUtil.create(tagDiv, empty, this._captionNode);
		}
		this._contentNode = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content loleaflet-dont-break', wrapper);
		this._nodeModify = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeModifyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeModify);
		this._contentText = L.DomUtil.create(tagDiv, empty, this._contentNode);
		this._nodeReply = L.DomUtil.create(tagDiv, classEdit, wrapper);
		this._nodeReplyText = L.DomUtil.create(tagTextArea, classTextArea, this._nodeReply);

		buttons = L.DomUtil.create(tagDiv, empty, this._nodeModify);
		L.DomEvent.on(this._nodeModifyText, 'blur', this._onLostFocus, this);
		L.DomEvent.on(this._nodeReplyText, 'blur', this._onLostFocusReply, this);
		this._createButton(buttons, 'annotation-cancel', cancel, this._onCancelClick);
		this._createButton(buttons, 'annotation-save', _('Save'), this._onSaveComment);
		buttons = L.DomUtil.create(tagDiv, empty, this._nodeReply);
		this._createButton(buttons, 'annotation-cancel', cancel, this._onCancelClick);
		this._createButton(buttons, 'annotation-reply', _('Reply'), this._onReplyClick);
		L.DomEvent.disableScrollPropagation(this._container);

		this._container.style.visibility = 'hidden';
		this._nodeModify.style.display = 'none';
		this._nodeReply.style.display = 'none';

		var events = [click, 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup', 'touchstart', 'touchmove', 'touchend'];
		L.DomEvent.on(container, click, this._onMouseClick, this);
		L.DomEvent.on(container, 'mouseleave', this._onMouseLeave, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(container, events[it], L.DomEvent.stopPropagation, this);
		}

		L.DomEvent.on(container, 'touchstart',
			function (e) {
				if (e && e.touches.length > 1) {
					L.DomEvent.preventDefault(e);
				}
			},
			this);

	},

	_onCancelClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._nodeModifyText.value = this._contentText.origText;
		this._nodeReplyText.value = '';
		this.show();
		if (this._map)
			this._map.fire('AnnotationCancel', {annotation: this});
	},

	_onSaveComment: function (e) {
		L.DomEvent.stopPropagation(e);
		this._data.text = this._nodeModifyText.value;
		this._updateContent();
		this.show();
		this._checkBounds();
		this._map.fire('AnnotationSave', {annotation: this});
	},

	_onLostFocus: function (e) {
		$(this._container).removeClass('annotation-active');
		if (this._contentText.origText !== this._nodeModifyText.value) {
			this._onSaveComment(e);
		}
		else if (this._nodeModifyText.value == '') {
			// Implies that this._contentText.origText == ''
			this._onCancelClick(e);
		}
	},

	_onLostFocusReply: function(e) {
		if (this._nodeReplyText.value !== '') {
			this._onReplyClick(e);
		}
	},

	_onMouseClick: function (e) {
		var target = e.target || e.srcElement;
		L.DomEvent.stopPropagation(e);
		if (L.DomUtil.hasClass(target, 'loleaflet-annotation-menu') || L.DomUtil.hasClass(target, 'loleaflet-annotation-menu-redline')) {
			$(target).contextMenu();
			return;
		} else if ((window.mode.isMobile() || window.mode.isTablet())
			&& this._map.getDocType() == 'spreadsheet') {
			this.hide();
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
		if (window.mode.isMobile() || window.mode.isTablet()) {
			e.annotation._data.reply = e.annotation._data.text;
			e.annotation.show();
			e.annotation._checkBounds();
			this._map.fire('AnnotationReply', {annotation: e.annotation});
		} else {
			this._data.reply = this._nodeReplyText.value;
			// Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
			// While in browsers like Chrome and Firefox, a null value is automatically converted to ''
			// Better to assign '' here instead of null to keep the behavior same for all
			this._nodeReplyText.value = '';
			this.show();
			this._checkBounds();
			this._map.fire('AnnotationReply', {annotation: this});
		}
	},

	_onResolveClick: function (e) {
		L.DomEvent.stopPropagation(e);
		this._map.fire('AnnotationResolve', {annotation: this});
	},

	_updateLayout: function () {
		var style = this._wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	},

	_updateResolvedField: function(state) {
		$(this._resolved).text(state=='true' ? 'Resolved' : '');
	},

	_updateContent: function () {
		// .text() method will escape the string, does not interpret the string as HTML
		$(this._contentText).text(this._data.text);
		// Get the escaped HTML out and find for possible, useful links
		var linkedText = Autolinker.link($(this._contentText).html());
		// Set the property of text field directly. This is insecure otherwise because it doesn't escape the input
		// But we have already escaped the input before and only thing we are adding on top of that is Autolinker
		// generated text.
		this._contentText.innerHTML = linkedText;
		// Original unlinked text
		this._contentText.origText = this._data.text;
		$(this._nodeModifyText).text(this._data.text);
		$(this._contentAuthor).text(this._data.author);

		this._updateResolvedField(this._data.resolved);
		$(this._authorAvatarImg).attr('src', this._data.avatar);
		if (!this._data.avatar) {
			$(this._authorAvatarImg).css('padding-top', '4px');
		}
		var user = this._map.getViewId(this._data.author);
		if (user >= 0) {
			var color = L.LOUtil.rgbToHex(this._map.getViewColor(user));
			$(this._authorAvatartdImg).css('border-color', color);
		}

		var d = new Date(this._data.dateTime.replace(/,.*/, 'Z'));
		var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
		$(this._contentDate).text(isNaN(d.getTime()) ? this._data.dateTime: d.toLocaleDateString(String.locale, dateOptions));

		if (this._data.trackchange) {
			$(this._captionText).text(this._data.description);
		}
	},

	_updatePosition: function () {
		if (this._map) {
			var pos = this._map.latLngToLayerPoint(this._latlng);
			L.DomUtil.setPosition(this._container, pos);
		}
		this._checkBounds();
	},

	_updateScaling: function (scaleFactor, initialLayoutData) {
		if (window.mode.isDesktop())
			return;

		var wrapperWidth = Math.round(initialLayoutData.wrapperWidth * scaleFactor);
		this._wrapper.style.width = wrapperWidth + 'px';
		var wrapperFontSize = Math.round(initialLayoutData.wrapperFontSize * scaleFactor);
		this._wrapper.style.fontSize = wrapperFontSize + 'px';
		var contentAuthorHeight = Math.round(initialLayoutData.authorContentHeight * scaleFactor);
		this._contentAuthor.style.height = contentAuthorHeight + 'px';
		var dateFontSize = Math.round(initialLayoutData.dateFontSize * scaleFactor);
		this._contentDate.style.fontSize = dateFontSize + 'px';
		if (this._menu) {
			var menuWidth = Math.round(initialLayoutData.menuWidth * scaleFactor);
			this._menu.style.width = menuWidth + 'px';
			var menuHeight = Math.round(initialLayoutData.menuHeight * scaleFactor);
			this._menu.style.height = menuHeight + 'px';

			if (this._acceptButton) {
				this._acceptButton.style.width = menuWidth + 'px';
				this._acceptButton.style.height = menuHeight + 'px';
			}
			if (this._rejectButton) {
				this._rejectButton.style.width = menuWidth + 'px';
				this._rejectButton.style.height = menuHeight + 'px';
			}
		}

		var authorImageWidth = Math.round(this.options.imgSize.x * scaleFactor);
		var authorImageHeight = Math.round(this.options.imgSize.y * scaleFactor);
		this._authorAvatarImg.setAttribute('width', authorImageWidth);
		this._authorAvatarImg.setAttribute('height', authorImageHeight);
	},

	_updateAnnotationMarker: function () {
		// Make sure to place the markers only for presentations and draw documents
		if (this._map._docLayer._docType !== 'presentation')
			return;
		if (this._data == null)
			return;
		if (this._annotationMarker == null) {
			this._annotationMarker = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'annotation-marker',
					iconSize: null
				}),
				draggable: true
			});
			if (this._map._docLayer._partHashes[this._map._docLayer._selectedPart] == this._data.parthash)
				this._map.addLayer(this._annotationMarker);
		}
		if (this._data.rectangle != null) {
			var stringTwips = this._data.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(stringTwips[0]), parseInt(stringTwips[1]));
			var offset = new L.Point(parseInt(stringTwips[2]), parseInt(stringTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var bounds = new L.LatLngBounds(
				this._map._docLayer._twipsToLatLng(topLeftTwips, this._map.getZoom()),
				this._map._docLayer._twipsToLatLng(bottomRightTwips, this._map.getZoom()));
			this._annotationMarker.setLatLng(bounds.getNorthWest());
			this._annotationMarker.on('dragstart drag dragend', this._onMarkerDrag, this);
			this._annotationMarker.on('click', this._onMarkerClick, this);
		}
		if (this._annotationMarker._icon) {
			(new Hammer(this._annotationMarker._icon, {recognizers: [[Hammer.Tap]]}))
				.on('tap', function() {
					this._map._docLayer._openCommentWizard(this);
				}.bind(this));
		}
	},
	_onMarkerDrag: function(event) {
		if (this._annotationMarker == null)
			return;
		if (event.type === 'dragend') {
			var pointTwip = this._map._docLayer._latLngToTwips(this._annotationMarker.getLatLng());
			this._sendAnnotationPositionChange(pointTwip);
		}
	},
	_onMarkerClick: function() {
		this._map.fire('AnnotationSelect', {annotation: this});
	},
	_sendAnnotationPositionChange: function(newPosition) {
		var comment = {
			Id: {
				type: 'string',
				value: this._data.id
			},
			PositionX: {
				type: 'int32',
				value: newPosition.x
			},
			PositionY: {
				type: 'int32',
				value: newPosition.y
			}
		};
		this._map.sendUnoCommand('.uno:EditAnnotation', comment);
	}
});

L.annotation = function (latlng, data, options) {
	return new L.Annotation(latlng, data, options);
};
