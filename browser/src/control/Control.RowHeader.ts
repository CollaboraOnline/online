/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.RowHeader
*/

/* global _UNO app UNOModifier */

declare var _UNO: any;
declare var UNOModifier: any;

namespace cool {

export class RowHeader extends cool.Header {

	_current: number;
	_resizeHandleSize: number;
	_selection: SelectionRange;

	constructor(options?: HeaderExtraProperties) {
		super({
			name: L.CSections.RowHeader.name,
			anchor: [[L.CSections.CornerHeader.name, 'bottom', 'top'], [L.CSections.RowGroup.name, 'right', 'left']],
			position: [0, 0], // This section's myTopLeft is placed according to corner header and row group sections.
			size: [48 * app.dpiScale, 0], // No initial height is necessary.
			expand: 'top bottom', // Expand vertically.
			processingOrder: L.CSections.RowHeader.processingOrder,
			drawingOrder: L.CSections.RowHeader.drawingOrder,
			zIndex: L.CSections.RowHeader.zIndex,
			interactable: true,
			sectionProperties: {},
			cursor: (options == undefined || options.cursor === undefined) ? 'row-resize' : options.cursor,
		});
	}

	onInitialize(): void {
		this._map = L.Map.THIS;
		this._isColumn = false;
		this._current = -1;
		this._resizeHandleSize = 15 * app.dpiScale;
		this._selection = {start: -1, end: -1};
		this._mouseOverEntry = null;
		this._lastMouseOverIndex = undefined;
		this._hitResizeArea = false;
		this.sectionProperties.docLayer = this._map._docLayer;

		this._selectionBackgroundGradient = [ '#3465A4', '#729FCF', '#004586' ];

		this._map.on('move zoomchanged sheetgeometrychanged splitposchanged darkmodechanged', this._updateCanvas, this);

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
			'.uno:RowHeight': {
				name: _UNO('.uno:RowHeight', 'spreadsheet', true),
				callback: (this._rowHeight).bind(this)
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
		this._headerInfo = new cool.HeaderInfo(this._map, false /* isCol */);
	}

	drawHeaderEntry (entry: HeaderEntryData): void {
		if (!entry)
			return;

		const content = entry.index + 1;
		const startY = entry.pos - entry.size;

		if (entry.size <= 0)
			return;

		const highlight = entry.isCurrent || entry.isHighlighted;

		// background gradient
		let selectionBackgroundGradient = null;
		if (highlight) {
			selectionBackgroundGradient = this.context.createLinearGradient(0, startY, 0, startY + entry.size);
			selectionBackgroundGradient.addColorStop(0, this._selectionBackgroundGradient[0]);
			selectionBackgroundGradient.addColorStop(0.5, this._selectionBackgroundGradient[1]);
			selectionBackgroundGradient.addColorStop(1, this._selectionBackgroundGradient[2]);
		}

		// draw background
		this.context.beginPath();
		this.context.fillStyle = highlight ? selectionBackgroundGradient : entry.isOver ? this._hoverColor : this._backgroundColor;
		this.context.fillRect(0, startY, this.size[0], entry.size);

		// draw resize handle
		const handleSize = this._resizeHandleSize;
		if (entry.isCurrent && entry.size > 2 * handleSize && !this.inResize()) {
			const center = startY + entry.size - handleSize / 2;
			const x = 2 * app.dpiScale;
			const w = this.size[0] - 4 * app.dpiScale;
			const size = 2 * app.dpiScale;
			const offset = 1 *app.dpiScale;

			this.context.fillStyle = '#BBBBBB';
			this.context.beginPath();
			this.context.fillRect(x + 2 * app.dpiScale, center - size - offset, w - 4 * app.dpiScale, size);
			this.context.beginPath();
			this.context.fillRect(x + 2 * app.dpiScale, center + offset, w - 4 * app.dpiScale, size);
		}

		// draw text content
		this.context.fillStyle = highlight ? this._selectionTextColor : this._textColor;
		this.context.font = this.getFont();
		this.context.textAlign = 'center';
		this.context.textBaseline = 'middle';
		this.context.fillText(content.toString(), this.size[0] / 2, entry.pos - (entry.size / 2) + app.roundedDpiScale);

		// draw row borders.
		this.context.strokeStyle = this._borderColor;
		this.context.lineWidth = app.dpiScale;
		this.context.strokeRect(0.5, startY - 0.5, this.size[0], entry.size);
	}

	getHeaderEntryBoundingClientRect (index: number): Partial<DOMRect> {
		let entry = this._mouseOverEntry;

		if (index)
			entry = this._headerInfo.getRowData(index);

		if (!entry)
			return;

		const rect = this.containerObject.getCanvasBoundingClientRect();

		const rowStart = (entry.pos - entry.size) / app.dpiScale;
		const rowEnd = entry.pos / app.dpiScale;

		const left = rect.left;
		const right = rect.right;
		const top = rect.top + rowStart;
		const bottom = rect.top + rowEnd;
		return {left: left, right: right, top: top, bottom: bottom};
	}

	onDraw(): void {
		this._headerInfo.forEachElement(function(elemData: HeaderEntryData): boolean {
			this.drawHeaderEntry(elemData);
			return false; // continue till last.
		}.bind(this));

		this.drawResizeLineIfNeeded();
	}

	onClick (point: number[], e: MouseEvent): void {
		if (!this._mouseOverEntry)
			return;

		const row = this._mouseOverEntry.index;

		let modifier = 0;
		if (e.shiftKey) {
			modifier += UNOModifier.SHIFT;
		}
		if (e.ctrlKey) {
			modifier += UNOModifier.CTRL;
		}

		this._selectRow(row, modifier);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	_onDialogResult (e: any): void {
		if (e.type === 'submit' && !isNaN(e.value)) {
			const extra = {
				aExtraHeight: {
					type: 'unsigned short',
					value: e.value
				}
			};

			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}
	}

	onDragEnd (dragDistance: number[]): void {
		if (dragDistance[1] === 0)
			return;

		let height = this._dragEntry.size;
		let row = this._dragEntry.index;

		const nextRow = this._headerInfo.getNextIndex(this._dragEntry.index);
		if (this._headerInfo.isZeroSize(nextRow)) {
			row = nextRow;
			height = 0;
		}

		height += dragDistance[1];
		height /= app.dpiScale;
		height = this._map._docLayer._pixelsToTwips({x: 0, y: height}).y;

		const command = {
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
		this._mouseOverEntry = null;
	}

	onMouseUp(): void {
		super.onMouseUp();

		if (!(this.containerObject.isDraggingSomething() && this._dragEntry)) {
			const entry = this._mouseOverEntry;
			let modifier = 0;

			if (this._startSelectionEntry && this._startSelectionEntry.index !== entry.index) {
				this._selectRow(this._startSelectionEntry.index, modifier);
				modifier += UNOModifier.SHIFT;
				this._selectRow(entry.index, modifier);
			}

			this._startSelectionEntry = null;
		}
	}

	setOptimalHeightAuto(): void {
		if (this._mouseOverEntry) {
			const row = this._mouseOverEntry.index;
			const command = {
				Row: {
					type: 'long',
					value: row
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

			this._map.sendUnoCommand('.uno:SelectRow', command);
			this._map.sendUnoCommand('.uno:SetOptimalRowHeight', extra);
		}
	}

	_getParallelPos (point: cool.Point): number {
		return point.y;
	}

	_getOrthogonalPos (point: cool.Point): number {
		return point.x;
	}
}

}

L.Control.RowHeader = cool.RowHeader;

L.control.rowHeader = function (options?: cool.HeaderExtraProperties) {
	return new L.Control.RowHeader(options);
};
