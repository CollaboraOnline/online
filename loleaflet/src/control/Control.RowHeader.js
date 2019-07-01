/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowHeader
*/

/* global $ _UNO */
L.Control.RowHeader = L.Control.Header.extend({
	options: {
		cursor: 'row-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		this._initialized = false;
	},

	_initialize: function () {
		this._initialized = true;
		this._isColumn = false;
		this._map.on('scrolloffset', this.offsetScrollPosition, this);
		this._map.on('updatescrolloffset', this.setScrollPosition, this);
		this._map.on('viewrowcolumnheaders', this.viewRowColumnHeaders, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentRow, this);
		this._map.on('updatecornerheader', this.drawCornerHeader, this);
		this._map.on('cornerheaderclicked', this._onCornerHeaderClick, this);
		var rowColumnFrame = L.DomUtil.get('spreadsheet-row-column-frame');
		this._headerContainer = L.DomUtil.createWithId('div', 'spreadsheet-header-rows-container', rowColumnFrame);

		this._initHeaderEntryStyles('spreadsheet-header-row');
		this._initHeaderEntryHoverStyles('spreadsheet-header-row-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-row-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-row-resize');

		this._canvas = L.DomUtil.create('canvas', 'spreadsheet-header-rows', this._headerContainer);
		this._canvasContext = this._canvas.getContext('2d');
		this._setCanvasWidth();
		this._setCanvasHeight();

		var scale = L.getDpiScaleFactor();
		this._canvasContext.scale(scale, scale);
		this._headerWidth = this._canvasWidth;
		L.Control.Header.rowHeaderWidth = this._canvasWidth;

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

		var rowHeaderObj = this;
		$.contextMenu({
			selector: '.spreadsheet-header-rows',
			className: 'loleaflet-font',
			items: {
				'insertrowabove': {
					name: _UNO('.uno:InsertRowsBefore', 'spreadsheet', true),
					callback: function() {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.insertRow.call(rowHeaderObj, index);
						}
					}
				},
				'deleteselectedrow': {
					name: _UNO('.uno:DeleteRows', 'spreadsheet', true),
					callback: function() {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.deleteRow.call(rowHeaderObj, index);
						}
					}
				},
				'optimalheight': {
					name: _UNO('.uno:SetOptimalRowHeight', 'spreadsheet', true),
					callback: function() {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.optimalHeight.call(rowHeaderObj, index);
						}
					}
				},
				'hideRow': {
					name: _UNO('.uno:HideRow', 'spreadsheet', true),
					callback: function() {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.hideRow.call(rowHeaderObj, index);
						}
					}
				},
				'showRow': {
					name: _UNO('.uno:ShowRow', 'spreadsheet', true),
					callback: function() {
						var index = rowHeaderObj._lastMouseOverIndex;
						if (index) {
							rowHeaderObj.showRow.call(rowHeaderObj, index);
						}
					}
				}
			},
			zIndex: 10
		});
	},

	optimalHeight: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalRowHeight');
	},

	insertRow: function(index) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	deleteRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(index) {
		if (this._map._docLayer._selections.getLayers().length === 0) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	},

	setScrollPosition: function (e) {
		var position = -e.y;
		this._position = Math.min(0, position);
	},

	offsetScrollPosition: function (e) {
		var offset = e.y;
		this._position = Math.min(0, this._position - offset);
	},

	_onClearSelection: function () {
		this.clearSelection(this._data);
	},

	_onUpdateSelection: function (e) {
		var start = e.start.y;
		var end = e.end.y;
		if (start !== -1) {
			start = this._twipsToPixels(start);
		}
		if (end !== -1) {
			end = this._twipsToPixels(end);
		}
		this.updateSelection(this._data, start, end);
	},

	_onUpdateCurrentRow: function (e) {
		var y = e.curY - this._startHeaderIndex;
		var h = this._twipsToPixels(e.height);
		var slim = h <= 1;
		this.updateCurrent(this._data, y, slim);
	},

	_updateRowHeader: function () {
		this._map.fire('updaterowcolumnheaders', {x: 0, y: this._map._getTopLeftPoint().y, offset: {x: 0, y: undefined}});
	},

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var ctx = this._canvasContext;
		var content = entry.index + this._startHeaderIndex;
		var startOrt = this._canvasWidth - this._headerWidth;
		var startPar = entry.pos - entry.size - this._startOffset;
		var endPar = entry.pos - this._startOffset;
		var height = endPar - startPar;
		var width = this._headerWidth;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (height <= 0)
			return;

		ctx.save();
		var scale = L.getDpiScaleFactor();
		ctx.scale(scale, scale);
		ctx.translate(0, this._position + this._startOffset);
		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = ctx.createLinearGradient(0, startPar, 0, startPar + height);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw header/outline border separator
		if (this._headerWidth !== this._canvasWidth) {
			ctx.fillStyle = this._borderColor;
			ctx.fillRect(startOrt - this._borderWidth, startPar, this._borderWidth, height);
		}

		// clip mask
		ctx.beginPath();
		ctx.rect(startOrt, startPar, width, height);
		ctx.clip();
		// draw background
		ctx.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		ctx.fillRect(startOrt, startPar, width, height);
		// draw resize handle
		var handleSize = this._resizeHandleSize;
		if (isCurrent && height > 2 * handleSize) {
			var center = startPar + height - handleSize / 2;
			var x = startOrt + 2;
			var w = width - 4;
			var size = 2;
			var offset = 1;
			ctx.fillStyle = '#BBBBBB'
			ctx.fillRect(x + 2, center - size - offset, w - 4, size);
			ctx.fillRect(x + 2, center + offset, w - 4, size);
		}
		// draw text content
		ctx.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(content, startOrt + (width / 2), endPar - (height / 2));
		// draw row separator
		ctx.fillStyle = this._borderColor;
		ctx.fillRect(startOrt, endPar - 1, width , this._borderWidth);
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

		ctx.translate(0, this._position + this._startOffset);
		// clip mask
		ctx.beginPath();
		ctx.rect(startOrt, startPar, headSize, height);
		ctx.clip();
		if (!group.hidden) {
			//draw tail
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(startOrt + 2, startPar + headSize);
			ctx.lineTo(startOrt + 2, startPar + height - 1);
			ctx.lineTo(startOrt + 2 + headSize / 2, startPar + height - 1);
			ctx.stroke();
			// draw head
			ctx.fillStyle = this._hoverColor;
			ctx.fillRect(startOrt, startPar, headSize, headSize);
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 0.5;
			ctx.strokeRect(startOrt, startPar, headSize, headSize);
			// draw '-'
			ctx.lineWidth = 1;
			ctx.strokeRect(startOrt + headSize / 4, startPar + headSize / 2, headSize / 2, 1);
		}
		else {
			// draw head
			ctx.fillStyle = this._hoverColor;
			ctx.fillRect(startOrt, startPar, headSize, headSize);
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 0.5;
			ctx.strokeRect(startOrt, startPar, headSize, headSize);
			// draw '+'
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(startOrt + headSize / 4, startPar + headSize / 2);
			ctx.lineTo(startOrt + 3 * headSize / 4, startPar + headSize / 2);
			ctx.moveTo(startOrt + headSize / 2, startPar + headSize / 4);
			ctx.lineTo(startOrt + headSize / 2, startPar + 3 * headSize / 4);
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
		var startPar = this._cornerCanvas.height / scale - (ctrlHeadSize + (L.Control.Header.colHeaderHeight - ctrlHeadSize) / 2);

		ctx.save();
		ctx.scale(scale, scale);
		ctx.fillStyle = this._hoverColor;
		ctx.fillRect(startOrt, startPar, ctrlHeadSize, ctrlHeadSize);
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(startOrt, startPar, ctrlHeadSize, ctrlHeadSize);
		// draw level number
		ctx.fillStyle = this._textColor;
		ctx.font = this._font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startOrt + (ctrlHeadSize / 2), startPar + (ctrlHeadSize / 2));
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;
		if (index)
			entry = this._data.get(index);

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var rowStart = entry.pos - entry.size + this._position;
		var rowEnd = entry.pos + this._position;

		var left = rect.left;
		var right = rect.right;
		var top = rect.top + rowStart;
		var bottom = rect.top + rowEnd;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	viewRowColumnHeaders: function (e) {
		if (e.data.rows && e.data.rows.length) {
			this.fillRows(e.data.rows, e.data.rowGroups, e.converter, e.context);
		}
	},

	fillRows: function (rows, rowGroups, converter, context) {
		if (rows.length < 2)
			return;

		var headerEntry, index, iterator, height, pos;

		var canvas = this._canvas;
		this._setCanvasWidth();
		this._setCanvasHeight();
		this._canvasContext.clearRect(0, 0, canvas.width, canvas.height);

		// update first header index and reset no more valid variables
		this._startHeaderIndex = parseInt(rows[0].text);
		this._current = -1;
		this._selection.start = this._selection.end = -1;
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;

		// create header data handler instance
		this._data = new L.Control.Header.DataImpl();

		// setup conversion routine
		this.converter = L.Util.bind(converter, context);
		this._data.converter = L.Util.bind(this._twipsToPixels, this);

		// create group array
		this._groupLevels = parseInt(rows[0].groupLevels);
		this._groups = this._groupLevels ? new Array(this._groupLevels) : null;

		var startOffsetTw = parseInt(rows[0].size);
		this._startOffset = this._twipsToPixels(startOffsetTw);

		this._data.pushBack(0, {pos: startOffsetTw, size: 0});
		var prevPos = startOffsetTw;
		var nextIndex = parseInt(rows[1].text);
		var last = rows.length - 1;

		for (iterator = 1; iterator < last; iterator++) {
			index = nextIndex;
			pos = parseInt(rows[iterator].size);
			nextIndex = parseInt(rows[iterator+1].text);
			height = pos - prevPos;
			prevPos = Math.round(pos + height * (nextIndex - index - 1));
			index = index - this._startHeaderIndex;
			headerEntry = {pos: pos, size: height};
			this._data.pushBack(index, headerEntry);
		}

		// setup last header entry
		index = nextIndex - this._startHeaderIndex;
		pos = parseInt(rows[last].size);
		height = pos - prevPos;
		this._data.pushBack(index, {pos: pos, size: height});

		// collect group controls data
		if (rowGroups !== undefined && this._groups) {
			this._collectGroupsData(rowGroups);
		}

		if (this._groups) {
			this.resize(this._computeOutlineWidth() + this._borderWidth + this._headerWidth);
		}
		else if (this._canvasWidth !== this._headerWidth) {
			this.resize(this._headerWidth);
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
		if ($('.spreadsheet-header-rows').length > 0) {
			$('.spreadsheet-header-rows').contextMenu(this._map._permission === 'edit');
		}
	},

	_selectRow: function(row, modifier) {
		var command = {
			Row: {
				type: 'long',
				value: row - 1
			},
			Modifier: {
				type: 'unsigned short',
				value: modifier
			}
		};

		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_onClick: function (e) {
		if (this._onOutlineMouseEvent(e, this._onGroupControlClick))
			return;

		if (!this._mouseOverEntry)
			return;

		var row = this._mouseOverEntry.index + this._startHeaderIndex;

		var modifier = 0;
		if (e.shiftKey) {
			modifier += this._map.keyboard.keyModifier.shift;
		}
		if (e.ctrlKey) {
			modifier += this._map.keyboard.keyModifier.ctrl;
		}

		this._selectRow(row, modifier);
	},

	_onCornerHeaderClick: function(e) {
		var pos = this._mouseEventToCanvasPos(this._cornerCanvas, e);

		if (pos.x > this.getOutlineWidth()) {
			// empty rectangle on the right select all
			this._map.sendUnoCommand('.uno:SelectAll');
			return;
		}

		var level = this._getGroupLevel(pos.x);
		this._updateOutlineState(/*is column: */ false, {column: false, level: level, index: -1});
	},

	_onDialogResult: function (e) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}

		this._map.enable(true);
	},

	_getHorzLatLng: function (start, offset, e) {
		var limit = this._map.mouseEventToContainerPoint({clientX: start.x, clientY: start.y});
		var drag = this._map.mouseEventToContainerPoint(e);
		return [
			this._map.containerPointToLatLng(new L.Point(0, Math.max(limit.y, drag.y + offset.y))),
			this._map.containerPointToLatLng(new L.Point(this._map.getSize().x, Math.max(limit.y, drag.y + offset.y)))
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._horzLine) {
			this._horzLine = L.polyline(this._getHorzLatLng(start, offset, e), {color: 'darkblue', weight: 1});
		}
		else {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}

		this._map.addLayer(this._horzLine);
	},

	onDragMove: function (item, start, offset, e) {
		if (this._horzLine) {
			this._horzLine.setLatLngs(this._getHorzLatLng(start, offset, e));
		}
	},

	onDragEnd: function (item, start, offset, e) {
		var end = new L.Point(e.clientX, e.clientY + offset.y);
		var distance = this._map._docLayer._pixelsToTwips(end.subtract(start));

		var clickedRow = this._mouseOverEntry;
		if (clickedRow) {
			var height = clickedRow.size;
			var row = clickedRow.index + this._startHeaderIndex;

			if (this._data.isZeroSize(clickedRow.index + 1)) {
				row += 1;
				height = 0;
			}

			if (height !== distance.y) {
				var command = {
					RowHeight: {
						type: 'unsigned short',
						value: this._map._docLayer.twipsToHMM(Math.max(distance.y, 0))
					},
					Row: {
						type: 'long',
						value: row
					}
				};

				this._map.sendUnoCommand('.uno:RowHeight', command);
			}
		}

		this._map.removeLayer(this._horzLine);
	},

	onDragClick: function (item, clicks/*, e*/) {
		this._map.removeLayer(this._horzLine);

		if (!this._mouseOverEntry)
			return;

		if (clicks === 2) {
			var row = this._mouseOverEntry.index + this._startHeaderIndex;
			var command = {
				Row: {
					type: 'long',
					value: row - 1
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			var extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectRow', command);
			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}
	},

	_onUpdatePermission: function (e) {
		if (this._map.getDocType() !== 'spreadsheet') {
			return;
		}

		if (!this._initialized) {
			this._initialize();
		}
		// Enable context menu on row headers only if permission is 'edit'
		if ($('.spreadsheet-header-rows').length > 0) {
			$('.spreadsheet-header-rows').contextMenu(e.perm === 'edit');
		}
	},

	_getParallelPos: function (point) {
		return point.y;
	},

	_getOrthogonalPos: function (point) {
		return point.x;
	},

	resize: function (width) {
		if (width < this._headerWidth)
			return;

		var columnHeader = L.DomUtil.get('spreadsheet-header-columns-container');
		var document = L.DomUtil.get('document-container');

		this._setCornerCanvasWidth(width);

		var deltaLeft = width - this._canvasWidth;
		var colHdrLeft = parseInt(L.DomUtil.getStyle(columnHeader, 'left')) + deltaLeft;
		var docLeft = parseInt(L.DomUtil.getStyle(document, 'left')) + deltaLeft;
		L.DomUtil.setStyle(columnHeader, 'left', colHdrLeft + 'px');
		L.DomUtil.setStyle(document, 'left', docLeft + 'px');

		this._setCanvasWidth(width);

		this._map.fire('updatecornerheader');
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
