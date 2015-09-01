/*
 * Document parts switching handler
 */
L.Map.include({
	setPart: function (part) {
		var docLayer = this._docLayer;
		if (part === 'prev') {
			if (docLayer._currentPart > 0) {
				docLayer._currentPart -= 1;
			}
		}
		else if (part === 'next') {
			if (docLayer._currentPart < docLayer._parts - 1) {
				docLayer._currentPart += 1;
			}
		}
		else if (typeof (part) === 'number' && part >= 0 && part < docLayer._parts) {
			docLayer._currentPart = part;
		}
		else {
			return;
		}
		if (docLayer._isCursorOverlayVisible) {
			// a click outside the slide to clear any selection
			L.Socket.sendMessage('resetselection');
		}
		this.fire('updateparts', {
			currentPart: docLayer._currentPart,
			parts: docLayer._parts,
			docType: docLayer._docType
		});
		L.Socket.sendMessage('setclientpart part=' + docLayer._currentPart);
		docLayer._update();
		docLayer._pruneTiles();
		docLayer._clearSelections();
	},

	getPartPreview: function (id, part, maxWidth, maxHeight) {
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

	getDocPreview: function (id, maxWidth, maxHeight, x, y, width, height) {
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
		return this._docLayer._currentPart;
	},

	getDocSize: function () {
		return this._docLayer._docPixelSize;
	},

	getDocType: function () {
		return this._docLayer._docType;
	}
});
