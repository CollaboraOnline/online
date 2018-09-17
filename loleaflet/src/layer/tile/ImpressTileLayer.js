/* -*- js-indent-level: 8 -*- */
/*
 * Impress tile layer is used to display a presentation document
 */

/* global $ _ w2ui w2utils _UNO */
L.ImpressTileLayer = L.TileLayer.extend({
	extraSize: L.point(290, 0),

	newAnnotation: function (comment) {
		if (this._draft) {
			return;
		}
		this.onAnnotationCancel();
		this._draft = L.annotation(L.latLng(0, 0), comment, {noMenu: true}).addTo(this._map);
		this._draft.edit();
		var mapCenter = this._map.latLngToLayerPoint(this._map.getCenter());
		var bounds = this._draft.getBounds();
		var topLeft = mapCenter.subtract(L.point(bounds.max.x - bounds.min.x, (bounds.max.y - bounds.min.y)/2));
		this._draft.setLatLng(this._map.layerPointToLatLng(topLeft));
		this.layoutAnnotations();
		this._draft.focus();
	},

	beforeAdd: function (map) {
		map.on('zoomend', this._onAnnotationZoom, this);
		map.on('updateparts', this.onUpdateParts, this);
		map.on('AnnotationCancel', this.onAnnotationCancel, this);
		map.on('AnnotationReply', this.onReplyClick, this);
		map.on('AnnotationSave', this.onAnnotationSave, this);
		map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);
		map.on('resize', this.onResize, this);
		if (L.Browser.mobile) {
			map.on('doclayerinit', this.onMobileInit, this);
		}
	},

	getAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id === id) {
				return annotations[index];
			}
		}
		return null;
	},

	hideAnnotations: function (part) {
		this._selectedAnnotation = undefined;
		var annotations = this._annotations[this._partHashes[part]];
		for (var index in annotations) {
			annotations[index].hide();
		}
	},

	hasAnnotations: function (part) {
		var annotations = this._annotations[this._partHashes[part]];
		return annotations && annotations.length > 0;
	},

	updateDocBounds: function (count, extraSize) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		if (annotations && annotations.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},

	onResize: function () {
		if (!L.Browser.mobile) {
			this._map.setView(this._map.getCenter(), this._map.getZoom(), {reset: true});
		}

		var presentationControlWrapperElem = L.DomUtil.get('presentation-controls-wrapper');
		var visible = L.DomUtil.getStyle(presentationControlWrapperElem, 'display');

		if (!this._isSlidePaneVisible && visible !== 'none') {
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				selectedParts: this._selectedParts,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
		this._isSlidePaneVisible = !(visible === 'none');
	},

	onMobileInit: function () {
		var map = this._map;
		var toolItems = [
			{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: 'Bold'},
			{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
			{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: 'Underline'},
			{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: 'Strikeout'},
			{type: 'break'},
			{type: 'text-color',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor')},
			{type: 'color',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor')},
			{type: 'break' , mobile:false},
			{type: 'button',  id: 'leftpara',  img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true), uno: 'LeftPara', unosheet: 'AlignLeft', disabled: true},
			{type: 'button',  id: 'centerpara',  img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true), uno: 'CenterPara', unosheet: 'AlignHorizontalCenter', disabled: true},
			{type: 'button',  id: 'rightpara',  img: 'alignright', hint: _UNO('.uno:RightPara', '', true), uno: 'RightPara', unosheet: 'AlignRight', disabled: true},
			{type: 'button',  id: 'justifypara',  img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: 'JustifyPara', unosheet: '', disabled: true},
			{type: 'break', id: 'breakpara'},
			{type: 'menu',  id: 'linespacing',  img: 'linespacing', hint: _UNO('.uno:FormatSpacingMenu'),
				items: [
					{id: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1'},
					{id: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15'},
					{id: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2'},
					{type: 'break'},
					{id: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
					{id: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
				]},
			{type: 'break', id: 'breakspacing'},
			{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: 'DefaultBullet', disabled: true},
			{type: 'break', id: 'breakbullet'},
			{type: 'button',  id: 'insertannotation', img: 'annotation', hint: _UNO('.uno:InsertAnnotation', '', true), hidden: true},
			{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), hidden: true, overlay: {onShow: window.insertTable},
			 html: '<div id="inserttable-wrapper"><div id="inserttable-popup" class="inserttable-pop ui-widget ui-corner-all"><div class="inserttable-grid"></div><div id="inserttable-status" class="loleaflet-font" style="padding: 5px;"><br/></div></div></div>'},
			{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true)},
			{type: 'menu', id: 'menugraphic', img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true),
				items: [
					{id: 'localgraphic', text: _('Insert Local Image')},
					{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)},
				]},
			{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
			{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: window.insertShapes},
				html: '<div id="insertshape-wrapper"><div id="insertshape-popup" class="insertshape-pop ui-widget ui-corner-all"><div class="insertshape-grid"></div></div></div>'},

			{type: 'button',  id: 'link',  img: 'link', hint: _UNO('.uno:HyperlinkDialog'), uno: 'HyperlinkDialog', disabled: true},
			{type: 'button',  id: 'insertsymbol', img: 'insertsymbol', hint: _UNO('.uno:InsertSymbol', '', true), uno: 'InsertSymbol'},
			{type: 'spacer'},
			{type: 'button',  id: 'modifypage', img: 'sidebar_modify_page', hint: _UNO('.uno:ModifyPage', 'presentation', true), uno: '.uno:ModifyPage'},
			{type: 'button',  id: 'slidechangewindow', img: 'sidebar_slide_change', hint: _UNO('.uno:SlideChangeWindow', 'presentation', true), uno: '.uno:SlideChangeWindow'},
			{type: 'button',  id: 'customanimation', img: 'sidebar_custom_animation', hint: _UNO('.uno:CustomAnimation', 'presentation', true), uno: '.uno:CustomAnimation'},
			{type: 'button',  id: 'masterslidespanel', img: 'sidebar_master_slides', hint: _('Master Slides'), uno: '.uno:MasterSlidesPanel'},
			{type: 'break', id: 'breaksidebar'}
		];

		var toolbar = $('#toolbar-up');
		toolbar.w2toolbar({
			name: 'actionbar',
			tooltip: 'bottom',
			items: [
				{type: 'button',  id: 'closemobile',  img: 'closemobile'},
				{type: 'spacer'},
				{type: 'button',  id: 'prev', img: 'prev', hint: _UNO('.uno:PageUp', 'text')},
				{type: 'button',  id: 'next', img: 'next', hint: _UNO('.uno:PageDown', 'text')},
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'button',  id: 'fullscreen', img: 'fullscreen', hint: _UNO('.uno:FullScreen', 'text')},
				{type: 'drop', id: 'userlist', img: 'users', hidden: true, html: '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
					'<hr><table class="loleaflet-font" id="editor-btn">' +
					'<tr>' +
					'<td><input type="checkbox" name="alwaysFollow" id="follow-checkbox" onclick="editorUpdate(event)"></td>' +
					'<td>' + _('Always follow the editor') + '</td>' +
					'</tr>' +
					'</table>' +
					'<p id="currently-msg">' + _('Current') + ' - <b><span id="current-editor"></span></b></p>' +
					'</div>'
				},
			],
			onClick: function (e) {
				window.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			},
			onRefresh: function() {
				var showUserList = map['wopi'].HideUserList !== null &&
									map['wopi'].HideUserList !== undefined &&
									$.inArray('true', map['wopi'].HideUserList) < 0 &&
									((window.mode.isMobile() && $.inArray('mobile', map['wopi'].HideUserList) < 0) ||
									(window.mode.isTablet() && $.inArray('tablet', map['wopi'].HideUserList) < 0));
				if (this.get('userlist').hidden == true && showUserList) {
					this.show('userlist');
					this.show('userlistbreak');
					map.on('deselectuser', window.deselectUser);
					map.on('addview', window.onAddView);
					map.on('removeview', window.onRemoveView);
				}
			}
		});
		toolbar.bind('touchstart', function(e) {
			w2ui['actionbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		toolbar = $('#presentation-toolbar');
		toolbar.w2toolbar({
			name: 'presentation-toolbar',
			tooltip: 'bottom',
			hidden: true,
			items: []
		});

		toolbar = $('#toolbar-down');
		toolbar.w2toolbar({
			name: 'editbar',
			tooltip: 'top',
			items: toolItems,
			onClick: function (e) {
				window.onClick(e, e.target);
				window.hideTooltip(this, e.target);
			},
			onRefresh: function(edata) {
				if (edata.target === 'inserttable')
					window.insertTable();

				if (edata.target === 'insertshapes')
					window.insertShapes();
			}
		});
		toolbar.bind('touchstart', function(e) {
			w2ui['editbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		map.on('updatetoolbarcommandvalues', function() {
			w2ui['editbar'].refresh();
		});

		map.on('showbusy', function(e) {
			w2utils.lock(w2ui['actionbar'].box, e.label, true);
		});

		map.on('hidebusy', function() {
			// If locked, unlock
			if (w2ui['actionbar'].box.firstChild.className === 'w2ui-lock') {
				w2utils.unlock(w2ui['actionbar'].box);
			}
		});

		this._map.on('updatepermission', window.onUpdatePermission);
	},

	onAdd: function (map) {
		map.addControl(L.control.partsPreview());
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
		this._topAnnotation = [];
		this._topAnnotation[this._selectedPart] = 0;
		this._selectedAnnotation = undefined;
		this._draft = null;
	},

	onAnnotationCancel: function () {
		if (this._draft) {
			this._map.removeLayer(this._draft);
			this._draft = null;
		}
		this._map.focus();
		this._selectedAnnotation = undefined;
		this.layoutAnnotations();
	},

	onAnnotationModify: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.edit();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationReply: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.reply();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationRemove: function (id) {
		this.onAnnotationCancel();
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		this._map.focus();
	},

	onAnnotationSave: function (e) {
		var comment;
		if (this._draft) {
			comment = {
				Text: {
					type: 'string',
					value: this._draft._data.text
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(this._draft);
			this._draft = null;
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
			this._selectedAnnotation = undefined;
		}
		this._map.focus();
	},

	_onAnnotationZoom: function () {
		this.onAnnotationCancel();
	},

	onReplyClick: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyToAnnotation', comment);
		this._selectedAnnotation = undefined;
		this._map.focus();
	},

	onAnnotationScrollDown: function () {
		this._topAnnotation[this._selectedPart] = Math.min(++this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
		this.onAnnotationCancel();
	},

	onAnnotationScrollUp: function () {
		if (this._topAnnotation[this._selectedPart] === 0) {
			this._map.fire('scrollby', {x: 0, y: -100});
		}
		this._topAnnotation[this._selectedPart] = Math.max(--this._topAnnotation[this._selectedPart], 0);
		this.onAnnotationCancel();
	},

	onUpdateParts: function () {
		if (typeof this._prevSelectedPart === 'number') {
			this.hideAnnotations(this._prevSelectedPart);
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
				if (this._topAnnotation[this._selectedPart] === undefined) {
					this._topAnnotation[this._selectedPart] = 0;
				}
				this.onAnnotationCancel();
			}
		}
	},

	clearAnnotations: function () {
		var annotation;
		var annotations;
		for (var key in this._annotations) {
			annotations = this._annotations[key];
			while (annotations.length > 0) {
				annotation = annotations.pop();
				if (annotation) {
					this._map.removeLayer(annotation);
				}
			}
		}
		this._annotations = {};
	},

	removeAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id == id) {
				this._map.removeLayer(annotations[index]);
				annotations.splice(index, 1);
				break;
			}
		}
	},

	scrollUntilAnnotationIsVisible: function(annotation) {
		var bounds = annotation.getBounds();
		var mapBounds = this._map.getBounds();
		if (this._map.layerPointToLatLng(bounds.getTopRight()).lat > mapBounds.getNorth()) {
			this._topAnnotation[this._selectedPart] = Math.max(this._topAnnotation[this._selectedPart] - 2, 0);
		}
		else if (this._map.layerPointToLatLng(bounds.getBottomLeft()).lat < mapBounds.getSouth()) {
			this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart] + 2, this._annotations[this._partHashes[this._selectedPart]].length - 1);
		}
		this.layoutAnnotations();
	},

	layoutAnnotations: function () {
		var topAnnotation;
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		var topRight = this._map.latLngToLayerPoint(this._map.options.docBounds.getNorthEast())
			.add(L.point((this._selectedAnnotation ? 3 : 2) * this.options.marginX, this.options.marginY));
		var bounds, annotation;
		for (var index in annotations) {
			annotation = annotations[index];
			if (!this._topAnnotation[this._selectedPart]) {
				this._topAnnotation[this._selectedPart] = 0;
			}
			topAnnotation = this._topAnnotation[this._selectedPart];
			if (topAnnotation > 0 && parseInt(index) === topAnnotation - 1) {
				// if the top annotation is not the first one, show a bit of the bottom of the previous annotation
				// so that the user gets aware that there are more annotations above.

				// get annotation bounds
				annotation.setLatLng(this._map.layerPointToLatLng(L.point(0, -100000))); // placed where it's not visible
				annotation.show(); // if it's hidden the bounds are wrong
				bounds = annotation.getBounds();
				annotation.hide();
				var topLeft = topRight.subtract(L.point(0, bounds.max.y-bounds.min.y));
				annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
				annotation.show();
				bounds = annotation.getBounds();
				bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));

			} else if (index >= topAnnotation) { // visible annotations
				if (annotation._data.id === this._selectedAnnotation) {
					if (bounds) {
						bounds.extend(L.point(bounds.max.x, bounds.max.y + 2 * this.options.marginY));
					}
					var offsetX = L.point(2 * this.options.marginX, 0);
					topLeft = (bounds ? bounds.getBottomLeft() : topRight).subtract(offsetX);
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					bounds = annotation.getBounds();
					bounds = L.bounds(bounds.getBottomLeft().add(offsetX), bounds.getTopRight().add(offsetX));
					bounds.extend(L.point(bounds.max.x, bounds.max.y + 3 * this.options.marginY));
				} else {
					topLeft = bounds ? bounds.getBottomLeft() : topRight;
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					annotation.show();
					bounds = annotation.getBounds();
					bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
				}
			} else {
				annotation.hide();
			}
		}
		if (bounds) {
			if (!this._scrollAnnotation) {
				this._scrollAnnotation = L.control.scroll.annotation();
				this._scrollAnnotation.addTo(this._map);
			}
		} else if (this._scrollAnnotation) {
			this._map.removeControl(this._scrollAnnotation);
			this._scrollAnnotation = null;
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		try {
			var values = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		} catch (e) {
			// One such case is 'commandvalues: ' for draw documents in response to .uno:AcceptTrackedChanges
			values = null;
		}

		if (!values) {
			return;
		}

		if (values.comments) {
			this.clearAnnotations();
			for (var index in values.comments) {
				var comment = values.comments[index];
				if (!this._annotations[comment.parthash]) {
					this._annotations[comment.parthash] = [];
				}
				this._annotations[comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
			}
			if (!this._topAnnotation) {
				this._topAnnotation = [];
			}
			this._topAnnotation[this._selectedPart] = 0;
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
			}
			this.layoutAnnotations();
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			if (obj.comment.action === 'Add') {
				if (!this._annotations[obj.comment.parthash]) {
					this._annotations[obj.comment.parthash] = [];
				}
				this._annotations[obj.comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), obj.comment).addTo(this._map));
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(1, this.extraSize);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Remove') {
				this.removeAnnotation(obj.comment.id);
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(0);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Modify') {
				var modified = this.getAnnotation(obj.comment.id);
				if (modified) {
					modified._data = obj.comment;
					modified.update();
					this._selectedAnnotation = undefined;
					this.layoutAnnotations();
				}
			}
		} else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var needsNewTiles = false;
		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles && command.part === this._selectedPart && this._debug)
		{
			this._debugAddInvalidationMessage(textMsg);
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part) {
				continue;
			}
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
					this.options.tileWidthTwips / scale * coords.x,
					this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
					this.options.tileWidthTwips / scale,
					this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}
		if (command.part === this._selectedPart &&
			command.part !== this._lastValidPart) {
			this._map.fire('updatepart', {part: this._lastValidPart, docType: this._docType});
			this._lastValidPart = command.part;
			this._map.fire('updatepart', {part: command.part, docType: this._docType});
		}

		this._map._docPreviews[command.part].invalid = true;
		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		// Since we have two status commands, remove them so we store and compare payloads only.
		textMsg = textMsg.replace('status: ', '');
		textMsg = textMsg.replace('statusupdate: ', '');
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			if (this._docType === 'drawing') {
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'drawing');
			}
			this._updateMaxBounds(true);
			this._documentInfo = textMsg;
			this._parts = command.parts;
			this._viewId = parseInt(command.viewid);
			this._selectedPart = command.selectedPart;
			this._selectedParts = command.selectedParts || [command.selectedPart];
			this._resetPreFetching(true);
			this._update();
			if (this._preFetchPart !== this._selectedPart) {
				this._preFetchPart = this._selectedPart;
				this._preFetchBorder = null;
			}
			var partMatch = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partHashes = partMatch.slice(partMatch.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				selectedParts: this._selectedParts,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
	},

	_updateMaxBounds: function (sizeChanged, extraSize) {
		if (!extraSize) {
			var annotations = this._annotations && this._partHashes && this._selectedPart !== undefined ?
				this._annotations[this._partHashes[this._selectedPart]] : [];
			extraSize = annotations && annotations.length > 0 ? this.extraSize : null;
		}
		L.GridLayer.prototype._updateMaxBounds.call(this, sizeChanged, extraSize, {panInside: false});
	}
});
