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
		docLayer._clearSelections();
		docLayer._update();
		docLayer._pruneTiles();
		docLayer._prevSelectedPartNeedsUpdate = true;
		if (docLayer._invalidatePreview) {
			docLayer._invalidatePreview();
		}
	},

	getPreview: function (id, index, maxWidth, maxHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, index: index, maxWidth: maxWidth, maxHeight: maxHeight, autoUpdate: autoUpdate};

		var docLayer = this._docLayer;
		if (docLayer._docType === 'text') {
			if (index >= docLayer._partPageRectanglesTwips.length) {
				return;
			}
			var part = 0;
			var tilePosX = docLayer._partPageRectanglesTwips[index].min.x;
			var tilePosY = docLayer._partPageRectanglesTwips[index].min.y;
			var tileWidth = docLayer._partPageRectanglesTwips[index].max.x - tilePosX;
			var tileHeight = docLayer._partPageRectanglesTwips[index].max.y - tilePosY;
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
		L.Socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
							'id=' + id);
	},

	getCustomPreview: function (id, part, width, height, tilePosX, tilePosY, tileWidth, tileHeight, options) {
		if (!this._docPreviews) {
			this._docPreviews = {};
		}
		var autoUpdate = options ? options.autoUpdate : false;
		this._docPreviews[id] = {id: id, part: part, width: width, height: height, tilePosX: tilePosX,
			tilePosY: tilePosY, tileWidth: tileWidth, tileHeight: tileHeight, autoUpdate: autoUpdate};
		L.Socket.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + width + ' ' +
							'height=' + height + ' ' +
							'tileposx=' + tilePosX + ' ' +
							'tileposy=' + tilePosY + ' ' +
							'tilewidth=' + tileWidth + ' ' +
							'tileheight=' + tileHeight + ' ' +
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
		if (docLayer._permission !== 'edit' && docLayer._partPageRectanglesPixels.length > docLayer._currentPage) {
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
			L.Socket.sendMessage('setpage page=' + docLayer._currentPage);
		}
		this.fire('pagenumberchanged', {
			currentPage: docLayer._currentPage,
			pages: docLayer._pages,
			docType: docLayer._docType
		});
	},

	insertPage: function() {
		if (this.getDocType() !== 'presentation') {
			return;
		}
		L.Socket.sendMessage('uno .uno:InsertPage');
		var docLayer = this._docLayer;

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

		docLayer._parts++;
		this.setPart('next');
	},

	duplicatePage: function() {
		if (this.getDocType() !== 'presentation') {
			return;
		}
		L.Socket.sendMessage('uno .uno:DuplicatePage');
		var docLayer = this._docLayer;

		this.fire('insertpage', {
			selectedPart: docLayer._selectedPart,
			parts:        docLayer._parts
		});

		docLayer._parts++;
		this.setPart('next');
	},

	deletePage: function () {
		if (this.getDocType() !== 'presentation') {
			return;
		}

		L.Socket.sendMessage('uno .uno:DeletePage');
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

		this.setPart(docLayer._selectedPart);
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

	getPageSizes: function () {
		return {
			twips: this._docLayer._partPageRectanglesTwips,
			pixels: this._docLayer._partPageRectanglesPixels};
	},

	getDocType: function () {
		return this._docLayer._docType;
	}
});
