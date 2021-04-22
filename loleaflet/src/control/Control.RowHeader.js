/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowHeader
*/

/* global _UNO */
L.Control.RowHeader = L.Control.Header.extend({
	name: L.CSections.RowHeader.name,
	anchor: [[L.CSections.CornerHeader.name, 'bottom', 'top'], [L.CSections.RowGroup.name, 'right', 'left']],
	position: [0, 0], // This section's myTopLeft is placed according to corner header and row group sections.
	size: [48 * window.devicePixelRatio, 0], // No initial height is necessary.
	expand: ['top', 'bottom'], // Expand vertically.
	processingOrder: L.CSections.RowHeader.processingOrder,
	drawingOrder: L.CSections.RowHeader.drawingOrder,
	zIndex: L.CSections.RowHeader.zIndex,
	interactable: true,
	sectionProperties: {},
	_headerWidth: 48 * window.devicePixelRatio, // This value is static.

	options: {
		cursor: 'row-resize'
	},

	onInitialize: function () {
		this._map = L.Map.THIS;
		this._setConverter();
		this._isColumn = false;
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
		this._map.on('updatecurrentheader', this._onUpdateCurrentRow, this);

		this._initHeaderEntryStyles('spreadsheet-header-row');
		this._initHeaderEntryHoverStyles('spreadsheet-header-row-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-row-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-row-resize');

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

		this._menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(this._menuItem, true, '');
		this._headerInfo = new L.Control.Header.HeaderInfo(this._map, false /* isCol */);
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

	drawHeaderEntry: function (entry, isOver, isHighlighted, isCurrent) {
		if (!entry)
			return;

		var content = entry.index + 1;
		var startY = entry.pos - entry.size;

		if (isHighlighted !== true && isHighlighted !== false) {
			isHighlighted = this.isHighlighted(entry.index);
		}

		if (entry.size <= 0)
			return;

		// background gradient
		var selectionBackgroundGradient = null;
		if (isHighlighted) {
			selectionBackgroundGradient = this.context.createLinearGradient(0, startY, 0, startY + entry.size);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw background
		this.context.beginPath();
		this.context.fillStyle = isHighlighted ? selectionBackgroundGradient : isOver ? this._hoverColor : this._backgroundColor;
		this.context.fillRect(0, startY, this.size[0], entry.size);

		// draw resize handle
		var handleSize = this._resizeHandleSize;
		if (isCurrent && entry.size > 2 * handleSize) {
			var center = startY + entry.size - handleSize / 2;
			var x = 2 * this.dpiScale;
			var w = this.size[0] - 4 * this.dpiScale;
			var size = 2 * this.dpiScale;
			var offset = 1 *this.dpiScale;

			this.context.fillStyle = '#BBBBBB';
			this.context.beginPath();
			this.context.fillRect(x + 2 * this.dpiScale, center - size - offset, w - 4 * this.dpiScale, size);
			this.context.beginPath();
			this.context.fillRect(x + 2 * this.dpiScale, center + offset, w - 4 * this.dpiScale, size);
		}

		// draw text content
		this.context.fillStyle = isHighlighted ? this._selectionTextColor : this._textColor;
		this.context.font = this.getFont();
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle';
		this.context.fillText(content, this.size[0] / 2, entry.pos - (entry.size / 2) + Math.round(this.dpiScale));

		// draw row borders.
		this.context.strokeStyle = this._borderColor;
		this.context.lineWidth = this.dpiScale;
		this.context.strokeRect(0.5, startY - 0.5, this.size[0], entry.size);
	},

	getHeaderEntryBoundingClientRect: function (index) {
		var entry = this._mouseOverEntry;

		if (index)
			entry = this._headerInfo.getRowData(index);

		if (!entry)
			return;

		var rect = this._canvas.getBoundingClientRect();

		var rowStart = (entry.pos - entry.size) / this.dpiScale;
		var rowEnd = entry.pos / this.dpiScale;

		var left = rect.left;
		var right = rect.right;
		var top = rect.top + rowStart;
		var bottom = rect.top + rowEnd;
		return {left: left, right: right, top: top, bottom: bottom};
	},

	onDraw: function () {
		var isHighlighted = null;
		if (this._map._docLayer._isWholeColumnSelected() === true)
			isHighlighted = true;

		this._headerInfo.forEachElement(function(elemData) {
			this.drawHeaderEntry(elemData, false, isHighlighted);
		}.bind(this));

		this.drawResizeLineIfNeeded();
	},

	onClick: function (point, e) {
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
	},

	onDragEnd: function (dragDistance) {
		if (dragDistance[1] === 0) {
			return;
		}
		else {
			var height = this._dragEntry.size;
			var row = this._dragEntry.index;

			var nextRow = this._headerInfo.getNextIndex(this._dragEntry.index);
			if (this._headerInfo.isZeroSize(nextRow)) {
				row = nextRow;
				height = 0;
			}

			height += dragDistance[1];
			height /= this.dpiScale;
			height = this._map._docLayer._pixelsToTwips({x: 0, y: height}).y;

			var command = {
				RowHeight: {
					type: 'unsigned short',
					value: this._map._docLayer.twipsToHMM(Math.max(height, 0))
				},
				Row: {
					type: 'long',
					value: row + 1 // core expects 1-based index.
				}
			};

			this._map.sendUnoCommand('.uno:RowHeight', command);
			//this.containerObject.requestReDraw();
		}
	},

	setOptimalHeightAuto: function () {
		if (this._mouseOverEntry) {
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

	_getParallelPos: function (point) {
		return point.y;
	},

	_getOrthogonalPos: function (point) {
		return point.x;
	},

	onResize: function () {},
	onRemove: function () {},
});

L.control.rowHeader = function (options) {
	return new L.Control.RowHeader(options);
};
