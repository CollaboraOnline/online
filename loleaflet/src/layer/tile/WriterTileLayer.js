/* -*- js-indent-level: 8 -*- */
/*
 * Writer tile layer is used to display a text document
 */

/* global $ _ w2ui _UNO */
L.WriterTileLayer = L.TileLayer.extend({

	newAnnotation: function (comment) {
		if (!comment.anchorPos && this._map._isCursorVisible) {
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
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(comment, function(annotation) { that._annotations._onAnnotationSave(annotation); });
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
		if (window.mode.isMobile() || window.mode.isTablet()) {
			this.onMobileInit(map);
		}
	},

	onAdd: function (map) {

		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = L.annotationManager(map);
		map.on('updatemaxbounds', this._onUpdateMaxBounds, this);
	},

	onMobileInit: function (map) {
		var toolItems = [
			{type: 'button',  id: 'showsearchbar',  img: 'search', hint: _('Show the search bar')},
			{type: 'break'},
			{type: 'button',  id: 'bold',  img: 'bold', hint: _UNO('.uno:Bold'), uno: 'Bold'},
			{type: 'button',  id: 'italic', img: 'italic', hint: _UNO('.uno:Italic'), uno: 'Italic'},
			{type: 'button',  id: 'underline',  img: 'underline', hint: _UNO('.uno:Underline'), uno: 'Underline'},
			{type: 'button',  id: 'strikeout', img: 'strikeout', hint: _UNO('.uno:Strikeout'), uno: 'Strikeout'},
			{type: 'break'},
			{type: 'button',  id: 'fontcolor', img: 'textcolor', hint: _UNO('.uno:FontColor')},
			{type: 'button',  id: 'backcolor', img: 'backcolor', hint: _UNO('.uno:BackgroundColor')},
			{type: 'button',  id: 'leftpara',  img: 'alignleft', hint: _UNO('.uno:LeftPara', '', true),
				uno: {textCommand: 'LeftPara', objectCommand: 'ObjectAlignLeft'},
				unosheet: 'AlignLeft', disabled: true},
			{type: 'button',  id: 'centerpara',  img: 'alignhorizontal', hint: _UNO('.uno:CenterPara', '', true),
				uno: {textCommand: 'CenterPara', objectCommand: 'AlignCenter'},
				unosheet: 'AlignHorizontalCenter', disabled: true},
			{type: 'button',  id: 'rightpara',  img: 'alignright', hint: _UNO('.uno:RightPara', '', true),
				uno: {textCommand: 'RightPara', objectCommand: 'ObjectAlignRight'},
				unosheet: 'AlignRight', disabled: true},
			{type: 'button',  id: 'justifypara',  img: 'alignblock', hint: _UNO('.uno:JustifyPara', '', true), uno: 'JustifyPara', unosheet: '', disabled: true},
			{type: 'break', id: 'breakspacing'},
			{type: 'button',  id: 'defaultnumbering',  img: 'numbering', hint: _UNO('.uno:DefaultNumbering', '', true),uno: 'DefaultNumbering', disabled: true},
			{type: 'button',  id: 'defaultbullet',  img: 'bullet', hint: _UNO('.uno:DefaultBullet', '', true), uno: 'DefaultBullet', disabled: true},
			{type: 'break', id: 'breakbullet', hidden: true},
			{type: 'button',  id: 'incrementindent',  img: 'incrementindent', hint: _UNO('.uno:IncrementIndent', '', true), uno: 'IncrementIndent', disabled: true},
			{type: 'button',  id: 'decrementindent',  img: 'decrementindent', hint: _UNO('.uno:DecrementIndent', '', true), uno: 'DecrementIndent', disabled: true},
		];

		var toolbar = $('#toolbar-up');
		toolbar.w2toolbar({
			name: 'actionbar',
			tooltip: 'bottom',
			items: [
				{type: 'button',  id: 'closemobile',  img: 'closemobile'},
				{type: 'spacer'},
				{type: 'button',  id: 'undo',  img: 'undo', hint: _UNO('.uno:Undo'), uno: 'Undo', disabled: true},
				{type: 'button',  id: 'redo',  img: 'redo', hint: _UNO('.uno:Redo'), uno: 'Redo', disabled: true},
				{type: 'button',  id: 'mobile_wizard', img: 'mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertion_mobile_wizard', img: 'insertion_mobile_wizard', disabled: true},
				{type: 'button',  id: 'insertcomment', img: 'insertcomment', disabled: true},
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

		toolbar = $('#toolbar-search');
		toolbar.w2toolbar({
			name: 'searchbar',
			tooltip: 'top',
			items: [
				{
					type: 'html', id: 'search',
					html: '<div id="search-input-group" style="padding: 3px 10px;" class="loleaflet-font">' +
						'    <label for="search-input">Search:</label>' +
						'    <input size="10" id="search-input"' +
						'style="padding: 3px; border-radius: 2px; border: 1px solid silver"/>' +
						'</div>'
				},
				{type: 'button', id: 'searchprev', img: 'prev', hint: _UNO('.uno:UpSearch'), disabled: true},
				{type: 'button', id: 'searchnext', img: 'next', hint: _UNO('.uno:DownSearch'), disabled: true},
				{type: 'button', id: 'cancelsearch', img: 'cancel', hint: _('Clear the search field'), hidden: true},
				{type: 'html', id: 'left'},
				{type: 'button', id: 'hidesearchbar', img: 'unfold', hint: _('Hide the search bar')}
			],
			onClick: function (e) {
				window.onClick(e, e.target, e.item, e.subItem);
			},
			onRefresh: function () {
				window.setupSearchInput();
			}
		});

		toolbar.bind('touchstart', function(e) {
			w2ui['searchbar'].touchStarted = true;
			var touchEvent = e.originalEvent;
			if (touchEvent && touchEvent.touches.length > 1) {
				L.DomEvent.preventDefault(e);
			}
		});

		$(w2ui.searchbar.box).find('.w2ui-scroll-left, .w2ui-scroll-right').hide();
		w2ui.searchbar.on('resize', function(target, e) {
			e.isCancelled = true;
		});

		map.on('updatepermission', window.onUpdatePermission);
	},

	onAnnotationModify: function (annotation) {
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(annotation, function(annotation) { that._annotations._onAnnotationSave(annotation); }, /* isMod */ true);
		} else {
			this._annotations.modify(annotation);
		}
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
