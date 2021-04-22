/* -*- js-indent-level: 8 -*- */
/*
* Control.ColumnHeader
*/

/* global _UNO */
L.Control.ColumnHeader = L.Control.Header.extend({
	name: L.CSections.ColumnHeader.name,
	anchor: [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.CornerHeader.name, 'right', 'left']],
	position: [0, 0], // This section's myTopLeft is placed according to corner header and column group sections.
	size: [0, 19 * window.devicePixelRatio], // No initial width is necessary.
	expand: ['left', 'right'], // Expand horizontally.
	processingOrder: L.CSections.ColumnHeader.processingOrder,
	drawingOrder: L.CSections.ColumnHeader.drawingOrder,
	zIndex: L.CSections.ColumnHeader.zIndex,
	interactable: true,
	sectionProperties: {},

	options: {
		cursor: 'col-resize'
	},

	onInitialize: function () {
		this._map = L.Map.THIS;
		this._isColumn = true;
		this._setConverter();
		this._current = -1;
		this._resizeHandleSize = 15 * this.dpiScale;
		this._selection = {start: -1, end: -1};
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;
		this._hitResizeArea = false;

		this._selectionBackgroundGradient = [ '#3465A4', '#729FCF', '#004586' ];

		this._map.on('move zoomchanged sheetgeometrychanged splitposchanged', this._updateCanvas, this);
		this._map.on('updateselectionheader', this._onUpdateSelection, this);
		this._map.on('clearselectionheader', this._onClearSelection, this);
		this._map.on('updatecurrentheader', this._onUpdateCurrentColumn, this);

		this._initHeaderEntryStyles('spreadsheet-header-column');
		this._initHeaderEntryHoverStyles('spreadsheet-header-column-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-column-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-column-resize');

		this._headerHeight = 19 * window.devicePixelRatio;

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

		this._menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(this._menuItem, true, '');
		this._headerInfo = new L.Control.Header.HeaderInfo(this._map, true /* isCol */);
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

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var content = this._colIndexToAlpha(entry.index + 1);
		var startX = entry.pos - entry.size;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (entry.size <= 0)
			return;

		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = this.context.createLinearGradient(startX, 0, startX, this.size[1]);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw background
		this.context.beginPath();
		this.context.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		this.context.fillRect(startX, 0, entry.size, this.size[1]);

		// draw resize handle
		var handleSize = this._resizeHandleSize;
		if (isCurrent && entry.size > 2 * handleSize && !this.inResize()) {
			var center = startX + entry.size - handleSize / 2;
			var y = 2 * this.dpiScale;
			var h = this.size[1] - 4 * this.dpiScale;
			var size = 2 * this.dpiScale;
			var offset = 1 * this.dpiScale;

			this.context.fillStyle = '#BBBBBB';
			this.context.beginPath();
			this.context.fillRect(center - size - offset, y + 2 * this.dpiScale, size, h - 4 * this.dpiScale);
			this.context.beginPath();
			this.context.fillRect(center + offset, y + 2 * this.dpiScale, size, h - 4 * this.dpiScale);
		}

		// draw text content
		this.context.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		this.context.font = this.getFont();
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle';
		// The '+ 1' below is a hack - it's currently not possible to measure
		// the exact bounding box in html5's canvas, and the textBaseline
		// 'middle' measures everything including the descent etc.
		// '+ 1' looks visually fine, and seems safe enough
		this.context.fillText(content, entry.pos - (entry.size / 2), (this.size[1] / 2) + 1);

		// draw column borders.
		this.context.strokeStyle = this._borderColor;
		this.context.lineWidth = this.dpiScale;
		this.context.strokeRect(startX - 0.5, 0.5, entry.size, this.size[1]);
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;
		if (index) {
			entry = this._headerInfo.getColData(index);
		}

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var colStart = (entry.pos - entry.size) / this.dpiScale;
		var colEnd = entry.pos / this.dpiScale;

		var left = rect.left + colStart;
		var right = rect.left + colEnd;
		var top = rect.top;
		var bottom = rect.bottom;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	onDraw: function () {
		var isHighlighted = null;
		if (this._map._docLayer._isWholeRowSelected() === true)
			isHighlighted = true;

		this._headerInfo.forEachElement(function(elemData) {
			this.drawHeaderEntry(elemData, false, isHighlighted);
		}.bind(this));

		this.drawResizeLineIfNeeded();
	},

	onClick: function (point, e) {
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
	},

	onDragEnd: function (dragDistance) {
		if (dragDistance[0] === 0) {
			return;
		}
		else {
			var width = this._dragEntry.size;
			var column = this._dragEntry.index;

			var nextCol = this._headerInfo.getNextIndex(this._dragEntry.index);
			if (this._headerInfo.isZeroSize(nextCol)) {
				column = nextCol;
				width = 0;
			}

			width += dragDistance[0];
			width /= this.dpiScale;
			width = this._map._docLayer._pixelsToTwips({x: width, y: 0}).x;

			var command = {
				ColumnWidth: {
					type: 'unsigned short',
					value: this._map._docLayer.twipsToHMM(Math.max(width, 0))
				},
				Column: {
					type: 'unsigned short',
					value: column + 1 // core expects 1-based index.
				}
			};

			this._map.sendUnoCommand('.uno:ColumnWidth', command);
		}
	},

	setOptimalWidthAuto: function () {
		if (this._mouseOverEntry) {
			var column = this._mouseOverEntry.index;
			var command = {
				Column: {
					type: 'long',
					value: column
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

			this._map.sendUnoCommand('.uno:SelectColumn', command);
			this._map.sendUnoCommand('.uno:SetOptimalColumnWidthDirect', extra);
		}
	},

	_getParallelPos: function (point) {
		return point.x;
	},

	_getOrthogonalPos: function (point) {
		return point.y;
	},

	onResize: function () {},
	onRemove: function () {},
});

L.control.columnHeader = function (options) {
	return new L.Control.ColumnHeader(options);
};
