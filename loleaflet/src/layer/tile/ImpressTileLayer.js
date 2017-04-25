/* -*- js-indent-level: 8 -*- */
/*
 * Impress tile layer is used to display a presentation document
 */

L.ImpressTileLayer = L.TileLayer.extend({

	newAnnotation: function (comment) {
		var annotation = L.annotation(this._map.getCenter(), comment, {noMenu: true}).addTo(this._map);
		annotation.edit();
		annotation.focus();
	},

	beforeAdd: function (map) {
		map.on('updateparts', this.onUpdateParts, this);
		map.on('AnnotationCancel', this.onAnnotationCancel, this);
		map.on('AnnotationReply', this.onReplyClick, this);
		map.on('AnnotationSave', this.onAnnotationSave, this);
		map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);
	},

	getAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id === id) {
				return annotations[index];
			}
		}
		return null;
	},

	hideAnnotations: function (part) {
		var annotations = this._annotations[this._partHashes[part]];
		for (var index in annotations) {
			annotations[index].hide();
		}
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
		this._topAnnotation = 0;
	},

	onAnnotationCancel: function (e) {
		this._map.removeLayer(e.annotation);
		this._map.focus();
	},

	onAnnotationModify: function (annotation) {
		var draft = L.annotation(this._map.getCenter(), annotation._data).addTo(this._map);
		draft.edit();
		draft.focus();
	},

	onAnnotationReply: function (annotation) {
		var draft = L.annotation(this._map.getCenter(), annotation._data).addTo(this._map);
		draft.reply();
		draft.focus();
	},

	onAnnotationRemove: function (id) {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this._map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		this._map.focus();
	},

	onAnnotationSave: function (e) {
		var comment;
		if (e.annotation._data.id === 'new') {
			comment = {
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: e.annotation._data.id
				},
				Text: {
					type: 'string',
					value: e.annotation._data.text
				}
			};
			this._map.sendUnoCommand('.uno:EditAnnotation', comment);
		}
		this._map.removeLayer(e.annotation);
		this._map.focus();
	},

	onReplyClick: function (e) {
		var comment = {
			Id: {
				type: 'string',
				value: e.annotation._data.id
			},
			Text: {
				type: 'string',
				value: e.annotation._data.reply
			}
		};
		this._map.sendUnoCommand('.uno:ReplyToAnnotation', comment);
		this._map.removeLayer(e.annotation);
		this._map.focus();
	},

	onAnnotationScrollDown: function (e) {
		this._topAnnotation = Math.min(++this._topAnnotation, this._annotations[this._partHashes[this._selectedPart]].length - 1);
		this.layoutAnnotations();
	},

	onAnnotationScrollUp: function (e) {
		this._topAnnotation = Math.max(--this._topAnnotation, 0);
		this.layoutAnnotations();
	},

	onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number') {
			this.hideAnnotations(this._prevSelectedPart);
			this.layoutAnnotations();
		}
	},

	removeAnnotation: function (id) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		for (var index in annotations) {
			if (annotations[index]._data.id == id) {
				this._map.removeLayer(annotations[index]);
				annotations.splice(index, 1);
				break;
			}
		}
	},

	layoutAnnotations: function () {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		var topRight = this._map.latLngToLayerPoint(this._map.options.maxBounds.getNorthEast()).add(L.point(this.options.marginX, this.options.marginY));
		var bounds, annotation;
		for (var index in annotations) {
			annotation = annotations[index];
			if (index >= this._topAnnotation) {
				annotation.setLatLng(bounds ? this._map.layerPointToLatLng(bounds.getBottomLeft()) : this._map.layerPointToLatLng(topRight));
				bounds = annotation.getBounds();
				bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
				annotation.show();
			} else {
				annotation.hide();
			}
		}
		if (bounds) {
			if (!this._scrollAnnotation) {
				this._scrollAnnotation = L.control.scroll.annotation();
				this._scrollAnnotation.addTo(this._map);
			}
		} else if (this._scrollAnnotation) {
			this._map.removeControl(this._scrollAnnotation);
			this._scrollAnnotation = null;
		}
	},

	_onCommandValuesMsg: function (textMsg) {
		try {
			var values = JSON.parse(textMsg.substring(textMsg.indexOf('{')));
		} catch (e) {
			// One such case is 'commandvalues: ' for draw documents in response to .uno:AcceptTrackedChanges
			values = null;
		}

		if (!values) {
			return;
		}

		if (values.comments) {
			this._annotations = {};
			for (var index in values.comments) {
				comment = values.comments[index];
				if (!this._annotations[comment.parthash]) {
					this._annotations[comment.parthash] = [];
				}
				this._annotations[comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), comment).addTo(this._map));
			}
			this._topAnnotation = 0;
			this.layoutAnnotations();
		} else {
			L.TileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onMessage: function (textMsg, img) {
		if (textMsg.startsWith('comment:')) {
			var obj = JSON.parse(textMsg.substring('comment:'.length + 1));
			if (obj.comment.action === 'Add') {
				if (!this._annotations[obj.comment.parthash]) {
					this._annotations[obj.comment.parthash] = [];
				}
				this._annotations[obj.comment.parthash].push(L.annotation(this._map.options.maxBounds.getSouthEast(), obj.comment).addTo(this._map));
				this._topAnnotation = Math.min(this._topAnnotation, this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Remove') {
				this.removeAnnotation(obj.comment.id);
				this._topAnnotation = Math.min(this._topAnnotation, this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Modify') {
				var modified = this.getAnnotation(obj.comment.id);
				if (modified) {
					modified._data = obj.comment;
					modified.update();
				}
			}
		} else {
			L.TileLayer.prototype._onMessage.call(this, textMsg, img);
		}
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
		var oldHashes = '';
		var needsNewTiles = false;

		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var tileTopLeft = this._coordsToTwips(coords);
			var tileBottomRight = new L.Point(this._tileWidthTwips, this._tileHeightTwips);
			var bounds = new L.Bounds(tileTopLeft, tileTopLeft.add(tileBottomRight));
			if (coords.part === command.part && invalidBounds.intersects(bounds)) {
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
					if (oldHashes !== '') {
						oldHashes += ',';
					}
					if (this._tiles[key].oldhash === undefined) {
						oldHashes += '0';
					}
					else {
						oldHashes += this._tiles[key].oldhash;
					}
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
				'tileheight=' + this._tileHeightTwips + ' ' +
				'oldhash=' + oldHashes;

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
		if (command.part === this._selectedPart &&
			command.part !== this._lastValidPart) {
			this._map.fire('updatepart', {part: this._lastValidPart, docType: this._docType});
			this._lastValidPart = command.part;
			this._map.fire('updatepart', {part: command.part, docType: this._docType});
		}

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._map.setPart(part, true);
			this._map.fire('setpart', {selectedPart: this._selectedPart});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = this._map._socket.parseServerCmd(textMsg);
		if (command.width && command.height && this._documentInfo !== textMsg) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			this._docType = command.type;
			if (this._docType === 'drawing') {
				L.DomUtil.addClass(L.DomUtil.get('presentation-controls-wrapper'), 'drawing');
			}
			this._updateMaxBounds(true);
			this._documentInfo = textMsg;
			this._parts = command.parts;
			this._viewId = parseInt(command.viewid);
			this._selectedPart = command.selectedPart;
			this._resetPreFetching(true);
			this._update();
			if (this._preFetchPart !== this._selectedPart) {
				this._preFetchPart = this._selectedPart;
				this._preFetchBorder = null;
			}
			var partMatch = textMsg.match(/[^\r\n]+/g);
			// only get the last matches
			this._partHashes = partMatch.slice(partMatch.length - this._parts);
			this._map.fire('updateparts', {
				selectedPart: this._selectedPart,
				parts: this._parts,
				docType: this._docType,
				partNames: this._partHashes
			});
		}
	}
});
