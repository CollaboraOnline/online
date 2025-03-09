/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Calc tile layer is used to display a spreadsheet document
 */

/* global app CPolyUtil CPolygon TileManager cool */

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
			if (commentList[i].sectionProperties.data.tab == this._selectedPart) {
				if (commentList[i].sectionProperties.data.cellRange.contains(app.calc.cellAddress.toArray())) {
					comment = commentList[i];
					break;
				}
			}
		}

		if (!comment) {
			var pixelStart = new L.Point(app.calc.cellCursorRectangle.pX1, app.calc.cellCursorRectangle.pY1);
			var rangeStart = this.sheetGeometry.getCellFromPos(pixelStart, 'corepixels');
			var pixelEnd = new L.Point(app.calc.cellCursorRectangle.pX2 - 1, app.calc.cellCursorRectangle.pY2 - 1);
			var rangeEnd = this.sheetGeometry.getCellFromPos(pixelEnd, 'corepixels');

			var newComment = {
				cellRange: new L.Bounds(rangeStart, rangeEnd),
				anchorPos: app.calc.cellCursorRectangle.toArray(),
				id: 'new',
				tab: this._selectedPart,
				dateTime: new Date().toISOString(),
				author: this._map.getViewName(this._viewId)
			};

			if (app.sectionContainer.doesSectionExist('new comment')) // If adding a new comment has failed, we need to remove the leftover.
				app.sectionContainer.removeSection('new comment');

			comment = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).add(newComment);
			comment.positionCalcComment();
		}
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).modify(comment);
		comment.focus();
	},

	beforeAdd: function (map) {
		app.file.textCursor.visible = false;
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('updateparts', this._onUpdateParts, this);
		map.on('splitposchanged', this.setSplitCellFromPos, this);
		map.on('commandstatechanged', this._onCommandStateChanged, this);
		map.uiManager.initializeSpecializedUI('spreadsheet');
		window.keyboard.hintOnscreenKeyboard(window.keyboard.guessOnscreenKeyboard());
	},

	onAdd: function (map) {
		map.addControl(L.control.tabs());
		L.CanvasTileLayer.prototype.onAdd.call(this, map);

		map.on('resize', function () {
			if (app.file.textCursor.visible) {
				this._onUpdateCursor(true /* scroll */);
			}
		}.bind(this));

		app.sectionContainer.addSection(new app.definitions.AutoFillMarkerSection());

		this.insertMode = false;
		this._resetInternalState();
		this._sheetSwitch = new L.SheetSwitchViewRestore(map);
		this._sheetGrid = true;
	},

	_resetInternalState: function() {
		this._cellSelections = Array(0);
		app.calc.cellCursorVisible = false;
		this._gotFirstCellCursor = false;
		this._lastColumn = 0; // with data
		this._lastRow = 0; // with data
		this.requestCellCursor();
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
		} else if (textMsg.startsWith('invalidateheader: row')) {
			this.refreshViewData({x: 0, y: this._map._getTopLeftPoint().y,
				offset: {x: 0, y: undefined}}, true /* compatDataSrcOnly */);
		} else if (textMsg.startsWith('invalidateheader: all')) {
			this.refreshViewData({x: this._map._getTopLeftPoint().x, y: this._map._getTopLeftPoint().y,
				offset: {x: undefined, y: undefined}}, true /* compatDataSrcOnly */);
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

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (!app.calc.isPartHidden(part)) {
			this.refreshViewData(undefined, true /* compatDataSrcOnly */, false /* sheetGeometryChanged */);
			this._replayPrintTwipsMsgAllViews('cellviewcursor');
			this._replayPrintTwipsMsgAllViews('textviewselection');
			// Hide previous tab's shown comment (if any).
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).hideAllComments();
			this._sheetSwitch.gotSetPart(part);
			this._syncTileContainerSize();
		}
	},

	_onZoomRowColumns: function () {
		this._sendClientZoom();
		if (this.sheetGeometry) {
			this.sheetGeometry.setTileGeometryData(app.tile.size.x, app.tile.size.y,
				TileManager.tileSize);
		}
		this._restrictDocumentSize();
		this.setSplitPosFromCell();
		this._map.fire('zoomchanged');
		this.refreshViewData();
		this._replayPrintTwipsMsgs(false);
	},

	_restrictDocumentSize: function () {

		if (!this.sheetGeometry) {
			return;
		}

		var maxDocSize = this.sheetGeometry.getSize('tiletwips');
		var newDocWidth = Math.min(maxDocSize.x, app.file.size.x);
		var newDocHeight = Math.min(maxDocSize.y, app.file.size.y);

		var lastCellPixel = this.sheetGeometry.getCellRect(this._lastColumn, this._lastRow);
		var isCalcRTL = this._map._docLayer.isCalcRTL();
		lastCellPixel = isCalcRTL ? lastCellPixel.getBottomRight() : lastCellPixel.getBottomLeft();
		var lastCellTwips = this._corePixelsToTwips(lastCellPixel);
		var mapSizeTwips = this._pixelsToTwips(this._map.getSize());
		var mapPosTwips = this._pixelsToTwips(this._map._getTopLeftPoint());

		// margin outside data area we allow to scroll
		// has to be bigger on mobile to allow scroll
		// to the next place where we extend that area
		// (allow few mobile screens down and right)
		var limitMargin = mapSizeTwips;
		if (!window.mode.isDesktop()) {
			limitMargin.x *= 8;
			limitMargin.y *= 8;
		}

		var limitWidth = mapPosTwips.x + mapSizeTwips.x < lastCellTwips.x;
		var limitHeight = mapPosTwips.y + mapSizeTwips.y < lastCellTwips.y;

		// limit to data area only (and map size for margin)
		if (limitWidth)
			newDocWidth = lastCellTwips.x + limitMargin.x;

		if (limitHeight)
			newDocHeight = lastCellTwips.y + limitMargin.y;

		var extendedLimit = false;

		if (!limitWidth && maxDocSize.x > app.file.size.x) {
			newDocWidth = Math.min(app.file.size.x + mapSizeTwips.x, maxDocSize.x);
			extendedLimit = true;
		}

		if (!limitHeight && maxDocSize.y > app.file.size.y) {
			newDocHeight = Math.min(app.file.size.y + mapSizeTwips.y, maxDocSize.y);
			extendedLimit = true;
		}

		var shouldRestrict = (newDocWidth !== app.file.size.x ||
				newDocHeight !== app.file.size.y);

		if (!shouldRestrict) {
			return;
		}

		// When there will be a latlng conversion, we should use CSS pixels.
		var newSizePx = this._twipsToPixels(new L.Point(newDocWidth, newDocHeight));

		var topLeft = this._map.unproject(new L.Point(0, 0));
		var bottomRight = this._map.unproject(newSizePx);

		this._docPixelSize = newSizePx.clone();
		app.file.size.x = newDocWidth;
		app.file.size.y = newDocHeight;
		app.file.size = new cool.SimplePoint(newDocWidth, newDocHeight);
		app.view.size = app.file.size.clone();

		this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));

		this._map.fire('scrolllimits', newSizePx.clone());

		if (limitWidth || limitHeight || extendedLimit)
			app.sectionContainer.requestReDraw();
	},

	_getCursorPosSize: function () {
		var x = -1, y = -1;
		var size = new L.Point(0, 0);

		if (app.calc.cellCursorVisible) {
			x = app.calc.cellAddress.x + 1;
			y = app.calc.cellAddress.y + 1;

			size = { x: app.calc.cellCursorRectangle.width, y: app.calc.cellCursorRectangle.height };
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
	updateScrollLimit: function () {
		if (this.sheetGeometry
			&& this._lastColumn !== undefined && this._lastColumn !== null
			&& this._lastRow !== undefined && this._lastRow !== null) {
			this._restrictDocumentSize();
		}
	},

	_hasPartsCountOrNamesChanged(lastStatusJSON, statusJSON) {
		if (!lastStatusJSON)
			return true;

		if (lastStatusJSON.parts.length !== statusJSON.parts.length)
			return true;
		else {
			for (let i = 0; i < statusJSON.parts.length; i++) {
				if (statusJSON.parts[i].name !== lastStatusJSON.parts[i].name)
					return true;
			}
			return false;
		}
	},

	_refreshPartNames(statusJSON) {
		this._partNames = [];

		for (let i = 0; i < statusJSON.parts.length; i++) {
			this._partNames.push(statusJSON.parts[i].name);
		}
	},

	_refreshPartHashes(statusJSON) {
		app.calc.partHashes = [];

		for (let i = 0; i < statusJSON.parts.length; i++) {
			app.calc.partHashes.push(statusJSON.parts[i].hash);
		}
	},

	_getMarginPropertiesForTheMap: function() {
		const rowHeaderSection = app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
		const columnHeaderSection = app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
		const rowGroupSection = app.sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
		const columnGroupSection = app.sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
		const scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
		const scrollBarThickness = scrollSection ? scrollSection.sectionProperties.scrollBarThickness : 0;

		const marginLeft = (rowHeaderSection ? rowHeaderSection.size[0] : 0) + (rowGroupSection ? rowGroupSection.size[0] : 0);
		const marginTop = (columnHeaderSection ? columnHeaderSection.size[1] : 0) + (columnGroupSection ? columnGroupSection.size[1] : 0);

		return { marginLeft, marginTop, scrollBarThickness };
	},

	_calculateNewCanvasAndMapSizes: function(documentContainerSize, availableSpace, marginLeft, marginTop, scrollBarThickness) {
		let newMapSize = availableSpace.slice();
		let newCanvasSize = documentContainerSize.slice();

		const fileSizePixels = app.file.size.pToArray();

		// If we don't need that much space.
		if (fileSizePixels[0] < availableSpace[0]) {
			newMapSize[0] = fileSizePixels[0];
			newCanvasSize[0] = fileSizePixels[0] + marginLeft + scrollBarThickness;
		}

		if (fileSizePixels[1] < availableSpace[1]) {
			newMapSize[1] = fileSizePixels[1];
			newCanvasSize[1] = fileSizePixels[1] + marginTop + scrollBarThickness;
		}

		newMapSize = [Math.round(newMapSize[0] / app.dpiScale), Math.round(newMapSize[1] / app.dpiScale)];
		newCanvasSize = [Math.round(newCanvasSize[0] / app.dpiScale), Math.round(newCanvasSize[1] / app.dpiScale)];

		return { newMapSize, newCanvasSize };
	},

	_resizeMapElementAndTilesLayer: function(mapElement, marginLeft, marginTop, newMapSize) {
		mapElement.style.left = Math.round(marginLeft / app.dpiScale) + 'px';
		mapElement.style.top = Math.round(marginTop / app.dpiScale) + 'px';
		mapElement.style.width = newMapSize[0] + 'px';
		mapElement.style.height = newMapSize[1] + 'px';

		this._container.style.width = newMapSize[0] + 'px';
		this._container.style.height = newMapSize[1] + 'px';
	},

	_updateHeaderSections: function() {
		if (app.sectionContainer.doesSectionExist(L.CSections.RowHeader.name)) {
			app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name)._updateCanvas();
			app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name)._updateCanvas();
		}
	},

	_syncTileContainerSize: function() {
		if (!this._map) return;

		if (!this._container) return;

		// Document container size is up to date as of now.
		const documentContainerSize = this._getDocumentContainerSize();
		documentContainerSize[0] *= app.dpiScale;
		documentContainerSize[1] *= app.dpiScale;

		// Size has changed. Our map and canvas are not resized yet.
		// But the row header, row group, column header and column group sections don't need to be resized.
		// We can get their width and height from the sections' properties.
		const { marginLeft, marginTop, scrollBarThickness } = this._getMarginPropertiesForTheMap();

		// Available for tiles section.
		const availableSpace = [documentContainerSize[0] - marginLeft - scrollBarThickness, documentContainerSize[1] - marginTop - scrollBarThickness];
		const { newMapSize, newCanvasSize } = this._calculateNewCanvasAndMapSizes(documentContainerSize, availableSpace, marginLeft, marginTop, scrollBarThickness);

		const mapElement = document.getElementById('map'); // map's size = tiles section's size.
		const oldMapSize = [mapElement.clientWidth, mapElement.clientHeight];
		this._resizeMapElementAndTilesLayer(mapElement, marginLeft, marginTop, newMapSize);

		app.sectionContainer.onResize(newCanvasSize[0], newCanvasSize[1]); // Canvas's size = documentContainer's size.

		this._updateHeaderSections();

		const widthIncreased = oldMapSize[0] < newMapSize[0];
		const heightIncreased = oldMapSize[1] < newMapSize[1];

		if (oldMapSize[0] !== newMapSize[0] || oldMapSize[1] !== newMapSize[1])
			this._map.invalidateSize({}, new L.Point(oldMapSize[0], oldMapSize[1]));

		this._mobileChecksAfterResizeEvent(heightIncreased);

		// Center the view w.r.t the new map-pane position using the current zoom.
		this._map.setView(this._map.getCenter());

		// We want to keep cursor visible when we show the keyboard on mobile device or tablet
		this._nonDesktopChecksAfterResizeEvent(heightIncreased);

		if (heightIncreased || widthIncreased) {
			app.sectionContainer.requestReDraw();
			this._map.fire('sizeincreased');
		}
	},

	_onStatusMsg: function (textMsg) {
		console.log('DEBUG: onStatusMsg: ' + textMsg);

		const statusJSON = JSON.parse(textMsg.replace('status:', '').replace('statusupdate:', ''));

		if (statusJSON.width && statusJSON.height && this._documentInfo !== textMsg) {
			const temp = this._lastStatusJSON ? Object.assign({}, this._lastStatusJSON): null;
			this._lastStatusJSON = statusJSON;
			this._documentInfo = textMsg;

			var firstSelectedPart = (typeof this._selectedPart !== 'number');

			if (statusJSON.readonly) this._map.setPermission('readonly');

			app.file.size.x = statusJSON.width;
			app.file.size.y = statusJSON.height;

			app.view.size = app.file.size.clone();

			this._docType = statusJSON.type;
			this._parts = statusJSON.partscount;

			if (app.socket._reconnecting) {
				app.socket.sendMessage('setclientpart part=' + this._selectedPart);
				this._resetInternalState();
				window.keyboard.hintOnscreenKeyboard(window.keyboard.guessOnscreenKeyboard());
			} else {
				this._selectedPart = statusJSON.selectedpart;
			}

			this._lastColumn = statusJSON.lastcolumn;
			this._lastRow = statusJSON.lastrow;
			this._selectedMode = (statusJSON.mode !== undefined) ? statusJSON.mode : 0;

			if (this.sheetGeometry && this._selectedPart != this.sheetGeometry.getPart()) {
				// Core initiated sheet switch, need to get full sheetGeometry data for the selected sheet.
				this.requestSheetGeometryData();
			}

			this._viewId = statusJSON.viewid;

			console.assert(this._viewId >= 0, 'Incorrect viewId received: ' + this._viewId);

			var mapSize = this._map.getSize();
			var sizePx = this._twipsToPixels(new L.Point(app.file.size.x, app.file.size.y));
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

			this._adjustCanvasSectionsForLayoutChange();

			this._refreshPartNames(statusJSON);
			this._refreshPartHashes(statusJSON);

			// if the number of parts, or order has changed then refresh comment positions
			if (this._hasPartsCountOrNamesChanged(temp, statusJSON))
				app.socket.sendMessage('commandvalues command=.uno:ViewAnnotationsPosition');


			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				source: 'status',
				partNames: this._partNames
			});

			TileManager.resetPreFetching(true);

			if (firstSelectedPart) this._switchSplitPanesContext();
		} else {
			this._adjustCanvasSectionsForLayoutChange();
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
			if (!app.sectionContainer.doesSectionExist(L.CSections.CornerGroup.name))
				app.sectionContainer.addSection(L.control.cornerGroup());
		}
		else { // If not, remove CornerGroup section.
			app.sectionContainer.removeSection(L.CSections.CornerGroup.name);
		}

		// If there are row groups, add RowGroup section.
		if (this.sheetGeometry._rows._outlines._outlines.length > 0) {
			if (!app.sectionContainer.doesSectionExist(L.CSections.RowGroup.name))
				app.sectionContainer.addSection(L.control.rowGroup());
		}
		else { // If not, remove RowGroup section.
			app.sectionContainer.removeSection(L.CSections.RowGroup.name);
		}

		// If there are column groups, add ColumnGroup section.
		if (this.sheetGeometry._columns._outlines._outlines.length > 0) {
			if (!app.sectionContainer.doesSectionExist(L.CSections.ColumnGroup.name)) {
				app.sectionContainer.addSection(L.control.columnGroup());
				app.sectionContainer.canvas.style.border = '1px solid darkgrey';
			}
		}
		else { // If not, remove ColumnGroup section.
			app.sectionContainer.removeSection(L.CSections.ColumnGroup.name);
			app.sectionContainer.canvas.style.border = '0px solid darkgrey';
		}
	},

	_setAnchor: function(name, section, value) {
		if (!section) {
			console.debug('_setAnchor: no section found: "' + name + '"');
			return;
		}

		section.anchor = value;
	},

	_adjustCanvasSectionsForLayoutChange: function () {
		var sheetIsRTL = app.calc.isRTL();
		if (sheetIsRTL && this._layoutIsRTL !== true) {
			console.log('debug: in LTR -> RTL canvas section adjustments');
			var sectionContainer = app.sectionContainer;

			var tilesSection = sectionContainer.getSectionWithName(L.CSections.Tiles.name);
			var rowHeaderSection = sectionContainer.getSectionWithName(L.CSections.RowHeader.name);
			var columnHeaderSection = sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name);
			var cornerHeaderSection = sectionContainer.getSectionWithName(L.CSections.CornerHeader.name);
			var columnGroupSection = sectionContainer.getSectionWithName(L.CSections.ColumnGroup.name);
			var rowGroupSection = sectionContainer.getSectionWithName(L.CSections.RowGroup.name);
			var cornerGroupSection = sectionContainer.getSectionWithName(L.CSections.CornerGroup.name);
			// Scroll section covers the entire document area, and needs RTL adjustments internally.

			this._setAnchor('cornerGroupSection', cornerGroupSection, ['top', 'right']);

			this._setAnchor('rowGroupSection', rowGroupSection,
				[[L.CSections.CornerGroup.name, 'bottom', 'top'], 'right']);

			this._setAnchor('columnGroupSection', columnGroupSection,
				['top', [L.CSections.CornerGroup.name, '-left', 'right']]);

			this._setAnchor('cornerHeaderSection', cornerHeaderSection,
				[[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.RowGroup.name, '-left', 'right']]);

			this._setAnchor('rowHeaderSection', rowHeaderSection,
				[[L.CSections.CornerHeader.name, 'bottom', 'top'], [L.CSections.RowGroup.name, '-left', 'right']]);

			this._setAnchor('columnHeaderSection', columnHeaderSection,
				[[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.CornerHeader.name, '-left', 'right']]);
			if (columnHeaderSection) columnHeaderSection.expand = ['left'];

			this._setAnchor('tilesSection', tilesSection,
				[[L.CSections.ColumnHeader.name, 'bottom', 'top'], [L.CSections.RowHeader.name, '-left', 'right']]);

			// Do not set layoutIsRtl to true prematurely. If set before all sections are defined
			// (e.g., during load with onStatusMsg), some sections may not update to their correct positions.
			// Ensure all sections are adjusted first, then set layoutIsRtl to true to show that they have moved.
			if (rowHeaderSection)
				this._layoutIsRTL = true;

			sectionContainer.reNewAllSections(true);
			this._syncTileContainerSize();

		} else if (!sheetIsRTL && this._layoutIsRTL === true) {

			console.log('debug: in RTL -> LTR canvas section adjustments');
			var sectionContainer = app.sectionContainer;

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

			if (rowHeaderSection)
				this._layoutIsRTL = false;

			tilesSection.anchor = [[L.CSections.ColumnHeader.name, 'bottom', 'top'], [L.CSections.RowHeader.name, 'right', 'left']];

			sectionContainer.reNewAllSections(true);
			this._syncTileContainerSize();
		}
	},

	_handleSheetGeometryDataMsg: function (jsonMsgObj, differentSheet) {
		if (!this.sheetGeometry) {
			this._sheetGeomFirstWait = false;
			this.sheetGeometry = new L.SheetGeometry(jsonMsgObj,
				app.tile.size.x, app.tile.size.y,
				TileManager.tileSize, this._selectedPart);

			app.sectionContainer.addSection(L.control.cornerHeader());
			app.sectionContainer.addSection(new app.definitions.rowHeader());
			app.sectionContainer.addSection(new app.definitions.columnHeader());
		}
		else {
			this.sheetGeometry.update(jsonMsgObj, /* checkCompleteness */ false, this._selectedPart);
		}

		this._replayPrintTwipsMsgs(differentSheet);

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

		app.sectionContainer.reNewAllSections(true);
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
			if (!this.insertMode) {
				app.file.textCursor.visible = false;
				if (this._map._docLayer._cursorMarker)
					this._map._docLayer._cursorMarker.remove();
			}
		}
		else if (e.commandName === '.uno:ToggleSheetGrid') {
			let trimmedState = e.state.trim();
			// Disabled mean we don't change the sheet grid state.
			if (trimmedState != 'disabled') {
				let newState = trimmedState === 'true';
				if (this._sheetGrid != newState) {
					this._sheetGrid = newState;
					app.sectionContainer.requestReDraw();
				}
			}
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
		command['Index'] = {
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
			var differentSheet = this.sheetGeometry === undefined || this._selectedPart !== this.sheetGeometry.getPart();
			// duplicate sheet-geometry for same sheet triggers replay of other messages that
			// disrupt the view restore during sheet switch.
			if (this._oldSheetGeomMsg === textMsg && !differentSheet)
				return;

			this._oldSheetGeomMsg = textMsg;
			this._handleSheetGeometryDataMsg(values, differentSheet);
			this._syncTileContainerSize();
		} else if (values.comments) {
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
					if (commentObject) {
						// turn cell range string into Bounds
						commentObject.sectionProperties.data.cellRange = this._parseCellRange(comment.cellRange);

					}
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
		if ((this.insertMode === false || app.file.textCursor.visible === false) && app.calc.cellCursorVisible) {
			// When insertMode is false, this is a cell selection message.
			textMsg = textMsg.replace('textselection:', '');
			if (textMsg.trim() !== 'EMPTY' && textMsg.trim() !== '') {
				this._cellSelections = textMsg.split(';');
				var that = this;
				this._cellSelections = this._cellSelections.map(function(element) {
					element = element.split(',');
					var topLeftTwips = new L.Point(parseInt(element[0]), parseInt(element[1]));
					var offset = new L.Point(parseInt(element[2]), parseInt(element[3]));
					var bottomRightTwips = topLeftTwips.add(offset);
					var boundsTwips = that._convertToTileTwipsSheetArea(new L.Bounds(topLeftTwips, bottomRightTwips));

					element = app.LOUtil.createRectangle(boundsTwips.min.x * app.twipsToPixels, boundsTwips.min.y * app.twipsToPixels, boundsTwips.getSize().x * app.twipsToPixels, boundsTwips.getSize().y * app.twipsToPixels);
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
		if (!this._gotFirstCellCursor) {
			// Drawing is disabled from CalcTileLayer construction, enable it now.
			this._gotFirstCellCursor = true;
			TileManager.update();
			this.enableDrawing();
		}
		if (this._map.uiManager.getHighlightMode()) {
			if (!textMsg.match('EMPTY'))
				this._highlightColAndRow(textMsg);
		}
		else
			this._resetReferencesMarks();
	},

	updateHighlight: function () {
		if ( this._map) {
			if (this._map.uiManager.getHighlightMode()) {
				var updateMsg = 'updateHighlight';
				this._highlightColAndRow(updateMsg);
			}
			else
				this._resetReferencesMarks();
		}
	},

	_highlightColAndRow: function (textMsg) {
		var strTwips = [];
		if(textMsg.startsWith('updateHighlight')) {
			strTwips[0] = app.calc.cellCursorTopLeftTwips.x;
			strTwips[1] = app.calc.cellCursorTopLeftTwips.y;
			strTwips[2] = app.calc.cellCursorOffset.x;
			strTwips[3] = app.calc.cellCursorOffset.y;
		}
		else
			strTwips = textMsg.match(/\d+/g);

		this._resetReferencesMarks();
		var references = [];
		this._referencesAll = [];
		var rectangles = [];
		var strColor = getComputedStyle(document.documentElement).getPropertyValue('--column-row-highlight');
		var maxCol = 268435455;
		var maxRow = 20971124;
		var part = this._selectedPart;
		var topLeftTwips, offset, boundsTwips;

		for(let i = 0; i < 2; i++) {
			if (i == 0) {
				// Column rectangle
				topLeftTwips = new L.Point(parseInt(strTwips[0]), parseInt(0));
				offset = new L.Point(parseInt(strTwips[2]), parseInt(maxCol));
				boundsTwips = this._convertToTileTwipsSheetArea(
					new L.Bounds(topLeftTwips, topLeftTwips.add(offset)));
				rectangles.push([boundsTwips.getBottomLeft(), boundsTwips.getBottomRight(),
				boundsTwips.getTopLeft(), boundsTwips.getTopRight()]);
			} else {
				// Row rectangle
				topLeftTwips = new L.Point(parseInt(0), parseInt(strTwips[1]));
				offset = new L.Point(parseInt(maxRow), parseInt(strTwips[3]));
				boundsTwips = this._convertToTileTwipsSheetArea(
					new L.Bounds(topLeftTwips, topLeftTwips.add(offset)));
				rectangles.push([boundsTwips.getBottomLeft(), boundsTwips.getBottomRight(),
					boundsTwips.getTopLeft(), boundsTwips.getTopRight()]);
			}

		    var docLayer = this;
		    var pointSet = CPolyUtil.rectanglesToPointSet(rectangles, function (twipsPoint) {
				var corePxPt = docLayer._twipsToCorePixels(twipsPoint);
				corePxPt.round();
				return corePxPt;
			});
			var reference = new CPolygon(pointSet, {
				pointerEvents: 'none',
				fillColor: strColor,
				fillOpacity: 0.25,
				weight: 2 * app.dpiScale,
				opacity: 0.25});

			references.push({mark: reference, part: part});
			this._referencesAll.push(references[i]);
		}
		this._updateReferenceMarks();
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

		return this._twipsToPixels(new L.Point(app.file.size.x, app.file.size.y));
	},

	_calculateScrollForNewCellCursor: function () {
		var scroll = new app.definitions.simplePoint(0, 0);

		if (!app.calc.cellCursorVisible) {
			return new L.LatLng(0, 0);
		}

		let paneRectangles = app.getViewRectangles(); // SimpleRectangle array.
		let contained = false;
		for (let i = 0; i < paneRectangles.length; i++) {
			if (paneRectangles[i].containsRectangle(app.calc.cellCursorRectangle.toArray()))
				contained = true;
		}

		if (contained)
			return new L.LatLng(0, 0); // No scroll needed.

		var noSplit = !this._splitPanesContext || this._splitPanesContext.getSplitPos().equals(new L.Point(0, 0));

		// No split panes. Check if target cell is bigger than screen but partially visible.
		if (noSplit && app.calc.cellCursorRectangle.intersectsRectangle(paneRectangles[0].toArray())) {
			if (app.calc.cellCursorRectangle.width > paneRectangles[0].width || app.calc.cellCursorRectangle.height > paneRectangles[0].height)
				return new L.LatLng(0, 0); // no scroll needed.
		}

		let freePane = paneRectangles[paneRectangles.length - 1]; // Last pane, this should be the scrollable - not frozen one.

		// Horizontal split
		if (app.calc.cellCursorRectangle.x2 > app.calc.splitCoordinate.x) {
			if (app.calc.cellCursorRectangle.width > freePane.width)
				return new L.LatLng(0, 0); // no scroll needed.

			var spacingX = app.calc.cellCursorRectangle.width / 4.0;

			if (app.calc.cellCursorRectangle.x1 < freePane.x1) {
				scroll.x = app.calc.cellCursorRectangle.x1 - freePane.x1 - spacingX;
			}
			else if (app.calc.cellCursorRectangle.x2 > freePane.x2) {
				scroll.x = app.calc.cellCursorRectangle.x2 - freePane.x2 + spacingX;
			}
		}

		// Vertical split
		if (app.calc.cellCursorRectangle.y2 > app.calc.splitCoordinate.y) {
			if (app.calc.cellCursorRectangle.height > freePane.height)
				return new L.LatLng(0, 0); // no scroll needed.

			var spacingY = 100; // twips margin

			// try to center in free pane the top of a cell
			if (app.calc.cellCursorRectangle.y1 < freePane.y1)
				scroll.y = app.calc.cellCursorRectangle.y1 - freePane.y1 - spacingY;

			// then check if end of a cell is visible
			if (app.calc.cellCursorRectangle.y2 > freePane.y2 + scroll.y)
				scroll.y = scroll.y + (app.calc.cellCursorRectangle.y2 - freePane.y2 + spacingY);
		}

		scroll = this._twipsToLatLng(scroll, this._map.getZoom()); // Simple point is also converted to L.Point by the converter.

		return scroll;
	},

	getSelectedPart: function () {
		return this._selectedPart;
	},
});
