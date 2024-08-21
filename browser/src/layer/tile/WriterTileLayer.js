/* -*- js-indent-level: 8 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Writer tile layer is used to display a text document
 */

/* global app GraphicSelection */
L.WriterTileLayer = L.CanvasTileLayer.extend({

	newAnnotation: function (comment) {
		if (app.file.textCursor.visible) {
			comment.anchorPos = [app.file.textCursor.rectangle.x2, app.file.textCursor.rectangle.y1];
		} else if (GraphicSelection.hasActiveSelection()) {
			// An image is selected, then guess the anchor based on the graphic selection.
			comment.anchorPos = [GraphicSelection.rectangle.x1, GraphicSelection.rectangle.y2];
		}

		var annotation = app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).add(comment);
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).modify(annotation);
	},

	beforeAdd: function (map) {
		map.uiManager.initializeSpecializedUI('text');
	},

	_onCommandValuesMsg: function (textMsg) {
		var braceIndex = textMsg.indexOf('{');
		if (braceIndex < 0) {
			return;
		}

		var values = JSON.parse(textMsg.substring(braceIndex));
		if (!values) {
			return;
		}

		if (values.comments) {
			values.comments.forEach(function(comment) {
				comment.id = comment.id.toString();
				comment.parent = comment.parentId.toString();
			});
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).importComments(values.comments);
		}
		else if (values.redlines && values.redlines.length > 0) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).importChanges(values.redlines);
		}
		else if (this._map.zotero && values.userDefinedProperties) {
			this._map.zotero.handleCustomProperty(values.userDefinedProperties);
		}
		else if (this._map.zotero && values.fields) {
			this._map.zotero.onFieldValue(values.fields);
		} else if (this._map.zotero && values.field) {
			this._map.zotero.handleFieldUnderCursor(values.field);
		} else if (this._map.zotero && values.setRefs) {
			this._map.zotero.onFieldValue(values.setRefs);
		} else if (this._map.zotero && values.setRef) {
			this._map.zotero.handleFieldUnderCursor(values.setRef);
		} else if (this._map.zotero && values.bookmarks) {
			this._map.zotero.handleBookmark(values.bookmarks);
		} else if (this._map.zotero && values.bookmark) {
			this._map.zotero.fetchCustomProperty(values.bookmark.name);
		} else if (this._map.zotero && values.sections) {
			this._map.zotero.onFieldValue(values.sections);
		} else {
			L.CanvasTileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
		}
	},

	_onInvalidateTilesMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
		if (command.x === undefined || command.y === undefined || command.part === undefined) {
			var strTwips = textMsg.match(/\d+/g);
			command.x = parseInt(strTwips[0]);
			command.y = parseInt(strTwips[1]);
			command.width = parseInt(strTwips[2]);
			command.height = parseInt(strTwips[3]);
			command.part = this._selectedPart;
		}

		if (isNaN(command.mode))
			command.mode = this._selectedMode;

		command.part = 0;
		var topLeftTwips = new L.Point(command.x, command.y);
		var offset = new L.Point(command.width, command.height);
		var bottomRightTwips = topLeftTwips.add(offset);
		if (this._debug.tileInvalidationsOn) {
			this._debug.addTileInvalidationRectangle(topLeftTwips, bottomRightTwips, textMsg);
		}
		var invalidBounds = new L.Bounds(topLeftTwips, bottomRightTwips);
		var visibleTopLeft = this._latLngToTwips(this._map.getBounds().getNorthWest());
		var visibleBottomRight = this._latLngToTwips(this._map.getBounds().getSouthEast());
		var visibleArea = new L.Bounds(visibleTopLeft, visibleBottomRight);
		var needsNewTiles = false;
		for (var key in this._tiles) {
			var coords = this._tiles[key].coords;
			var bounds = this._coordsToTileBounds(coords);
			if (coords.part === command.part && coords.mode === command.mode &&
				invalidBounds.intersects(bounds)) {
				if (visibleArea.intersects(bounds)) {
					needsNewTiles = true;
				}
				this._invalidateTile(key, command.wireId);
			}
		}

		if (needsNewTiles && this._debug.tileInvalidationsOn) {
			this._debug.addTileInvalidationMessage(textMsg);
		}

		this._previewInvalidations.push(invalidBounds);
		// 1s after the last invalidation, update the preview
		clearTimeout(this._previewInvalidator);
		this._previewInvalidator = setTimeout(L.bind(this._invalidatePreviews, this), this.options.previewInvalidationTimeout);
	},

	_onSetPartMsg: function (textMsg) {
		var part = parseInt(textMsg.match(/\d+/g)[0]);
		if (part !== this._selectedPart) {
			this._currentPage = part;
			this._map.fire('pagenumberchanged', {
				currentPage: part,
				pages: this._pages,
				docType: this._docType
			});
		}
	},

	_onStatusMsg: function (textMsg) {
		var command = app.socket.parseServerCmd(textMsg);
		if (app.socket._reconnecting) {
			// persist cursor position on reconnection
			// In writer, core always sends the cursor coordinates
			// of the first paragraph of the document so we want to ignore that
			// to eliminate document jumping while reconnecting
			this.persistCursorPositionInWriter = true;
			this._postMouseEvent('buttondown', this.lastCursorPos.center[0], this.lastCursorPos.center[1], 1, 1, 0);
			this._postMouseEvent('buttonup', this.lastCursorPos.center[0], this.lastCursorPos.center[1], 1, 1, 0);
		}
		if (!command.width || !command.height || this._documentInfo === textMsg)
			return;

		var sizeChanged = command.width !== this._docWidthTwips || command.height !== this._docHeightTwips;

		if (command.viewid !== undefined) {
			this._viewId = parseInt(command.viewid);
		}
		console.assert(this._viewId >= 0, 'Incorrect viewId received: ' + this._viewId);

		if (sizeChanged) {
			this._docWidthTwips = command.width;
			this._docHeightTwips = command.height;
			app.file.size.twips = [this._docWidthTwips, this._docHeightTwips];
			app.file.size.pixels = [Math.round(this._tileSize * (this._docWidthTwips / this._tileWidthTwips)), Math.round(this._tileSize * (this._docHeightTwips / this._tileHeightTwips))];
			app.view.size.pixels = app.file.size.pixels.slice();
			this._docType = command.type;
			this._updateMaxBounds(true);
		}

		this._documentInfo = textMsg;
		this._selectedPart = 0;
		this._selectedMode = (command.mode !== undefined) ? command.mode : 0;
		this._parts = 1;
		this._currentPage = command.selectedPart;
		this._pages = command.parts;
		app.file.writer.pageRectangleList = command.pageRectangleList.slice(); // Copy the array.
		this._map.fire('pagenumberchanged', {
			currentPage: this._currentPage,
			pages: this._pages,
			docType: this._docType
		});
		this._resetPreFetching(true);
	},
});
