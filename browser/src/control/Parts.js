/* -*- js-indent-level: 8 -*- */
/*
 * Document parts switching and selecting handler
 */

/* global app _ */

L.Map.include({
	setPart: function (part, external, calledFromSetPartHandler) {
		var docLayer = this._docLayer;

		if (docLayer.isCalc())
			docLayer._sheetSwitch.save(part /* toPart */);

		docLayer._prevSelectedPart = docLayer._selectedPart;
		docLayer._selectedParts = [];
		if (part === 'prev') {
			if (docLayer._selectedPart > 0) {
				docLayer._selectedPart -= 1;
				this._partsDirection = -1;
			}
		}
		else if (part === 'next') {
			if (docLayer._selectedPart < docLayer._parts - 1) {
				docLayer._selectedPart += 1;
				this._partsDirection = 1;
			}
		}
		else if (typeof (part) === 'number' && part >= 0 && part < docLayer._parts) {
			this._partsDirection = (part >= docLayer._selectedPart) ? 1 : -1;
			docLayer._selectedPart = part;
			docLayer._updateReferenceMarks();
		}
		else {
			return;
		}

		var notifyServer = function (part) {
			// If this wasn't triggered from the server,
			// then notify the server of the change.
			if (!external)
				app.socket.sendMessage('setclientpart part=' + part);
		};

		if (app.file.fileBasedView)
		{
			docLayer._selectedPart = docLayer._prevSelectedPart;
			if (typeof(part) !== 'number') {
				docLayer._preview._scrollViewByDirection(part);
				this._docLayer._checkSelectedPart();
				return;
			}
			docLayer._preview._scrollViewToPartPosition(docLayer._selectedPart);
			this._docLayer._checkSelectedPart();
			notifyServer(part);
			return;
		}

		this.fire('scrolltopart');

		docLayer._selectedParts.push(docLayer._selectedPart);
		if (docLayer.isCursorVisible()) {
			// a click outside the slide to clear any selection
			app.socket.sendMessage('resetselection');
		}

		notifyServer(docLayer._selectedPart);

		this.fire('updateparts', {
			selectedPart: docLayer._selectedPart,
			selectedParts: docLayer._selectedParts,
			parts: docLayer._parts,
			docType: docLayer._docType
		});

		docLayer.eachView(docLayer._viewCursors, docLayer._onUpdateViewCursor, docLayer);
		docLayer.eachView(docLayer._cellViewCursors, docLayer._onUpdateCellViewCursor, docLayer);
		docLayer.eachView(docLayer._graphicViewMarkers, docLayer._onUpdateGraphicViewSelection, docLayer);
		docLayer.eachView(docLayer._viewSelections, docLayer._onUpdateTextViewSelection, docLayer);
		docLayer._clearSelections(calledFromSetPartHandler);
		docLayer._updateOnChangePart();
		docLayer._pruneTiles();
		docLayer._prevSelectedPartNeedsUpdate = true;
		if (docLayer._invalidatePreviews) {
			docLayer._invalidatePreviews();
		}
		docLayer._drawSearchResults();
		if (!this._searchRequested) {
			this.focus();
		}
	},

	// part is the part index/id
	// how is 0 to deselect, 1 to select, and 2 to toggle selection
	selectPart: function (part, how, external) {
		//TODO: Update/track selected parts(?).
		var docLayer = this._docLayer;
		var index = docLayer._selectedParts.indexOf(part);
		if (index >= 0 && how != 1) {
			// Remove (i.e. deselect)
			docLayer._selectedParts.splice(index, 1);
		}
		else if (how != 0) {
			// Add (i.e. select)
			docLayer._selectedParts.push(part);
		}

		this.fire('updateparts', {
			selectedPart: docLayer._selectedPart,
			selectedParts: docLayer._selectedParts,
			parts: docLayer._parts,
			docType: docLayer._docType
		});

		// If this wasn't triggered from the server,
		// then notify the server of the change.
		if (!external) {
			app.socket.sendMessage('selectclientpart part=' + part + ' how=' + how);
		}
	},

	deselectAll: function() {
		var docLayer = this._docLayer;
		while (docLayer._selectedParts.length > 0) {
			this.selectPart(docLayer._selectedParts[0], 0, false);
		}
	},

	_processPreviewQueue: function() {
		if (this._previewRequestsOnFly > 1) {
			// we don't always get a response for each tile requests
			// especially when we have more than one view
			// the server can determine that we have the tile already
			// and does not response to us
			// in that case we cannot decrease previewRequestsOnFly counter
			// we should not wait more than 2 seconds for each 3 requests
			var now = new Date();
			if (now - this._timeToEmptyQueue < 2000)
				// wait until the queue is empty
				return;
			else {
				this._previewRequestsOnFly = 0;
				this._timeToEmptyQueue = now;
			}
		}
		// take 3 requests from the queue:
		while (this._previewRequestsOnFly < 3) {
			var tile = this._previewQueue.shift();
			if (!tile)
				break;
			var isVisible = this.isPreviewVisible(tile[0], true);
			if (isVisible != true)
				// skip this! we can't see it
				continue;
			this._previewRequestsOnFly++;
			app.socket.sendMessage(tile[1]);
		}
	},

	_addPreviewToQueue: function(part, tileMsg) {
		for (var tile in this._previewQueue)
			if (tile[0] === part)
				// we already have this tile in the queue
				// no need to ask for it twice
				return;
		this._previewQueue.push([part, tileMsg]);
	},

	getPreview: function (id, index, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? !!options.autoUpdate : false;
		var fetchThumbnail = options && options.fetchThumbnail ? options.fetchThumbnail : true;
		this._docPreviews[id] = {id: id, index: index, maxWidth: maxWidth, maxHeight: maxHeight, autoUpdate: autoUpdate, invalid: false};

		var docLayer = this._docLayer;
		if (docLayer._docType === 'text') {
			return;
		}
		else {
			var part = index;
			var tilePosX = 0;
			var tilePosY = 0;
			var tileWidth = docLayer._partWidthTwips ? docLayer._partWidthTwips: docLayer._docWidthTwips;
			var tileHeight = docLayer._partHeightTwips ? docLayer._partHeightTwips: docLayer._docHeightTwips;
		}
		var docRatio = tileWidth / tileHeight;
		var imgRatio = maxWidth / maxHeight;
		// fit into the given rectangle while maintaining the ratio
		if (imgRatio > docRatio) {
			maxWidth = Math.round(tileWidth * maxHeight / tileHeight);
		}
		else {
			maxHeight = Math.round(tileHeight * maxWidth / tileWidth);
		}

		if (fetchThumbnail) {
			var mode = docLayer._selectedMode;
			this._addPreviewToQueue(part, 'tile ' +
							'nviewid=0' + ' ' +
							'part=' + part + ' ' +
							((mode !== 0) ? ('mode=' + mode + ' ') : '') +
							'width=' + maxWidth * app.roundedDpiScale + ' ' +
							'height=' + maxHeight * app.roundedDpiScale + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
						 'broadcast=no');
			this._processPreviewQueue();
		}

		return {width: maxWidth, height: maxHeight};
	},

	// getCustomPreview
	// Triggers the creation of a preview with the given id, of width X height size, of the [(tilePosX,tilePosY),
	// (tilePosX + tileWidth, tilePosY + tileHeight)] section of the document.
	getCustomPreview: function (id, part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, width: width, height: height, tilePosX: tilePosX,
			tilePosY: tilePosY, tileWidth: tileWidth, tileHeight: tileHeight, autoUpdate: autoUpdate, invalid: false};

		var mode = this._docLayer._selectedMode;
		this._addPreviewToQueue(part, 'tile ' +
							'nviewid=0' + ' ' +
							'part=' + part + ' ' +
							((mode !== 0) ? ('mode=' + mode + ' ') : '') +
							'width=' + width * app.roundedDpiScale + ' ' +
							'height=' + height * app.roundedDpiScale + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
							'broadcast=no');
		this._processPreviewQueue();
	},

	goToPage: function (page) {
		var docLayer = this._docLayer;
		if (page === 'prev') {
			if (docLayer._currentPage > 0) {
				docLayer._currentPage -= 1;
			}
		}
		else if (page === 'next') {
			if (docLayer._currentPage < docLayer._pages - 1) {
				docLayer._currentPage += 1;
			}
		}
		else if (typeof (page) === 'number' && page >= 0 && page < docLayer._pages) {
			docLayer._currentPage = page;
		}
		if (!this.isEditMode() && app.file.writer.pageRectangleList.length > docLayer._currentPage) {
			var pos = new L.Point(app.file.writer.pageRectangleList[docLayer._currentPage][0], app.file.writer.pageRectangleList[docLayer._currentPage][1]);
			pos = docLayer._twipsToCorePixels(pos);
			this.scrollTop(pos.y);
		}
		else {
			app.socket.sendMessage('setpage page=' + docLayer._currentPage);
		}
		this.fire('pagenumberchanged', {
			currentPage: docLayer._currentPage,
			pages: docLayer._pages,
			docType: docLayer._docType
		});
	},

	insertPage: function(nPos) {
		if (this.isPresentationOrDrawing()) {
			app.socket.sendMessage('uno .uno:InsertPage');
		}
		else if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Name': {
					'type': 'string',
					'value': ''
				},
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			app.socket.sendMessage('uno .uno:Insert ' + JSON.stringify(command));
		}
		else {
			return;
		}

		var docLayer = this._docLayer;

		// At least for Impress, we should not fire this. It causes a circular reference.
		if (!this.isPresentationOrDrawing()) {
			this.fire('insertpage', {
				selectedPart: docLayer._selectedPart,
				parts:        docLayer._parts
			});
		}

		docLayer._parts++;

		// Since we know which part we want to set, use the index (instead of 'next', 'prev')
		if (typeof nPos === 'number') {
			this.setPart(nPos);
		}
		else {
			this.setPart('next');
		}
	},

	duplicatePage: function() {
		if (!this.isPresentationOrDrawing()) {
			return;
		}
		app.socket.sendMessage('uno .uno:DuplicatePage');
		var docLayer = this._docLayer;

		// At least for Impress, we should not fire this. It causes a circular reference.
		if (!this.isPresentationOrDrawing()) {
			this.fire('insertpage', {
				selectedPart: docLayer._selectedPart,
				parts:        docLayer._parts
			});
		}

		docLayer._parts++;
		this.setPart('next');
	},

	deletePage: function (nPos) {
		if (this.isPresentationOrDrawing()) {
			app.socket.sendMessage('uno .uno:DeletePage');
		}
		else if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			app.socket.sendMessage('uno .uno:Remove ' + JSON.stringify(command));
		}
		else {
			return;
		}

		var docLayer = this._docLayer;
		// TO DO: Deleting all the pages causes problem.
		if (docLayer._parts === 1) {
			return;
		}

		if (this.getDocType() === 'spreadsheet' && docLayer._parts <= docLayer.hiddenParts() + 1) {
			return;
		}

		// At least for Impress, we should not fire this. It causes a circular reference.
		if (!this.isPresentationOrDrawing()) {
			this.fire('deletepage', {
				selectedPart: docLayer._selectedPart,
				parts:        docLayer._parts
			});
		}

		docLayer._parts--;
		if (docLayer._selectedPart >= docLayer._parts) {
			docLayer._selectedPart--;
		}

		if (typeof nPos === 'number') {
			this.setPart(nPos);
		}
		else {
			this.setPart(docLayer._selectedPart);
		}
	},

	renamePage: function (name, nPos) {
		if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Name': {
					'type': 'string',
					'value': name
				},
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			app.socket.sendMessage('uno .uno:Name ' + JSON.stringify(command));
			this.setPart(this._docLayer);
		}
	},

	showPage: function () {
		if (this.getDocType() === 'spreadsheet' && this.hasAnyHiddenPart()) {
			var partNames_ = this._docLayer._partNames;
			var hiddenParts_ = this._docLayer._hiddenParts;

			if (hiddenParts_.length > 0) {
				var container = document.createElement('div');
				container.style.maxHeight = '300px';
				container.style.overflowY = 'auto';
				for (var i = 0; i < hiddenParts_.length; i++) {
					var checkbox = document.createElement('input');
					checkbox.type = 'checkbox';
					checkbox.id = 'hidden-part-checkbox-' + String(hiddenParts_[i]);
					var label = document.createElement('label');
					label.htmlFor = 'hidden-part-checkbox-' + String(hiddenParts_[i]);
					label.innerText = partNames_[hiddenParts_[i]];
					var newLine = document.createElement('br');
					container.appendChild(checkbox);
					container.appendChild(label);
					container.appendChild(newLine);
				}
			}

			var callback = function() {
				var checkboxList = document.querySelectorAll('input[id^="hidden-part-checkbox"]');
				for (var i = 0; i < checkboxList.length; i++) {
					if (checkboxList[i].checked === true) {
						var partName_ = partNames_[parseInt(checkboxList[i].id.replace('hidden-part-checkbox-', ''))];
						var argument = {aTableName: {type: 'string', value: partName_}};
						app.socket.sendMessage('uno .uno:Show ' + JSON.stringify(argument));
					}
				}
			};

			this.uiManager.showInfoModal('show-sheets-modal', '', ' ', ' ', _('Close'), callback, true);
			document.getElementById('show-sheets-modal').querySelectorAll('p')[0].outerHTML = container.outerHTML;
		}
	},

	hidePage: function (tabNumber) {
		if (this.getDocType() === 'spreadsheet' && this.getNumberOfVisibleParts() > 1) {
			var argument = {nTabNumber: {type: 'int16', value: tabNumber}};
			app.socket.sendMessage('uno .uno:Hide ' + JSON.stringify(argument));
		}
	},

	isHiddenPart: function (part) {
		if (this.getDocType() !== 'spreadsheet')
			return false;
		return this._docLayer.isHiddenPart(part);
	},

	hasAnyHiddenPart: function () {
		if (this.getDocType() !== 'spreadsheet')
			return false;
		return this._docLayer.hasAnyHiddenPart();
	},

	getNumberOfParts: function () {
		return this._docLayer._parts;
	},

	getNumberOfVisibleParts: function () {
		return this.getNumberOfParts() - this._docLayer.hiddenParts();
	},

	getCurrentPartNumber: function () {
		return this._docLayer._selectedPart;
	},

	getDocSize: function () {
		return this._docLayer._docPixelSize;
	},

	getDocType: function () {
		if (!this._docLayer)
			return null;

		return this._docLayer._docType;
	},

	isPresentationOrDrawing: function () {
		return this.getDocType() === 'presentation' || this.getDocType() === 'drawing';
	}
});
