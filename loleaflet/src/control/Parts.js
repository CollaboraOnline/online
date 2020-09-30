/* -*- js-indent-level: 8 -*- */
/*
 * Document parts switching and selecting handler
 */

/* global vex $ _ */

L.Map.include({
	setPart: function (part, external, calledFromSetPartHandler) {
		var docLayer = this._docLayer;
		docLayer._prevSelectedPart = docLayer._selectedPart;
		docLayer._selectedParts = [];
		if (part === 'prev') {
			if (docLayer._selectedPart > 0) {
				docLayer._selectedPart -= 1;
			}
		}
		else if (part === 'next') {
			if (docLayer._selectedPart < docLayer._parts - 1) {
				docLayer._selectedPart += 1;
			}
		}
		else if (typeof (part) === 'number' && part >= 0 && part < docLayer._parts) {
			docLayer._selectedPart = part;
			docLayer._updateReferenceMarks();
		}
		else {
			return;
		}

		docLayer._selectedParts.push(docLayer._selectedPart);

		if (docLayer.isCursorVisible()) {
			// a click outside the slide to clear any selection
			this._socket.sendMessage('resetselection');
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
			this._socket.sendMessage('setclientpart part=' + docLayer._selectedPart);
		}
		docLayer.eachView(docLayer._viewCursors, docLayer._onUpdateViewCursor, docLayer);
		docLayer.eachView(docLayer._cellViewCursors, docLayer._onUpdateCellViewCursor, docLayer);
		docLayer.eachView(docLayer._graphicViewMarkers, docLayer._onUpdateGraphicViewSelection, docLayer);
		docLayer.eachView(docLayer._viewSelections, docLayer._onUpdateTextViewSelection, docLayer);
		docLayer._clearSelections(calledFromSetPartHandler);
		docLayer._updateOnChangePart();
		docLayer._pruneTiles();
		docLayer._prevSelectedPartNeedsUpdate = true;
		if (docLayer._invalidatePreview) {
			docLayer._invalidatePreview();
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
			this._socket.sendMessage('selectclientpart part=' + part + ' how=' + how);
		}
	},

	deselectAll: function() {
		var docLayer = this._docLayer;
		while (docLayer._selectedParts.length > 0) {
			this.selectPart(docLayer._selectedParts[0], 0, false);
		}
	},

	getPreview: function (id, index, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? !!options.autoUpdate : false;
		var forAllClients = options ? !!options.broadcast : false;
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
			var tileWidth = docLayer._docWidthTwips;
			var tileHeight = docLayer._docHeightTwips;
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

		var dpiscale = L.getDpiScaleFactor();
		if (forAllClients) {
			dpiscale = 2; // some may be hidpi, and it is fine to send the hi-dpi slide preview to non-hpi clients
		}

		if (fetchThumbnail) {
			this._socket.sendMessage('tile ' +
							'nviewid=0' + ' ' +
							'part=' + part + ' ' +
							'width=' + maxWidth * dpiscale + ' ' +
							'height=' + maxHeight * dpiscale + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
						 'broadcast=' + (forAllClients ? 'yes' : 'no'));
		}

		return {width: maxWidth, height: maxHeight};
	},

	getCustomPreview: function (id, part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, width: width, height: height, tilePosX: tilePosX,
			tilePosY: tilePosY, tileWidth: tileWidth, tileHeight: tileHeight, autoUpdate: autoUpdate, invalid: false};

		var dpiscale = L.getDpiScaleFactor();

		this._socket.sendMessage('tile ' +
							'nviewid=0' + ' ' +
							'part=' + part + ' ' +
							'width=' + width * dpiscale + ' ' +
							'height=' + height * dpiscale + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
							'broadcast=no');
	},

	removePreviewUpdate: function (id) {
		if (this._docPreviews && this._docPreviews[id]) {
			this._docPreviews[id].autoUpdate = false;
		}
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
		if (!this.isPermissionEdit() && docLayer._partPageRectanglesPixels.length > docLayer._currentPage) {
			// we can scroll to the desired page without having a LOK instance
			var pageBounds = docLayer._partPageRectanglesPixels[docLayer._currentPage];
			var pos = new L.Point(
					pageBounds.min.x + (pageBounds.max.x - pageBounds.min.x) / 2,
					pageBounds.min.y);
			pos.y -= this.getSize().y / 4; // offset by a quater of the viewing area so that the previous page is visible
			this.scrollTop(pos.y, {update: true});
			this.scrollLeft(pos.x, {update: true});
		}
		else {
			this._socket.sendMessage('setpage page=' + docLayer._currentPage);
		}
		this.fire('pagenumberchanged', {
			currentPage: docLayer._currentPage,
			pages: docLayer._pages,
			docType: docLayer._docType
		});
	},

	insertPage: function(nPos) {
		if (this.getDocType() === 'presentation') {
			this._socket.sendMessage('uno .uno:InsertPage');
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

			this._socket.sendMessage('uno .uno:Insert ' + JSON.stringify(command));
		}
		else {
			return;
		}

		var docLayer = this._docLayer;

		// At least for Impress, we should not fire this. It causes a circular reference.
		if (this.getDocType() !== 'presentation') {
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
		if (this.getDocType() !== 'presentation') {
			return;
		}
		this._socket.sendMessage('uno .uno:DuplicatePage');
		var docLayer = this._docLayer;

		// At least for Impress, we should not fire this. It causes a circular reference.
		if (this.getDocType() !== 'presentation') {
			this.fire('insertpage', {
				selectedPart: docLayer._selectedPart,
				parts:        docLayer._parts
			});
		}

		docLayer._parts++;
		this.setPart('next');
	},

	deletePage: function (nPos) {
		if (this.getDocType() === 'presentation') {
			this._socket.sendMessage('uno .uno:DeletePage');
		}
		else if (this.getDocType() === 'spreadsheet') {
			var command = {
				'Index': {
					'type': 'long',
					'value': nPos + 1
				}
			};

			this._socket.sendMessage('uno .uno:Remove ' + JSON.stringify(command));
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
		if (this.getDocType() !== 'presentation') {
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

			this._socket.sendMessage('uno .uno:Name ' + JSON.stringify(command));
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
				container.style.maxWidth = '200px';
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

			var socket_ = this._socket;
			vex.dialog.open({
				unsafeMessage: container.outerHTML,
				buttons: [
					$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') }),
					$.extend({}, vex.dialog.buttons.YES, { text: _('OK') })
				],
				callback: function (value) {
					if (value === true) {
						var checkboxList = document.querySelectorAll('input[id^="hidden-part-checkbox"]');
						for (var i = 0; i < checkboxList.length; i++) {
							if (checkboxList[i].checked === true) {
								var partName_ = partNames_[parseInt(checkboxList[i].id.replace('hidden-part-checkbox-', ''))];
								var argument = {aTableName: {type: 'string', value: partName_}};
								socket_.sendMessage('uno .uno:Show ' + JSON.stringify(argument));
							}
						}
					}
				}
			});
		}
	},

	hidePage: function (tabNumber) {
		if (this.getDocType() === 'spreadsheet' && this.getNumberOfVisibleParts() > 1) {
			var argument = {nTabNumber: {type: 'int16', value: tabNumber}};
			this._socket.sendMessage('uno .uno:Hide ' + JSON.stringify(argument));
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

	getNumberOfPages: function () {
		return this._docLayer._pages;
	},

	getNumberOfParts: function () {
		return this._docLayer._parts;
	},

	getNumberOfVisibleParts: function () {
		return this.getNumberOfParts() - this._docLayer.hiddenParts();
	},

	getHiddenPartNames: function () {
		var partNames = this._docLayer._partNames;
		var names = [];
		for (var i = 0; i < partNames.length; ++i) {
			if (this.isHiddenPart(i))
				names.push(partNames[i]);
		}
		return names.join(',');
	},

	getCurrentPageNumber: function () {
		return this._docLayer._currentPage;
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
	}
});
