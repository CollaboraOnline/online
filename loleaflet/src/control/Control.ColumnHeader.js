/* -*- js-indent-level: 8 -*- */
/*
* Control.ColumnHeader
*/

/* global $ _UNO Hammer */
L.Control.ColumnHeader = L.Control.Header.extend({
	options: {
		cursor: 'col-resize'
	},

	onAdd: function (map) {
		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('move zoomchanged sheetgeometrychanged splitposchanged', this._updateCanvas, this);
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
		this._canvasBaseHeight = this._canvasHeight;

		var scale = this.canvasDPIScale();
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

		this._startOffset = 0;
		this._position = 0;

		L.DomEvent.addListener(this._cornerCanvas, 'click', this._onCornerHeaderClick, this);

		this._menuItem = {
			'.uno:InsertColumnsBefore': {
				name: _UNO('.uno:InsertColumnsBefore', 'spreadsheet', true),
				callback: (this._insertColBefore).bind(this)
			},
			'.uno:InsertColumnsAfter': {
				name: _UNO('.uno:InsertColumnsAfter', 'spreadsheet', true),
				callback: (this._insertColAfter).bind(this)
			},
			'.uno:DeleteColumns': {
				name: _UNO('.uno:DeleteColumns', 'spreadsheet', true),
				callback: (this._deleteSelectedCol).bind(this)
			},
			'.uno:SetOptimalColumnWidth': {
				name: _UNO('.uno:SetOptimalColumnWidth', 'spreadsheet', true),
				callback: (this._optimalWidth).bind(this)
			},
			'.uno:HideColumn': {
				name: _UNO('.uno:HideColumn', 'spreadsheet', true),
				callback: (this._hideColumn).bind(this)
			},
			'.uno:ShowColumn': {
				name: _UNO('.uno:ShowColumn', 'spreadsheet', true),
				callback: (this._showColumn).bind(this)
			}
		};

		if (!window.mode.isMobile()) {
			L.installContextMenu({
				selector: '.spreadsheet-header-columns',
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

	optimalWidth: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalColumnWidth');
	},

	insertColumnBefore: function(index) {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	},

	insertColumnAfter: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumnsAfter');
		this._updateColumnHeader();
	},

	deleteColumn: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	},

	hideColumn: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	},

	showColumn: function(index) {
		if (!this.isHighlighted(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	},

	_updateCanvas: function () {
		if (this._headerInfo) {
			this._headerInfo.update();
			this._redrawHeaders();
		}
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
		this.clearSelection();
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
		this.updateSelection(start, end);
	},

	_onUpdateCurrentColumn: function (e) {
		var x = e.curX - 1; // 1-based to 0-based.
		var w = this._twipsToPixels(e.width);
		var slim = w <= 1;
		this.updateCurrent(x, slim);
	},

	_updateColumnHeader: function () {
		this._map._docLayer.refreshViewData({x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	},

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var ctx = this._canvasContext;
		var content = this._colIndexToAlpha(entry.index + 1);
		var startOrt = this._canvasHeight - this._headerHeight;
		var posTemp = entry.pos * (L.Browser.retina ? 2: 1);
		var startPar = posTemp - (entry.size * (L.Browser.retina ? 2: 1));
		var endPar = posTemp;
		var width = endPar - startPar;
		var height = this._headerHeight;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (width <= 0)
			return;

		ctx.save();
		//var scale = this.canvasDPIScale();
		//ctx.scale(scale, scale);
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
		ctx.font = this._font.getFont();
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
		var startPar = this._headerInfo.docToHeaderPos(group.startPos);
		var height = group.endPos - group.startPos;

		ctx.save();
		var scale = this.canvasDPIScale();
		ctx.scale(scale, scale);

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
		var scale = this.canvasDPIScale();

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
		ctx.font = this._font.getFont();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(level + 1, startPar + (ctrlHeadSize / 2), startOrt + (ctrlHeadSize / 2));
		ctx.restore();
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;
		if (index) {
			entry = this._headerInfo.getColData(index);
		}

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var colStart = entry.pos - entry.size;
		var colEnd = entry.pos;

		var left = rect.left + colStart;
		var right = rect.left + colEnd;
		var top = rect.top;
		var bottom = rect.bottom;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	viewRowColumnHeaders: function (e) {
		var dataInEvent = (e.data && e.data.columns && e.data.columns.length > 0);
		if (dataInEvent || e.updatecolumns) {
			dataInEvent ? this.fillColumns(e.data.columns, e.data.columnGroups, e.converter, e.context) :
				this.fillColumns(undefined, undefined, e.converter, e.context);
			this._onUpdateCurrentColumn(e.cursor);
			if (e.selection && e.selection.hasSelection) {
				this._onUpdateSelection(e.selection);
			}
			else {
				this._onClearSelection();
			}
		}
	},

	fillColumns: function (columns, colGroups, converter, context) {
		if (columns && columns.length < 2)
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
			// create data structure for column widths
			this._headerInfo = new L.Control.Header.HeaderInfo(this._map, true /* isCol */);
			this._map._colHdr = this._headerInfo;
		}

		// setup conversion routine
		this.converter = L.Util.bind(converter, context);

		// create group array
		this._groupLevels = columns ? parseInt(columns[0].groupLevels):
			sheetGeometry.getColumnGroupLevels();
		this._groups = this._groupLevels ? new Array(this._groupLevels) : null;

		// collect group controls data
		if (colGroups !== undefined && this._groups) {
			this._collectGroupsData(colGroups);
		}
		else if (sheetGeometry) {
			this._collectGroupsData(sheetGeometry.getColumnGroupsDataInView());
		}

		if (this._groups) {
			this.resize(this._computeOutlineWidth() + this._borderWidth + this._headerHeight);
		}
		else if (this._canvasHeight !== this._headerHeight) {
			this.resize(this._headerHeight);
		}

		this._redrawHeaders();

		this.mouseInit(canvas);

		if ($('.spreadsheet-header-columns').length > 0) {
			$('.spreadsheet-header-columns').contextMenu(this._map.isPermissionEdit());
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
				value: colNumber
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

		var col = this._mouseOverEntry.index;

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

		var scale = this.canvasDPIScale();
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
		var size = this._map.getSize();
		var drag = this._map.mouseEventToContainerPoint(e);
		var entryStart = this._dragEntry.pos - this._dragEntry.size;
		var xpos = Math.max(drag.x, entryStart);
		return [
			this._map.unproject(new L.Point(xpos, 0)),
			this._map.unproject(new L.Point(xpos, size.y)),
		];
	},

	onDragStart: function (item, start, offset, e) {
		if (!this._vertLine) {
			this._vertLine = L.polyline(this._getVertLatLng(start, offset, e), {color: 'darkblue', weight: 1, fixed: true});
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
			var column = clickedColumn.index;

			var nextCol = this._headerInfo.getNextIndex(clickedColumn.index);
			if (this._headerInfo.isZeroSize(nextCol)) {
				column = nextCol;
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
						value: column + 1 // core expects 1-based index.
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
			var column = this._mouseOverEntry.index;
			var command = {
				Col: {
					type: 'unsigned short',
					value: column
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
		var document = this._map.options.documentContainer;

		this._setCornerCanvasHeight(height);
		var deltaTop = height - this._canvasHeight;
		var rowHdrTop = parseInt(L.DomUtil.getStyle(rowHeader, 'top')) + deltaTop;
		var docTop = parseInt(L.DomUtil.getStyle(document, 'top')) + deltaTop;
		L.DomUtil.setStyle(rowHeader, 'top', rowHdrTop + 'px');
		// L.DomUtil.setStyle does not seem to affect the attributes when
		// one of the media queries of document-container element are
		// active (non-desktop case). Using style.setProperty directly
		// seems to work as expected for both mobile/desktop.
		document.style.setProperty('top', docTop + 'px', 'important');

		this._setCanvasHeight(height);

		this._map.fire('updatecornerheader');
	},

	_insertColBefore: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.insertColumnBefore.call(this, index);
		}
	},

	_insertColAfter: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.insertColumnAfter.call(this, index);
		}
	},

	_deleteSelectedCol: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.deleteColumn.call(this, index);
		}
	},

	_optimalWidth: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.optimalWidth.call(this, index);
		}
	},

	_hideColumn: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.hideColumn.call(this, index);
		}
	},

	_showColumn: function() {
		var index = this._lastMouseOverIndex;
		if (index) {
			this.showColumn.call(this, index);
		}
	}
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
