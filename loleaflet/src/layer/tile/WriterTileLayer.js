/*
 * Writer tile layer is used to display a text document
 */

L.WriterTileLayer = L.TileLayer.extend({

	_onInvalidateTilesMsg: function (textMsg) {
		var command = L.Socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		command.part = 0;
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var toRequest = [];

		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (invalidBounds.intersects(bounds) && coords.part === command.part) {
				if (this._tiles[key]._invalidCount) {
					this._tiles[key]._invalidCount += 1;
				}
				else {
					this._tiles[key]._invalidCount = 1;
				}
				if (visibleArea.intersects(bounds)) {
					var msg = 'tile ' +
							'part=' + coords.part + ' ' +
							'width=' + this._tileSize + ' ' +
							'height=' + this._tileSize + ' ' +
							'tileposx=' + tileTopLeft.x + ' '    +
							'tileposy=' + tileTopLeft.y + ' ' +
							'tilewidth=' + this._tileWidthTwips + ' ' +
							'tileheight=' + this._tileHeightTwips;
					toRequest.push({msg: msg, key: key, coords: coords});
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		// Sort tiles so that we request those closer to the cursor first
		var cursorPos = this._map.project(this._visibleCursor.getNorthWest());
		cursorPos = cursorPos.divideBy(this._tileSize);
		toRequest.sort(function(x, y) {return x.coords.distanceTo(cursorPos) - y.coords.distanceTo(cursorPos);});
		for (var i = 0; i < toRequest.length; i++) {
			L.Socket.sendMessage(toRequest[i].msg, toRequest[i].key);
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			var scale = this._map.getZoomScale(coords.z);
			topLeftTwips = new L.Point(
					this.options.tileWidthTwips / scale * coords.x,
					this.options.tileHeightTwips / scale * coords.y);
			bottomRightTwips = topLeftTwips.add(new L.Point(
					this.options.tileWidthTwips / scale,
					this.options.tileHeightTwips / scale));
			bounds = new L.Bounds(topLeftTwips, bottomRightTwips);
			if (invalidBounds.intersects(bounds)) {
				delete this._tileCache[key];
			}
		}
		if (!this._previewInvalidations) {
			this._previewInvalidations = [];
		}
		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreview, this), 1000);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		this._currentPage = part;
		this._map.fire('pagenumberchanged', {
			currentPage: part,
			pages: this._pages,
			docType: this._docType
		});
	},

	_onStatusMsg: function (textMsg) {
		var command = L.Socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._updateMaxBounds(true);
			this._documentInfo = textMsg;
			this._selectedPart = 0;
			this._parts = 1;
			this._currentPage = command.selectedPart;
			this._pages = command.parts;
			this._map.fire('pagenumberchanged', {
				currentPage: this._currentPage,
				pages: this._pages,
				docType: this._docType
			});
			this._resetPreFetching(true);
			this._update();
		}
	},

	_invalidatePreview: function () {
		// invalidate writer page previews
		if (this._map._docPreviews && this._previewInvalidations) {
			var toInvalidate = {};
			for (var i = 0; i < this._previewInvalidations.length; i++) {
				var invalidBounds = this._previewInvalidations[i];
				var invalidPixBounds = new L.Bounds(
						invalidBounds.min.divideBy(this.options.tileWidthTwips).multiplyBy(this._tileSize),
						invalidBounds.max.divideBy(this.options.tileWidthTwips).multiplyBy(this._tileSize));

				for (var key in this._map._docPreviews) {
					// find preview tiles that need to be updated and add them in a set
					var preview = this._map._docPreviews[key];
					var bounds = new L.Bounds(new L.Point(preview.x, preview.y),
											  new L.Point(preview.x + preview.width, preview.y + preview.height));
					if (invalidPixBounds.intersects(bounds)) {
						toInvalidate[key] = true;
					}
				}

				for (key in toInvalidate) {
					// update invalid preview tiles
					preview = this._map._docPreviews[key];
					if (preview.autoUpdate) {
						this._map.getDocPreview(preview.id, preview.maxWidth, preview.maxHeight,
								preview.x, preview.y, preview.width, preview.height, {autoUpdate: true});
					}
					else {
						this._map.fire('invalidatepreview', {id: preview.id});
					}
				}
			}
		}
		this._previewInvalidations = [];
	}
});
