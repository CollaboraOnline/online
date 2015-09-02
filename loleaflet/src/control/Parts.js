/*
 * Document parts switching handler
 */
L.Map.include({
	setPart: function (part) {
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
			L.Socket.sendMessage('resetselection');
		}
		this.fire('updateparts', {
			selectedPart: docLayer._selectedPart,
			parts: docLayer._parts,
			docType: docLayer._docType
		});
		L.Socket.sendMessage('setclientpart part=' + docLayer._selectedPart);
		docLayer._update();
		docLayer._pruneTiles();
		docLayer._clearSelections();
		docLayer._prevSelectedPartNeedsUpdate = true;
		if (docLayer._invalidatePreview) {
			docLayer._invalidatePreview();
		}
	},

	getPartPreview: function (id, part, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, maxWidth: maxWidth, maxHeight: maxHeight, autoUpdate: autoUpdate};

		var docLayer = this._docLayer;
		var docRatio = docLayer._docWidthTwips / docLayer._docHeightTwips;
		var imgRatio = maxWidth / maxHeight;
		// fit into the given rectangle while maintaining the ratio
		if (imgRatio > docRatio) {
			maxWidth = Math.round(docLayer._docWidthTwips * maxHeight / docLayer._docHeightTwips);
		}
		else {
			maxHeight = Math.round(docLayer._docHeightTwips * maxWidth / docLayer._docWidthTwips);
		}
		L.Socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=0 tileposy=0 ' +
							'tilewidth=' + docLayer._docWidthTwips + ' ' +
							'tileheight=' + docLayer._docHeightTwips + ' ' +
							'id=' + id);
	},

	getDocPreview: function (id, maxWidth, maxHeight, x, y, width, height, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, maxWidth: maxWidth, maxHeight: maxHeight, x: x, y: y,
			width: width, height: height, autoUpdate: autoUpdate};

		var docLayer = this._docLayer;
		var docRatio = width / height;
		var imgRatio = maxWidth / maxHeight;
		// fit into the given rectangle while maintaining the ratio
		if (imgRatio > docRatio) {
			maxWidth = Math.round(width * maxHeight / height);
		}
		else {
			maxHeight = Math.round(height * maxWidth / width);
		}
		x = Math.round(x / docLayer._tileSize * docLayer._tileWidthTwips);
		width = Math.round(width / docLayer._tileSize * docLayer._tileWidthTwips);
		y = Math.round(y / docLayer._tileSize * docLayer._tileHeightTwips);
		height = Math.round(height / docLayer._tileSize * docLayer._tileHeightTwips);

		L.Socket.sendMessage('tile ' +
							'part=0 ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=' + x + ' ' +
							'tileposy=' + y + ' ' +
							'tilewidth=' + width + ' ' +
							'tileheight=' + height + ' ' +
							'id=' + id);
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
		L.Socket.sendMessage('setpage page=' + docLayer._currentPage);
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
		return this._docLayer._docType;
	}
});
