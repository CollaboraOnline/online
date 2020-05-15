/* -*- js-indent-level: 8 -*- */
/*
 * Calc tile layer is used to display a spreadsheet document
 */

/* global */
L.CalcTileLayer = L.TileLayer.extend({
	options: {
		sheetGeometryDataEnabled: false
	},

	STD_EXTRA_WIDTH: 113, /* 2mm extra for optimal width,
							  * 0.1986cm with TeX points,
							  * 0.1993cm with PS points. */

	twipsToHMM: function (twips) {
		return (twips * 127 + 36) / 72;
	},

	newAnnotation: function (comment) {
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(comment, function(annotation) { that._onAnnotationSave(annotation); });
		} else {
			var annotations = this._annotations[this._selectedPart];
			var annotation;
			for (var key in annotations) {
				if (this._cellCursor.contains(annotations[key]._annotation._data.cellPos)) {
					annotation = annotations[key];
					break;
				}
			}

			if (!annotation) {
				comment.cellPos = this._cellCursor;
				annotation = this.createAnnotation(comment);
				annotation._annotation._tag = annotation;
				this.showAnnotation(annotation);
			}
			annotation.editAnnotation();
		}
	},

	createAnnotation: function (comment) {
		var annotation = L.divOverlay(comment.cellPos).bindAnnotation(L.annotation(L.latLng(0, 0),
			comment, comment.id === 'new' ? {noMenu: true} : {}));
		return annotation;
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('updateparts', this._onUpdateParts, this);
		map.on('AnnotationCancel', this._onAnnotationCancel, this);
		map.on('AnnotationReply', this._onAnnotationReply, this);
		map.on('AnnotationSave', this._onAnnotationSave, this);

		map.uiManager.initializeSpecializedUI('spreadsheet');
	},

	clearAnnotations: function () {
		for (var tab in this._annotations) {
			this.hideAnnotations(tab);
		}
		this._annotations = {};
	},

	onAdd: function (map) {
		map.addControl(L.control.tabs());
		map.addControl(L.control.columnHeader());
		map.addControl(L.control.rowHeader());
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
	},

	onAnnotationModify: function (annotation) {
		annotation.edit();
		annotation.focus();
	},

	onAnnotationRemove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		var tab = this._selectedPart;
		this._map.sendUnoCommand('.uno:DeleteNote', comment);
		this._annotations[tab][id].closePopup();
		this._map.focus();
	},

	onAnnotationReply: function (annotation) {
		annotation.reply();
		annotation.focus();
	},

	isCurrentCellCommentShown: function () {
		var annotations = this._annotations[this._selectedPart];
		for (var key in annotations) {
			var annotation = annotations[key]._annotation;
			if (this._cellCursor.contains(annotation._data.cellPos)) {
				return this._map.hasLayer(annotation) && annotation.isVisible();
			}
		}
		return false;
	},

	showAnnotationFromCurrentCell: function() {
		var annotations = this._annotations[this._selectedPart];
		for (var key in annotations) {
			var annotation = annotations[key]._annotation;
			if (this._cellCursor.contains(annotation._data.cellPos)) {
				this._map.addLayer(annotation);
				annotation.show();
			}
		}
	},

	hideAnnotationFromCurrentCell: function() {
		var annotations = this._annotations[this._selectedPart];
		for (var key in annotations) {
			var annotation = annotations[key]._annotation;
			if (this._cellCursor.contains(annotation._data.cellPos)) {
				annotation.hide();
				this._map.removeLayer(annotation);
			}
		}
	},

	showAnnotation: function (annotation) {
		this._map.addLayer(annotation);
	},

	hideAnnotation: function (annotation) {
		if (annotation)
			this._map.removeLayer(annotation);
	},

	showAnnotations: function () {
		var annotations = this._annotations[this._selectedPart];
		for (var key in annotations) {
			this.showAnnotation(annotations[key]);
		}
	},

	hideAnnotations: function (part) {
		var annotations = this._annotations[part];
		for (var key in annotations) {
			this.hideAnnotation(annotations[key]);
		}
	},

	isHiddenPart: function (part) {
		if (!this._hiddenParts)
			return false;
		return this._hiddenParts.indexOf(part) !== -1;
	},

	hiddenParts: function () {
		if (!this._hiddenParts)
			return 0;
		return this._hiddenParts.length;
	},

	hasAnyHiddenPart: function () {
		if (!this._hiddenParts)
			return false;
		return this.hiddenParts() !== 0;
	},
	_onAnnotationCancel: function (e) {
		if (e.annotation._data.id === 'new') {
			this.hideAnnotation(e.annotation._tag);
		} else {
			this._annotations[e.annotation._data.tab][e.annotation._data.id].closePopup();
		}
		this._map.focus();
	},

	_onAnnotationReply: function (e) {
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
		this._map.sendUnoCommand('.uno:ReplyComment', comment);
		this._map.focus();
	},

	_onAnnotationSave: function (e) {
		var comment;
		if (e.annotation._data.id === 'new') {
			comment = {
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: e.annotation._data.author
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this.hideAnnotation(e.annotation._tag);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				},
				Author: {
					type: 'string',
					value: this._map.getViewName(this._viewId)
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
			this._annotations[e.annotation._data.tab][e.annotation._data.id].closePopup();
		}
		this._map.focus();
	},

	_onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number' && !e.source) {
			this.hideAnnotations(this._prevSelectedPart);
			this.showAnnotations();
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			obj.comment.tab = parseInt(obj.comment.tab);
			if (obj.comment.action === 'Add') {
				obj.comment.cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (!this._annotations[obj.comment.tab]) {
					this._annotations[obj.comment.tab] = {};
				}
				this._annotations[obj.comment.tab][obj.comment.id] = this.createAnnotation(obj.comment);
				if (obj.comment.tab === this._selectedPart) {
					this.showAnnotation(this._annotations[obj.comment.tab][obj.comment.id]);
				}
			} else if (obj.comment.action === 'Remove') {
				var removed = this._annotations[obj.comment.tab][obj.comment.id];
				if (removed) {
					this.hideAnnotation(removed);
					delete this._annotations[obj.comment.tab][obj.comment.id];
				}
			} else if (obj.comment.action === 'Modify') {
				var modified = this._annotations[obj.comment.tab][obj.comment.id];
				obj.comment.cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (modified) {
					modified._annotation._data = obj.comment;
					modified.setLatLngBounds(obj.comment.cellPos);
				}
			}
		} else if (textMsg.startsWith('invalidateheader: column')) {
			this.refreshViewData({x: this._map._getTopLeftPoint().x, y: 0,
				offset: {x: undefined, y: 0}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: row')) {
			this.refreshViewData({x: 0, y: this._map._getTopLeftPoint().y,
				offset: {x: 0, y: undefined}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: all')) {
			this.refreshViewData({x: this._map._getTopLeftPoint().x, y: this._map._getTopLeftPoint().y,
				offset: {x: undefined, y: undefined}});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
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

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart && !this.isHiddenPart(part)) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
			this.refreshViewData(undefined, true /* sheetGeometryChanged */);
		}
	},

	_onZoomRowColumns: function () {
		this._sendClientZoom();
		if (this.sheetGeometry) {
			this.sheetGeometry.setTileGeometryData(this._tileWidthTwips, this._tileHeightTwips,
				this._tileSize, this._tilePixelScale);
		}
		this.refreshViewData();
		this._map._socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
	},

	_onUpdateCurrentHeader: function() {
		this._map.fire('updatecurrentheader', this._getCursorPosSize());
	},

	_getCursorPosSize: function () {
		var x = -1, y = -1;
		if (this._cellCursorXY) {
			x = this._cellCursorXY.x + 1;
			y = this._cellCursorXY.y + 1;
		}
		var size = new L.Point(0, 0);
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			size = this._cellCursorTwips.getSize();
		}

		return { curX: x, curY: y, width: size.x, height: size.y };
	},

	_onUpdateSelectionHeader: function () {
		var selectionHeaderData = this._getSelectionHeaderData();
		if (selectionHeaderData.hasSelection) {
			this._map.fire('updateselectionheader', selectionHeaderData);
			return;
		}

		this._map.fire('clearselectionheader');
	},

	_getSelectionHeaderData: function() {
		var layers = this._selections.getLayers();
		var layer = layers.pop();
		if (layers.length === 0 && layer && layer.getLatLngs().length === 1) {
			var start = this._latLngToTwips(layer.getBounds().getNorthWest()).add([1, 1]);
			var end = this._latLngToTwips(layer.getBounds().getSouthEast()).subtract([1, 1]);
			return { hasSelection: true, start: start, end: end };
		}

		return { hasSelection: false };
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._parts = command.parts;
			this._selectedPart = command.selectedPart;
			this._viewId = parseInt(command.viewid);
			var mapSize = this._map.getSize();
			var width = this._docWidthTwips / this._tileWidthTwips * this._tileSize;
			var height = this._docHeightTwips / this._tileHeightTwips * this._tileSize;
			if (width < mapSize.x || height < mapSize.y) {
				width = Math.max(width, mapSize.x);
				height = Math.max(height, mapSize.y);
				var topLeft = this._map.unproject(new L.Point(0, 0));
				var bottomRight = this._map.unproject(new L.Point(width, height));
				this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
				this._docPixelSize = {x: width, y: height};
				this._map.fire('docsize', {x: width, y: height});
			}
			else {
				this._updateMaxBounds(true);
			}
			this._hiddenParts = command.hiddenparts || [];
			this._documentInfo = textMsg;
			var partNames = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partNames = partNames.slice(partNames.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partNames,
				hiddenParts: this._hiddenParts,
				source: 'status'
			});
			this._resetPreFetching(true);
			this._update();
		}
	},

	// This initiates a selective repainting of row/col headers and
	// gridlines based on the settings of coordinatesData.offset. This
	// should be called whenever the view area changes (scrolling, panning,
	// zooming, cursor moving out of view-area etc.).  Depending on the
	// active sheet geometry data-source, it may ask core to send current
	// view area's data or the global data on geometry changes.
	refreshViewData: function (coordinatesData, sheetGeometryChanged) {

		// There are places that call this function with no arguments to indicate that the
		// command arguments should be the current map area coordinates.
		if (typeof coordinatesData != 'object') {
			coordinatesData = {};
		}

		var offset = coordinatesData.offset || {};

		var topLeftPoint = new L.Point(coordinatesData.x, coordinatesData.y);
		var sizePx = this._map.getSize();

		if (topLeftPoint.x === undefined) {
			topLeftPoint.x = this._map._getTopLeftPoint().x;
		}
		if (topLeftPoint.y === undefined) {
			topLeftPoint.y = this._map._getTopLeftPoint().y;
		}

		var updateRows = true;
		var updateCols = true;

		if (offset.x === 0) {
			updateCols = false;
			if (!this.options.sheetGeometryDataEnabled) {
				topLeftPoint.x = -1;
				sizePx.x = 0;
			}
		}
		if (offset.y === 0) {
			updateRows = false;
			if (!this.options.sheetGeometryDataEnabled) {
				topLeftPoint.y = -1;
				sizePx.y = 0;
			}
		}

		var pos = this._pixelsToTwips(topLeftPoint);
		var size = this._pixelsToTwips(sizePx);

		if (!this.options.sheetGeometryDataEnabled) {
			this.requestViewRowColumnData(pos, size);
			return;
		}

		if (sheetGeometryChanged || !this.sheetGeometry) {
			this.requestSheetGeometryData(
				{columns: updateCols, rows: updateRows});
			return;
		}

		this.sheetGeometry.setViewArea(pos, size);
		this._updateHeadersGridLines(undefined, updateCols, updateRows);
	},

	// This send .uno:ViewRowColumnHeaders command to core with the new view coordinates (tile-twips).
	requestViewRowColumnData: function (pos, size) {

		var payload = 'commandvalues command=.uno:ViewRowColumnHeaders?x=' + Math.round(pos.x) + '&y=' + Math.round(pos.y) +
			'&width=' + Math.round(size.x) + '&height=' + Math.round(size.y);

		this._map._socket.sendMessage(payload);
	},

	// sends the .uno:SheetGeometryData command optionally with arguments.
	requestSheetGeometryData: function (flags) {
		var unoCmd = '.uno:SheetGeometryData';
		var haveArgs = (typeof flags == 'object' &&
			(flags.columns === true || flags.rows === true) &&
			(flags.columns !== flags.rows));
		var payload = 'commandvalues command=' + unoCmd;

		if (haveArgs) {
			var argList = [];
			if (flags.columns === true) {
				argList.push('columns=1');
			}
			if (flags.rows === true) {
				argList.push('rows=1');
			}

			var dataTypeFlagNames = ['sizes', 'hidden', 'filtered', 'groups'];
			var dataTypesPresent = false;
			dataTypeFlagNames.forEach(function (name) {
				if (flags[name] === true) {
					argList.push(name + '=1');
					dataTypesPresent = true;
				}
			});

			if (!dataTypesPresent) {
				dataTypeFlagNames.forEach(function (name) {
					argList.push(name + '=1');
				});
			}

			payload += '?' + argList.join('&');
		}

		this._map._socket.sendMessage(payload);
	},

	// Sends a notification to the row/col header and gridline controls that
	// they need repainting.
	// viewAreaData is the parsed .uno:ViewRowColumnHeaders JSON if that source is used.
	// else it should be undefined.
	_updateHeadersGridLines: function (viewAreaData, updateCols, updateRows) {
		this._map.fire('viewrowcolumnheaders', {
			data: viewAreaData,
			updaterows: updateRows,
			updatecolumns: updateCols,
			cursor: this._getCursorPosSize(),
			selection: this._getSelectionHeaderData(),
			converter: this._twipsToPixels,
			context: this
		});
	},

	_handleSheetGeometryDataMsg: function (jsonMsgObj) {
		if (!this.sheetGeometry) {
			this.sheetGeometry = new L.SheetGeometry(jsonMsgObj,
				this._tileWidthTwips, this._tileHeightTwips,
				this._tileSize, this._tilePixelScale);
		}

		this.sheetGeometry.update(jsonMsgObj);
		this.sheetGeometry.setViewArea(this._pixelsToTwips(this._map._getTopLeftPoint()),
			this._pixelsToTwips(this._map.getSize()));
		this._updateHeadersGridLines(undefined, true /* updateCols */,
			true /* updateRows */);
	},

	_onCommandValuesMsg: function (textMsg) {
		var jsonIdx = textMsg.indexOf('{');
		if (jsonIdx === -1)
			return;

		var values = JSON.parse(textMsg.substring(jsonIdx));
		if (!values) {
			return;
		}

		var comment;
		if (values.commandName === '.uno:ViewRowColumnHeaders') {
			this._updateHeadersGridLines(values);

		} else if (values.commandName === '.uno:SheetGeometryData') {
			this._handleSheetGeometryDataMsg(values);

		} else if (values.comments) {
			this.clearAnnotations();
			for (var index in values.comments) {
				comment = values.comments[index];
				comment.tab = parseInt(comment.tab);
				comment.cellPos = L.LOUtil.stringToBounds(comment.cellPos);
				comment.cellPos = L.latLngBounds(this._twipsToLatLng(comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(comment.cellPos.getTopRight()));
				if (!this._annotations[comment.tab]) {
					this._annotations[comment.tab] = {};
				}
				this._annotations[comment.tab][comment.id] = this.createAnnotation(comment);
			}
			this.showAnnotations();
		} else if (values.commentsPos) {
			this.hideAnnotations();
			for (index in values.commentsPos) {
				comment = values.commentsPos[index];
				comment.tab = parseInt(comment.tab);
				comment.cellPos = L.LOUtil.stringToBounds(comment.cellPos);
				comment.cellPos = L.latLngBounds(this._twipsToLatLng(comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(comment.cellPos.getTopRight()));
				var annotation = this._annotations[comment.tab][comment.id];
				if (annotation) {
					annotation.setLatLngBounds(comment.cellPos);
					if (annotation.mark) {
						annotation.mark.setLatLng(comment.cellPos.getNorthEast());
					}
				}
			}
			this.showAnnotations();
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onTextSelectionMsg: function (textMsg) {
		L.TileLayer.prototype._onTextSelectionMsg.call(this, textMsg);
		this._onUpdateSelectionHeader();
	},

	_onCellCursorMsg: function (textMsg) {
		L.TileLayer.prototype._onCellCursorMsg.call(this, textMsg);
		this._onUpdateCurrentHeader();
	}
});


// TODO: Move these somewhere more appropriate.

// Sheet geometry data
L.SheetGeometry = L.Class.extend({

	// sheetGeomJSON is expected to be the parsed JSON message from core
	// in response to client command '.uno:SheetGeometryData' with
	// all flags (ie 'columns', 'rows', 'sizes', 'hidden', 'filtered',
	// 'groups') enabled.
	initialize: function (sheetGeomJSON, tileWidthTwips, tileHeightTwips,
		tileSizeCSSPixels, dpiScale) {

		if (typeof sheetGeomJSON !== 'object' ||
			typeof tileWidthTwips !== 'number' ||
			typeof tileHeightTwips !== 'number' ||
			typeof tileSizeCSSPixels !== 'number' ||
			typeof dpiScale !== 'number') {
			console.error('Incorrect constructor argument types or missing required arguments');
			return;
		}

		this._columns = new L.SheetDimension();
		this._rows = new L.SheetDimension();
		this._unoCommand = '.uno:SheetGeometryData';

		// Set various unit conversion info early on because on update() call below, these info are needed.
		this.setTileGeometryData(tileWidthTwips, tileHeightTwips, tileSizeCSSPixels,
			dpiScale, false /* update position info ?*/);

		this.update(sheetGeomJSON, /* checkCompleteness */ true);
	},

	update: function (sheetGeomJSON, checkCompleteness) {

		if (!this._testValidity(sheetGeomJSON, checkCompleteness)) {
			return false;
		}

		var updateOK = true;
		if (sheetGeomJSON.columns) {
			if (!this._columns.update(sheetGeomJSON.columns)) {
				console.error(this._unoCommand + ': columns update failed.');
				updateOK = false;
			}
		}

		if (sheetGeomJSON.rows) {
			if (!this._rows.update(sheetGeomJSON.rows)) {
				console.error(this._unoCommand + ': rows update failed.');
				updateOK = false;
			}
		}

		this._columns.setMaxIndex(+sheetGeomJSON.maxtiledcolumn);
		this._rows.setMaxIndex(+sheetGeomJSON.maxtiledrow);

		return updateOK;
	},

	setTileGeometryData: function (tileWidthTwips, tileHeightTwips, tileSizeCSSPixels,
		dpiScale, updatePositions) {

		this._columns.setTileGeometryData(tileWidthTwips, tileSizeCSSPixels, dpiScale, updatePositions);
		this._rows.setTileGeometryData(tileHeightTwips, tileSizeCSSPixels, dpiScale, updatePositions);
	},

	setViewArea: function (topLeftTwipsPoint, sizeTwips) {

		if (!(topLeftTwipsPoint instanceof L.Point) || !(sizeTwips instanceof L.Point)) {
			console.error('invalid argument types');
			return false;
		}

		var left   = topLeftTwipsPoint.x;
		var top    = topLeftTwipsPoint.y;
		var right  = left + sizeTwips.x;
		var bottom = top + sizeTwips.y;

		this._columns.setViewLimits(left, right);
		this._rows.setViewLimits(top, bottom);

		return true;
	},

	getColumnsGeometry: function () {
		return this._columns;
	},

	getRowsGeometry: function () {
		return this._rows;
	},

	// returns an object with keys 'start' and 'end' indicating the
	// column range in the current view area.
	getViewColumnRange: function () {
		return this._columns.getViewElementRange();
	},

	// returns an object with keys 'start' and 'end' indicating the
	// row range in the current view area.
	getViewRowRange: function () {
		return this._rows.getViewElementRange();
	},

	getViewCellRange: function () {
		return {
			columnrange: this.getViewColumnRange(),
			rowrange: this.getViewRowRange()
		};
	},

	// Returns an object with the following fields:
	// columnIndex should be zero based.
	// 'startpos' (start position of the column in css pixels), 'size' (column size in css pixels).
	// Note: All these fields are computed by assuming zero sizes for hidden/filtered columns.
	getColumnData: function (columnIndex) {
		return this._columns.getElementData(columnIndex);
	},

	// Returns an object with the following fields:
	// rowIndex should be zero based.
	// 'startpos' (start position of the row in css pixels), 'size' (row size in css pixels).
	// Note: All these fields are computed by assuming zero sizes for hidden/filtered rows.
	getRowData: function (rowIndex) {
		return this._rows.getElementData(rowIndex);
	},

	// Runs the callback for every column in the inclusive range [columnStart, columnEnd].
	// callback is expected to have a signature of (column, columnData)
	// where 'column' will contain the column index(zero based) and 'columnData' will be an object with
	// the same fields as returned by getColumnData().
	forEachColumnInRange: function (columnStart, columnEnd, callback) {
		this._columns.forEachInRange(columnStart, columnEnd, callback);
	},

	// Runs the callback for every row in the inclusive range [rowStart, rowEnd].
	// callback is expected to have a signature of (row, rowData)
	// where 'row' will contain the row index(zero based) and 'rowData' will be an object with
	// the same fields as returned by getRowData().
	forEachRowInRange: function (rowStart, rowEnd, callback) {
		this._rows.forEachInRange(rowStart, rowEnd, callback);
	},

	getColumnGroupLevels: function () {
		return this._columns.getGroupLevels();
	},

	getRowGroupLevels: function () {
		return this._rows.getGroupLevels();
	},

	getColumnGroupsDataInView: function () {
		return this._columns.getGroupsDataInView();
	},

	getRowGroupsDataInView: function () {
		return this._rows.getGroupsDataInView();
	},

	_testValidity: function (sheetGeomJSON, checkCompleteness) {

		if (!sheetGeomJSON.hasOwnProperty('commandName')) {
			console.error(this._unoCommand + ' response has no property named "commandName".');
			return false;
		}

		if (sheetGeomJSON.commandName !== this._unoCommand) {
			console.error('JSON response has wrong commandName: ' +
				sheetGeomJSON.commandName + ' expected: ' +
				this._unoCommand);
			return false;
		}

		if (typeof sheetGeomJSON.maxtiledcolumn !== 'string' ||
			!/^\d+$/.test(sheetGeomJSON.maxtiledcolumn)) {
			console.error('JSON is missing/unreadable maxtiledcolumn property');
			return false;
		}

		if (typeof sheetGeomJSON.maxtiledrow !== 'string' ||
			!/^\d+$/.test(sheetGeomJSON.maxtiledrow)) {
			console.error('JSON is missing/unreadable maxtiledrow property');
			return false;
		}

		if (checkCompleteness) {

			if (!sheetGeomJSON.hasOwnProperty('rows') ||
				!sheetGeomJSON.hasOwnProperty('columns')) {

				console.error(this._unoCommand + ' response is incomplete.');
				return false;
			}

			if (typeof sheetGeomJSON.rows !== 'object' ||
				typeof sheetGeomJSON.columns !== 'object') {

				console.error(this._unoCommand + ' response has invalid rows/columns children.');
				return false;
			}

			var expectedFields = ['sizes', 'hidden', 'filtered'];
			for (var idx = 0; idx < expectedFields.length; idx++) {

				var fieldName = expectedFields[idx];
				var encodingForCols = sheetGeomJSON.columns[fieldName];
				var encodingForRows = sheetGeomJSON.rows[fieldName];

				// Don't accept empty string or any other types.
				if (typeof encodingForRows !== 'string' || !encodingForRows) {
					console.error(this._unoCommand + ' response has invalid value for rows.' +
						fieldName);
					return false;
				}

				// Don't accept empty string or any other types.
				if (typeof encodingForCols !== 'string' || !encodingForCols) {
					console.error(this._unoCommand + ' response has invalid value for columns.' +
						fieldName);
					return false;
				}
			}
		}

		return true;
	}
});

// Used to represent/query geometry data about either rows or columns.
L.SheetDimension = L.Class.extend({

	initialize: function () {

		this._sizes = new L.SpanList();
		this._hidden = new L.BoolSpanList();
		this._filtered = new L.BoolSpanList();
		this._outlines = new L.DimensionOutlines();

		// This is used to store the span-list of sizes
		// with hidden/filtered elements set to zero size.
		// This needs to be updated whenever
		// this._sizes/this._hidden/this._filtered are modified.
		this._visibleSizes = undefined;
	},

	update: function (jsonObject) {

		if (typeof jsonObject !== 'object') {
			return false;
		}

		var regenerateVisibleSizes = false;
		var loadsOK = true;
		if (jsonObject.hasOwnProperty('sizes')) {
			loadsOK = this._sizes.load(jsonObject.sizes);
			regenerateVisibleSizes = true;
		}

		if (jsonObject.hasOwnProperty('hidden')) {
			var thisLoadOK = this._hidden.load(jsonObject.hidden);
			loadsOK = loadsOK && thisLoadOK;
			regenerateVisibleSizes = true;
		}

		if (jsonObject.hasOwnProperty('filtered')) {
			thisLoadOK = this._filtered.load(jsonObject.filtered);
			loadsOK = loadsOK && thisLoadOK;
			regenerateVisibleSizes = true;
		}

		if (jsonObject.hasOwnProperty('groups')) {
			thisLoadOK = this._outlines.load(jsonObject.groups);
			loadsOK = loadsOK && thisLoadOK;
		}

		if (loadsOK && regenerateVisibleSizes) {
			this._updateVisible();
		}

		return loadsOK;
	},

	setMaxIndex: function (maxIndex) {
		this._maxIndex = maxIndex;
	},

	setTileGeometryData: function (tileSizeTwips, tileSizeCSSPixels, dpiScale, updatePositions) {
		if (updatePositions === undefined) {
			updatePositions = true;
		}

		this._twipsPerCSSPixel = tileSizeTwips / tileSizeCSSPixels;
		this._devPixelsPerCssPixel = dpiScale;

		if (updatePositions) {
			// We need to compute positions data for every zoom change.
			this._updatePositions();
		}
	},

	_updateVisible: function () {

		var invisibleSpanList = this._hidden.union(this._filtered); // this._hidden is not modified.
		this._visibleSizes = this._sizes.applyZeroValues(invisibleSpanList); // this._sizes is not modified.
		this._updatePositions();
	},

	_updatePositions: function() {

		var posDevPx = 0; // position in device pixels.
		var dimensionObj = this;
		this._visibleSizes.addCustomDataForEachSpan(function (
			index,
			size, /* size in twips of one element in the span */
			spanLength /* #elements in the span */) {

			// Important: rounding needs to be done in device pixels exactly like the core.
			var sizeDevPxOne = Math.floor(size / dimensionObj._twipsPerCSSPixel * dimensionObj._devPixelsPerCssPixel);
			posDevPx += (sizeDevPxOne * spanLength);
			var posCssPx = posDevPx / dimensionObj._devPixelsPerCssPixel;
			// position in device-pixel aligned twips.
			var posTileTwips = Math.floor(posCssPx * dimensionObj._twipsPerCSSPixel);

			var customData = {
				sizedev: sizeDevPxOne,
				posdevpx: posDevPx,
				poscsspx: posCssPx,
				postiletwips: posTileTwips
			};

			return customData;
		});
	},

	// returns the element pos/size in css pixels by default.
	getElementData: function (index, useDevicePixels) {
		var span = this._visibleSizes.getSpanDataByIndex(index);
		if (span === undefined) {
			return undefined;
		}

		return this._getElementDataFromSpanByIndex(index, span, useDevicePixels);
	},

	// returns element pos/size in css pixels by default.
	_getElementDataFromSpanByIndex: function (index, span, useDevicePixels) {
		if (span === undefined || index < span.start || span.end < index) {
			return undefined;
		}

		var numSizes = span.end - index + 1;
		var pixelScale = useDevicePixels ? this._devPixelsPerCssPixel : 1;
		return {
			startpos: (span.data.posdevpx - span.data.sizedev * numSizes) / pixelScale,
			size: span.data.sizedev / pixelScale
		};
	},

	forEachInRange: function (start, end, callback) {

		var dimensionObj = this;
		this._visibleSizes.forEachSpanInRange(start, end, function (span) {
			var first = Math.max(span.start, start);
			var last = Math.min(span.end, end);
			for (var index = first; index <= last; ++index) {
				callback(index, dimensionObj._getElementDataFromSpanByIndex(index, span));
			}
		});
	},

	// computes element index from tile-twips position.
	_getIndexFromTileTwipsPos: function (pos) {
		var span = this._visibleSizes.getSpanDataByCustomDataField(pos, 'postiletwips');
		var elementCount = span.end - span.start + 1;
		var posStart = ((span.data.posdevpx - span.data.sizedev * elementCount) /
			this._devPixelsPerCssPixel * this._twipsPerCSSPixel);
		var posEnd = span.data.postiletwips;
		var sizeOne = (posEnd - posStart) / elementCount;

		// always round down as relativeIndex is zero-based.
		var relativeIndex = Math.floor((pos - posStart) / sizeOne);

		return span.start + relativeIndex;
	},

	setViewLimits: function (startPosTileTwips, endPosTileTwips) {

		this._viewStartIndex = Math.max(0, this._getIndexFromTileTwipsPos(startPosTileTwips));
		this._viewEndIndex = Math.min(this._maxIndex, this._getIndexFromTileTwipsPos(endPosTileTwips));
	},

	getViewElementRange: function () {
		return {
			start: this._viewStartIndex,
			end: this._viewEndIndex
		};
	},

	getGroupLevels: function () {
		return this._outlines.getLevels();
	},

	getGroupsDataInView: function () {
		var groupsData = [];
		var levels = this._outlines.getLevels();
		if (!levels) {
			return groupsData;
		}

		var dimensionObj = this;
		this._outlines.forEachGroupInRange(this._viewStartIndex, this._viewEndIndex,
			function (levelIdx, groupIdx, start, end, hidden) {

				var startElementData = dimensionObj.getElementData(start, true /* device pixels */);
				var endElementData = dimensionObj.getElementData(end, true /* device pixels */);
				groupsData.push({
					level: (levelIdx + 1).toString(),
					index: groupIdx.toString(),
					startPos: startElementData.startpos.toString(),
					endPos: (endElementData.startpos + endElementData.size).toString(),
					hidden: hidden ? '1' : '0'
				});
			});

		return groupsData;
	},

	getMaxIndex: function () {
		return this._maxIndex;
	}
});

L.SpanList = L.Class.extend({

	initialize: function (encoding) {

		// spans are objects with keys: 'index' and 'value'.
		// 'index' holds the last element of the span.
		// Optionally custom data of a span can be added
		// under the key 'data' via addCustomDataForEachSpan.
		this._spanlist = [];
		if (typeof encoding !== 'string') {
			return;
		}

		this.load(encoding);
	},

	load: function (encoding) {

		if (typeof encoding !== 'string') {
			return false;
		}

		var result = parseSpanListEncoding(encoding, false /* boolean value ? */);
		if (result === undefined) {
			return false;
		}

		this._spanlist = result.spanlist;
		return true;
	},

	// Runs in O(#spans in 'this' + #spans in 'other')
	applyZeroValues: function (other) {

		if (!(other instanceof L.BoolSpanList)) {
			return undefined;
		}

		// Ensure both spanlists have the same total range.
		if (this._spanlist[this._spanlist.length - 1].index !== other._spanlist[other._spanlist.length - 1]) {
			return undefined;
		}

		var maxElement = this._spanlist[this._spanlist.length - 1].index;
		var result = new L.SpanList();

		var thisIdx = 0;
		var otherIdx = 0;
		var zeroBit = other._startBit;
		var resultValue = zeroBit ? 0 : this._spanlist[thisIdx].value;

		while (thisIdx < this._spanlist.length && otherIdx < other._spanlist.length) {

			// end elements of the current spans of 'this' and 'other'.
			var thisElement = this._spanlist[thisIdx].index;
			var otherElement = other._spanlist[otherIdx];

			var lastElement = otherElement;
			if (thisElement < otherElement) {
				lastElement = thisElement;
				++thisIdx;
			}
			else if (otherElement < thisElement) {
				zeroBit = !zeroBit;
				++otherIdx;
			}
			else { // both elements are equal.
				zeroBit = !zeroBit;
				++thisIdx;
				++otherIdx;
			}

			var nextResultValue = resultValue;
			if (thisIdx < this._spanlist.length) {
				nextResultValue = zeroBit ? 0 : this._spanlist[thisIdx].value;
			}

			if (resultValue != nextResultValue || lastElement >= maxElement) {
				// In the result spanlist a new span start from lastElement+1
				// or reached the maximum possible element.
				result._spanlist.push({index: lastElement, value: resultValue});
				resultValue = nextResultValue;
			}
		}

		return result;
	},

	addCustomDataForEachSpan: function (getCustomDataCallback) {

		var prevIndex = -1;
		this._spanlist.forEach(function (span) {
			span.data = getCustomDataCallback(
				span.index, span.value,
				span.index - prevIndex);
			prevIndex = span.index;
		});
	},

	getSpanDataByIndex: function (index) {
		var spanid = this._searchByIndex(index);
		if (spanid == -1) {
			return undefined;
		}

		return this._getSpanData(spanid);
	},

	getSpanDataByCustomDataField: function (value, fieldName) {
		var spanid = this._searchByCustomDataField(value, fieldName);
		if (spanid == -1) {
			return undefined;
		}

		return this._getSpanData(spanid);
	},

	forEachSpanInRange: function (start, end, callback) {

		if (start > end) {
			return;
		}

		var startId = this._searchByIndex(start);
		var endId = this._searchByIndex(end);

		if (startId == -1 || endId == -1) {
			return;
		}

		for (var id = startId; id <= endId; ++id) {
			callback(this._getSpanData(id));
		}
	},

	_getSpanData: function (spanid) {

		var span = this._spanlist[spanid];
		var dataClone = undefined;
		if (span.data) {
			dataClone = {};
			Object.keys(span.data).forEach(function (key) {
				dataClone[key] = span.data[key];
			});
		}

		return {
			start: spanid ? this._spanlist[spanid - 1].index + 1 : 0,
			end: span.index,
			size: span.value,
			data: dataClone
		};
	},

	_searchByIndex: function (index) {

		if (index < 0 || index > this._spanlist[this._spanlist.length - 1].index) {
			return -1;
		}

		var start = 0;
		var end = this._spanlist.length - 1;
		var mid = -1;
		while (start <= end) {
			mid = Math.round((start + end) / 2);
			var spanstart = mid ? this._spanlist[mid - 1].index + 1 : 0;
			var spanend = this._spanlist[mid].index;
			if (spanstart <= index && index <= spanend) {
				break;
			}

			if (index < spanstart) {
				end = mid - 1;
			}
			else { // spanend < index
				start = mid + 1;
			}
		}

		return mid;
	},

	_searchByCustomDataField: function (value, fieldName) {

		// All custom searchable data values are assumed to start from 0 at the start of first span.
		var maxValue = this._spanlist[this._spanlist.length - 1].data[fieldName];
		if (value < 0 || value > maxValue) {
			return -1;
		}

		var start = 0;
		var end = this._spanlist.length - 1;
		var mid = -1;
		while (start <= end) {
			mid = Math.round((start + end) / 2);
			var valuestart = mid ? this._spanlist[mid - 1].data[fieldName] + 1 : 0;
			var valueend = this._spanlist[mid].data[fieldName];
			if (valuestart <= value && value <= valueend) {
				break;
			}

			if (value < valuestart) {
				end = mid - 1;
			}
			else { // valueend < value
				start = mid + 1;
			}
		}

		// may fail for custom data ?
		return (start <= end) ? mid : -1;
	}

});

L.BoolSpanList = L.SpanList.extend({

	load: function (encoding) {

		if (typeof encoding !== 'string') {
			return false;
		}

		var result = parseSpanListEncoding(encoding, true /* boolean value ? */);
		if (result === undefined) {
			return false;
		}

		this._spanlist = result.spanlist;
		this._startBit = result.startBit;
		return true;
	},

	// Runs in O(#spans in 'this' + #spans in 'other')
	union: function (other) {

		if (!(other instanceof L.BoolSpanList)) {
			return undefined;
		}

		// Ensure both spanlists have the same total range.
		if (this._spanlist[this._spanlist.length - 1] !== other._spanlist[other._spanlist.length - 1]) {
			return undefined;
		}

		var maxElement = this._spanlist[this._spanlist.length - 1];

		var result = new L.BoolSpanList();
		var thisBit = this._startBit;
		var otherBit = other._startBit;
		var resultBit = thisBit || otherBit;
		result._startBit = resultBit;

		var thisIdx = 0;
		var otherIdx = 0;

		while (thisIdx < this._spanlist.length && otherIdx < other._spanlist.length) {

			// end elements of the current spans of 'this' and 'other'.
			var thisElement = this._spanlist[thisIdx];
			var otherElement = other._spanlist[otherIdx];

			var lastElement = otherElement;
			if (thisElement < otherElement) {
				lastElement = thisElement;
				thisBit = !thisBit;
				++thisIdx;
			}
			else if (otherElement < thisElement) {
				otherBit = !otherBit;
				++otherIdx;
			}
			else { // both elements are equal.
				thisBit = !thisBit;
				otherBit = !otherBit;
				++thisIdx;
				++otherIdx;
			}

			var nextResultBit = (thisBit || otherBit);
			if (resultBit != nextResultBit || lastElement >= maxElement) {
				// In the result spanlist a new span start from lastElement+1
				// or reached the maximum possible element.
				result._spanlist.push(lastElement);
				resultBit = nextResultBit;
			}
		}

		return result;
	}
});

function parseSpanListEncoding(encoding, booleanValue) {

	var spanlist = [];
	var splits = encoding.split(' ');
	if (splits.length < 2) {
		return undefined;
	}

	var startBit = false;
	if (booleanValue) {
		var parts = splits[0].split(':');
		if (parts.length != 2) {
			return undefined;
		}
		startBit = parseInt(parts[0]);
		var first = parseInt(parts[1]);
		if (isNaN(startBit) || isNaN(first)) {
			return undefined;
		}
		spanlist.push(first);
	}

	startBit = Boolean(startBit);

	for (var idx = 0; idx < splits.length - 1; ++idx) {

		if (booleanValue) {
			if (!idx) {
				continue;
			}

			var entry = parseInt(splits[idx]);
			if (isNaN(entry)) {
				return undefined;
			}

			spanlist.push(entry);
			continue;
		}

		var spanParts = splits[idx].split(':');
		if (spanParts.length != 2) {
			return undefined;
		}

		var span = {
			index: parseInt(spanParts[1]),
			value: parseInt(spanParts[0])
		};

		if (isNaN(span.index) || isNaN(span.value)) {
			return undefined;
		}

		spanlist.push(span);
	}

	var result = {spanlist: spanlist};

	if (booleanValue) {
		result.startBit = startBit;
	}

	return result;
}

L.DimensionOutlines = L.Class.extend({

	initialize: function (encoding) {

		this._outlines = [];
		if (typeof encoding !== 'string') {
			return;
		}

		this.load(encoding);
	},

	load: function (encoding) {

		if (typeof encoding !== 'string') {
			return false;
		}

		var levels = encoding.split(' ');
		if (levels.length < 2) {
			// No outline.
			return true;
		}

		var outlines = [];

		for (var levelIdx = 0; levelIdx < levels.length - 1; ++levelIdx) {
			var collectionSplits = levels[levelIdx].split(',');
			var collections = [];
			if (collectionSplits.length < 2) {
				return false;
			}

			for (var collIdx = 0; collIdx < collectionSplits.length - 1; ++collIdx) {
				var entrySplits = collectionSplits[collIdx].split(':');
				if (entrySplits.length < 4) {
					return false;
				}

				var olineEntry = {
					start: parseInt(entrySplits[0]),
					end: parseInt(entrySplits[1]), // this is size.
					hidden: parseInt(entrySplits[2]),
					visible: parseInt(entrySplits[3])
				};

				if (isNaN(olineEntry.start) || isNaN(olineEntry.end) ||
					isNaN(olineEntry.hidden) || isNaN(olineEntry.visible)) {
					return false;
				}

				// correct the 'end' attribute.
				olineEntry.end += (olineEntry.start - 1);

				collections.push(olineEntry);
			}

			outlines.push(collections);
		}

		this._outlines = outlines;
		return true;
	},

	getLevels: function () {
		return this._outlines.length;
	},

	// Calls 'callback' for all groups in all levels that have an intersection with the inclusive element range [start, end].
	// 'callback' is called with these parameters : (levelIdx, groupIdx, groupStart, groupEnd, groupHidden).
	forEachGroupInRange: function (start, end, callback) {

		if (start === undefined || end === undefined || callback === undefined) {
			return;
		}

		if (!this._outlines.length || start > end) {
			return;
		}

		// Search direction provider for binarySearch().
		// Here we want to find the first group after or intersects elementIdx.
		// return value : 0 for match, -1 for "try previous entries", +1 for "try next entries".
		var directionProvider = function (elementIdx, prevGroup, curGroup/*, nextGroup*/) {

			var direction = (elementIdx < curGroup.start) ? -1 :
				(curGroup.end < elementIdx) ? 1 : 0;

			if (direction >= 0) {
				return direction;
			}

			// If curGroup is the first one, or elementidx is after prevGroup's end, then it is a match.
			if (!prevGroup || (prevGroup.end < elementIdx)) {
				return 0;
			}

			return -1;
		};

		for (var levelIdx = this._outlines.length - 1; levelIdx >= 0; --levelIdx) {

			var groupsInLevel = this._outlines[levelIdx];
			// Find the first group after or that intersects 'start'.
			var startGroupIdx = binarySearch(groupsInLevel, start, directionProvider);
			if (startGroupIdx == -1) {
				// All groups at this level are before 'start'.
				continue;
			}

			var startGroup = groupsInLevel[startGroupIdx];
			if (end < startGroup.start) {
				// No group at this level intersects the range [start, end].
				continue;
			}

			for (var groupIdx = startGroupIdx; groupIdx < groupsInLevel.length; ++groupIdx) {
				var group = groupsInLevel[groupIdx];
				if (end < group.start) {
					continue;
				}

				callback(levelIdx, groupIdx, group.start,
					group.end, group.hidden);
			}
		}
	}
});


// Does binary search on array for key, possibly using a custom direction provider.
// Of course, this assumes that the array is sorted (w.r.t to the semantics of
// the directionProvider when it is provided).
// It returns the index of the match if successful else returns -1.
//
// directionProvider will be provided the following parameters :
// (key, previousArrayElement, currentArrayElement, nextArrayElement)
// previousArrayElement and nextArrayElement can be undefined when
// currentArrayElement is the first or the last element of the array
// respectively. This function should return:
//   0: for a match(to stop search),
//   1: to try searching upper half,
//  -1: to try searching lower half

function binarySearch(array, key, directionProvider) {

	if (array === undefined || !array.length) {
		return -1;
	}

	if (directionProvider === undefined) {
		directionProvider = function (key, testvalue) {
			return (key === testvalue) ? 0 :
				(key < testvalue) ? -1 : 1;
		};
	}

	var start = 0;
	var end = array.length - 1;

	// Bound checks and early exit.
	var startDir = directionProvider(key, undefined, array[0], array[1]);
	if (startDir <= 0) {
		return startDir;
	}

	var endDir = directionProvider(key, array[end - 1], array[end]);
	if (endDir >= 0) {
		return endDir ? -1 : end;
	}

	var mid = -1;
	while (start <= end) {
		mid = Math.round((start + end) / 2);
		var direction = directionProvider(key, array[mid-1],
			array[mid], array[mid+1]);

		if (direction == 0) {
			break;
		}

		if (direction == -1) {
			end = mid - 1;
		}
		else {
			start = mid + 1;
		}
	}

	return (start > end) ? -1 : mid;
}
