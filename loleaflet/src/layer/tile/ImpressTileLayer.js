/* -*- js-indent-level: 8 -*- */
/*
 * Impress tile layer is used to display a presentation document
 */

L.ImpressTileLayer = L.TileLayer.extend({
	extraSize: L.point(290, 0),

	newAnnotation: function (comment) {
		if (this._draft) {
			return;
		}
		this.onAnnotationCancel();
		this._draft = L.annotation(L.latLng(0, 0), comment, {noMenu: true}).addTo(this._map);
		this._draft.edit();
		var mapCenter = this._map.latLngToLayerPoint(this._map.getCenter());
		var bounds = this._draft.getBounds();
		var topLeft = mapCenter.subtract(L.point(bounds.max.x - bounds.min.x, (bounds.max.y - bounds.min.y)/2));
		this._draft.setLatLng(this._map.layerPointToLatLng(topLeft));
		this.layoutAnnotations();
		this._draft.focus();
	},

	beforeAdd: function (map) {
		map.on('zoomend', this._onAnnotationZoom, this);
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
		this._selectedAnnotation = undefined;
		var annotations = this._annotations[this._partHashes[part]];
		for (var index in annotations) {
			annotations[index].hide();
		}
	},

	hasAnnotations: function (part) {
		var annotations = this._annotations[this._partHashes[part]];
		return annotations && annotations.length > 0;
	},

	updateDocBounds: function (count, extraSize) {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		if (annotations && annotations.length === count) {
			this._map._docLayer._updateMaxBounds(true, extraSize);
		}
	},

	onAdd: function (map) {
		L.TileLayer.prototype.onAdd.call(this, map);
		this._annotations = {};
		this._topAnnotation = [];
		this._topAnnotation[this._selectedPart] = 0;
		this._selectedAnnotation = undefined;
		this._draft = null;
	},

	onAnnotationCancel: function (e) {
		if (this._draft) {
			this._map.removeLayer(this._draft);
			this._draft = null;
		}
		this._map.focus();
		this._selectedAnnotation = undefined;
		this.layoutAnnotations();
	},

	onAnnotationModify: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.edit();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationReply: function (annotation) {
		this.onAnnotationCancel();
		this._selectedAnnotation = annotation._data.id;
		annotation.reply();
		this.scrollUntilAnnotationIsVisible(annotation);
		annotation.focus();
	},

	onAnnotationRemove: function (id) {
		this.onAnnotationCancel();
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
		if (this._draft) {
			comment = {
				Text: {
					type: 'string',
					value: this._draft._data.text
				}
			};
			this._map.sendUnoCommand('.uno:InsertAnnotation', comment);
			this._map.removeLayer(this._draft);
			this._draft = null;
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
			this._selectedAnnotation = undefined;
		}
		this._map.focus();
	},

	_onAnnotationZoom: function (e) {
		this.onAnnotationCancel();
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
		this._selectedAnnotation = undefined;
		this._map.focus();
	},

	onAnnotationScrollDown: function (e) {
		this._topAnnotation[this._selectedPart] = Math.min(++this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
		this.onAnnotationCancel();
	},

	onAnnotationScrollUp: function (e) {
		if (this._topAnnotation[this._selectedPart] === 0) {
			this._map.fire('scrollby', {x: 0, y: -100});
		}
		this._topAnnotation[this._selectedPart] = Math.max(--this._topAnnotation[this._selectedPart], 0);
		this.onAnnotationCancel();
	},

	onUpdateParts: function (e) {
		if (typeof this._prevSelectedPart === 'number') {
			this.hideAnnotations(this._prevSelectedPart);
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
				if (this._topAnnotation[this._selectedPart] === undefined) {
					this._topAnnotation[this._selectedPart] = 0;
				}
				this.onAnnotationCancel();
			}
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

	scrollUntilAnnotationIsVisible: function(annotation) {
		var bounds = annotation.getBounds();
		var mapBounds = this._map.getBounds();
		if (this._map.layerPointToLatLng(bounds.getTopRight()).lat > mapBounds.getNorth()) {
			this._topAnnotation[this._selectedPart] = Math.max(this._topAnnotation[this._selectedPart] - 2, 0);
		}
		else if (this._map.layerPointToLatLng(bounds.getBottomLeft()).lat < mapBounds.getSouth()) {
			this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart] + 2, this._annotations[this._partHashes[this._selectedPart]].length - 1);
		}
		this.layoutAnnotations();
	},

	layoutAnnotations: function () {
		var annotations = this._annotations[this._partHashes[this._selectedPart]];
		var scale = this._map.getZoomScale(this._map.getZoom(), 10);
		var topRight = this._map.latLngToLayerPoint(this._map.options.maxBounds.getNorthEast())
			.subtract(this.extraSize.multiplyBy(scale))
			.add(L.point((this._selectedAnnotation ? 3 : 2) * this.options.marginX, this.options.marginY));
		var topAnnotation = this._topAnnotation[this._selectedPart];
		var bounds, annotation;
		for (var index in annotations) {
			annotation = annotations[index];
			if (topAnnotation > 0 && parseInt(index) === topAnnotation - 1) {
				// if the top annotation is not the first one, show a bit of the bottom of the previous annotation
				// so that the user gets aware that there are more annotations above.

				// get annotation bounds
				annotation.setLatLng(this._map.layerPointToLatLng(L.point(0, -100000))); // placed where it's not visible
				annotation.show(); // if it's hidden the bounds are wrong
				bounds = annotation.getBounds();
				annotation.hide();
				var topLeft = topRight.subtract(L.point(0, bounds.max.y-bounds.min.y));
				annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
				annotation.show();
				bounds = annotation.getBounds();
				bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));

			} else if (index >= topAnnotation) { // visible annotations
				if (annotation._data.id === this._selectedAnnotation) {
					if (bounds) {
						bounds.extend(L.point(bounds.max.x, bounds.max.y + 2 * this.options.marginY));
					}
					var offsetX = L.point(2 * this.options.marginX, 0);
					var topLeft = (bounds ? bounds.getBottomLeft() : topRight).subtract(offsetX);
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					bounds = annotation.getBounds();
					bounds = L.bounds(bounds.getBottomLeft().add(offsetX), bounds.getTopRight().add(offsetX));
					bounds.extend(L.point(bounds.max.x, bounds.max.y + 3 * this.options.marginY));
				} else {
					var topLeft = bounds ? bounds.getBottomLeft() : topRight;
					annotation.setLatLng(this._map.layerPointToLatLng(topLeft));
					annotation.show();
					bounds = annotation.getBounds();
					bounds.extend(L.point(bounds.max.x, bounds.max.y + this.options.marginY));
				}
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
			if (!this._topAnnotation) {
				this._topAnnotation = [];
			}
			this._topAnnotation[this._selectedPart] = 0;
			if (this.hasAnnotations(this._selectedPart)) {
				this._map._docLayer._updateMaxBounds(true);
			}
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
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(1, this.extraSize);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Remove') {
				this.removeAnnotation(obj.comment.id);
				this._topAnnotation[this._selectedPart] = Math.min(this._topAnnotation[this._selectedPart], this._annotations[this._partHashes[this._selectedPart]].length - 1);
				this.updateDocBounds(0);
				this.layoutAnnotations();
			} else if (obj.comment.action === 'Modify') {
				var modified = this.getAnnotation(obj.comment.id);
				if (modified) {
					modified._data = obj.comment;
					modified.update();
					this._selectedAnnotation = undefined;
					this.layoutAnnotations();
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
	},

	_updateMaxBounds: function (sizeChanged, extraSize) {
		if (!extraSize) {
			var annotations = this._annotations && this._partHashes && this._selectedPart !== undefined ?
				this._annotations[this._partHashes[this._selectedPart]] : [];
			extraSize = annotations && annotations.length > 0 ? this.extraSize : null;
		}
		L.GridLayer.prototype._updateMaxBounds.call(this, sizeChanged, extraSize, {panInside: false});
	}
});
