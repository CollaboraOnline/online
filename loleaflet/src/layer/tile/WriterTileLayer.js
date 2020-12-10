/* -*- js-indent-level: 8 -*- */
/*
 * Writer tile layer is used to display a text document
 */

/* global */
L.WriterTileLayer = L.CanvasTileLayer.extend({

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
		map.uiManager.initializeSpecializedUI('text');
	},

	onAdd: function (map) {

		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = L.annotationManager(map);
		map.on('updatemaxbounds', this._onUpdateMaxBounds, this);
	},

	onAnnotationModify: function (annotation) {
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(annotation, function(annotation) { that._annotations._onAnnotationSave(annotation); }, /* isMod */ true);
		} else {
			this._annotations.modify(annotation);
		}
	},

	layoutAnnotations: function () {
		this._annotations.layout();
	},

	unselectAnnotations: function () {
		if (this._annotations) {
			this._annotations.unselect();
		}
	},

	onAnnotationRemove: function (id) {
		this._annotations.remove(id);
	},

	onAnnotationRemoveThread: function (id) {
		this._annotations.removeThread(id);
	},

	onAnnotationReply: function (annotation) {
		this._annotations.reply(annotation);
	},

	onAnnotationResolve: function (annotation) {
		this._annotations.resolve(annotation);
	},

	onAnnotationResolveThread: function (annotation) {
		this._annotations.resolveThread(annotation);
	},

	isThreadResolved: function(annotation) {
		return this._annotations._isThreadResolved(annotation);
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
	},

	_createCommentStructure: function (menuStructure) {
		var rootComment, lastChild, comment;
		var annotations = this._map._docLayer._annotations;
		var showResolved = this._map._docLayer._annotations._showResolved;
		var annotationList = annotations._items;
		for (var i = 0; i < annotationList.length; i++) {
			if (annotationList[i]._data.parent === '0') {

				lastChild = annotations.getLastChildIndexOf(annotationList[i]._data.id);
				var commentThread = [];
				while (true) {
					comment = {
						id: 'comment' + annotationList[lastChild]._data.id,
						enable: true,
						data: annotationList[lastChild]._data,
						type: 'comment',
						text: annotationList[lastChild]._data.text,
						annotation: annotationList[lastChild],
						children: []
					};

					if (showResolved || comment.data.resolved !== 'true') {
						commentThread.unshift(comment);
					}

					if (annotationList[lastChild]._data.parent === '0')
						break;

					lastChild = annotations.getIndexOf(annotationList[lastChild]._data.parent);
				}
				if (commentThread.length > 0)
				{
					rootComment = {
						id: commentThread[0].id,
						enable: true,
						data: commentThread[0].data,
						type: 'rootcomment',
						text: commentThread[0].data.text,
						annotation: commentThread[0].annotation,
						children: commentThread
					};

					menuStructure['children'].push(rootComment);
				}
			}
		}
	},

	_addHighlightSelectedWizardComment: function(annotation) {
		var annotations = this._map._docLayer._annotations;
		var annotationList = annotations._items;
		var lastChild = annotations.getLastChildIndexOf(annotation._data.id);

		while (true) {
			this._map.removeLayer(annotationList[lastChild]._data.textSelected);
			this._map.addLayer(annotationList[lastChild]._data.wizardHighlight);

			if (annotationList[lastChild]._data.parent === '0')
				break;

			lastChild = annotations.getIndexOf(annotationList[lastChild]._data.parent);
		}

	},

	_removeHighlightSelectedWizardComment: function(annotation) {
		if (annotation) {
			var annotations = this._map._docLayer._annotations;
			var annotationList = annotations._items;
			var lastChild = annotations.getLastChildIndexOf(annotation._data.id);

			if (lastChild !== undefined) {
				while (true) {
					this._map.removeLayer(annotationList[lastChild]._data.wizardHighlight);
					this._map.addLayer(annotationList[lastChild]._data.textSelected);

					if (annotationList[lastChild]._data.parent === '0')
						break;

					lastChild = annotations.getIndexOf(annotationList[lastChild]._data.parent);
				}
			}
		}
	}
});
