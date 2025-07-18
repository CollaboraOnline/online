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
/* global app GraphicSelection cool TileManager JSDialog */
L.WriterTileLayer = L.CanvasTileLayer.extend({
    initialize: function (options) {
        L.CanvasTileLayer.prototype.initialize.call(this, options);
        this._quickFind = JSDialog.QuickFindPanel();
    },
    newAnnotation: function (commentData) {
        var comment = new cool.Comment(commentData, {}, app.sectionContainer.getSectionWithName(L.CSections.CommentList.name));
        if (app.file.textCursor.visible) {
            comment.sectionProperties.data.anchorPos = [app.file.textCursor.rectangle.x2, app.file.textCursor.rectangle.y1];
        }
        else if (GraphicSelection.hasActiveSelection()) {
            // An image is selected, then guess the anchor based on the graphic selection.
            comment.sectionProperties.data.anchorPos = [GraphicSelection.rectangle.x1, GraphicSelection.rectangle.y2];
        }
        app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).add(comment);
        app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).modify(comment);
    },
    beforeAdd: function (map) {
        this.map = map;
        map.addControl(this._quickFind);
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
            values.comments.forEach(function (comment) {
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
        }
        else if (this._map.zotero && values.field) {
            this._map.zotero.handleFieldUnderCursor(values.field);
        }
        else if (this._map.zotero && values.setRefs) {
            this._map.zotero.onFieldValue(values.setRefs);
        }
        else if (this._map.zotero && values.setRef) {
            this._map.zotero.handleFieldUnderCursor(values.setRef);
        }
        else if (this._map.zotero && values.bookmarks) {
            this._map.zotero.handleBookmark(values.bookmarks);
        }
        else if (this._map.zotero && values.bookmark) {
            this._map.zotero.fetchCustomProperty(values.bookmark.name);
        }
        else if (this._map.zotero && values.sections) {
            this._map.zotero.onFieldValue(values.sections);
        }
        else {
            L.CanvasTileLayer.prototype._onCommandValuesMsg.call(this, textMsg);
        }
    },
    _onSetPartMsg: function (textMsg) {
        var part = parseInt(textMsg.match(/\d+/g)[0]);
        if (part !== this._currentPage) {
            this._currentPage = part;
            this._map.fire('pagenumberchanged', {
                currentPage: part,
                pages: this._pages,
                docType: this._docType
            });
        }
    },
    _onStatusMsg: function (textMsg) {
        var statusJSON = JSON.parse(textMsg.replace('status:', '').replace('statusupdate:', ''));
        if (app.socket._reconnecting) {
            // persist cursor position on reconnection
            // In writer, core always sends the cursor coordinates
            // of the first paragraph of the document so we want to ignore that
            // to eliminate document jumping while reconnecting
            this.persistCursorPositionInWriter = true;
            this._postMouseEvent('buttondown', this.lastCursorPos.center[0], this.lastCursorPos.center[1], 1, 1, 0);
            this._postMouseEvent('buttonup', this.lastCursorPos.center[0], this.lastCursorPos.center[1], 1, 1, 0);
        }
        if (!statusJSON.width || !statusJSON.height || this._documentInfo === textMsg)
            return;
        var sizeChanged = statusJSON.width !== app.file.size.x || statusJSON.height !== app.file.size.y;
        if (statusJSON.viewid !== undefined)
            this._viewId = statusJSON.viewid;
        console.assert(this._viewId >= 0, 'Incorrect viewId received: ' + this._viewId);
        if (sizeChanged) {
            app.file.size.x = statusJSON.width;
            app.file.size.y = statusJSON.height;
            app.view.size = app.file.size.clone();
            this._docType = statusJSON.type;
            this._updateMaxBounds(true);
        }
        this._documentInfo = textMsg;
        this._selectedPart = 0;
        this._selectedMode = (statusJSON.mode !== undefined) ? statusJSON.mode : 0;
        this._parts = 1;
        this._currentPage = statusJSON.selectedpart;
        this._pages = statusJSON.partscount;
        app.file.writer.pageRectangleList = statusJSON.pagerectangles.slice(); // Copy the array.
        this._map.fire('pagenumberchanged', {
            currentPage: this._currentPage,
            pages: this._pages,
            docType: this._docType
        });
        TileManager.resetPreFetching(true);
    },
});
//# sourceMappingURL=WriterTileLayer.js.map
//# sourceMappingURL=WriterTileLayer.js.map
//# sourceMappingURL=WriterTileLayer.js.map
//# sourceMappingURL=WriterTileLayer.js.map