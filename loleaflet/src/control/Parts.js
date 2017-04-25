/*
 * Document parts switching handler
 */
L.Map.include({
	setPart: function (part, external) {
		var docLayer = this._docLayer;
		docLayer._prevSelectedPart = docLayer._selectedPart;
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
		}
		else {
			return;
		}
		if (docLayer._isCursorOverlayVisible) {
			// a click outside the slide to clear any selection
			this._socket.sendMessage('resetselection');
		}
		this.fire('updateparts', {
			selectedPart: docLayer._selectedPart,
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
		docLayer._clearSelections();
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
		if (docLayer._docType === 'spreadsheet')
			this.fire('updaterowcolumnheaders', {x: this._getTopLeftPoint().x, y: this._getTopLeftPoint(), offset: {x: undefined, y: undefined}});
	},

	getPreview: function (id, index, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? !!options.autoUpdate : false;
		var forAllClients = options ? !!options.broadcast : false;
		this._docPreviews[id] = {id: id, index: index, maxWidth: maxWidth, maxHeight: maxHeight, autoUpdate: autoUpdate};

		var docLayer = this._docLayer;
		if (docLayer._docType === 'text') {
			return;
		}
		else {
			part = index;
			tilePosX = 0;
			tilePosY = 0;
			tileWidth = docLayer._docWidthTwips;
			tileHeight = docLayer._docHeightTwips;
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
		this._socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id + ' ' +
							'broadcast=' + (forAllClients ? 'yes' : 'no'));
	},

	getCustomPreview: function (id, part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, width: width, height: height, tilePosX: tilePosX,
			tilePosY: tilePosY, tileWidth: tileWidth, tileHeight: tileHeight, autoUpdate: autoUpdate};
		this._socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + width + ' ' +
							'height=' + height + ' ' +
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
		if (this._permission !== 'edit' && docLayer._partPageRectanglesPixels.length > docLayer._currentPage) {
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

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

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

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

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

		this.fire('deletepage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

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

	getNumberOfPages: function () {
		return this._docLayer._pages;
	},

	getNumberOfParts: function () {
		return this._docLayer._parts;
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
