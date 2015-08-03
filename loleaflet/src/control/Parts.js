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
		this.fire('updateparts', {
			currentPart: docLayer._currentPart,
			parts: docLayer._parts,
			docType: docLayer._docType
		});
		docLayer.sendMessage('setclientpart part=' + docLayer._currentPart);
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
		docLayer.sendMessage('tile ' +
							'part=' + part + ' ' +
							'width=' + maxWidth + ' ' +
							'height=' + maxHeight + ' ' +
							'tileposx=0 tileposy=0 ' +
							'tilewidth=' + docLayer._docWidthTwips + ' ' +
							'tileheight=' + docLayer._docHeightTwips + ' ' +
							'id=' + id);
	},

	goToPage: function (page) {
		var docLayer = this._docLayer;
		if (page < 0 || page >= docLayer._pages) {
			return;
		}
		docLayer._currentPage = page;
		docLayer.sendMessage('setpage page=' + page);
	},

	getNumberOfPages: function () {
		return this._docLayer._pages;
	}
});
