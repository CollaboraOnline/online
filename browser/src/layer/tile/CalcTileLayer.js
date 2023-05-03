/* -*- js-indent-level: 8 -*- */
/*
 * Calc tile layer is used to display a spreadsheet document
 */

/* global app */

L.CalcTileLayer = L.CanvasTileLayer.extend({
	options: {
		// TODO: sync these automatically from SAL_LOK_OPTIONS
		sheetGeometryDataEnabled: true,
		printTwipsMsgsEnabled: true,
		syncSplits: true, // if false, the splits/freezes are not synced with other users viewing the same sheet.
	},

	twipsToHMM: function (twips) {
		return (twips * 127 + 36) / 72;
	},

	newAnnotation: function (comment) {
		var commentList = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).sectionProperties.commentList;
		var comment = null;

		for (var i = 0; i < commentList.length; i++) {
			if (this._cellCursorTwips.contains(commentList[i].sectionProperties.data.cellPos)) {
				if (commentList[i].tab == this._selectedPart) {
					comment = commentList[i];
					break;
				}
			}
		}

		if (!comment) {
			var newComment = {
				cellPos: app.file.calc.cellCursor.rectangle.twips.slice(), // Copy the array.
				anchorPos: app.file.calc.cellCursor.rectangle.twips.slice(), // Copy the array.
				id: 'new',
				tab: this._selectedPart,
				dateTime: new Date().toDateString(),
				author: this._map.getViewName(this._viewId)
			};
			comment = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).add(newComment);
			comment.show();
		}
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).modify(comment);
		comment.focus();
	},

	beforeAdd: function (map) {
		map._isCursorVisible = false;
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('updateparts', this._onUpdateParts, this);
		map.on('splitposchanged', this.setSplitCellFromPos, this);
		map.on('commandstatechanged', this._onCommandStateChanged, this);
		map.uiManager.initializeSpecializedUI('spreadsheet');
	},

	onAdd: function (map) {
		map.addControl(L.control.tabs());
		L.CanvasTileLayer.prototype.onAdd.call(this, map);

		map.on('resize', function () {
			if (this.isCursorVisible()) {
				this._onUpdateCursor(true /* scroll */);
			}
		}.bind(this));

		// This is called when page size is increased
		// the content of the cells that become visible may stay empty
		// unless we have the tiles in the cache already
		// This will only fetch the tiles which are invalid or does not exist
		map.on('sizeincreased', function() {
			this._update();
		}.bind(this));

		app.sectionContainer.addSection(new app.definitions.AutoFillMarkerSection());

		this.insertMode = false;
		this._cellSelections = Array(0);
		this._cellCursorXY = new L.Point(-1, -1);
		this._gotFirstCellCursor = false;
		this._sheetSwitch = new L.SheetSwitchViewRestore(map);
		this._lastColumn = 0; // with data
		this._lastRow = 0; // with data
		this.requestCellCursor();
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

	_onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number' && !e.source) {
			this.refreshViewData(undefined, false /* compatDataSrcOnly */, true /* sheetGeometryChanged */);
			this._switchSplitPanesContext();
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('invalidateheader: column')) {
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
		} else if (textMsg.startsWith('printranges:')) {
			this._onPrintRangesMsg(textMsg);
		} else {
			L.CanvasTileLayer.prototype._onMessage.call(this, textMsg, img);
		}
	},

	// This is used to read and parse printranges so that the next
	// canvas grid paint will show the visual indication of the print range
	// in the current sheet if any.
	_onPrintRangesMsg: function (textMsg) {
		textMsg = textMsg.substr('printranges:'.length);
		var msgData = JSON.parse(textMsg);
		if (!msgData['printranges'] || !Array.isArray(msgData['printranges']))
			return;

		if (!this._printRanges) {
			this._printRanges = [];
		}

		msgData['printranges'].forEach(function (sheetPrintRange) {
			if (typeof sheetPrintRange['sheet'] !== 'number' || !Array.isArray(sheetPrintRange['ranges'])) {
				return;
			}

			this._printRanges[sheetPrintRange['sheet']] = sheetPrintRange['ranges'];
		}, this);
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

		if (isNaN(command.mode))
			command.mode = this._selectedMode;

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
			var bounds = this._coordsToTileBounds(coords);
			if (coords.part === command.part && coords.mode === command.mode &&
				invalidBounds.intersects(bounds)) {
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

		if (needsNewTiles && command.part === this._selectedPart
			&& command.mode === this._selectedMode && this._debug)
		{
			this._debugAddInvalidationMessage(textMsg);
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part || coords.mode !== command.mode) {
				continue;
			}

			bounds = this._coordsToTileBounds(coords);
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
			// Hide previous tab's shown comment (if any).
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).hideAllComments();
			this._sheetSwitch.gotSetPart(part);
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

		var mapPosX = this._map._getTopLeftPoint().x;
		var mapPosY = this._map._getTopLeftPoint().y;
		var mapSize = this._map.getSize();

		var lastCellPixel = this.sheetGeometry.getCellRect(this._lastColumn, this._lastRow);
		var isCalcRTL = this._map._docLayer.isCalcRTL();
		lastCellPixel = isCalcRTL ? lastCellPixel.getBottomRight() : lastCellPixel.getBottomLeft();
		var lastCellTwips = this._corePixelsToTwips(lastCellPixel);
		var mapSizeTwips = this._corePixelsToTwips(mapSize);

		var limitWidth = mapPosX + mapSize.x < lastCellPixel.x;
		var limitHeight = mapPosY + mapSize.y < lastCellPixel.y;

		// limit to data area only (and map size for margin)
		if (limitWidth)
			newDocWidth = Math.min(lastCellTwips.x + mapSizeTwips.x, newDocWidth);

		if (limitHeight)
			newDocHeight = Math.min(lastCellTwips.y + mapSizeTwips.y, newDocHeight);

		var extendedLimit = false;

		if (!limitWidth && maxDocSize.x > this._docWidthTwips) {
			newDocWidth = this._docWidthTwips + mapSizeTwips.x;
			extendedLimit = true;
		}

		if (!limitHeight && maxDocSize.y > this._docHeightTwips) {
			newDocHeight = this._docHeightTwips + mapSizeTwips.y;
			extendedLimit = true;
		}

		var shouldRestrict = (newDocWidth !== this._docWidthTwips ||
				newDocHeight !== this._docHeightTwips);

		if (!shouldRestrict) {
			return;
		}

		// When there will be a latlng conversion, we should use CSS pixels.
		var newSizePx = this._twipsToPixels(new L.Point(newDocWidth, newDocHeight));

		var topLeft = this._map.unproject(new L.Point(0, 0));
		var bottomRight = this._map.unproject(newSizePx);

		this._docPixelSize = newSizePx.clone();
		this._docWidthTwips = newDocWidth;
		this._docHeightTwips = newDocHeight;
		app.file.size.twips = [newDocWidth, newDocHeight];
		app.file.size.pixels = [Math.round(this._tileSize * (this._docWidthTwips / this._tileWidthTwips)), Math.round(this._tileSize * (this._docHeightTwips / this._tileHeightTwips))];
		app.view.size.pixels = app.file.size.pixels.slice();

		this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));

		this._map.fire('scrolllimits', newSizePx.clone());

		if (limitWidth || limitHeight || extendedLimit)
			this._painter._sectionContainer.requestReDraw();
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
		if (this._cellCSelections.empty())
			return { hasSelection: false };

		var bounds = this._cellCSelections.getBounds();
		window.app.console.assert(bounds.isValid(), 'Non empty selection should have valid bounds');
		return {
			hasSelection: true,
			start: this._corePixelsToTwips(bounds.min).add([1, 1]),
			end: this._corePixelsToTwips(bounds.max).subtract([1, 1]),
		};
	},

	/// take into account only data area to reduce scrollbar range
	updateScollLimit: function () {
		if (this.sheetGeometry && this._lastColumn && this._lastRow) {
			this._restrictDocumentSize();
		}
	},

	_handleRTLFlags: function (command) {
		var rtlChanged = command.rtlParts === undefined;
		rtlChanged = rtlChanged || this._rtlParts !== undefined && (
			command.rtlParts.length !== this._rtlParts.length
			|| this._rtlParts.some(function (part, index) {
				return part !== command.rtlParts[index];
			}));
		this._rtlParts = command.rtlParts || [];
		if (rtlChanged) {
			this._adjustCanvasSectionsForLayoutChange();
		}
	},

	_onStatusMsg: function (textMsg) {
		console.log('DEBUG: onStatusMsg: ' + textMsg);
		var command = app.socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			var firstSelectedPart = (typeof this._selectedPart !== 'number');
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._lastColumn = command.lastcolumn;
			this._lastRow = command.lastrow;
			app.file.size.twips = [this._docWidthTwips, this._docHeightTwips];
			app.file.size.pixels = [Math.round(this._tileSize * (this._docWidthTwips / this._tileWidthTwips)), Math.round(this._tileSize * (this._docHeightTwips / this._tileHeightTwips))];
			app.view.size.pixels = app.file.size.pixels.slice();
			this._docType = command.type;
			this._parts = command.parts;
			this._selectedPart = command.selectedPart;
			this._selectedMode = (command.mode !== undefined) ? command.mode : 0;
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
			this._handleRTLFlags(command);
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
		} else {
			this._handleRTLFlags(command);
		}

		var scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
		scrollSection.stepByStepScrolling = true;
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

	_adjustCanvasSectionsForLayoutChange: function () {
		var sheetIsRTL = this._rtlParts.indexOf(this._selectedPart) >= 0;
		if (sheetIsRTL && this._layoutIsRTL !== true) {
			console.log('debug: in LTR -> RTL canvas section adjustments');
			var sectionContainer = this._painter._sectionContainer;

			var tilesSection = sectionContainer.getSectionWithName(L.CSections.Tiles.name);
			var rowHeaderSection = sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
			var columnHeaderSection = sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
			var cornerHeaderSection = sectionContainer.getSectionWithName(L.CSections.CornerHeader.name);
			var columnGroupSection = sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
			var rowGroupSection = sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
			var cornerGroupSection = sectionContainer.getSectionWithName(L.CSections.CornerGroup.name);
			// Scroll section covers the entire document area, and needs RTL adjustments internally.

			if (cornerGroupSection) {
				cornerGroupSection.anchor = ['top', 'right'];
			}

			if (rowGroupSection) {
				rowGroupSection.anchor = [[L.CSections.CornerGroup.name, 'bottom', 'top'], 'right'];
			}

			if (columnGroupSection) {
				columnGroupSection.anchor = ['top', [L.CSections.CornerGroup.name, '-left', 'right']];
			}

			cornerHeaderSection.anchor = [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.RowGroup.name, '-left', 'right']];

			rowHeaderSection.anchor = [[L.CSections.CornerHeader.name, 'bottom', 'top'], [L.CSections.RowGroup.name, '-left', 'right']];

			columnHeaderSection.anchor = [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.CornerHeader.name, '-left', 'right']];
			columnHeaderSection.expand = ['left'];

			tilesSection.anchor = [[L.CSections.ColumnHeader.name, 'bottom', 'top'], [L.CSections.RowHeader.name, '-left', 'right']];

			this._layoutIsRTL = true;

			sectionContainer.reNewAllSections(true);
			this._syncTileContainerSize();

		} else if (!sheetIsRTL && this._layoutIsRTL === true) {

			console.log('debug: in RTL -> LTR canvas section adjustments');
			this._layoutIsRTL = false;
			var sectionContainer = this._painter._sectionContainer;

			var tilesSection = sectionContainer.getSectionWithName(L.CSections.Tiles.name);
			var rowHeaderSection = sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
			var columnHeaderSection = sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
			var cornerHeaderSection = sectionContainer.getSectionWithName(L.CSections.CornerHeader.name);
			var columnGroupSection = sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
			var rowGroupSection = sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
			var cornerGroupSection = sectionContainer.getSectionWithName(L.CSections.CornerGroup.name);

			if (cornerGroupSection) {
				cornerGroupSection.anchor = ['top', 'left'];
			}

			if (rowGroupSection) {
				rowGroupSection.anchor = [[L.CSections.CornerGroup.name, 'bottom', 'top'], 'left'];
			}

			if (columnGroupSection) {
				columnGroupSection.anchor = ['top', [L.CSections.CornerGroup.name, 'right', 'left']];
			}

			cornerHeaderSection.anchor = [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.RowGroup.name, 'right', 'left']];

			rowHeaderSection.anchor = [[L.CSections.CornerHeader.name, 'bottom', 'top'], [L.CSections.RowGroup.name, 'right', 'left']];

			columnHeaderSection.anchor = [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.CornerHeader.name, 'right', 'left']];
			columnHeaderSection.expand = ['right'];

			tilesSection.anchor = [[L.CSections.ColumnHeader.name, 'bottom', 'top'], [L.CSections.RowHeader.name, 'right', 'left']];

			sectionContainer.reNewAllSections(true);
			this._syncTileContainerSize();
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

		console.log('debug: got sheetGeometry: this._rtlParts = ' + this._rtlParts + ' this._selectedPart = ' + this._selectedPart);

		this._adjustCanvasSectionsForLayoutChange();

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

		window.app.console.assert(typeof this._selectedPart === 'number', 'invalid selectedPart');

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
			window.app.console.warn('Empty argument for ' + e.commandName);
			return;
		}

		var values = e.state.split('/');
		var newSplitIndex = Math.floor(parseInt(values[0]));
		window.app.console.assert(!isNaN(newSplitIndex) && newSplitIndex >= 0, 'invalid argument for ' + e.commandName);

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

		if (!this._map.isEditMode() || !this._splitCellState || !this.options.syncSplits) {
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
			// duplicate sheet-geometry for same sheet triggers replay of other messages that
			// disrupt the view restore during sheet switch.
			if (this._oldSheetGeomMsg === textMsg && this._selectedPart === this.sheetGeometry.getPart())
				return;

			this._oldSheetGeomMsg = textMsg;
			this._handleSheetGeometryDataMsg(values);

		} else if (values.comments) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).clearList();
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).importComments(values.comments);
		} else if (values.commentsPos) {
			var section = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name);
			// invalidate all comments
			section.sectionProperties.commentList.forEach(function (comment) {
				comment.valid = false;
			});
			for (var index in values.commentsPos) {
				comment = values.commentsPos[index];
				if (section)
				{
					var commentObject;
					for (var i = 0; i < section.sectionProperties.commentList.length; i++) {
						if (parseInt(section.sectionProperties.commentList[i].sectionProperties.data.id) === parseInt(comment.id)) {
							if (parseInt(section.sectionProperties.commentList[i].sectionProperties.data.tab) === parseInt(comment.tab)) {
								commentObject = section.sectionProperties.commentList[i];
							} else {
								// tabs can be moved around and we need to update the tab because the id is still valid.
								commentObject = section.sectionProperties.commentList[i];
								commentObject.sectionProperties.data.tab = comment.tab;
							}
							commentObject.valid = true;
							break;
						}
					}
					if (commentObject)
						commentObject.sectionProperties.data.cellPos = section.stringToRectangles(comment.cellPos)[0];
				}
			}

			if (section)
				section.onCommentsDataUpdate();

		} else {
			L.CanvasTileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onTextSelectionMsg: function (textMsg) {
		L.CanvasTileLayer.prototype._onTextSelectionMsg.call(this, textMsg);
		// If this is a cellSelection message, user shouldn't be editing a cell. Below check is for ensuring that.
		if (this.insertMode === false && this._cellCursorXY && this._cellCursorXY.x !== -1) {
			// When insertMode is false, this is a cell selection message.
			textMsg = textMsg.replace('textselection:', '');
			if (textMsg.trim() !== 'EMPTY' && textMsg.trim() !== '') {
				this._cellSelections = textMsg.split(';');
				var ratio = this._tileSize / this._tileWidthTwips;
				var that = this;
				this._cellSelections = this._cellSelections.map(function(element) {
					element = element.split(',');
					var topLeftTwips = new L.Point(parseInt(element[0]), parseInt(element[1]));
					var offset = new L.Point(parseInt(element[2]), parseInt(element[3]));
					var bottomRightTwips = topLeftTwips.add(offset);
					var boundsTwips = that._convertToTileTwipsSheetArea(new L.Bounds(topLeftTwips, bottomRightTwips));

					element = L.LOUtil.createRectangle(boundsTwips.min.x * ratio, boundsTwips.min.y * ratio, boundsTwips.getSize().x * ratio, boundsTwips.getSize().y * ratio);
					return element;
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
		if (!this._gotFirstCellCursor && !textMsg.match('EMPTY')) {
			// Drawing is disabled from CalcTileLayer construction, enable it now.
			this._gotFirstCellCursor = true;
			this._update();
			this.enableDrawing();
		}
	},

	_getEditCursorRectangle: function (msgObj) {

		if (!this.options.printTwipsMsgsEnabled || !this.sheetGeometry ||
			!Object.prototype.hasOwnProperty.call(msgObj, 'relrect') || !Object.prototype.hasOwnProperty.call(msgObj, 'refpoint')) {
			// 1) non-print-twips messaging mode OR
			// 2) the edit-cursor belongs to draw/chart objects.
			return L.CanvasTileLayer.prototype._getEditCursorRectangle.call(this, msgObj);
		}

		if (typeof msgObj !== 'object') {
			window.app.console.error('invalid edit cursor message');
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
			window.app.console.error('invalid text selection message');
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
});

