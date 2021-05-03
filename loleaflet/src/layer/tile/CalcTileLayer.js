/* -*- js-indent-level: 8 -*- */
/*
 * Calc tile layer is used to display a spreadsheet document
 */

/* global app $ */

L.CalcTileLayer = L.CanvasTileLayer.extend({
	options: {
		// TODO: sync these automatically from SAL_LOK_OPTIONS
		sheetGeometryDataEnabled: true,
		printTwipsMsgsEnabled: true,
		syncSplits: true, // if false, the splits/freezes are not synced with other users viewing the same sheet.
	},

	editedAnnotation: null,

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
			this.editedAnnotation = annotation;
			annotation.editAnnotation();
		}
	},

	createAnnotation: function (comment) {
		var annotation = L.divOverlay(comment.cellPos).bindAnnotation(L.annotation(L.latLng(0, 0),
			comment, comment.id === 'new' ? {noMenu: true} : {}));
		return annotation;
	},

	beforeAdd: function (map) {
		map._isCursorVisible = false;
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('updateparts', this._onUpdateParts, this);
		map.on('AnnotationCancel', this._onAnnotationCancel, this);
		map.on('AnnotationReply', this._onAnnotationReply, this);
		map.on('AnnotationSave', this._onAnnotationSave, this);
		map.on('splitposchanged', this.setSplitCellFromPos, this);
		map.on('commandstatechanged', this._onCommandStateChanged, this);
		map.uiManager.initializeSpecializedUI('spreadsheet');
	},

	clearAnnotations: function () {
		if (this._map) {
			for (var tab in this._annotations) {
				this.hideAnnotations(tab);
			}
		} // else during shutdown.
		this._annotations = {};
	},

	layoutAnnotations: function () {
	},

	unselectAnnotations: function () {
	},

	onAdd: function (map) {
		map.addControl(L.control.tabs());
		L.CanvasTileLayer.prototype.onAdd.call(this, map);

		map.on('resize', function () {
			if (this.isCursorVisible()) {
				this._onUpdateCursor(true /* scroll */);
			}
		}.bind(this));

		this._annotations = {};

		app.sectionContainer.addSection(new app.definitions.AutoFillMarkerSection());

		this.insertMode = false;
		this._cellSelections = Array(0);
		this._cellCursorXY = {x: -1, y: -1};
	},

	onAnnotationModify: function (annotation) {
		this.editedAnnotation = annotation;
		if (window.mode.isMobile() || window.mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(annotation, function(annotation) { that._onAnnotationSave(annotation); }, /* isMod */ true);
		} else {
			annotation.edit();
			annotation.focus();
		}
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
		this.editedAnnotation = annotation;
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
			if (this._cellCursor.intersects(annotation._data.cellPos)) {
				if (window.mode.isMobile()) {
					this._openCommentWizard(annotation);
				} else {
					this._map.addLayer(annotation);
					annotation.show();
				}
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
			this.refreshViewData(undefined, false /* compatDataSrcOnly */, true /* sheetGeometryChanged */);
			this._switchSplitPanesContext();
			this.hideAnnotations(this._prevSelectedPart);
			this.showAnnotations();
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			obj.comment.tab = parseInt(obj.comment.tab);
			if (obj.comment.action === 'Add') {
				if (obj.comment.author in this._map._viewInfoByUserName) {
					obj.comment.avatar = this._map._viewInfoByUserName[obj.comment.author].userextrainfo.avatar;
				}
				var cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = this._convertToTileTwipsSheetArea(cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (!this._annotations[obj.comment.tab]) {
					this._annotations[obj.comment.tab] = {};
				}
				this._annotations[obj.comment.tab][obj.comment.id] = this.createAnnotation(obj.comment);
				var addedComment = this._annotations[obj.comment.tab][obj.comment.id];
				if (obj.comment.tab === this._selectedPart) {
					this.showAnnotation(addedComment);
				}
				if (window.mode.isMobile())
					this._map._docLayer._openCommentWizard(addedComment._annotation);
			} else if (obj.comment.action === 'Remove') {
				var removed = this._annotations[obj.comment.tab][obj.comment.id];
				if (removed) {
					this.hideAnnotation(removed);
					delete this._annotations[obj.comment.tab][obj.comment.id];
				}
				if (window.mode.isMobile())
					this._map._docLayer._openCommentWizard();
			} else if (obj.comment.action === 'Modify') {
				var modified = this._annotations[obj.comment.tab][obj.comment.id];
				cellPos = L.LOUtil.stringToBounds(obj.comment.cellPos);
				obj.comment.cellPos = this._convertToTileTwipsSheetArea(cellPos);
				obj.comment.cellPos = L.latLngBounds(this._twipsToLatLng(obj.comment.cellPos.getBottomLeft()),
					this._twipsToLatLng(obj.comment.cellPos.getTopRight()));
				if (modified) {
					modified._annotation._data = obj.comment;
					modified.setLatLngBounds(obj.comment.cellPos);
				}
				if (window.mode.isMobile())
					this._map._docLayer._openCommentWizard(modified._annotation);
			}
		} else if (textMsg.startsWith('invalidateheader: column')) {
			this.refreshViewData({x: this._map._getTopLeftPoint().x, y: 0,
				offset: {x: undefined, y: 0}}, true /* compatDataSrcOnly */);
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: row')) {
			this.refreshViewData({x: 0, y: this._map._getTopLeftPoint().y,
				offset: {x: 0, y: undefined}}, true /* compatDataSrcOnly */);
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (textMsg.startsWith('invalidateheader: all')) {
			this.refreshViewData({x: this._map._getTopLeftPoint().x, y: this._map._getTopLeftPoint().y,
				offset: {x: undefined, y: undefined}}, true /* compatDataSrcOnly */);
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
		} else if (this.options.sheetGeometryDataEnabled &&
				textMsg.startsWith('invalidatesheetgeometry:')) {
			var params = textMsg.substring('invalidatesheetgeometry:'.length).trim().split(' ');
			var flags = {};
			params.forEach(function (param) {
				flags[param] = true;
			});
			this.requestSheetGeometryData(flags);
		} else {
			L.CanvasTileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
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
		var visibleArea, visiblePaneAreas;
		if (this._splitPanesContext) {
			visiblePaneAreas = this._splitPanesContext.getTwipsBoundList();
		}
		else {
			var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
			var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
			visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		}

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
				var intersectsVisible = visibleArea ? visibleArea.intersects(bounds) : bounds.intersectsAny(visiblePaneAreas);
				if (intersectsVisible) {
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

			bounds = this._coordsToTwipsBoundsAtZoom(coords, this._map.getZoom());
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
		if (!this.isHiddenPart(part)) {
			this.refreshViewData(undefined, true /* compatDataSrcOnly */, false /* sheetGeometryChanged */);
			this._replayPrintTwipsMsgAllViews('cellviewcursor');
			this._replayPrintTwipsMsgAllViews('textviewselection');
		}
	},

	_onZoomRowColumns: function () {
		this._sendClientZoom();
		if (this.sheetGeometry) {
			this.sheetGeometry.setTileGeometryData(this._tileWidthTwips, this._tileHeightTwips,
				this._tileSize);
		}
		this._restrictDocumentSize();
		this.setSplitPosFromCell();
		this._map.fire('zoomchanged');
		this.refreshViewData();
		this._replayPrintTwipsMsgs();
		app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');
	},

	_restrictDocumentSize: function () {

		if (!this.sheetGeometry) {
			return;
		}

		var maxDocSize = this.sheetGeometry.getSize('tiletwips');
		var newDocWidth = Math.min(maxDocSize.x, this._docWidthTwips);
		var newDocHeight = Math.min(maxDocSize.y, this._docHeightTwips);

		var shouldRestrict = (newDocWidth !== this._docWidthTwips ||
				newDocHeight !== this._docHeightTwips);

		if (!shouldRestrict) {
			return;
		}

		// When there will be a latlng conversion, we should use CSS pixels.
		var newSizePx = this._twipsToPixels(new L.Point(newDocWidth, newDocHeight));

		var topLeft = this._map.unproject(new L.Point(0, 0));
		var bottomRight = this._map.unproject(newSizePx);
		this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));

		this._docPixelSize = newSizePx.clone();
		this._docWidthTwips = newDocWidth;
		this._docHeightTwips = newDocHeight;
		this._map.fire('scrolllimits', newSizePx.clone());
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

	_getSelectionHeaderData: function() {
		if (this._selections.empty())
			return { hasSelection: false };

		var bounds = this._selections.getBounds();
		console.assert(bounds.isValid(), 'Non empty selection should have valid bounds');
		return {
			hasSelection: true,
			start: this._corePixelsToTwips(bounds.min).add([1, 1]),
			end: this._corePixelsToTwips(bounds.max).subtract([1, 1]),
		};
	},

	_onStatusMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			var firstSelectedPart = (typeof this._selectedPart !== 'number');
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._parts = command.parts;
			this._selectedPart = command.selectedPart;
			if (this.sheetGeometry && this._selectedPart != this.sheetGeometry.getPart()) {
				// Core initiated sheet switch, need to get full sheetGeometry data for the selected sheet.
				this.requestSheetGeometryData();
			}
			this._viewId = parseInt(command.viewid);
			var mapSize = this._map.getSize();
			var sizePx = this._twipsToPixels(new L.Point(this._docWidthTwips, this._docHeightTwips));
			var width = sizePx.x;
			var height = sizePx.y;
			if (width < mapSize.x || height < mapSize.y) {
				width = Math.max(width, mapSize.x);
				height = Math.max(height, mapSize.y);
				var topLeft = this._map.unproject(new L.Point(0, 0));
				var bottomRight = this._map.unproject(new L.Point(width, height));
				this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
				this._docPixelSize = {x: width, y: height};
				this._map.fire('scrolllimits', {x: width, y: height});
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
			if (firstSelectedPart) {
				this._switchSplitPanesContext();
			}
		}
	},

	// This initiates a selective repainting of row/col headers and
	// gridlines based on the settings of coordinatesData.offset. This
	// should be called whenever the view area changes (scrolling, panning,
	// zooming, cursor moving out of view-area etc.).  Depending on the
	// active sheet geometry data-source, it may ask core to send current
	// view area's data or the global data on geometry changes.
	refreshViewData: function (coordinatesData, compatDataSrcOnly, sheetGeometryChanged) {

		if (this.options.sheetGeometryDataEnabled && compatDataSrcOnly) {
			return;
		}
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

		if (this.sheetGeometry) {
			this.sheetGeometry.setViewArea(pos, size);
			this._updateHeadersGridLines(undefined, updateCols, updateRows);
		}
	},

	// This send .uno:ViewRowColumnHeaders command to core with the new view coordinates (tile-twips).
	requestViewRowColumnData: function (pos, size) {

		var payload = 'commandvalues command=.uno:ViewRowColumnHeaders?x=' + Math.round(pos.x) + '&y=' + Math.round(pos.y) +
			'&width=' + Math.round(size.x) + '&height=' + Math.round(size.y);

		app.socket.sendMessage(payload);
	},

	// sends the .uno:SheetGeometryData command optionally with arguments.
	requestSheetGeometryData: function (flags) {
		if (!this.sheetGeometry) {
			// Suppress multiple requests at document load, till we get a response.
			if (this._sheetGeomFirstWait === true) {
				return;
			}
			this._sheetGeomFirstWait = true;
		}
		var unoCmd = '.uno:SheetGeometryData';
		var haveArgs = (typeof flags == 'object' &&
			(flags.columns === true || flags.rows === true || flags.all === true));
		var payload = 'commandvalues command=' + unoCmd;

		if (haveArgs) {
			var argList = [];
			var both = (flags.all === true);
			if (both || flags.columns === true) {
				argList.push('columns=1');
			}
			if (both || flags.rows === true) {
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

		app.socket.sendMessage(payload);
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
			converter: this._twipsToCorePixels,
			context: this
		});
	},

	_addRemoveGroupSections: function () {
		// If there are row and column groups at the same time, add CornerGroup section.
		if (this.sheetGeometry._rows._outlines._outlines.length > 0 && this.sheetGeometry._columns._outlines._outlines.length > 0) {
			if (!this._painter._sectionContainer.doesSectionExist(L.CSections.CornerGroup.name))
				this._painter._sectionContainer.addSection(L.control.cornerGroup());
		}
		else { // If not, remove CornerGroup section.
			this._painter._sectionContainer.removeSection(L.CSections.CornerGroup.name);
		}

		// If there are row groups, add RowGroup section.
		if (this.sheetGeometry._rows._outlines._outlines.length > 0) {
			if (!this._painter._sectionContainer.doesSectionExist(L.CSections.RowGroup.name))
				this._painter._sectionContainer.addSection(L.control.rowGroup());
		}
		else { // If not, remove RowGroup section.
			this._painter._sectionContainer.removeSection(L.CSections.RowGroup.name);
		}

		// If there are column groups, add ColumnGroup section.
		if (this.sheetGeometry._columns._outlines._outlines.length > 0) {
			if (!this._painter._sectionContainer.doesSectionExist(L.CSections.ColumnGroup.name)) {
				this._painter._sectionContainer.addSection(L.control.columnGroup());
				this._painter._sectionContainer.canvas.style.border = '1px solid darkgrey';
			}
		}
		else { // If not, remove ColumnGroup section.
			this._painter._sectionContainer.removeSection(L.CSections.ColumnGroup.name);
			this._painter._sectionContainer.canvas.style.border = '0px solid darkgrey';
		}
	},

	_handleSheetGeometryDataMsg: function (jsonMsgObj) {
		if (!this.sheetGeometry) {
			this._sheetGeomFirstWait = false;
			this.sheetGeometry = new L.SheetGeometry(jsonMsgObj,
				this._tileWidthTwips, this._tileHeightTwips,
				this._tileSize, this._selectedPart);

			this._painter._sectionContainer.addSection(L.control.cornerHeader());
			this._painter._sectionContainer.addSection(L.control.rowHeader());
			this._painter._sectionContainer.addSection(L.control.columnHeader());
		}
		else {
			this.sheetGeometry.update(jsonMsgObj, /* checkCompleteness */ false, this._selectedPart);
		}

		this._replayPrintTwipsMsgs();

		this.sheetGeometry.setViewArea(this._pixelsToTwips(this._map._getTopLeftPoint()),
			this._pixelsToTwips(this._map.getSize()));

		this._addRemoveGroupSections();

		this._updateHeadersGridLines(undefined, true /* updateCols */,
			true /* updateRows */);

		this.dontSendSplitPosToCore = true;
		this.setSplitPosFromCell();
		this.dontSendSplitPosToCore = false;

		this._syncTileContainerSize();

		this._map.fire('sheetgeometrychanged');
	},

	// Calculates the split position in (core-pixels) from the split-cell.
	setSplitPosFromCell: function (forceSplittersUpdate) {
		if (!this.sheetGeometry || !this._splitPanesContext) {
			return;
		}

		this._splitPanesContext.setSplitPosFromCell(forceSplittersUpdate);
	},

	// Calculates the split-cell from the split position in (core-pixels).
	setSplitCellFromPos: function () {

		if (!this.sheetGeometry || !this._splitPanesContext) {
			return;
		}

		this._splitPanesContext.setSplitCellFromPos();
	},

	_switchSplitPanesContext: function () {

		if (!this.hasSplitPanesSupport()) {
			return;
		}

		if (!this._splitPaneCache) {
			this._splitPaneCache = {};
		}

		console.assert(typeof this._selectedPart === 'number', 'invalid selectedPart');

		var spContext = this._splitPaneCache[this._selectedPart];
		if (!spContext) {
			spContext = new L.CalcSplitPanesContext(this);
			this._splitPaneCache[this._selectedPart] = spContext;
		}

		this._splitPanesContext = spContext;
		if (this.sheetGeometry) {
			// Force update of the splitter lines.
			this.setSplitPosFromCell(true);
		}
	},

	_onRowColSelCount: function (state) {
		if (state.trim() !== '') {
			var rowCount = parseInt(state.split(', ')[0].trim().split(' ')[0].replace(',', '').replace(',', ''));
			var columnCount = parseInt(state.split(', ')[1].trim().split(' ')[0].replace(',', '').replace(',', ''));
			if (rowCount > 1000000)
				this._map.wholeColumnSelected = true;
			else
				this._map.wholeColumnSelected = false;

			if (columnCount === 1024)
				this._map.wholeRowSelected = true;
			else
				this._map.wholeRowSelected = false;
		}
		else {
			this._map.wholeColumnSelected = false;
			this._map.wholeRowSelected = false;
		}
	},

	_onCommandStateChanged: function (e) {

		if (e.commandName === '.uno:FreezePanesColumn') {
			this._onSplitStateChanged(e, true /* isSplitCol */);
		}
		else if (e.commandName === '.uno:FreezePanesRow') {
			this._onSplitStateChanged(e, false /* isSplitCol */);
		}
		else if (e.commandName === '.uno:RowColSelCount') {
			// We also call the function when state is empty, because row/column variables should be set.
			if (e.state.trim() === '' || e.state.startsWith('Selected'))
				this._onRowColSelCount(e.state.replace('Selected:', '').replace('row', '').replace('column', '').replace('s', ''));
		}
		else if (e.commandName === '.uno:InsertMode') {
			/* If we get textselection message from core:
				When insertMode is active:  User is selecting some text.
				When insertMode is passive: User is selecting cells.
			*/
			this.insertMode = e.state.trim() === '' ? false: true;
		}
	},

	_onSplitStateChanged: function (e, isSplitCol) {
		if (!this._splitPanesContext) {
			return;
		}

		if (!this._splitCellState) {
			this._splitCellState = new L.Point(-1, -1);
		}

		if (!e.state || e.state.length === 0) {
			console.warn('Empty argument for ' + e.commandName);
			return;
		}

		var newSplitIndex = Math.floor(parseInt(e.state));
		console.assert(!isNaN(newSplitIndex) && newSplitIndex >= 0, 'invalid argument for ' + e.commandName);

		// This stores the current split-cell state of core, so this should not be modified.
		this._splitCellState[isSplitCol ? 'x' : 'y'] = newSplitIndex;

		if (!this.options.syncSplits) {
			return;
		}

		var changed = isSplitCol ? this._splitPanesContext.setSplitCol(newSplitIndex) :
			this._splitPanesContext.setSplitRow(newSplitIndex);

		if (changed) {
			this.setSplitPosFromCell();
		}
	},

	sendSplitIndex: function (newSplitIndex, isSplitCol) {

		if (!this._map.isPermissionEdit() || !this._splitCellState || !this.options.syncSplits) {
			return false;
		}

		var splitColState = this._splitCellState.x;
		var splitRowState = this._splitCellState.y;
		if (splitColState === -1 || splitRowState === -1) {
			// Did not get the 'first' FreezePanesColumn/FreezePanesRow messages from core yet.
			return false;
		}

		var currentState = isSplitCol ? splitColState : splitRowState;
		if (currentState === newSplitIndex) {
			return false;
		}

		var unoName = isSplitCol ? 'FreezePanesColumn' : 'FreezePanesRow';
		var command = {};
		command[unoName] = {
			type: 'int32',
			value: newSplitIndex
		};

		this._map.sendUnoCommand('.uno:' + unoName, command);
		return true;
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
				if (comment.author in this._map._viewInfoByUserName) {
					comment.avatar = this._map._viewInfoByUserName[comment.author].userextrainfo.avatar;
				}
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
				if (this._annotations && this._annotations[comment.tab])
				{
					var annotation = this._annotations[comment.tab][comment.id];
					if (annotation) {
						annotation.setLatLngBounds(comment.cellPos);
						if (annotation.mark) {
							annotation.mark.setLatLng(comment.cellPos.getNorthEast());
						}
					}
				}
			}
			this.showAnnotations();
		} else {
			L.CanvasTileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_refreshRowColumnHeaders: function () {
		if (app.sectionContainer.doesSectionExist(L.CSections.RowHeader.name))
			app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
		if (app.sectionContainer.doesSectionExist(L.CSections.ColumnHeader.name))
			app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
	},

	_onTextSelectionMsg: function (textMsg) {
		L.CanvasTileLayer.prototype._onTextSelectionMsg.call(this, textMsg);
		// If this is a cellSelection message, user shouldn't be editing a cell. Below check is for ensuring that.
		if (this.insertMode === false && this._cellCursorXY && this._cellCursorXY.x !== -1) {
			// When insertMode is false, this is a cell selection message.
			textMsg = textMsg.replace('textselection:', '');
			if (textMsg.trim() !== 'EMPTY') {
				this._cellSelections = textMsg.split(';');
				var ratio = this._tileSize / this._tileWidthTwips;
				this._cellSelections = this._cellSelections.map(function(element) {
					element = element.split(',');
					return L.LOUtil.createRectangle(parseInt(element[0]) * ratio, parseInt(element[1]) * ratio, parseInt(element[2]) * ratio, parseInt(element[3]) * ratio);
				});
			}
			else {
				this._cellSelections = Array(0);
			}
			this._refreshRowColumnHeaders();
		}
	},

	_onCellCursorMsg: function (textMsg) {
		L.CanvasTileLayer.prototype._onCellCursorMsg.call(this, textMsg);
		this._refreshRowColumnHeaders();
	},

	_getEditCursorRectangle: function (msgObj) {

		if (!this.options.printTwipsMsgsEnabled || !this.sheetGeometry ||
			!Object.prototype.hasOwnProperty.call(msgObj, 'relrect') || !Object.prototype.hasOwnProperty.call(msgObj, 'refpoint')) {
			// 1) non-print-twips messaging mode OR
			// 2) the edit-cursor belongs to draw/chart objects.
			return L.CanvasTileLayer.prototype._getEditCursorRectangle.call(this, msgObj);
		}

		if (typeof msgObj !== 'object') {
			console.error('invalid edit cursor message');
			return undefined;
		}

		var relrect = L.Bounds.parse(msgObj.relrect);
		var refpoint = L.Point.parse(msgObj.refpoint);
		refpoint = this.sheetGeometry.getTileTwipsPointFromPrint(refpoint);
		return relrect.add(refpoint);
	},

	_getTextSelectionRectangles: function (textMsg) {

		if (!this.options.printTwipsMsgsEnabled || !this.sheetGeometry) {
			return L.CanvasTileLayer.prototype._getTextSelectionRectangles.call(this, textMsg);
		}

		if (typeof textMsg !== 'string') {
			console.error('invalid text selection message');
			return [];
		}

		var refpointDelim = '::';
		var delimIndex = textMsg.indexOf(refpointDelim);
		if (delimIndex === -1) {
			// No refpoint information available, treat it as cell-range selection rectangle.
			var rangeRectArray = L.Bounds.parseArray(textMsg);
			rangeRectArray = rangeRectArray.map(function (rect) {
				return this._convertToTileTwipsSheetArea(rect);
			}, this);
			return rangeRectArray;
		}

		var refpoint = L.Point.parse(textMsg.substring(delimIndex + refpointDelim.length));
		refpoint = this.sheetGeometry.getTileTwipsPointFromPrint(refpoint);

		var rectArray = L.Bounds.parseArray(textMsg.substring(0, delimIndex));
		rectArray.forEach(function (rect) {
			rect._add(refpoint); // compute absolute coordinates and update in-place.
		});

		return rectArray;
	},

	getSnapDocPosX: function (docPosX, unit) {
		if (!this.options.sheetGeometryDataEnabled) {
			return docPosX;
		}

		unit = unit || 'corepixels';

		return this.sheetGeometry.getSnapDocPosX(docPosX, unit);
	},

	getSnapDocPosY: function (docPosY, unit) {
		if (!this.options.sheetGeometryDataEnabled) {
			return docPosY;
		}

		unit = unit || 'corepixels';

		return this.sheetGeometry.getSnapDocPosY(docPosY, unit);
	},

	getSplitPanesContext: function () {
		if (!this.hasSplitPanesSupport()) {
			return undefined;
		}

		return this._splitPanesContext;
	},

	getMaxDocSize: function () {

		if (this.sheetGeometry) {
			return this.sheetGeometry.getSize('corepixels');
		}

		return this._twipsToPixels(new L.Point(this._docWidthTwips, this._docHeightTwips));
	},

	getCursorPos: function () {
		return this._twipsToPixels(this._cellCursorTwips.getTopLeft());
	},

	_calculateScrollForNewCellCursor: function () {

		var scroll = new L.LatLng(0, 0);

		if (!this._cellCursor || this._isEmptyRectangle(this._cellCursor)) {
			return scroll;
		}

		var map = this._map;
		var paneRectsInLatLng = this.getPaneLatLngRectangles();

		if (this._cellCursor.isInAny(paneRectsInLatLng)) {
			return scroll; // no scroll needed.
		}

		var freePaneBounds = paneRectsInLatLng[paneRectsInLatLng.length - 1];
		var splitPoint = map.unproject(this._splitPanesContext ? this._splitPanesContext.getSplitPos() : new L.Point(0, 0));

		if (this._cellCursor.getEast() > splitPoint.lng) {

			var freePaneWidth = Math.abs(freePaneBounds.getEast() - freePaneBounds.getWest());
			var cursorWidth = Math.abs(this._cellCursor.getEast() - this._cellCursor.getWest());
			var spacingX = cursorWidth / 4.0;

			if (this._cellCursor.getWest() < freePaneBounds.getWest()) {
				scroll.lng = this._cellCursor.getWest() - freePaneBounds.getWest() - spacingX;
			}
			else if (cursorWidth < freePaneWidth && this._cellCursor.getEast() > freePaneBounds.getEast()) {
				scroll.lng = this._cellCursor.getEast() - freePaneBounds.getEast() + spacingX;
			}
		}

		if (this._cellCursor.getSouth() < splitPoint.lat) {

			var spacingY = Math.abs((this._cellCursor.getSouth() - this._cellCursor.getNorth())) / 4.0;
			if (this._cellCursor.getNorth() > freePaneBounds.getNorth()) {
				scroll.lat = this._cellCursor.getNorth() - freePaneBounds.getNorth() + spacingY;
			}
			else if (this._cellCursor.getSouth() < freePaneBounds.getSouth()) {
				scroll.lat = this._cellCursor.getSouth() - freePaneBounds.getSouth() - spacingY;
			}
		}

		return scroll;
	},

	getSelectedPart: function () {
		return this._selectedPart;
	},

	_createCommentStructure: function (menuStructure) {
		var rootComment;
		var annotations = this._annotations[this._selectedPart];

		for (var i in annotations) {
			rootComment = {
				id: 'comment' + annotations[i]._annotation._data.id,
				enable: true,
				data: annotations[i]._annotation._data,
				type: 'rootcomment',
				text: annotations[i]._annotation._data.text,
				annotation: annotations[i]._annotation,
				children: []
			};
			rootComment.annotation.leafletId = annotations[i]._leaflet_id;	// required to highlight the selected cell
			menuStructure['children'].push(rootComment);
		}
	},

	_addHighlightSelectedWizardComment: function(annotation) {
		if (this.lastWizardCommentHighlight) {
			this.lastWizardCommentHighlight.removeClass('calc-comment-highlight');
		}
		this.lastWizardCommentHighlight = $(this._map._layers[annotation.leafletId]._container);
		this.lastWizardCommentHighlight.addClass('calc-comment-highlight');
	},

	_removeHighlightSelectedWizardComment: function() {
		if (this.lastWizardCommentHighlight)
			this.lastWizardCommentHighlight.removeClass('calc-comment-highlight');
	}

});

L.CalcSplitPanesContext = L.SplitPanesContext.extend({

	_setDefaults: function () {
		this._part = this._docLayer.getSelectedPart();
		this._splitPos = new L.Point(0, 0);
		this._splitCell = new L.Point(0, 0);
	},

	setSplitCol: function (splitCol) {
		console.assert(typeof splitCol === 'number', 'invalid argument type');
		return this._splitCell.setX(splitCol);
	},

	setSplitRow: function (splitRow) {
		console.assert(typeof splitRow === 'number', 'invalid argument type');
		return this._splitCell.setY(splitRow);
	},

	// Calculates the split position in (core-pixels) from the split-cell.
	setSplitPosFromCell: function (forceSplittersUpdate) {
		var newSplitPos = this._docLayer.sheetGeometry.getCellRect(this._splitCell.x, this._splitCell.y).min;

		// setSplitPos limits the split position based on the screen size and it fires 'splitposchanged' (if there is any change).
		// setSplitCellFromPos gets invoked on 'splitposchanged' to sync the split-cell with the position change if any.
		this.setSplitPos(newSplitPos.x, newSplitPos.y, forceSplittersUpdate);

		// It is possible that the split-position did not change due to screen size limits, so no 'splitposchanged' but
		// we still need to sync the split-cell.
		this.setSplitCellFromPos();
	},

	// Calculates the split-cell from the split position in (core-pixels).
	setSplitCellFromPos: function () {

		// This should not call setSplitPosFromCell() directly/indirectly.

		var newSplitCell = this._docLayer.sheetGeometry.getCellFromPos(this._splitPos, 'corepixels');

		// Send new state via uno commands if there is any change.
		if (!this._docLayer.dontSendSplitPosToCore) {
			this.setSplitCol(newSplitCell.x) && this._docLayer.sendSplitIndex(newSplitCell.x, true /*  isSplitCol */);
			this.setSplitRow(newSplitCell.y) && this._docLayer.sendSplitIndex(newSplitCell.y, false /* isSplitCol */);
		}
	},
});

// TODO: Move these somewhere more appropriate.

// Sheet geometry data
L.SheetGeometry = L.Class.extend({

	// sheetGeomJSON is expected to be the parsed JSON message from core
	// in response to client command '.uno:SheetGeometryData' with
	// all flags (ie 'columns', 'rows', 'sizes', 'hidden', 'filtered',
	// 'groups') enabled.
	initialize: function (sheetGeomJSON, tileWidthTwips, tileHeightTwips,
		tileSizePixels, part) {

		if (typeof sheetGeomJSON !== 'object' ||
			typeof tileWidthTwips !== 'number' ||
			typeof tileHeightTwips !== 'number' ||
			typeof tileSizePixels !== 'number' ||
			typeof part !== 'number') {
			console.error('Incorrect constructor argument types or missing required arguments');
			return;
		}

		this._part = -1;
		this._columns = new L.SheetDimension();
		this._rows = new L.SheetDimension();
		this._unoCommand = '.uno:SheetGeometryData';

		// Set various unit conversion info early on because on update() call below, these info are needed.
		this.setTileGeometryData(tileWidthTwips, tileHeightTwips, tileSizePixels,
			false /* update position info ?*/);

		this.update(sheetGeomJSON, /* checkCompleteness */ true, part);
	},

	update: function (sheetGeomJSON, checkCompleteness, part) {

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

		if (updateOK) {
			console.assert(typeof part === 'number', 'part must be a number');
			if (part !== this._part) {
				this._part = part;
			}
		}

		this._columns.setMaxIndex(+sheetGeomJSON.maxtiledcolumn);
		this._rows.setMaxIndex(+sheetGeomJSON.maxtiledrow);

		return updateOK;
	},

	setTileGeometryData: function (tileWidthTwips, tileHeightTwips, tileSizePixels,
		updatePositions) {
		this._columns.setTileGeometryData(tileWidthTwips, tileSizePixels, updatePositions);
		this._rows.setTileGeometryData(tileHeightTwips, tileSizePixels, updatePositions);
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

	getPart: function () {
		return this._part;
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
	// rowIndex should be zero based.
	// 'startpos' (start position of the row in core pixels), 'size' (row size in core pixels).
	// Note: All these fields are computed by assuming zero sizes for hidden/filtered rows.
	getRowData: function (rowIndex) {
		return this._rows.getElementData(rowIndex);
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

	// accepts a point in display twips coordinates at current zoom
	// and returns the equivalent point in display-twips at the given zoom.
	getTileTwipsAtZoom: function (point, zoomScale) { // (L.Point) -> L.Point
		if (!(point instanceof L.Point)) {
			console.error('Bad argument type, expected L.Point');
			return point;
		}

		return new L.Point(this._columns.getTileTwipsAtZoom(point.x, zoomScale),
			this._rows.getTileTwipsAtZoom(point.y, zoomScale));
	},

	// accepts a point in print twips coordinates and returns the equivalent point
	// in tile-twips.
	getTileTwipsPointFromPrint: function (point) { // (L.Point) -> L.Point
		if (!(point instanceof L.Point)) {
			console.error('Bad argument type, expected L.Point');
			return point;
		}

		return new L.Point(this._columns.getTileTwipsPosFromPrint(point.x),
			this._rows.getTileTwipsPosFromPrint(point.y));
	},

	// accepts a point in tile-twips coordinates and returns the equivalent point
	// in print-twips.
	getPrintTwipsPointFromTile: function (point) { // (L.Point) -> L.Point
		if (!(point instanceof L.Point)) {
			console.error('Bad argument type, expected L.Point');
			return point;
		}

		return new L.Point(this._columns.getPrintTwipsPosFromTile(point.x),
			this._rows.getPrintTwipsPosFromTile(point.y));
	},

	// accepts a rectangle in print twips coordinates and returns the equivalent rectangle
	// in tile-twips aligned to the cells.
	getTileTwipsSheetAreaFromPrint: function (rectangle) { // (L.Bounds) -> L.Bounds
		if (!(rectangle instanceof L.Bounds)) {
			console.error('Bad argument type, expected L.Bounds');
			return rectangle;
		}

		var topLeft = rectangle.getTopLeft();
		var bottomRight = rectangle.getBottomRight();

		var horizBounds = this._columns.getTileTwipsRangeFromPrint(topLeft.x, bottomRight.x);
		var vertBounds = this._rows.getTileTwipsRangeFromPrint(topLeft.y, bottomRight.y);

		topLeft = new L.Point(horizBounds.startpos, vertBounds.startpos);
		bottomRight = new L.Point(horizBounds.endpos, vertBounds.endpos);

		return new L.Bounds(topLeft, bottomRight);
	},

	// Returns full sheet size as L.Point in the given unit.
	// unit must be one of 'corepixels', 'tiletwips', 'printtwips'
	getSize: function (unit) {
		return new L.Point(this._columns.getSize(unit),
			this._rows.getSize(unit));
	},

	// Returns the core pixel position/size of the requested cell at a specified zoom.
	getCellRect: function (columnIndex, rowIndex, zoomScale) {
		var horizPosSize = this._columns.getElementData(columnIndex, zoomScale);
		var vertPosSize  = this._rows.getElementData(rowIndex, zoomScale);

		var topLeft = new L.Point(horizPosSize.startpos, vertPosSize.startpos);
		var size = new L.Point(horizPosSize.size, vertPosSize.size);

		return new L.Bounds(topLeft, topLeft.add(size));
	},

	getCellFromPos: function (pos, unit) {
		console.assert(pos instanceof L.Point);
		return new L.Point(
			this._columns.getIndexFromPos(pos.x, unit),
			this._rows.getIndexFromPos(pos.y, unit)
		);
	},

	// Returns the start position of the column containing posX in the specified unit.
	// unit must be one of 'corepixels', 'tiletwips', 'printtwips'
	getSnapDocPosX: function (posX, unit) {
		return this._columns.getSnapPos(posX, unit);
	},

	// Returns the start position of the row containing posY in the specified unit.
	// unit must be one of 'corepixels', 'tiletwips', 'printtwips'
	getSnapDocPosY: function (posY, unit) {
		return this._rows.getSnapPos(posY, unit);
	},

	_testValidity: function (sheetGeomJSON, checkCompleteness) {

		if (!Object.prototype.hasOwnProperty.call(sheetGeomJSON, 'commandName')) {
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

			if (!Object.prototype.hasOwnProperty.call(sheetGeomJSON, 'rows') ||
				!Object.prototype.hasOwnProperty.call(sheetGeomJSON, 'columns')) {

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
		if (Object.prototype.hasOwnProperty.call(jsonObject, 'sizes')) {
			loadsOK = this._sizes.load(jsonObject.sizes);
			regenerateVisibleSizes = true;
		}

		if (Object.prototype.hasOwnProperty.call(jsonObject, 'hidden')) {
			var thisLoadOK = this._hidden.load(jsonObject.hidden);
			loadsOK = loadsOK && thisLoadOK;
			regenerateVisibleSizes = true;
		}

		if (Object.prototype.hasOwnProperty.call(jsonObject, 'filtered')) {
			thisLoadOK = this._filtered.load(jsonObject.filtered);
			loadsOK = loadsOK && thisLoadOK;
			regenerateVisibleSizes = true;
		}

		if (Object.prototype.hasOwnProperty.call(jsonObject, 'groups')) {
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

	setTileGeometryData: function (tileSizeTwips, tileSizePixels, updatePositions) {

		if (updatePositions === undefined) {
			updatePositions = true;
		}

		// Avoid position re-computations if no change in Zoom/dpiScale.
		if (this._tileSizeTwips === tileSizeTwips &&
			this._tileSizePixels === tileSizePixels) {
			return;
		}

		this._tileSizeTwips = tileSizeTwips;
		this._tileSizePixels = tileSizePixels;

		// number of core-pixels in the tile is the same as the number of device pixels used to render the tile.
		this._coreZoomFactor = this._tileSizePixels * 15.0 / this._tileSizeTwips;
		this._twipsPerCorePixel = this._tileSizeTwips / this._tileSizePixels;

		if (updatePositions) {
			// We need to compute positions data for every zoom change.
			this._updatePositions();
		}
	},

	_updateVisible: function () {

		var invisibleSpanList = this._hidden.union(this._filtered); // this._hidden is not modified.
		this._visibleSizes = this._sizes.applyZeroValues(invisibleSpanList); // this._sizes is not modified.
		this._updatePositions();
		this._addGeneralVariables();
	},

	_addGeneralVariables: function() {
		for (var i = 0; i < this._visibleSizes._spanlist.length; i++) {
			this._visibleSizes._spanlist[i].start = i > 0 ? this._visibleSizes._spanlist[i - 1].index + 1: 0;
			this._visibleSizes._spanlist[i].end = this._visibleSizes._spanlist[i].index; // Todo: Remove data duplication by renaming "index & value" to "end & size" or vice versa.
			this._visibleSizes._spanlist[i].size = this._visibleSizes._spanlist[i].value;
		}
	},

	_updatePositions: function() {

		var posCorePx = 0; // position in core pixels.
		var posPrintTwips = 0;
		var dimensionObj = this;
		this._visibleSizes.addCustomDataForEachSpan(function (
			index,
			size, /* size in twips of one element in the span */
			spanLength /* #elements in the span */) {

			// Important: rounding needs to be done in core pixels to match core.
			var sizeCorePxOne = Math.floor(size / dimensionObj._twipsPerCorePixel);
			posCorePx += (sizeCorePxOne * spanLength);
			// position in core-pixel aligned twips.
			var posTileTwips = Math.floor(posCorePx * dimensionObj._twipsPerCorePixel);
			posPrintTwips += (size * spanLength);

			var customData = {
				sizecore: sizeCorePxOne,
				poscorepx: posCorePx,
				postiletwips: posTileTwips,
				posprinttwips: posPrintTwips
			};

			return customData;
		});
	},

	// returns the element pos/size in core pixels by default.
	getElementData: function (index, zoomScale) {
		if (zoomScale !== undefined) {
			var startpos = 0;
			var size = 0;
			this._visibleSizes.forEachSpanInRange(0, index, function (spanData) {
				var count = spanData.end - spanData.start + 1;
				var sizeOneCorePx = Math.floor(spanData.size * zoomScale / 15.0);
				if (index > spanData.end) {
					startpos += (sizeOneCorePx * count);
				}
				else if (index >= spanData.start && index <= spanData.end) {
					// final span
					startpos += (sizeOneCorePx * (index - spanData.start));
					size = sizeOneCorePx;
				}
			});

			return {
				startpos: startpos,
				size: size
			};
		}

		var span = this._visibleSizes.getSpanDataByIndex(index);
		if (span === undefined) {
			return undefined;
		}

		return this._getElementDataFromSpanByIndex(index, span);
	},

	getElementDataAny: function (index, unitName) {
		var span = this._visibleSizes.getSpanDataByIndex(index);
		if (span === undefined) {
			return undefined;
		}

		return this._getElementDataAnyFromSpanByIndex(index, span, unitName);
	},

	// returns element pos/size in core pixels by default.
	_getElementDataFromSpanByIndex: function (index, span) {
		return this._getElementDataAnyFromSpanByIndex(index, span, 'corepixels');
	},

	// returns element pos/size in the requested unit.
	_getElementDataAnyFromSpanByIndex: function (index, span, unitName) {

		if (span === undefined || index < span.start || span.end < index) {
			return undefined;
		}

		if (unitName !== 'corepixels' &&
				unitName !== 'tiletwips' && unitName !== 'printtwips') {
			console.error('unsupported unitName: ' + unitName);
			return undefined;
		}

		var numSizes = span.end - index + 1;
		var inPixels = unitName === 'corepixels';
		if (inPixels) {
			return {
				startpos: (span.data.poscorepx - span.data.sizecore * numSizes),
				size: span.data.sizecore
			};
		}

		if (unitName === 'printtwips') {
			return {
				startpos: (span.data.posprinttwips - span.size * numSizes),
				size: span.size
			};
		}

		// unitName is 'tiletwips'
		// It is very important to calculate this from core pixel units to mirror the core calculations.
		var twipsPerCorePixel = this._twipsPerCorePixel;
		return {
			startpos: Math.floor(
				(span.data.poscorepx - span.data.sizecore * numSizes) * twipsPerCorePixel),
			size: Math.floor(span.data.sizecore * twipsPerCorePixel)
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

	// callback with a position for each grid line in this pixel range
	forEachInCorePixelRange: function(startPix, endPix, callback) {
		this._visibleSizes.forEachSpan(function (spanData) {
			// do we overlap ?
			var spanFirstCorePx = spanData.data.poscorepx -
			    (spanData.data.sizecore * (spanData.end - spanData.start + 1));
			if (spanFirstCorePx < endPix && spanData.data.poscorepx > startPix)
			{
				var firstCorePx = Math.max(
					spanFirstCorePx,
					startPix + spanData.data.sizecore -
						((startPix - spanFirstCorePx) % spanData.data.sizecore));
				var lastCorePx = Math.min(endPix, spanData.data.poscorepx);

				for (var pos = firstCorePx; pos <= lastCorePx; pos += spanData.data.sizecore) {
					callback(pos);
				}
			}
		});
	},

	// computes element index from tile-twips position and returns
	// an object with this index and the span data.
	_getSpanAndIndexFromTileTwipsPos: function (pos) {
		var result = {};
		var span = this._visibleSizes.getSpanDataByCustomDataField(pos, 'postiletwips');
		result.span = span;
		if (span === undefined) {
			// enforce limits.
			result.index = (pos >= 0) ? this._maxIndex : 0;
			result.span = this._visibleSizes.getSpanDataByIndex(result.index);
			return result;
		}
		var elementCount = span.end - span.start + 1;
		var posStart = ((span.data.poscorepx - span.data.sizecore * elementCount) * this._twipsPerCorePixel);
		var posEnd = span.data.postiletwips;
		var sizeOne = (posEnd - posStart) / elementCount;

		// always round down as relativeIndex is zero-based.
		var relativeIndex = Math.floor((pos - posStart) / sizeOne);

		result.index = span.start + relativeIndex;
		return result;
	},

	// computes element index from tile-twips position.
	_getIndexFromTileTwipsPos: function (pos) {
		return this._getSpanAndIndexFromTileTwipsPos(pos).index;
	},

	// computes element index from print twips position and returns
	// an object with this index and the span data.
	_getSpanAndIndexFromPrintTwipsPos: function (pos) {
		var result = {};
		var span = this._visibleSizes.getSpanDataByCustomDataField(pos, 'posprinttwips');
		result.span = span;
		if (span === undefined) {
			// enforce limits.
			result.index = (pos >= 0) ? this._maxIndex : 0;
			result.span = this._visibleSizes.getSpanDataByIndex(result.index);
			return result;
		}
		var elementCount = span.end - span.start + 1;
		var posStart = (span.data.posprinttwips - span.size * elementCount);
		var sizeOne = span.size;

		// always round down as relativeIndex is zero-based.
		var relativeIndex = Math.floor((pos - posStart) / sizeOne);

		result.index = span.start + relativeIndex;
		return result;
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

				var startElementData = dimensionObj.getElementData(start);
				var endElementData = dimensionObj.getElementData(end);
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
	},

	// Accepts a position in display twips at current zoom and returns corresponding
	// display twips position at the given zoomScale.
	getTileTwipsAtZoom: function (posTT, zoomScale) {
		if (typeof posTT !== 'number' || typeof zoomScale !== 'number') {
			console.error('Wrong argument types');
			return;
		}

		var posPT = this.getPrintTwipsPosFromTile(posTT);
		return this.getTileTwipsPosFromPrint(posPT, zoomScale);
	},

	// Accepts a position in print twips and returns the corresponding position in tile twips.
	getTileTwipsPosFromPrint: function (posPT, zoomScale) {

		if (typeof posPT !== 'number') {
			console.error('Wrong argument type');
			return;
		}

		if (typeof zoomScale === 'number') {
			var posTT = 0;
			var posPTInc = 0;
			this._visibleSizes.forEachSpan(function (spanData) {
				var count = spanData.end - spanData.start + 1;
				var sizeSpanPT = spanData.size * count;
				var sizeOneCorePx = Math.floor(spanData.size * zoomScale / 15.0);
				var sizeSpanTT = Math.floor(sizeOneCorePx * count * 15 / zoomScale);

				if (posPTInc >= posPT) {
					return;
				}

				if (posPTInc + sizeSpanPT < posPT) {
					// add whole span.
					posPTInc += sizeSpanPT;
					posTT += sizeSpanTT;
					return;
				}

				// final span
				var remainingPT = posPT - posPTInc;
				var elemCountFinalSpan = Math.floor(remainingPT / spanData.size);
				var extra = remainingPT - (elemCountFinalSpan * spanData.size);
				posTT += (Math.floor(elemCountFinalSpan * sizeSpanTT / count) + extra);
				posPTInc = posPT;
			});

			return posTT;
		}

		var element = this._getSpanAndIndexFromPrintTwipsPos(posPT);
		var elementDataTT = this._getElementDataAnyFromSpanByIndex(element.index, element.span, 'tiletwips');
		var elementDataPT = this._getElementDataAnyFromSpanByIndex(element.index, element.span, 'printtwips');

		var offset = posPT - elementDataPT.startpos;
		console.assert(offset >= 0, 'offset should not be negative');

		// Preserve any offset from the matching column/row start position.
		return elementDataTT.startpos + offset;
	},

	// Accepts a position in tile twips and returns the corresponding position in print twips.
	getPrintTwipsPosFromTile: function (posTT) {

		if (typeof posTT !== 'number') {
			console.error('Wrong argument type');
			return;
		}

		var element = this._getSpanAndIndexFromTileTwipsPos(posTT);
		var elementDataTT = this._getElementDataAnyFromSpanByIndex(element.index, element.span, 'tiletwips');
		var elementDataPT = this._getElementDataAnyFromSpanByIndex(element.index, element.span, 'printtwips');

		var offset = posTT - elementDataTT.startpos;
		console.assert(offset >= 0, 'offset should not be negative');

		// Preserve any offset from the matching column/row start position.
		return elementDataPT.startpos + offset;
	},

	// Accepts a start and end positions in print twips, and returns the
	// corresponding positions in tile twips, by first computing the element range.
	getTileTwipsRangeFromPrint: function (posStartPT, posEndPT) {
		var startElement = this._getSpanAndIndexFromPrintTwipsPos(posStartPT);
		var startData = this._getElementDataAnyFromSpanByIndex(startElement.index, startElement.span, 'tiletwips');
		if (posStartPT === posEndPT) {
			// range is hidden, send a minimal sized tile-twips range.
			// Set the size = twips equivalent of 1 core pixel,
			// to imitate what core does when it sends cursor/ranges in tile-twips coordinates.
			var rangeSize = Math.floor(this._twipsPerCorePixel);
			return {
				startpos: startData.startpos,
				endpos: startData.startpos + rangeSize
			};
		}
		var endElement = this._getSpanAndIndexFromPrintTwipsPos(posEndPT);
		var endData = this._getElementDataAnyFromSpanByIndex(endElement.index, endElement.span, 'tiletwips');

		var startPos = startData.startpos;
		var endPos = endData.startpos + endData.size;
		if (endPos < startPos) {
			endPos = startPos;
		}

		return {
			startpos: startPos,
			endpos: endPos
		};
	},

	getSize: function (unit) {
		var posSize = this.getElementDataAny(this._maxIndex, unit);
		if (!posSize) {
			return undefined;
		}

		return posSize.startpos + posSize.size;
	},

	isUnitSupported: function (unitName) {
		return (
			unitName === 'corepixels' ||
			unitName === 'tiletwips' ||
			unitName === 'printtwips'
		);
	},

	getSnapPos: function (pos, unit) {
		console.assert(typeof pos === 'number', 'pos is not a number');
		console.assert(this.isUnitSupported(unit), 'unit: ' + unit + ' is not supported');

		var origUnit = unit;

		if (unit === 'corepixels') {
			pos = pos * this._twipsPerCorePixel;
			unit = 'tiletwips';
		}

		console.assert(unit === 'tiletwips' || unit === 'printtwips', 'wrong unit assumption');
		var result = (unit === 'tiletwips') ?
			this._getSpanAndIndexFromTileTwipsPos(pos) :
			this._getSpanAndIndexFromPrintTwipsPos(pos);

		return this._getElementDataAnyFromSpanByIndex(result.index, result.span, origUnit).startpos;
	},

	getIndexFromPos: function (pos, unit) {
		console.assert(typeof pos === 'number', 'pos is not a number');
		console.assert(this.isUnitSupported(unit), 'unit: ' + unit + ' is not supported');

		if (unit === 'corepixels') {
			pos = pos * this._twipsPerCorePixel;
			unit = 'tiletwips';
		}

		console.assert(unit === 'tiletwips' || unit === 'printtwips', 'wrong unit assumption');
		var result = (unit === 'tiletwips') ?
			this._getSpanAndIndexFromTileTwipsPos(pos) :
			this._getSpanAndIndexFromPrintTwipsPos(pos);

		return result.index;
	},

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

		if (typeof getCustomDataCallback != 'function') {
			return;
		}

		var prevIndex = -1;
		this._spanlist.forEach(function (span) {
			span.data = getCustomDataCallback(
				span.index, span.value,
				span.index - prevIndex);
			prevIndex = span.index;
		});
	},

	getSpanDataByIndex: function (index) {

		if (typeof index != 'number') {
			return undefined;
		}

		var spanid = this._searchByIndex(index);
		if (spanid == -1) {
			return undefined;
		}

		return this._getSpanData(spanid);
	},

	getSpanDataByCustomDataField: function (value, fieldName) {

		if (typeof value != 'number' || typeof fieldName != 'string' || !fieldName) {
			return undefined;
		}

		var spanid = this._searchByCustomDataField(value, fieldName);
		if (spanid == -1) {
			return undefined;
		}

		return this._getSpanData(spanid);
	},

	forEachSpanInRange: function (start, end, callback) {

		if (typeof start != 'number' || typeof end != 'number' ||
			typeof callback != 'function' || start > end) {
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

	forEachSpan: function(callback) {
		for (var id = 0; id < this._spanlist.length; ++id) {
			callback(this._getSpanData(id));
		}
	},

	_getSpanData: function (spanid) {
		// TODO: Check if data is changed by the callers. If not, return the pointer instead.
		var clone = {};
		var span = this._spanlist[spanid];
		Object.keys(span).forEach(function (key) {
			clone[key] = span[key];
		});
		return clone;
	},

	_searchByIndex: function (index) {

		return binarySearch(this._spanlist, index,
			function directionProvider(testIndex, prevSpan, curSpan) {
				var spanStart = prevSpan ?
					prevSpan.index + 1 : 0;
				var spanEnd = curSpan.index;
				return (testIndex < spanStart) ? -1 :
					(spanEnd < testIndex) ? 1 : 0;
			});
	},

	_searchByCustomDataField: function (value, fieldName) {

		// All custom searchable data values are assumed to start
		// from 0 at the start of first span and are in non-decreasing order.

		return binarySearch(this._spanlist, value,
			function directionProvider(testValue, prevSpan, curSpan, nextSpan) {
				var valueStart = prevSpan ?
					prevSpan.data[fieldName] : 0;
				var valueEnd = curSpan.data[fieldName] - (nextSpan ? 1 : 0);
				if (valueStart === undefined || valueEnd === undefined) {
					// fieldName not present in the 'data' property.
					return -1;
				}
				return (testValue < valueStart) ? -1 :
					(valueEnd < testValue) ? 1 : 0;
			}, true /* find the first match in case of duplicates */);
		// About the last argument: duplicates can happen, for instance if the
		// custom field represents positions, and there are spans with zero sizes (hidden/filtered).
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
			this._outlines = [];
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

		if (typeof start != 'number' || typeof end != 'number' || typeof callback != 'function') {
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
// 'firstMatch' if true, some additional work is done to ensure that the index of
// the first match (from the 0 index of the array) is returned in case there are
// duplicates.
//
// directionProvider will be provided the following parameters :
// (key, previousArrayElement, currentArrayElement, nextArrayElement)
// previousArrayElement and nextArrayElement can be undefined when
// currentArrayElement is the first or the last element of the array
// respectively. This function should return:
//   0: for a match(to stop search),
//   1: to try searching upper half,
//  -1: to try searching lower half

function binarySearch(array, key, directionProvider, firstMatch) {

	if (!Array.isArray(array) || !array.length) {
		return -1;
	}

	if (typeof directionProvider != 'function') {
		directionProvider = function (key, prevvalue, testvalue) {
			return (key === testvalue) ? 0 :
				(key < testvalue) ? -1 : 1;
		};
	}

	firstMatch = (firstMatch === true);

	var start = 0;
	var end = array.length - 1;

	// Bound checks and early exit.
	var startDir = directionProvider(key, undefined, array[0], array[1]);
	if (startDir <= 0) {
		return startDir;
	}

	var endDir = directionProvider(key, array[end - 1], array[end]);
	if (endDir >= 0) {

		if (endDir === 1) {
			return -1;
		}

		return firstMatch ? _findFirstMatch(array, key, directionProvider, end) : end;
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

	return (start > end) ? -1 :
		firstMatch ? _findFirstMatch(array, key, directionProvider, mid) : mid;
}

// Helper function for binarySearch().
function _findFirstMatch(array, key, directionProvider, randomMatchingIndex) {

	if (randomMatchingIndex === 0) {
		return 0;
	}

	var index = randomMatchingIndex - 1;
	while (index >= 0 && directionProvider(key,
		array[index - 1], array[index], array[index + 1]) == 0) {
		--index;
	}

	return index + 1;
}
