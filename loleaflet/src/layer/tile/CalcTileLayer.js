/*
 * Calc tile layer is used to display a spreadsheet document
 */

L.CalcTileLayer = L.TileLayer.extend({
	STD_EXTRA_WIDTH: 113, /* 2mm extra for optimal width,
                              * 0.1986cm with TeX points,
                              * 0.1993cm with PS points. */

	twipsToHMM: function (twips) {
		return (twips * 127 + 36) / 72;
	},

	beforeAdd: function (map) {
		map._addZoomLimit(this);
		map.on('zoomend', this._onZoomRowColumns, this);
		map.on('resize', this._onUpdateViewPort, this);
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}
		if (this._docType === 'text') {
			command.part = 0;
		}
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug) {
			this._debugAddInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);

		var tilePositionsX = '';
		var tilePositionsY = '';
		var needsNewTiles = false;

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
					if (tilePositionsX !== '') {
						tilePositionsX += ',';
					}
					tilePositionsX += tileTopLeft.x;
					if (tilePositionsY !== '') {
						tilePositionsY += ',';
					}
					tilePositionsY += tileTopLeft.y;
					needsNewTiles = true;
					if (this._debug) {
						this._debugAddInvalidationData(this._tiles[key]);
					}
				}
				else {
					// tile outside of the visible area, just remove it
					this._preFetchBorder = null;
					this._removeTile(key);
				}
			}
		}

		if (needsNewTiles && command.part === this._selectedPart)
		{
			var message = 'tilecombine ' +
				'part=' + command.part + ' ' +
				'width=' + this._tileWidthPx + ' ' +
				'height=' + this._tileHeightPx + ' ' +
				'tileposx=' + tilePositionsX + ' ' +
				'tileposy=' + tilePositionsY + ' ' +
				'tilewidth=' + this._tileWidthTwips + ' ' +
				'tileheight=' + this._tileHeightTwips;

			this._map._socket.sendMessage(message, '');
			if (this._debug) {
				this._debugAddInvalidationMessage(message);
			}
		}

		for (key in this._tileCache) {
			// compute the rectangle that each tile covers in the document based
			// on the zoom level
			coords = this._keyToTileCoords(key);
			if (coords.part !== command.part) {
				continue;
			}
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

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
			this._map._socket.sendMessage('commandvalues command=.uno:ViewRowColumnHeaders');
		}
	},

	_onZoomRowColumns: function () {
		this._updateClientZoom();
		if (this._clientZoom) {
			this._map._socket.sendMessage('clientzoom ' + this._clientZoom);
			this._clientZoom = null;
		}
		this._map._socket.sendMessage('commandvalues command=.uno:ViewRowColumnHeaders');
	},

	_onUpdateViewPort: function () {
		var width = parseInt(L.DomUtil.getStyle(this._map._container, 'width'));
		var height = parseInt(L.DomUtil.getStyle(this._map._container, 'height'));
		this._map.fire('updateviewport', {
			rows: {
				totalHeight: this._docPixelSize.y,
				viewPort: height
			},
			columns: {
				totalWidth: this._docPixelSize.x,
				viewPort: width
			}
		});
	},

	_onUpdateSelectionHeader: function () {
		var layers = this._selections.getLayers();
		var layer = layers.pop();
		if (layers.length === 0 && layer && layer.getLatLngs().length === 1) {
			var start = this._latLngToTwips(layer.getBounds().getNorthWest()).add([1, 1]);
			var end = this._latLngToTwips(layer.getBounds().getSouthEast()).subtract([1, 1]);
			this._map.fire('updateselectionheader', {start: start, end: end});
		}
		else {
			this._map.fire('clearselectionheader');
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			this._parts = command.parts;
			this._selectedPart = command.selectedPart;
			this._viewId = parseInt(command.viewid);
			var mapSize = this._map.getSize();
			var width = this._docWidthTwips / this._tileWidthTwips * this._tileSize;
			var height = this._docHeightTwips / this._tileHeightTwips * this._tileSize;
			if (width < mapSize.x || height < mapSize.y) {
				width = Math.max(width, mapSize.x);
				height = Math.max(height, mapSize.y);
				var topLeft = this._map.unproject(new L.Point(0, 0));
				var bottomRight = this._map.unproject(new L.Point(width, height));
				this._map.setMaxBounds(new L.LatLngBounds(topLeft, bottomRight));
				this._docPixelSize = {x: width, y: height};
				this._map.fire('docsize', {x: width, y: height});
			}
			else {
				this._updateMaxBounds(true);
			}
			this._documentInfo = textMsg;
			var partNames = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			partNames = partNames.slice(partNames.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				partNames: partNames
			});
			this._resetPreFetching(true);
			this._update();
			if (this._preFetchPart !== this._selectedPart) {
				this._preFetchPart = this._selectedPart;
				this._preFetchBorder = null;
			}
		}

		// Force fetching of row/column headers
		this._onZoomRowColumns();
	},

	_onCommandValuesMsg: function (textMsg) {
		if (textMsg.match('.uno:ViewRowColumnHeaders')) {
			var data = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
			this._map.fire('viewrowcolumnheaders', {
				data: data,
				converter: this._twipsToPixels,
				context: this
			});
			this._onUpdateViewPort();
			this._onUpdateSelectionHeader();
		}
		else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onTextSelectionMsg: function (textMsg) {
		L.TileLayer.prototype._onTextSelectionMsg.call(this, textMsg);
		this._onUpdateSelectionHeader();
	},

	_onCellCursorMsg: function (textMsg) {
		var pos = new L.Point(-1, -1);
		L.TileLayer.prototype._onCellCursorMsg.call(this, textMsg);
		if (this._cellCursor && !this._isEmptyRectangle(this._cellCursor)) {
			pos = this._cellCursorTwips.min.add([1, 1]);
		}
		this._map.fire('updatecurrentheader', pos);
	}
});
