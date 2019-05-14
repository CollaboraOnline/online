/* -*- js-indent-level: 8 -*- */
/*
 * Writer tile layer is used to display a text document
 */

/* global $ _ w2ui _UNO */
L.WriterTileLayer = L.TileLayer.extend({

	newAnnotation: function (comment) {
		if (!comment.anchorPos && this._isCursorVisible) {
			comment.anchorPos = L.bounds(this._latLngToTwips(this._visibleCursor.getSouthWest()),
				this._latLngToTwips(this._visibleCursor.getNorthEast()));
			comment.anchorPix = this._twipsToPixels(comment.anchorPos.min);
		} else if (this._graphicSelection && !this._isEmptyRectangle(this._graphicSelection)) {
			// An image is selected, then guess the anchor based on the graphic
			// selection.
			comment.anchorPos = L.bounds(this._latLngToTwips(this._graphicSelection.getSouthWest()),
				this._latLngToTwips(this._graphicSelection.getNorthEast()));
			comment.anchorPix = this._twipsToPixels(comment.anchorPos.min);
		}
		if (comment.anchorPos) {
			this._annotations.modify(this._annotations.add(comment));
		}
	},

	clearAnnotations: function() {
		if (this._annotations) {
			this._annotations.clear();
			this._annotations.clearChanges();
		}
	},

	onRemove: function (map) {
		map.off('updatemaxbounds', this._onUpdateMaxBounds, this);
	},

	beforeAdd: function (map) {
		if (L.Browser.mobile) {
			map.on('doclayerinit', this.onMobileInit, this);
		}
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = L.annotationManager(map);
		map.on('updatemaxbounds', this._onUpdateMaxBounds, this);
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
			{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: 'DefaultNumbering', disabled: true},
			{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: 'DefaultBullet', disabled: true},
			{type: 'break', id: 'breakbullet', hidden: true},
			{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: 'IncrementIndent', disabled: true},
			{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: 'DecrementIndent', disabled: true},
			{type: 'break', id: 'breakindent'},
			{type: 'button',  id: 'insertannotation', img: 'annotation', hint: _UNO('.uno:InsertAnnotation', '', true)},
			{type: 'drop',  id: 'inserttable',  img: 'inserttable', hint: _('Insert table'), hidden: true, overlay: {onShow: window.insertTable},
			 html: '<div id="inserttable-wrapper"><div id="inserttable-popup" class="inserttable-pop ui-widget ui-corner-all"><div class="inserttable-grid"></div><div id="inserttable-status" class="loleaflet-font" style="padding: 5px;"><br/></div></div></div>'},
			{type: 'button',  id: 'insertgraphic',  img: 'insertgraphic', hint: _UNO('.uno:InsertGraphic', '', true)},
			{type: 'button',  id: 'insertobjectchart',  img: 'insertobjectchart', hint: _UNO('.uno:InsertObjectChart', '', true), uno: 'InsertObjectChart'},
			{type: 'drop',  id: 'insertshapes',  img: 'basicshapes_ellipse', hint: _('Insert shapes'), overlay: {onShow: window.insertShapes},
				html: '<div id="insertshape-wrapper"><div id="insertshape-popup" class="insertshape-pop ui-widget ui-corner-all"><div class="insertshape-grid"></div></div></div>'},

			{type: 'button',  id: 'link',  img: 'link', hint: _UNO('.uno:HyperlinkDialog'), uno: 'HyperlinkDialog', disabled: true},
			{type: 'button',  id: 'insertsymbol', img: 'insertsymbol', hint: _UNO('.uno:InsertSymbol', '', true), uno: 'InsertSymbol'},
			{type: 'spacer'}
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
				{type: 'drop', id: 'userlist', img: 'users', html: '<div id="userlist_container"><table id="userlist_table"><tbody></tbody></table>' +
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

	},

	onAnnotationModify: function (annotation) {
		this._annotations.modify(annotation);
	},

	onAnnotationRemove: function (id) {
		this._annotations.remove(id);
	},

	onAnnotationReply: function (annotation) {
		this._annotations.reply(annotation);
	},

	onAnnotationResolve: function (annotation) {
		this._annotations.resolve(annotation);
	},

	onChangeAccept: function(id) {
		this._annotations.acceptChange(id);
	},

	onChangeReject: function(id) {
		this._annotations.rejectChange(id);
	},

	_onCommandValuesMsg: function (textMsg) {
		var braceIndex = textMsg.indexOf('{');
		if (braceIndex < 0) {
			return;
		}

		var values = JSON.parse(textMsg.substring(braceIndex));
		if (!values) {
			return;
		}

		if (values.comments) {
			this._annotations.fill(values.comments);
		}
		else if (values.redlines) {
			this._annotations.fillChanges(values.redlines);
		}
		else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablemodified:')) {
			obj = JSON.parse(textMsg.substring('redlinetablemodified:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else if (textMsg.startsWith('redlinetablechanged:')) {
			obj = JSON.parse(textMsg.substring('redlinetablechanged:'.length + 1));
			this._annotations.onACKComment(obj);
		}
		else {
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
		command.part = 0;
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

		if (needsNewTiles && this._debug)
		{
			this._debugAddInvalidationMessage(textMsg);
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
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

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._currentPage = part;
			this._map.fire('pagenumberchanged', {
				currentPage: part,
				pages: this._pages,
				docType: this._docType
			});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (!command.width || !command.height || this._documentInfo === textMsg)
			return;

		var sizeChanged = command.width !== this._docWidthTwips || command.height !== this._docHeightTwips;
		if (sizeChanged) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._viewId = parseInt(command.viewid);
			this._updateMaxBounds(true);
		}

		this._documentInfo = textMsg;
		this._selectedPart = 0;
		this._parts = 1;
		this._currentPage = command.selectedPart;
		this._pages = command.parts;
		this._map.fire('pagenumberchanged', {
			currentPage: this._currentPage,
			pages: this._pages,
			docType: this._docType
		});
		this._resetPreFetching(true);
		this._update();
	},

	_onUpdateMaxBounds: function (e) {
		this._updateMaxBounds(e.sizeChanged, e.extraSize);
	}
});
