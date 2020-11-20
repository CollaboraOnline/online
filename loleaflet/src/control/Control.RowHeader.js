/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowHeader
*/

/* global $ _UNO Hammer */
L.Control.RowHeader = L.Control.Header.extend({
	options: {
		cursor: 'row-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('move zoomchanged sheetgeometrychanged splitposchanged', this._updateCanvas, this);
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

		var scale = this.canvasDPIScale();
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

		this._startOffset = 0;
		this._position = 0;

		this._menuItem = {
			'.uno:InsertRowsBefore': {
				name: _UNO('.uno:InsertRowsBefore', 'spreadsheet', true),
				callback: (this._insertRowAbove).bind(this)
			},
			'.uno:InsertRowsAfter': {
				name: _UNO('.uno:InsertRowsAfter', 'spreadsheet', true),
				callback: (this._insertRowBelow).bind(this)
			},
			'.uno:DeleteRows': {
				name: _UNO('.uno:DeleteRows', 'spreadsheet', true),
				callback: (this._deleteSelectedRow).bind(this)
			},
			'.uno:SetOptimalRowHeight': {
				name: _UNO('.uno:SetOptimalRowHeight', 'spreadsheet', true),
				callback: (this._optimalHeight).bind(this)
			},
			'.uno:HideRow': {
				name: _UNO('.uno:HideRow', 'spreadsheet', true),
				callback: (this._hideRow).bind(this)
			},
			'.uno:ShowRow': {
				name: _UNO('.uno:ShowRow', 'spreadsheet', true),
				callback: (this._showRow).bind(this)
			}
		};

		if (!window.mode.isMobile()) {
			L.installContextMenu({
				selector: '.spreadsheet-header-rows',
				className: 'loleaflet-font',
				items: this._menuItem,
				zIndex: 10
			});
		} else {
			var menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(this._menuItem, true, '');
			(new Hammer(this._canvas, {recognizers: [[Hammer.Press, {time: 500}]]}))
				.on('press', L.bind(function () {
					if (this._map.isPermissionEdit()) {
						window.contextMenuWizard = true;
						this._map.fire('mobilewizard', menuData);
					}
				}, this));
		}

	},

	optimalHeight: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalRowHeight');
	},

	insertRowAbove: function(index) {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	},

	insertRowBelow: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRowsAfter');
	},

	deleteRow: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	},

	hideRow: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	},

	showRow: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	},

	_updateCanvas: function () {
		if (this._headerInfo) {
			this._headerInfo.update();
			this._redrawHeaders();
		}
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
		this.clearSelection();
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
		this.updateSelection(start, end);
	},

	_onUpdateCurrentRow: function (e) {
		var y = e.curY - 1; // 1-based to 0-based.
		var h = this._twipsToPixels(e.height);
		var slim = h <= 1;
		this.updateCurrent(y, slim);
	},

	_updateRowHeader: function () {
		this._map._docLayer.refreshViewData({x: 0, y: this._map._getTopLeftPoint().y, offset: {x: 0, y: undefined}});
	},

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var ctx = this._canvasContext;
		var content = entry.index + 1;
		var startOrt = this._canvasWidth - this._headerWidth;
		var startPar = entry.pos - entry.size;
		var endPar = entry.pos;
		var height = endPar - startPar;
		var width = this._headerWidth;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (height <= 0)
			return;

		ctx.save();
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
			ctx.fillStyle = '#BBBBBB';
			ctx.fillRect(x + 2, center - size - offset, w - 4, size);
			ctx.fillRect(x + 2, center + offset, w - 4, size);
		}
		// draw text content
		ctx.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		ctx.font = this._font.getFont();
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
		var startPar = this._headerInfo.docToHeaderPos(group.startPos);
		var height = group.endPos - group.startPos;

		ctx.save();
		var scale = this.canvasDPIScale();
		ctx.scale(scale, scale);

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
		var scale = this.canvasDPIScale();

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
		ctx.font = this._font.getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startOrt + (ctrlHeadSize / 2), startPar + (ctrlHeadSize / 2));
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;

		if (index)
			entry = this._headerInfo.getRowData(index);

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var rowStart = entry.pos - entry.size;
		var rowEnd = entry.pos;

		var left = rect.left;
		var right = rect.right;
		var top = rect.top + rowStart;
		var bottom = rect.top + rowEnd;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	viewRowColumnHeaders: function (e) {
		var dataInEvent = (e.data && e.data.rows && e.data.rows.length);
		if (dataInEvent || e.updaterows) {
			dataInEvent ? this.fillRows(e.data.rows, e.data.rowGroups, e.converter, e.context) :
				this.fillRows(undefined, undefined, e.converter, e.context);
			this._onUpdateCurrentRow(e.cursor);
			if (e.selection && e.selection.hasSelection) {
				this._onUpdateSelection(e.selection);
			}
			else {
				this._onClearSelection();
			}
		}
	},

	fillRows: function (rows, rowGroups, converter, context) {
		if (rows && rows.length < 2)
			return;

		var canvas = this._canvas;
		this._setCanvasWidth();
		this._setCanvasHeight();
		this._canvasContext.clearRect(0, 0, canvas.width, canvas.height);

		// Reset state
		this._current = -1;
		this._selection.start = this._selection.end = -1;
		this._mouseOverEntry = null;
		if (!window.contextMenuWizard) {
			this._lastMouseOverIndex = undefined;
		}

		var sheetGeometry = this._map._docLayer.sheetGeometry;

		if (!this._headerInfo) {
			// create data structure for row heights
			this._headerInfo = new L.Control.Header.HeaderInfo(this._map, false /* isCol */);
			this._map._rowHdr = this._headerInfo;
		}

		// setup conversion routine
		this.converter = L.Util.bind(converter, context);

		// create group array
		this._groupLevels = rows ? parseInt(rows[0].groupLevels) :
			sheetGeometry.getRowGroupLevels();
		this._groups = this._groupLevels ? new Array(this._groupLevels) : null;

		// collect group controls data
		if (rowGroups !== undefined && this._groups) {
			this._collectGroupsData(rowGroups);
		}
		else if (sheetGeometry) {
			this._collectGroupsData(sheetGeometry.getRowGroupsDataInView());
		}

		if (this._groups) {
			this.resize(this._computeOutlineWidth() + this._borderWidth + this._headerWidth);
		}
		else if (this._canvasWidth !== this._headerWidth) {
			this.resize(this._headerWidth);
		}

		this._redrawHeaders();

		this.mouseInit(canvas);

		if ($('.spreadsheet-header-rows').length > 0) {
			$('.spreadsheet-header-rows').contextMenu(this._map.isPermissionEdit());
		}
	},

	_redrawHeaders: function () {
		this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this._headerInfo.forEachElement(function(elemData) {
			this.drawHeaderEntry(elemData, false);
		}.bind(this));

		// draw group controls
		this.drawOutline();
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

		this._map.sendUnoCommand('.uno:SelectRow ', command);
	},

	_onClick: function (e) {
		if (this._onOutlineMouseEvent(e, this._onGroupControlClick))
			return;

		if (!this._mouseOverEntry)
			return;

		var row = this._mouseOverEntry.index;

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
		var size = this._map.getSize();
		var drag = this._map.mouseEventToContainerPoint(e);
		var entryStart = this._dragEntry.pos - this._dragEntry.size;
		var ypos = Math.max(drag.y, entryStart);
		return [
			this._map.unproject(new L.Point(0, ypos)),
			this._map.unproject(new L.Point(size.x, ypos)),
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._horzLine) {
			this._horzLine = L.polyline(this._getHorzLatLng(start, offset, e), {color: 'darkblue', weight: 1, fixed: true});
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
			var row = clickedRow.index;

			var nextRow = this._headerInfo.getNextIndex(clickedRow.index);
			if (this._headerInfo.isZeroSize(nextRow)) {
				row = nextRow;
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
						value: row + 1 // core expects 1-based index.
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
			var row = this._mouseOverEntry.index;
			var command = {
				Row: {
					type: 'long',
					value: row
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
		var document = this._map.options.documentContainer;

		this._setCornerCanvasWidth(width);

		var deltaLeft = width - this._canvasWidth;
		var colHdrLeft = parseInt(L.DomUtil.getStyle(columnHeader, 'left')) + deltaLeft;
		var docLeft = parseInt(L.DomUtil.getStyle(document, 'left')) + deltaLeft;
		L.DomUtil.setStyle(columnHeader, 'left', colHdrLeft + 'px');
		L.DomUtil.setStyle(document, 'left', docLeft + 'px');

		this._setCanvasWidth(width);

		this._map.fire('updatecornerheader');
	},

	_insertRowAbove: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.insertRowAbove.call(this, index);
		}
	},

	_insertRowBelow: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.insertRowBelow.call(this, index);
		}
	},

	_deleteSelectedRow: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.deleteRow.call(this, index);
		}
	},

	_optimalHeight: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.optimalHeight.call(this, index);
		}
	},

	_hideRow: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.hideRow.call(this, index);
		}
	},

	_showRow: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.showRow.call(this, index);
		}
	}
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
