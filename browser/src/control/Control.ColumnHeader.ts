/* -*- js-indent-level: 8 -*- */
/*
* Control.ColumnHeader
*/

/* global _UNO app UNOModifier */
namespace cool {

export class ColumnHeader extends Header {

	_current: number;
	_resizeHandleSize: number;
	_selection: SelectionRange;

	constructor(options?: HeaderExtraProperties) {
		super({
			name: L.CSections.ColumnHeader.name,
			anchor: [[L.CSections.ColumnGroup.name, 'bottom', 'top'], [L.CSections.CornerHeader.name, 'right', 'left']],
			position: [0, 0], // This section's myTopLeft is placed according to corner header and column group sections.
			size: [0, 19 * app.dpiScale], // No initial width is necessary.
			expand: 'right', // Expand horizontally.
			processingOrder: L.CSections.ColumnHeader.processingOrder,
			drawingOrder: L.CSections.ColumnHeader.drawingOrder,
			zIndex: L.CSections.ColumnHeader.zIndex,
			interactable: true,
			sectionProperties: {},
			cursor: (options == undefined || options.cursor === undefined) ? 'col-resize' : options.cursor,
		});
	}

	onInitialize(): void {
		this._map = L.Map.THIS;
		this._isColumn = true;
		this._current = -1;
		this._resizeHandleSize = 15 * app.dpiScale;
		this._selection = {start: -1, end: -1};
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;
		this._hitResizeArea = false;
		this.sectionProperties.docLayer = this._map._docLayer;

		this._selectionBackgroundGradient = [ '#3465A4', '#729FCF', '#004586' ];

		this._map.on('move zoomchanged sheetgeometrychanged splitposchanged darkmodechanged', this._updateCanvas, this);

		this._initHeaderEntryStyles('spreadsheet-header-column');
		this._initHeaderEntryHoverStyles('spreadsheet-header-column-hover');
		this._initHeaderEntrySelectedStyles('spreadsheet-header-column-selected');
		this._initHeaderEntryResizeStyles('spreadsheet-header-column-resize');

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
			'.uno:ColumnWidth': {
				name: _UNO('.uno:ColumnWidth', 'spreadsheet', true),
				callback: (this._columnWidth).bind(this)
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
		this._headerInfo = new cool.HeaderInfo(this._map, true /* isCol */);
	}

	drawHeaderEntry (entry: HeaderEntryData): void {
		if (!entry)
			return;

		const isRTL = this.isCalcRTL();
		const content = this._colIndexToAlpha(entry.index + 1);
		const startX = isRTL ? this.size[0] - entry.pos : entry.pos - entry.size;

		if (entry.size <= 0)
			return;

		const highlight = entry.isCurrent || entry.isHighlighted;

		// background gradient
		let selectionBackgroundGradient = null;
		if (highlight) {
			selectionBackgroundGradient = this.context.createLinearGradient(startX, 0, startX, this.size[1]);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw background
		this.context.beginPath();
		this.context.fillStyle = highlight ? selectionBackgroundGradient : entry.isOver ? this._hoverColor : this._backgroundColor;
		this.context.fillRect(startX, 0, entry.size, this.size[1]);

		// draw resize handle
		const handleSize = this._resizeHandleSize;
		if (entry.isCurrent && entry.size > 2 * handleSize && !this.inResize()) {
			const center = isRTL ? startX + handleSize / 2 : startX + entry.size - handleSize / 2;
			const y = 2 * app.dpiScale;
			const h = this.size[1] - 4 * app.dpiScale;
			const size = 2 * app.dpiScale;
			const offset = 1 * app.dpiScale;

			this.context.fillStyle = '#BBBBBB';
			this.context.beginPath();
			this.context.fillRect(center - size - offset, y + 2 * app.dpiScale, size, h - 4 * app.dpiScale);
			this.context.beginPath();
			this.context.fillRect(center + offset, y + 2 * app.dpiScale, size, h - 4 * app.dpiScale);
		}

		// draw text content
		this.context.fillStyle = highlight ? this._selectionTextColor : this._textColor;
		this.context.font = this.getFont();
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle';
		// The '+ 1' below is a hack - it's currently not possible to measure
		// the exact bounding box in html5's canvas, and the textBaseline
		// 'middle' measures everything including the descent etc.
		// '+ 1' looks visually fine, and seems safe enough
		this.context.fillText(content,
			isRTL ? startX + (entry.size / 2) : entry.pos - (entry.size / 2),
			(this.size[1] / 2) + 1);

		// draw column borders.
		this.context.strokeStyle = this._borderColor;
		this.context.lineWidth = app.dpiScale;
		this.context.strokeRect(startX - 0.5, 0.5, entry.size, this.size[1]);
	}

	getHeaderEntryBoundingClientRect (index: number): Partial<DOMRect> {
		let entry = this._mouseOverEntry;
		if (index) {
			entry = this._headerInfo.getColData(index);
		}

		if (!entry)
			return;

		const rect = this.containerObject.getCanvasBoundingClientRect();
		const colStart = (entry.pos - entry.size) / app.dpiScale;
		const colEnd = entry.pos / app.dpiScale;

		const isRTL = this.isCalcRTL();

		const left = isRTL ? rect.right - colEnd : rect.left + colStart;
		const right = isRTL ? rect.right - colStart : rect.left + colEnd;
		const top = rect.top;
		const bottom = rect.bottom;
		return {left: left, right: right, top: top, bottom: bottom};
	}

	onDraw(): void {
		this._headerInfo.forEachElement(function(elemData: HeaderEntryData): boolean {
			this.drawHeaderEntry(elemData);
			return false; // continue till last.
		}.bind(this));

		this.drawResizeLineIfNeeded();
	}

	onClick(point: number[], e: MouseEvent): void {
		if (!this._mouseOverEntry)
			return;

		const col = this._mouseOverEntry.index;

		let modifier = 0;
		if (e.shiftKey) {
			modifier += UNOModifier.SHIFT;
		}
		if (e.ctrlKey) {
			modifier += UNOModifier.CTRL;
		}

		this._selectColumn(col, modifier);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	_onDialogResult(e: any) {
		if (e.type === 'submit' && !isNaN(e.value)) {
			const extra = {
				aExtraWidth: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalColumnWidth', extra);
		}
	}

	onDragEnd (dragDistance: number[]): number {
		if (dragDistance[0] === 0)
			return;

		let width = this._dragEntry.size;
		let column = this._dragEntry.index;

		const nextCol = this._headerInfo.getNextIndex(this._dragEntry.index);
		if (this._headerInfo.isZeroSize(nextCol)) {
			column = nextCol;
			width = 0;
		}

		const isRTL = this.isCalcRTL();

		if (isRTL) {
			width -= dragDistance[0];
		}
		else {
			width += dragDistance[0];
		}

		width /= app.dpiScale;
		width = this._map._docLayer._pixelsToTwips({x: width, y: 0}).x;

		const command = {
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
		this._mouseOverEntry = null;
	}

	onMouseUp(): void {
		super.onMouseUp();

		if (!(this.containerObject.isDraggingSomething() && this._dragEntry)) {
			const entry = this._mouseOverEntry;
			let modifier = 0;

			if (this._startSelectionEntry && this._startSelectionEntry.index !== entry.index) {
				this._selectColumn(this._startSelectionEntry.index, modifier);
				modifier += UNOModifier.SHIFT;
				this._selectColumn(entry.index, modifier);
			}

			this._startSelectionEntry = null;
		}
	}

	setOptimalWidthAuto(): void {
		if (this._mouseOverEntry) {
			const column = this._mouseOverEntry.index;
			const command = {
				Column: {
					type: 'long',
					value: column
				},
				Modifier: {
					type: 'unsigned short',
					value: 0
				}
			};

			const extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: 0
				}
			};

			this._map.sendUnoCommand('.uno:SelectColumn', command);
			this._map.sendUnoCommand('.uno:SetOptimalColumnWidthDirect', extra);
		}
	}

	_getParallelPos (point: cool.Point): number {
		return point.x;
	}

	_getOrthogonalPos (point: cool.Point): number {
		return point.y;
	}
}

}

L.Control.ColumnHeader = cool.ColumnHeader;

L.control.columnHeader = function (options?: cool.HeaderExtraProperties) {
	return new L.Control.ColumnHeader(options);
};
