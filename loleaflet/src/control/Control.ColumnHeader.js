/* -*- js-indent-level: 8 -*- */
/*
* Control.ColumnHeader
*/

/* global $ _UNO */
L.Control.ColumnHeader = L.Control.Header.extend({
	options: {
		cursor: 'col-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._isColumn = true;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentColumn, this);
		this._map.on('updatecornerheader', this.drawCornerHeader, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		this._headerContainer = L.DomUtil.createWithId('div', 'spreadsheet-header-columns-container', rowColumnFrame);

		this._initHeaderEntryStyles('spreadsheet-header-column');
		this._initHeaderEntryHoverStyles('spreadsheet-header-column-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-column-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-column-resize');

		this._canvas = L.DomUtil.create('canvas', 'spreadsheet-header-columns', this._headerContainer);
		this._canvasContext = this._canvas.getContext('2d');
		this._setCanvasWidth();
		this._setCanvasHeight();

		var scale = L.getDpiScaleFactor();
		this._canvasContext.scale(scale, scale);

		this._headerHeight = this._canvasHeight;
		L.Control.Header.colHeaderHeight = this._canvasHeight;

		L.DomUtil.setStyle(this._canvas, 'cursor', this._cursor);

		L.DomEvent.on(this._canvas, 'mousemove', this._onMouseMove, this);
		L.DomEvent.on(this._canvas, 'mouseout', this._onMouseOut, this);
		L.DomEvent.on(this._canvas, 'click', this._onClick, this);
		L.DomEvent.on(this._canvas, 'dblclick', this._onDoubleClick, this);
		L.DomEvent.on(this._canvas, 'touchstart',
			function (e) {
				if (e && e.touches.length > 1) {
					L.DomEvent.preventDefault(e);
				}
			},
			this);

		this._startHeaderIndex = 0;
		this._startOffset = 0;
		this._position = 0;

		L.DomEvent.on(this._cornerCanvas, 'contextmenu', L.DomEvent.preventDefault);
		L.DomEvent.addListener(this._cornerCanvas, 'click', this._onCornerHeaderClick, this);

		var colHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-columns',
			className: 'loleaflet-font',
			items: {
				'insertcolbefore': {
					name: _UNO('.uno:InsertColumnsBefore', 'spreadsheet', true),
					callback: function() {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							colHeaderObj.insertColumn.call(colHeaderObj, index);
						}
					}
				},
				'deleteselectedcol': {
					name: _UNO('.uno:DeleteColumns', 'spreadsheet', true),
					callback: function() {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							colHeaderObj.deleteColumn.call(colHeaderObj, index);
						}
					}
				},
				'optimalwidth': {
					name: _UNO('.uno:SetOptimalColumnWidth', 'spreadsheet', true),
					callback: function() {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							colHeaderObj.optimalWidth.call(colHeaderObj, index);
						}
					}
				},
				'hideColumn': {
					name: _UNO('.uno:HideColumn', 'spreadsheet', true),
					callback: function() {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							colHeaderObj.hideColumn.call(colHeaderObj, index);
						}
					}
				},
				'showColumn': {
					name: _UNO('.uno:ShowColumn', 'spreadsheet', true),
					callback: function() {
						var index = colHeaderObj._lastMouseOverIndex;
						if (index) {
							colHeaderObj.showColumn.call(colHeaderObj, index);
						}
					}
				}
			},
			zIndex: 10
		});
	},

	optimalWidth: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalColumnWidth');
	},

	insertColumn: function(index) {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	},

	deleteColumn: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	},

	hideColumn: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	},

	showColumn: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	},

	setScrollPosition: function (e) {
		var position = -e.x;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.x;
		this._position = Math.min(0, this._position- offset);
	},

	_onClearSelection: function () {
		this.clearSelection(this._data);
	},

	_onUpdateSelection: function (e) {
		var start = e.start.x;
		var end = e.end.x;
		if (start !== -1) {
			start = this._twipsToPixels(start);
		}
		if (end !== -1) {
			end = this._twipsToPixels(end);
		}
		this.updateSelection(this._data, start, end);
	},

	_onUpdateCurrentColumn: function (e) {
		var x = e.curX - this._startHeaderIndex;
		var w = this._twipsToPixels(e.width);
		var slim = w <= 1;
		this.updateCurrent(this._data, x, slim);
	},

	_updateColumnHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var ctx = this._canvasContext;
		var content = this._colIndexToAlpha(entry.index + this._startHeaderIndex);
		var startOrt = this._canvasHeight - this._headerHeight;
		var startPar = entry.pos - entry.size - this._startOffset;
		var endPar = entry.pos - this._startOffset;
		var width = endPar - startPar;
		var height = this._headerHeight;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (width <= 0)
			return;

		ctx.save();
		var scale = L.getDpiScaleFactor();
		ctx.scale(scale, scale);
		ctx.translate(this._position + this._startOffset, 0);
		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = ctx.createLinearGradient(startPar, startOrt, startPar, startOrt + height);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw header/outline border separator
		if (this._headerHeight !== this._canvasHeight) {
			ctx.fillStyle = this._borderColor;
			ctx.fillRect(startPar, startOrt - this._borderWidth, width, this._borderWidth);
		}

		// clip mask
		ctx.beginPath();
		ctx.rect(startPar, startOrt, width, height);
		ctx.clip();
		// draw background
		ctx.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		ctx.fillRect(startPar, startOrt, width, height);
		// draw resize handle
		var handleSize = this._resizeHandleSize;
		if (isCurrent && width > 2 * handleSize) {
			var center = startPar + width - handleSize / 2;
			var y = startOrt + 2;
			var h = height - 4;
			var size = 2;
			var offset = 1;
			ctx.fillStyle = '#BBBBBB';
			ctx.fillRect(center - size - offset, y + 2, size, h - 4);
			ctx.fillRect(center + offset, y + 2, size, h - 4);
		}
		// draw text content
		ctx.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		// The '+ 1' below is a hack - it's currently not possible to measure
		// the exact bounding box in html5's canvas, and the textBaseline
		// 'middle' measures everything including the descent etc.
		// '+ 1' looks visually fine, and seems safe enough
		ctx.fillText(content, endPar - (width / 2), startOrt + (height / 2) + 1);
		// draw row separator
		ctx.fillStyle = this._borderColor;
		ctx.fillRect(endPar -1, startOrt, this._borderWidth, height);
		ctx.restore();
	},

	drawGroupControl: function (group) {
		if (!group)
			return;

		var ctx = this._canvasContext;
		var headSize = this._groupHeadSize;
		var spacing = this._levelSpacing;
		var level = group.level;

		var startOrt = spacing + (headSize + spacing) * level;
		var startPar = group.startPos - this._startOffset;
		var height = group.endPos - group.startPos;

		ctx.save();
		var scale = L.getDpiScaleFactor();
		ctx.scale(scale, scale);

		ctx.translate(this._position + this._startOffset, 0);
		// clip mask
		ctx.beginPath();
		ctx.rect(startPar, startOrt, height, headSize);
		ctx.clip();
		if (!group.hidden) {
			//draw tail
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(startPar + headSize, startOrt + 2);
			ctx.lineTo(startPar + height - 1, startOrt + 2);
			ctx.lineTo(startPar + height - 1, startOrt + 2 + headSize / 2);
			ctx.stroke();
			// draw head
			ctx.fillStyle = this._hoverColor;
			ctx.fillRect(startPar, startOrt, headSize, headSize);
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 0.5;
			ctx.strokeRect(startPar, startOrt, headSize, headSize);
			// draw '-'
			ctx.lineWidth = 1;
			ctx.strokeRect(startPar + headSize / 4, startOrt + headSize / 2, headSize / 2, 1);
		}
		else {
			// draw head
			ctx.fillStyle = this._hoverColor;
			ctx.fillRect(startPar, startOrt, headSize, headSize);
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 0.5;
			ctx.strokeRect(startPar, startOrt, headSize, headSize);
			// draw '+'
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(startPar + headSize / 4, startOrt + headSize / 2);
			ctx.lineTo(startPar + 3 * headSize / 4, startOrt + headSize / 2);
			ctx.moveTo(startPar + headSize / 2, startOrt + headSize / 4);
			ctx.lineTo(startPar + headSize / 2, startOrt + 3 * headSize / 4);
			ctx.stroke();
		}
		ctx.restore();
	},

	drawLevelHeader: function(level) {
		var ctx = this._cornerCanvasContext;
		var ctrlHeadSize = this._groupHeadSize;
		var levelSpacing = this._levelSpacing;
		var scale = L.getDpiScaleFactor();

		var startOrt = levelSpacing + (ctrlHeadSize + levelSpacing) * level;
		var startPar = this._cornerCanvas.width / scale - (ctrlHeadSize + (L.Control.Header.rowHeaderWidth - ctrlHeadSize) / 2);

		ctx.save();
		ctx.scale(scale, scale);
		ctx.fillStyle = this._hoverColor;
		ctx.fillRect(startPar, startOrt, ctrlHeadSize, ctrlHeadSize);
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(startPar, startOrt, ctrlHeadSize, ctrlHeadSize);
		// draw level number
		ctx.fillStyle = this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startPar + (ctrlHeadSize / 2), startOrt + (ctrlHeadSize / 2));
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;
		if (index)
			entry = this._data.get(index);

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var colStart = entry.pos - entry.size + this._position;
		var colEnd = entry.pos + this._position;

		var left = rect.left + colStart;
		var right = rect.left + colEnd;
		var top = rect.top;
		var bottom = rect.bottom;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.columns && e.data.columns.length > 0) {
			this.fillColumns(e.data.columns, e.data.columnGroups, e.converter, e.context);
		}
	},

	fillColumns: function (columns, colGroups, converter, context) {
		if (columns.length < 2)
			return;

		var headerEntry, index, iterator, width, pos;

		var canvas = this._canvas;
		this._setCanvasWidth();
		this._setCanvasHeight();
		this._canvasContext.clearRect(0, 0, canvas.width, canvas.height);

		// update first header index and reset no more valid variables
		this._startHeaderIndex = parseInt(columns[0].text);
		this._current = -1; // no more valid
		this._selection.start = this._selection.end = -1; // no more valid
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;

		// create header data handler instance
		this._data = new L.Control.Header.DataImpl();

		// setup conversion routine
		this.converter = L.Util.bind(converter, context);
		this._data.converter = L.Util.bind(this._twipsToPixels, this);

		// create group array
		this._groupLevels = parseInt(columns[0].groupLevels);
		this._groups = this._groupLevels ? new Array(this._groupLevels) : null;

		var startOffsetTw = parseInt(columns[0].size);
		this._startOffset = this._twipsToPixels(startOffsetTw);

		this._data.pushBack(0, {pos: startOffsetTw, size: 0});
		var prevPos = startOffsetTw;
		var nextIndex = parseInt(columns[1].text);
		var last = columns.length - 1;

		for (iterator = 1; iterator < last; iterator++) {
			index = nextIndex;
			pos = parseInt(columns[iterator].size);
			nextIndex = parseInt(columns[iterator+1].text);
			width = pos - prevPos;
			prevPos = Math.round(pos + width * (nextIndex - index - 1));
			index = index - this._startHeaderIndex;
			headerEntry = {pos: pos, size: width};
			this._data.pushBack(index, headerEntry);
		}

		// setup last header entry
		index = nextIndex - this._startHeaderIndex;
		pos = parseInt(columns[last].size);
		width = pos - prevPos;
		this._data.pushBack(index, {pos: pos, size: width});

		// collect group controls data
		if (colGroups !== undefined && this._groups) {
			this._collectGroupsData(colGroups);
		}

		if (this._groups) {
			this.resize(this._computeOutlineWidth() + this._borderWidth + this._headerHeight);
		}
		else if (this._canvasHeight !== this._headerHeight) {
			this.resize(this._headerHeight);
		}

		// draw header
		headerEntry = this._data.getFirst();
		while (headerEntry) {
			this.drawHeaderEntry(headerEntry, false);
			headerEntry = this._data.getNext();
		}

		// draw group controls
		this.drawOutline();

		this.mouseInit(canvas);

		L.DomEvent.on(canvas, 'contextmenu', L.DomEvent.preventDefault);
		if ($('.spreadsheet-header-columns').length > 0) {
			$('.spreadsheet-header-columns').contextMenu(this._map._permission === 'edit');
		}
	},

	_colAlphaToNumber: function(alpha) {
		var res = 0;
		var offset = 'A'.charCodeAt();
		for (var i = 0; i < alpha.length; i++) {
			var chr = alpha[alpha.length - i - 1];
			res += (chr.charCodeAt() - offset + 1) * Math.pow(26, i);
		}

		return res;
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
				value: colNumber - 1
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectColumn ', command);
	},

	_onClick: function (e) {
		if (this._onOutlineMouseEvent(e, this._onGroupControlClick))
			return;

		if (!this._mouseOverEntry)
			return;

		var col = this._mouseOverEntry.index + this._startHeaderIndex;

		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectColumn(col, modifier);
	},

	_onCornerHeaderClick: function(e) {
		var pos = this._mouseEventToCanvasPos(this._cornerCanvas, e);

		if (pos.y > this.getOutlineWidth()) {
			this._map.fire('cornerheaderclicked', e);
			return;
		}

		var scale = L.getDpiScaleFactor();
		var rowOutlineWidth = this._cornerCanvas.width / scale - L.Control.Header.rowHeaderWidth - this._borderWidth;
		if (pos.x <= rowOutlineWidth) {
			// empty rectangle on the left select all
			this._map.sendUnoCommand('.uno:SelectAll');
			return;
		}

		var level = this._getGroupLevel(pos.y);
		this._updateOutlineState(/*is column: */ true, {column: true, level: level, index: -1});
	},

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraWidth: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalColumnWidth', extra);
		}

		this._map.enable(true);
	},

	_getVertLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), 0)),
			this._map.containerPointToLatLng(new L.Point(Math.max(limit.x, drag.x + offset.x), this._map.getSize().y))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._vertLine) {
			this._vertLine = L.polyline(this._getVertLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}

		this._map.addLayer(this._vertLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._vertLine) {
			this._vertLine.setLatLngs(this._getVertLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX + offset.x, e.clientY);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		var clickedColumn = this._mouseOverEntry;
		if (clickedColumn) {
			var width = clickedColumn.size;
			var column = clickedColumn.index + this._startHeaderIndex;

			if (this._data.isZeroSize(clickedColumn.index + 1)) {
				column += 1;
				width = 0;
			}

			if (width !== distance.x) {
				var command = {
					ColumnWidth: {
						type: 'unsigned short',
						value: this._map._docLayer.twipsToHMM(Math.max(distance.x, 0))
					},
					Column: {
						type: 'unsigned short',
						value: column
					}
				};

				this._map.sendUnoCommand('.uno:ColumnWidth', command);
				this._updateColumnHeader();
			}
		}

		this._map.removeLayer(this._vertLine);
	},

	onDragClick: function (item, clicks/*, e*/) {
		this._map.removeLayer(this._vertLine);

		if (!this._mouseOverEntry)
			return;

		if (clicks === 2) {
			var column = this._mouseOverEntry.index + this._startHeaderIndex;
			var command = {
				Col: {
					type: 'unsigned short',
					value: column - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectColumn ', command);
			this._map.sendUnoCommand('.uno:SetOptimalColumnWidthDirect');
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		if ($('.spreadsheet-header-columns').length > 0) {
			$('.spreadsheet-header-columns').contextMenu(e.perm === 'edit');
		}
	},

	_getParallelPos: function (point) {
		return point.x;
	},

	_getOrthogonalPos: function (point) {
		return point.y;
	},

	resize: function (height) {
		if (height < this._headerHeight)
			return;

		var rowHeader = L.DomUtil.get('spreadsheet-header-rows-container');
		var document = L.DomUtil.get('document-container');

		this._setCornerCanvasHeight(height);
		var deltaTop = height - this._canvasHeight;
		var rowHdrTop = parseInt(L.DomUtil.getStyle(rowHeader, 'top')) + deltaTop;
		var docTop = parseInt(L.DomUtil.getStyle(document, 'top')) + deltaTop;
		L.DomUtil.setStyle(rowHeader, 'top', rowHdrTop + 'px');
		L.DomUtil.setStyle(document, 'top', docTop + 'px');

		this._setCanvasHeight(height);

		this._map.fire('updatecornerheader');
	}

});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
