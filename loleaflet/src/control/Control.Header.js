/* -*- js-indent-level: 8 -*- */
/*
* Control.Header
*
* Abstract class, basis for ColumnHeader and RowHeader controls.
* Used only in spreadsheets, implements the row/column headers.
*/
/* global $ L */

L.Control.Header = L.Class.extend({

	_setConverter: function() {
		this.converter = this._map._docLayer._twipsToCorePixels.bind(this._map._docLayer);
	},

	_initHeaderEntryStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		this._backgroundColor = L.DomUtil.getStyle(elem, 'background-color');
		var fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		var that = this;
		this.getFont = function() {
			var selectedSize = that._getFontSize();
			return selectedSize + 'px ' + fontFamily;
		};
		this._borderColor = L.DomUtil.getStyle(elem, 'border-top-color');
		var borderWidth = L.DomUtil.getStyle(elem, 'border-top-width');
		this._borderWidth = Math.round(parseFloat(borderWidth));
		this._cursor = L.DomUtil.getStyle(elem, 'cursor');
		L.DomUtil.remove(elem);
	},

	_getFontSize: function () {
		var map = this._map;
		var zoomScale = map.getZoomScale(map.getZoom(),	map.options.defaultZoom);
		if (zoomScale < 0.68)
			return Math.round(8 * this.dpiScale);
		else if (zoomScale < 0.8)
			return Math.round(10 * this.dpiScale);
		else
			return Math.round(12 * this.dpiScale);
	},

	_initHeaderEntryHoverStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._hoverColor = L.DomUtil.getStyle(elem, 'background-color');
		L.DomUtil.remove(elem);
	},

	_initHeaderEntrySelectedStyles: function (className) {
		var baseElem = document.getElementsByTagName('body')[0];
		var elem = L.DomUtil.create('div', className, baseElem);
		this._selectionTextColor = L.DomUtil.getStyle(elem, 'color');

		var selectionBackgroundGradient = [];
		var gradientColors = L.DomUtil.getStyle(elem, 'background-image');
		gradientColors = gradientColors.slice('linear-gradient('.length, -1);
		while (gradientColors) {
			var color = gradientColors.split(',', 3);
			color = color.join(','); // color = 'rgb(r, g, b)'
			selectionBackgroundGradient.push(color);
			gradientColors = gradientColors.substr(color.length); // remove last parsed color
			gradientColors = gradientColors.substr(gradientColors.indexOf('r')); // remove ', ' stuff
		}

		if (selectionBackgroundGradient.length) {
			this._selectionBackgroundGradient = selectionBackgroundGradient;
		}
		L.DomUtil.remove(elem);
	},

	_initHeaderEntryResizeStyles: function (className) {
		if (this.options.cursor) {
			this._resizeCursor = this.options.cursor;
		}
		else {
			var baseElem = document.getElementsByTagName('body')[0];
			var elem = L.DomUtil.create('div', className, baseElem);
			this._resizeCursor = L.DomUtil.getStyle(elem, 'cursor');
			L.DomUtil.remove(elem);
		}
	},

	onLongPress: function () {
		if (this._map.isPermissionEdit()) {
			window.contextMenuWizard = true;
			this._map.fire('mobilewizard', {data: this._menuData});
		}
	},

	_updateCanvas: function () {
		if (this._headerInfo) {
			this._headerInfo.update(this);
			this.containerObject.requestReDraw();
		}
	},

	optimalHeight: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalRowHeight');
	},

	insertRowAbove: function(index) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	insertRowBelow: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRowsAfter');
	},

	deleteRow: function(index) {
		if (!this._headerInfo.getElementData(index).isHighlighted) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	},

	_selectRow: function(row, modifier) {
		var command = {
			Row: {
				type: 'long',
				value: row
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.wholeRowSelected = true; // This variable is set early, state change will set this again.
		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_insertRowAbove: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertRowAbove.call(this, index);
		}
	},

	_insertRowBelow: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertRowBelow.call(this, index);
		}
	},

	_deleteSelectedRow: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.deleteRow.call(this, index);
		}
	},

	_optimalHeight: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.optimalHeight.call(this, index);
		}
	},

	_hideRow: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.hideRow.call(this, index);
		}
	},

	_showRow: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.showRow.call(this, index);
		}
	},

	_getHorzLatLng: function (start, offset, e) {
		var size = this._map.getSize();
		var drag = this._map.mouseEventToContainerPoint(e);
		var entryStart = (this._dragEntry.pos - this._dragEntry.size) / this._dpiScale;
		var ypos = Math.max(drag.y, entryStart);
		return [
			this._map.unproject(new L.Point(0, ypos)),
			this._map.unproject(new L.Point(size.x, ypos)),
		];
	},

	optimalWidth: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalColumnWidth');
	},

	insertColumnBefore: function(index) {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	},

	insertColumnAfter: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumnsAfter');
		this._updateColumnHeader();
	},

	deleteColumn: function(index) {
		if (!this._headerInfo.getElementData(index).isHighlighted) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	},

	hideColumn: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	},

	showColumn: function(index) {
		if (!this._headerInfo.getElementData(index).isCurrent) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	},

	_updateColumnHeader: function () {
		this._map._docLayer.refreshViewData({x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	_colIndexToAlpha: function(columnNumber) {
		var offset = 'A'.charCodeAt();
		var dividend = columnNumber;
		var columnName = '';
		var modulo;

		while (dividend > 0) {
			modulo = (dividend - 1) % 26;
			columnName = String.fromCharCode(offset + modulo) + columnName;
			dividend = Math.floor((dividend - modulo) / 26);
		}

		return columnName;
	},

	_selectColumn: function(colNumber, modifier) {
		var command = {
			Col: {
				type: 'unsigned short',
				value: colNumber
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.wholeColumnSelected = true; // This variable is set early, state change will set this again.
		this._map.sendUnoCommand('.uno:SelectColumn ', command);
	},

	_getVertLatLng: function (start, offset, e) {
		var size = this._map.getSize();
		var drag = this._map.mouseEventToContainerPoint(e);
		var entryStart = (this._dragEntry.pos - this._dragEntry.size) / this._dpiScale;
		var xpos = Math.max(drag.x, entryStart);
		return [
			this._map.unproject(new L.Point(xpos, 0)),
			this._map.unproject(new L.Point(xpos, size.y)),
		];
	},

	_insertColBefore: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertColumnBefore.call(this, index);
		}
	},

	_insertColAfter: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertColumnAfter.call(this, index);
		}
	},

	_deleteSelectedCol: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.deleteColumn.call(this, index);
		}
	},

	_optimalWidth: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.optimalWidth.call(this, index);
		}
	},

	_hideColumn: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.hideColumn.call(this, index);
		}
	},

	_showColumn: function() {
		var index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.showColumn.call(this, index);
		}
	},

	_entryAtPoint: function(point) {
		if (!this._headerInfo)
			return false;

		var position = this._headerInfo._isColumn ? point[0]: point[1];

		var that = this;
		var result = null;
		this._headerInfo.forEachElement(function(entry) {
			var end = entry.pos;
			var start = end - entry.size;
			if (position >= start && position < end) {
				var resizeAreaStart = Math.max(start, end - 3 * that.dpiScale);
				if (entry.isCurrent || window.mode.isMobile()) {
					resizeAreaStart = end - that._resizeHandleSize;
				}
				var isMouseOverResizeArea = (position > resizeAreaStart);
				result = {entry: entry, hit: isMouseOverResizeArea};
				return true;
			}
		});
		return result;
	},

	onMouseEnter: function () {
		L.DomUtil.setStyle(this.containerObject.canvas, 'cursor', this._cursor);
		this._bindContextMenu();
	},

	onMouseLeave: function (point) {
		if (point === null) { // This means that the mouse pointer is outside the canvas.
			if (this.containerObject.draggingSomething && this._dragEntry) { // Were we resizing a row / column before mouse left.
				this.onDragEnd(this.containerObject.dragDistance);
			}
		}

		if (this._mouseOverEntry) {
			this.containerObject.setPenPosition(this);
			this.drawHeaderEntry(this._mouseOverEntry);
			this._mouseOverEntry = null;
		}
		this._hitResizeArea = false;
		L.DomUtil.setStyle(this.containerObject.canvas, 'cursor', 'default');
	},

	onContextMenu: function () {

	},

	_bindContextMenu: function () {
		this._unBindContextMenu();
		var that = this;
		$.contextMenu({
			selector: '#document-canvas',
			className: 'loleaflet-font',
			zIndex: 10,
			items: that._menuItem,
			callback: function() {}
		});
		$('#document-canvas').contextMenu('update');
	},

	_unBindContextMenu: function () {
		$.contextMenu('destroy', '#document-canvas');
	},

	inResize: function () {
		return this.containerObject.draggingSomething && this._dragEntry && this._dragDistance;
	},

	drawResizeLineIfNeeded: function () {
		if (!this.inResize())
			return;

		this.containerObject.setPenPosition(this);
		var x = this._isColumn ? (this._dragEntry.pos + this._dragDistance[0]): this.size[0];
		var y = this._isColumn ? this.size[1]: (this._dragEntry.pos + this._dragDistance[1]);

		this.context.lineWidth = this.dpiScale;
		this.context.strokeStyle = 'darkblue';
		this.context.beginPath();
		this.context.moveTo(x, y);
		this.context.lineTo(this._isColumn ? x: this.containerObject.right, this._isColumn ? this.containerObject.bottom: y);
		this.context.stroke();
	},

	onMouseMove: function (point, dragDistance) {
		if (!this.containerObject.draggingSomething) { // If we are not dragging anything.
			this._dragDistance = null;
			var result = this._entryAtPoint(point); // Data related to current entry that the mouse is over now.

			// If mouse was over another entry previously, we draw that again (without mouse-over effect).
			if (this._mouseOverEntry && (!result || result.entry.index !== this._mouseOverEntry.index)) {
				this.containerObject.setPenPosition(this);
				this._mouseOverEntry.isOver = false;
				this.drawHeaderEntry(this._mouseOverEntry);
			}

			var isMouseOverResizeArea = false;

			if (result) { // Is mouse over an entry.
				this._mouseOverEntry = result.entry;
				this._mouseOverEntry.isOver = true;
				this._lastMouseOverIndex = this._mouseOverEntry.index; // used by context menu
				this.containerObject.setPenPosition(this);
				this.drawHeaderEntry(result.entry);
				isMouseOverResizeArea = result.hit;
			}

			// cypress mobile emulation sometimes triggers resizing unintentionally.
			if (L.Browser.cypressTest)
				return false;

			if (isMouseOverResizeArea !== this._hitResizeArea) { // Do we need to change cursor (to resize or pointer).
				var cursor = isMouseOverResizeArea ? this._resizeCursor : this._cursor;
				L.DomUtil.setStyle(this.containerObject.canvas, 'cursor', cursor);
				this._hitResizeArea = isMouseOverResizeArea;
			}
		}
		else { // We are in dragging mode.
			this._dragDistance = dragDistance;
			this.containerObject.requestReDraw(); // Remove previously drawn line and paint a new one.
		}
	},

	onDoubleClick: function () {
		this._isColumn ? this.setOptimalWidthAuto(): this.setOptimalHeightAuto();
	},

	onMouseDown: function (point) {
		this.onMouseMove(point);

		if (this._hitResizeArea) {
			L.DomUtil.disableImageDrag();
			L.DomUtil.disableTextSelection();

			// When code is here, this._mouseOverEntry should never be null.

			this._dragEntry = { // In case dragging takes place, we will remember this entry.
				index: this._mouseOverEntry.index,
				origsize: this._mouseOverEntry.origsize,
				pos: this._mouseOverEntry.pos,
				size: this._mouseOverEntry.size
			};
		}
		else {
			this._dragEntry = null;
		}
	},

	onMouseUp: function () {
		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this.containerObject.draggingSomething && this._dragEntry) {
			this.onDragEnd(this.containerObject.dragDistance);
			this._dragEntry = null;
		}
	},

	_twipsToPixels: function (twips) {
		if (!this.converter)
			return 0;
		var point = new L.Point(twips, twips);
		return Math.round(this._getParallelPos(this.converter(point)));
	},

	onNewDocumentTopLeft: function () {
		this._updateCanvas();
	},

	onMouseWheel: function() {},
});

L.Control.Header.HeaderInfo = L.Class.extend({

	initialize: function (map, _isColumn) {
		console.assert(map && _isColumn !== undefined, 'map and isCol required');
		this._map = map;
		this._isColumn = _isColumn;
		this._dpiScale = L.Util.getDpiScaleFactor(true);
		console.assert(this._map._docLayer.sheetGeometry, 'no sheet geometry data-structure found!');
		var sheetGeom = this._map._docLayer.sheetGeometry;
		this._dimGeom = this._isColumn ? sheetGeom.getColumnsGeometry() : sheetGeom.getRowsGeometry();
	},

	findXInCellSelections: function (cellSelections, ordinate) {
		for (var i = 0; i < cellSelections.length; i++) {
			if (cellSelections[i].containsPixelOrdinateX(ordinate))
				return true;
		}
		return false;
	},

	findYInCellSelections: function (cellSelections, ordinate) {
		for (var i = 0; i < cellSelections.length; i++) {
			if (cellSelections[i].containsPixelOrdinateY(ordinate))
				return true;
		}
		return false;
	},

	isHeaderEntryHighLighted: function (cellSelections, ordinate) {
		if (this._isColumn && this._map.wholeRowSelected)
			return true;
		else if (!this._isColumn && this._map.wholeColumnSelected)
			return true;
		else if (this._isColumn && cellSelections.length > 0) {
			return this.findXInCellSelections(cellSelections, ordinate);
		}
		else if (!this._isColumn && cellSelections.length > 0) {
			return this.findYInCellSelections(cellSelections, ordinate);
		}
		else
			return false;
	},

	update: function (section) {
		var cellSelections = this._map._docLayer._cellSelections;
		var that = this;
		var currentIndex = -1;

		if (this._map._docLayer._cellCursorXY) {
			currentIndex = this._isColumn ? this._map._docLayer._cellCursorXY.x: this._map._docLayer._cellCursorXY.y;
		}

		var startPx = this._isColumn === true ? section.documentTopLeft[0]: section.documentTopLeft[1];
		this._docVisStart = startPx;
		var endPx = startPx + (this._isColumn === true ? section.size[0]: section.size[1]);
		var startIdx = this._dimGeom.getIndexFromPos(startPx, 'corepixels');
		var endIdx = this._dimGeom.getIndexFromPos(endPx - 1, 'corepixels');
		this._elements = [];

		var splitPosContext = this._map.getSplitPanesContext();

		this._hasSplits = false;
		this._splitIndex = 0;
		var splitPos = 0;

		if (splitPosContext) {

			splitPos = (this._isColumn ? splitPosContext.getSplitPos().x : splitPosContext.getSplitPos().y) * this._dpiScale;
			var splitIndex = this._dimGeom.getIndexFromPos(splitPos + 1, 'corepixels');

			if (splitIndex) {
				// Make sure splitPos is aligned to the cell boundary.
				splitPos = this._dimGeom.getElementData(splitIndex).startpos;
				this._splitPos = splitPos;
				this._dimGeom.forEachInRange(0, splitIndex - 1,
					function (idx, data) {
						this._elements[idx] = {
							index: idx,
							pos: data.startpos + data.size, // end position on the header canvas
							size: data.size,
							origsize: data.size,
							isHighlighted: that.isHeaderEntryHighLighted(cellSelections, data.startpos + data.size * 0.5),
							isCurrent: idx === currentIndex ? true: false
						};
					}.bind(this)
				);

				this._hasSplits = true;
				this._splitIndex = splitIndex;

				var freeStartPos = startPx + splitPos + 1;
				var freeStartIndex = this._dimGeom.getIndexFromPos(freeStartPos + 1, 'corepixels');

				startIdx = freeStartIndex;
			}
		}

		// first free index
		var dataFirstFree = this._dimGeom.getElementData(startIdx);
		var firstFreeEnd = dataFirstFree.startpos + dataFirstFree.size - startPx;
		var firstFreeStart = splitPos;
		var firstFreeSize = Math.max(0, firstFreeEnd - firstFreeStart);
		this._elements[startIdx] = {
			index: startIdx,
			pos: firstFreeEnd, // end position on the header canvas
			size: firstFreeSize,
			origsize: dataFirstFree.size,
			isHighlighted: that.isHeaderEntryHighLighted(cellSelections, dataFirstFree.startpos + dataFirstFree.size * 0.5),
			isCurrent: startIdx === currentIndex ? true: false
		};

		this._dimGeom.forEachInRange(startIdx + 1,
			endIdx, function (idx, data) {
				this._elements[idx] = {
					index: idx,
					pos: data.startpos - startPx + data.size, // end position on the header canvas
					size: data.size,
					origsize: data.size,
					isHighlighted: that.isHeaderEntryHighLighted(cellSelections, data.startpos + data.size * 0.5),
					isCurrent: idx === currentIndex ? true: false
				};
			}.bind(this));

		this._startIndex = startIdx;
		this._endIndex = endIdx;
	},

	docToHeaderPos: function (docPos) {
		if (!this._hasSplits) {
			return docPos - this._docVisStart;
		}

		if (docPos <= this._splitPos) {
			return docPos;
		}

		// max here is to prevent encroachment of the fixed pane-area.
		return Math.max(docPos - this._docVisStart, this._splitPos);
	},

	headerToDocPos: function (hdrPos) {
		if (!this._hasSplits) {
			return hdrPos + this._docVisStart;
		}

		if (hdrPos <= this._splitPos) {
			return hdrPos;
		}

		return hdrPos + this._docVisStart;
	},

	isZeroSize: function (i) {
		var elem = this._elements[i];
		console.assert(elem, 'queried a non existent row/col in the header : ' + i);
		return elem.size === 0;
	},

	getMinIndex: function () {
		return this._hasSplits ? 0 : this._startIndex;
	},

	getMaxIndex: function () {
		return this._endIndex;
	},

	getElementData: function (index) {
		return this._elements[index];
	},

	getRowData: function (index) {
		console.assert(!this._isColumn, 'this is a column header instance!');
		return this.getElementData(index);
	},

	getColData: function (index) {
		console.assert(this._isColumn, 'this is a row header instance!');
		return this.getElementData(index);
	},

	getPreviousIndex: function (index) {

		var prevIndex;
		if (this._splitIndex && index === this._startIndex) {
			prevIndex = this._splitIndex - 1;
		}
		else {
			prevIndex = index - 1;
		}

		return prevIndex;
	},

	getNextIndex: function (index) {

		var nextIndex;
		if (this._splitIndex && index === (this._splitIndex - 1)) {
			nextIndex = this._startIndex;
		}
		else {
			nextIndex = index + 1;
		}

		return nextIndex;
	},

	forEachElement: function (callback) {
		var idx;
		if (this._hasSplits) {
			for (idx = 0; idx < this._splitIndex; ++idx) {
				console.assert(this._elements[idx], 'forEachElement failed');
				if (callback(this._elements[idx])) {
					return;
				}
			}
		}
		for (idx = this._startIndex; idx <= this._endIndex; ++idx) {
			console.assert(this._elements[idx], 'forEachElement failed');
			if (callback(this._elements[idx])) {
				return;
			}
		}
	},

});
