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
 * Control.Header
 *
 * Abstract class, basis for ColumnHeader and RowHeader controls.
 * Used only in spreadsheets, implements the row/column headers.
 */
/* global $ L app */

namespace cool {

export interface SelectionRange {
	start: number,
	end: number,
}

export class Header extends app.definitions.canvasSectionObject {
	_map: any;
	_textColor: string;
	_backgroundColor: string;
	_borderColor: string;
	_borderWidth: number;
	_cursor: string;
	_hoverColor: string;
	_selectionTextColor: string;
	_selectionBackgroundGradient: string[];
	_resizeCursor: string;
	_lastMouseOverIndex: number;
	_menuData: any;
	_headerInfo: HeaderInfo;
	_dragEntry: HeaderEntryData;
	_mouseOverEntry: HeaderEntryData;
	_prevMouseOverEntry: HeaderEntryData;
	_startSelectionEntry: HeaderEntryData;
	_lastSelectedIndex: number;
	_hitResizeArea: boolean;
	_menuItem: any;
	_dragDistance: number[];
	_isColumn: boolean;
	cursor: string;

	getFont: () => string;

	constructor () {
		super();
	}

	_initHeaderEntryStyles (className: string): void {
		const baseElem = document.getElementsByTagName('body')[0];
		const elem = L.DomUtil.create('div', className, baseElem);
		this._textColor = L.DomUtil.getStyle(elem, 'color');
		this._backgroundColor = getComputedStyle(document.body).getPropertyValue('--color-background-darker');
		const fontFamily = L.DomUtil.getStyle(elem, 'font-family');
		this.getFont = function() {
			const selectedSize = this._getFontSize();
			return selectedSize + 'px ' + fontFamily;
		}.bind(this);
		this._borderColor = L.DomUtil.getStyle(elem, 'border-top-color');
		const borderWidth = L.DomUtil.getStyle(elem, 'border-top-width');
		this._borderWidth = Math.round(parseFloat(borderWidth));
		this._cursor = L.DomUtil.getStyle(elem, 'cursor');
		L.DomUtil.remove(elem);
	}

	_getFontSize(): number {
		const map = this._map;
		const zoomScale = map.getZoomScale(map.getZoom(), map.options.defaultZoom);
		if (zoomScale < 0.68)
			return Math.round(8 * app.dpiScale);
		else if (zoomScale < 0.8)
			return Math.round(10 * app.dpiScale);
		else
			return Math.round(12 * app.dpiScale);
	}

	_initHeaderEntryHoverStyles (className: string): void {
		const baseElem = document.getElementsByTagName('body')[0];
		const elem = L.DomUtil.create('div', className, baseElem);
		this._hoverColor = getComputedStyle(document.body).getPropertyValue('--color-background-lighter');
		L.DomUtil.remove(elem);
	}

	_initHeaderEntrySelectedStyles(className: string): void {
		const baseElem = document.getElementsByTagName('body')[0];
		const elem = L.DomUtil.create('div', className, baseElem);
		this._selectionTextColor = L.DomUtil.getStyle(elem, 'color');

		const selectionBackgroundGradient: string[] = [];
		let gradientColors: string = L.DomUtil.getStyle(elem, 'background-image');
		gradientColors = gradientColors.slice('linear-gradient('.length, -1);
		while (gradientColors) {
			const color = gradientColors.split(',', 3);
			const colorJoin = color.join(','); // color = 'rgb(r, g, b)'
			selectionBackgroundGradient.push(colorJoin);
			gradientColors = gradientColors.substr(color.length); // remove last parsed color
			gradientColors = gradientColors.substr(gradientColors.indexOf('r')); // remove ', ' stuff
		}

		if (selectionBackgroundGradient.length) {
			this._selectionBackgroundGradient = selectionBackgroundGradient;
		}
		L.DomUtil.remove(elem);
	}

	_initHeaderEntryResizeStyles (className: string): void {
		if (this.cursor) {
			this._resizeCursor = this.cursor;
		}
		else {
			const baseElem = document.getElementsByTagName('body')[0];
			const elem = L.DomUtil.create('div', className, baseElem);
			this._resizeCursor = L.DomUtil.getStyle(elem, 'cursor');
			L.DomUtil.remove(elem);
		}
	}

	_isRowColumnInSelectedRange (index: number): boolean {
		return (!!this._headerInfo.getElementData(index).isCurrent) || (!!this._headerInfo.getElementData(index).isHighlighted);
	}

	onContextMenu(evt: MouseEvent): void {
		if ((window as any).mode.isMobile() && this._map.isEditMode()) {
			(window as any).contextMenuWizard = true;
			this._map.fire('mobilewizard', {data: this._menuData});
		}
		else if (this._map.isEditMode()) {
			this._bindContextMenu();
			$('#canvas-container').contextMenu({x: evt.clientX, y: evt.clientY});
		}
	}

	_updateCanvas(): void {
		if (this._headerInfo) {
			this._headerInfo.update(this as any as CanvasSectionObject);
			this.containerObject.requestReDraw();
		}
	}

	_reInitRowColumnHeaderStylesAfterModeChange(): void {
		// add a separation to update row/column DOM element info
		if (this._isColumn) {
			// update column DOM element info
			this._initHeaderEntryStyles('spreadsheet-header-column');
			this._initHeaderEntryHoverStyles('spreadsheet-header-column-hover');
			this._initHeaderEntrySelectedStyles('spreadsheet-header-column-selected');
			this._initHeaderEntryResizeStyles('spreadsheet-header-column-resize');
		}
		else {
			// update row DOM element info
			this._initHeaderEntryStyles('spreadsheet-header-row');
			this._initHeaderEntryHoverStyles('spreadsheet-header-row-hover');
			this._initHeaderEntrySelectedStyles('spreadsheet-header-row-selected');
			this._initHeaderEntryResizeStyles('spreadsheet-header-row-resize');
		}
	}

	optimalHeight (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalRowHeight');
	}

	insertRowAbove (index: number): void {
		// First select the corresponding row because
		// .uno:InsertRows doesn't accept any row number
		// as argument and just inserts before the selected row
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRows');
	}

	insertRowBelow (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertRowsAfter');
	}

	deleteRow (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteRows');
	}

	hideRow (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideRow');
	}

	showRow (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectRow(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowRow');
	}

	_selectRow (row: number, modifier: number): void {
		// If function dialog is open and user wants to add the whole row to function.
		if (this._map.dialog.hasOpenedDialog() && this._map.dialog.getCurrentDialogContainer()) {
			const dialogContainer = this._map.dialog.getCurrentDialogContainer();
			if (dialogContainer.dataset.uniqueId === 'FormulaDialog') {
				const alpha = String(row + 1);
				const text = alpha + ':' + alpha;
				this._map._textInput._sendText(text);
			}

			return;
		}

		// Normal behavior.
		const command = {
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
	}

	_insertRowAbove(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertRowAbove.call(this, index);
		}
	}

	_insertRowBelow(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertRowBelow.call(this, index);
		}
	}

	_deleteSelectedRow(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.deleteRow.call(this, index);
		}
	}

	_rowHeight(): void {
		this._map.sendUnoCommand('.uno:RowHeight');
	}

	_optimalHeight(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.optimalHeight.call(this, index);
		}
	}

	_hideRow(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.hideRow.call(this, index);
		}
	}

	_showRow(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.showRow.call(this, index);
		}
	}

	optimalWidth (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:SetOptimalColumnWidth');
	}

	insertColumnBefore (index: number): void {
		// First select the corresponding column because
		// .uno:InsertColumn doesn't accept any column number
		// as argument and just inserts before the selected column
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumns');
		this._updateColumnHeader();
	}

	insertColumnAfter (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:InsertColumnsAfter');
		this._updateColumnHeader();
	}

	deleteColumn (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:DeleteColumns');
		this._updateColumnHeader();
	}

	hideColumn (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:HideColumn');
		this._updateColumnHeader();
	}

	showColumn (index: number): void {
		if (!this._isRowColumnInSelectedRange(index)) {
			this._selectColumn(index, 0);
		}
		this._map.sendUnoCommand('.uno:ShowColumn');
		this._updateColumnHeader();
	}

	_updateColumnHeader(): void {
		this._map._docLayer.refreshViewData({x: this._map._getTopLeftPoint().x, y: 0, offset: {x: undefined, y: 0}});
	}

	_colIndexToAlpha (columnNumber: number): string {
		const offset = 'A'.charCodeAt(0);
		let dividend = columnNumber;
		let columnName = '';

		while (dividend > 0) {
			const modulo: number = (dividend - 1) % 26;
			columnName = String.fromCharCode(offset + modulo) + columnName;
			dividend = Math.floor((dividend - modulo) / 26);
		}

		return columnName;
	}

	_selectColumn (colNumber: number, modifier: number): void {
		// If function dialog is open and user wants to add the whole column to function.
		if (this._map.dialog.hasOpenedDialog() && this._map.dialog.getCurrentDialogContainer()) {
			const dialogContainer = this._map.dialog.getCurrentDialogContainer();
			if (dialogContainer.dataset.uniqueId === 'FormulaDialog') {
				const alpha = this._colIndexToAlpha(colNumber + 1);
				const text = alpha + ':' + alpha;
				this._map._textInput._sendText(text);
			}

			return;
		}

		// Normal behavior.
		const command = {
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
	}

	_insertColBefore(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertColumnBefore.call(this, index);
		}
	}

	_insertColAfter(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.insertColumnAfter.call(this, index);
		}
	}

	_deleteSelectedCol(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.deleteColumn.call(this, index);
		}
	}

	_columnWidth(): void {
		this._map.sendUnoCommand('.uno:ColumnWidth');
	}

	_optimalWidth(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.optimalWidth.call(this, index);
		}
	}

	_hideColumn(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.hideColumn.call(this, index);
		}
	}

	_showColumn(): void {
		const index = this._lastMouseOverIndex;
		if (index !== undefined) {
			this.showColumn.call(this, index);
		}
	}

	_freezePanes (): void {
		this._map.sendUnoCommand('.uno:FreezePanes');
	}

	_entryAtPoint(point: number[]): PointEntryQueryResult {
		if (!this._headerInfo)
			return undefined;

		const isColumn = this._headerInfo._isColumn;
		const position = isColumn ? point[0]: point[1];

		let result:PointEntryQueryResult  = null;
		const isRTL = isColumn && this.isCalcRTL();
		this._headerInfo.forEachElement(function(entry: HeaderEntryData): boolean {
			const end = isRTL ? this.size[0] - entry.pos + entry.size : entry.pos;
			const start = end - entry.size;
			if (position >= start && position < end) {
				// NOTE: From a geometric perspective resizeAreaStart is really "resizeAreaEnd" in RTL case.
				let resizeAreaStart = isRTL ? Math.min(start + 3 * app.dpiScale, end) : Math.max(start, end - 3 * app.dpiScale);
				if (entry.isCurrent || (window as any).mode.isMobile()) {
					resizeAreaStart = isRTL ? start + this._resizeHandleSize : end - this._resizeHandleSize;
				}
				const isMouseOverResizeArea = isRTL ? (position < resizeAreaStart) : (position > resizeAreaStart);
				result = {entry: entry, hit: isMouseOverResizeArea};
				return true;
			}
		}.bind(this));
		return result;
	}

	drawHeaderEntry (entry: HeaderEntryData): void {
		return;
	}

	onDraw(): void {
		this._headerInfo.forEachElement(function(elemData: HeaderEntryData): boolean {
			this.drawHeaderEntry(elemData);
			return false; // continue till last.
		}.bind(this));

		this.drawResizeLineIfNeeded();
	}

	onDragEnd (dragDistance: number[]): void {
		return;
	}

	onMouseEnter(): void {
		this.containerObject.getCanvasStyle().cursor = this._cursor;
		this._bindContextMenu();
	}

	onMouseLeave (point: number[]): void {
		if (point === null) { // This means that the mouse pointer is outside the canvas.
			if (this.containerObject.isDraggingSomething() && this._dragEntry) { // Were we resizing a row / column before mouse left.
				this.onDragEnd(this.containerObject.getDragDistance());
			}
		}

		if (this._mouseOverEntry) {
			this.containerObject.setPenPosition(this);
			this._mouseOverEntry.isOver = false;
			this.drawHeaderEntry(this._mouseOverEntry);
			this._mouseOverEntry = null;
		}
		this._hitResizeArea = false;
		this.containerObject.getCanvasStyle().cursor = 'default';
	}

	_bindContextMenu(): void {
		if ((window as any).mode.isMobile() || this._map.isReadOnlyMode()) {
			// On mobile, we use the mobile wizard rather than the context menu
			return;
		}

		this._unBindContextMenu();
		$.contextMenu({
			selector: '#canvas-container',
			className: 'cool-font',
			zIndex: 1500,
			items: this._menuItem,
			callback: function() { return; }
		});
		$('#canvas-container').contextMenu('update');
		this._map._contextMenu.stopRightMouseUpEvent();
	}

	_unBindContextMenu(): void {
		$.contextMenu('destroy', '#canvas-container');
	}

	inResize(): boolean {
		return this.containerObject.isDraggingSomething() && this._dragEntry && (this._dragDistance !== null);
	}

	drawResizeLineIfNeeded(): void {
		if (!this.inResize())
			return;

		this.containerObject.setPenPosition(this);
		const isRTL = this.isCalcRTL();
		const x = this._isColumn ? ((isRTL ? this.size[0] - this._dragEntry.pos: this._dragEntry.pos) + this._dragDistance[0]): (isRTL ? 0 : this.size[0]);
		const y = this._isColumn ? this.size[1]: (this._dragEntry.pos + this._dragDistance[1]);

		this.context.lineWidth = app.dpiScale;
		this.context.strokeStyle = 'darkblue';
		this.context.beginPath();
		this.context.moveTo(x, y);
		this.context.lineTo(this._isColumn ? x: (isRTL ? -this.myTopLeft[0]: this.containerObject.getCanvasRight()), this._isColumn ? this.containerObject.getCanvasBottom(): y);
		this.context.stroke();
	}

	onMouseMove (point: number[], dragDistance?: number[]): void {
		const result = this._entryAtPoint(point); // Data related to current entry that the mouse is over now.
		if (result) { // Is mouse over an entry.
			this._prevMouseOverEntry = this._mouseOverEntry;
			this._mouseOverEntry = result.entry;
		}

		if (!this.containerObject.isDraggingSomething()) { // If we are not dragging anything.
			this._dragDistance = null;

			// If mouse was over another entry previously, we draw that again (without mouse-over effect).
			if (this._prevMouseOverEntry && (result && result.entry.index !== this._prevMouseOverEntry.index)) {
				this.containerObject.setPenPosition(this);
				this._prevMouseOverEntry.isOver = false;
				this.drawHeaderEntry(this._prevMouseOverEntry);
			}

			let isMouseOverResizeArea = false;

			this._mouseOverEntry.isOver = true;
			this._lastMouseOverIndex = this._mouseOverEntry.index; // used by context menu
			this.containerObject.setPenPosition(this);
			this.drawHeaderEntry(result.entry);
			isMouseOverResizeArea = result.hit;

			// cypress mobile emulation sometimes triggers resizing unintentionally.
			if (L.Browser.cypressTest)
				return;

			if (isMouseOverResizeArea !== this._hitResizeArea) { // Do we need to change cursor (to resize or pointer).
				const cursor = isMouseOverResizeArea ? this._resizeCursor : this._cursor;
				this.containerObject.getCanvasStyle().cursor = cursor;
				this._hitResizeArea = isMouseOverResizeArea;
			}
		}
		else { // We are in dragging mode.
			this._dragDistance = dragDistance;
			this.containerObject.requestReDraw(); // Remove previously drawn line and paint a new one.

			if (this._prevMouseOverEntry && this._lastSelectedIndex == this._prevMouseOverEntry.index)
				return;
			if (this._dragEntry)
				return;
			const modifier = typeof this._lastSelectedIndex === 'number' && this._lastSelectedIndex >= 0 ? UNOModifier.SHIFT : 0;
			this._lastSelectedIndex = this._mouseOverEntry.index;
			this.selectIndex(this._mouseOverEntry.index, modifier);
		}
	}

	selectIndex(index: number, modifier: number): void {
		return;
	}

	setOptimalWidthAuto(): void {
		return;
	}

	setOptimalHeightAuto(): void {
		return;
	}

	onDoubleClick(): void {
		this._isColumn ? this.setOptimalWidthAuto(): this.setOptimalHeightAuto();
	}

	onMouseDown (point: number[]): void {
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

		this._startSelectionEntry = this._mouseOverEntry;
		this._lastSelectedIndex = null;
	}

	onMouseUp(): void {
		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this.containerObject.isDraggingSomething() && this._dragEntry) {
			this.onDragEnd(this.containerObject.getDragDistance());
			this._dragEntry = null;
		}
	}

	onNewDocumentTopLeft(): void {
		return;
	}
}

export interface HeaderEntryData {
	index: number,
	pos: number, // end position on the header canvas
	size: number,
	origsize: number,
	isHighlighted?: boolean,
	isCurrent?: boolean,
	isOver?: boolean,
}

export interface PointEntryQueryResult {
	entry: HeaderEntryData,
	hit: boolean,
}

export class HeaderInfo {
	_map: any;
	_isColumn: boolean;
	_dimGeom: cool.SheetDimension;
	_docVisStart: number;
	_elements: HeaderEntryData[];
	_startIndex: number;
	_endIndex: number;
	_hasSplits: boolean;
	_splitIndex: number;
	_splitPos: number;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor(map: any, _isColumn: boolean) {
		window.app.console.assert(map && _isColumn !== undefined, 'map and isCol required');
		this._map = map;
		this._isColumn = _isColumn;
		window.app.console.assert(this._map._docLayer.sheetGeometry, 'no sheet geometry data-structure found!');
		const sheetGeom = this._map._docLayer.sheetGeometry as cool.SheetGeometry;
		this._dimGeom = this._isColumn ? sheetGeom.getColumnsGeometry() : sheetGeom.getRowsGeometry();
	}

	findXInCellSelections (cellSelections: cool.Rectangle[], ordinate: number): boolean {
		for (let i = 0; i < cellSelections.length; i++) {
			if (cellSelections[i].containsPixelOrdinateX(ordinate))
				return true;
		}
		return false;
	}

	findYInCellSelections (cellSelections: cool.Rectangle[], ordinate: number): boolean {
		for (let i = 0; i < cellSelections.length; i++) {
			if (cellSelections[i].containsPixelOrdinateY(ordinate))
				return true;
		}
		return false;
	}

	isHeaderEntryHighLighted (cellSelections: cool.Rectangle[], ordinate: number): boolean {
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
	}

	update(section: CanvasSectionObject): void {
		const cellSelections: cool.Rectangle[] = this._map._docLayer._cellSelections;

		let currentIndex: number;
		if (app.calc.cellCursorVisible) {
			currentIndex = this._isColumn ? app.calc.cellAddress.x: app.calc.cellAddress.y;
		} else {
			currentIndex = -1;
		}

		const tsManager = this._map._docLayer._painter;
		const ctx = tsManager._paintContext();

		const splitPos = this._isColumn ?
			ctx.splitPos.x
			: ctx.splitPos.y;

		let startPx: number;
		let scale: number;
		if (tsManager._inZoomAnim) {
			const viewBounds = ctx.viewBounds;
			const freePaneBounds = new L.Bounds(viewBounds.min.add(ctx.splitPos), viewBounds.max);

			scale = tsManager._zoomFrameScale;

			const zoomPos = tsManager._getZoomDocPos(
				tsManager._newCenter,
				tsManager._layer._pinchStartCenter,
				freePaneBounds,
				{ freezeX: false, freezeY: false },
				ctx.splitPos,
				scale,
				false
			);

			startPx = this._isColumn ?
				zoomPos.topLeft.x
				: zoomPos.topLeft.y;
		} else {
			startPx = this._isColumn ?
				section.documentTopLeft[0] + splitPos
				: section.documentTopLeft[1] + splitPos;
			scale = 1;
		}

		const endPx = this._isColumn ?
			startPx + section.size[0] / scale
			: startPx + section.size[1] / scale;

		this._docVisStart = startPx;
		let startIdx = this._dimGeom.getIndexFromPos(startPx, 'corepixels');
		const endIdx = Math.min(this._dimGeom.getIndexFromPos(endPx - 1, 'corepixels'), 1048576 - 1);
		this._elements = [];

		this._hasSplits = false;
		this._splitIndex = 0;

		if (splitPos) {
			const splitIndex = this._dimGeom.getIndexFromPos(splitPos + 1, 'corepixels');

			if (splitIndex) {
				this._splitPos = splitPos;
				this._dimGeom.forEachInRange(0,
					splitIndex - 1,
					(idx: number, data: DimensionPosSize) => {
						this._elements[idx] = {
							index: idx,
							pos: (data.startpos + data.size) * scale, // end position on the header canvas
							size: data.size * scale,
							origsize: data.size,
							isHighlighted: this.isHeaderEntryHighLighted(cellSelections, data.startpos + data.size * 0.5),
							isCurrent: idx === currentIndex
						};
					}
				);

				this._hasSplits = true;
				this._splitIndex = splitIndex;

				const freeStartPos = startPx;
				const freeStartIndex = this._dimGeom.getIndexFromPos(freeStartPos + 1, 'corepixels');

				startIdx = freeStartIndex;
			}
		}

		// first free index
		const dataFirstFree = this._dimGeom.getElementData(startIdx);
		const firstFreeEnd = dataFirstFree.startpos + dataFirstFree.size - startPx + splitPos;
		const firstFreeStart = splitPos;
		const firstFreeSize = Math.max(0, firstFreeEnd - firstFreeStart);
		this._elements[startIdx] = {
			index: startIdx,
			pos: firstFreeEnd * scale, // end position on the header canvas
			size: firstFreeSize * scale,
			origsize: dataFirstFree.size,
			isHighlighted: this.isHeaderEntryHighLighted(cellSelections, dataFirstFree.startpos + dataFirstFree.size * 0.5),
			isCurrent: startIdx === currentIndex
		};

		this._dimGeom.forEachInRange(startIdx + 1,
			endIdx,
			(idx: number, data: DimensionPosSize) => {
				this._elements[idx] = {
					index: idx,
					pos: (data.startpos - startPx + splitPos + data.size) * scale, // end position on the header canvas
					size: data.size * scale,
					origsize: data.size,
					isHighlighted: this.isHeaderEntryHighLighted(cellSelections, data.startpos + data.size * 0.5),
					isCurrent: idx === currentIndex
				};
			}
		);

		this._startIndex = startIdx;
		this._endIndex = endIdx;
	}

	docToHeaderPos (docPos: number): number {
		if (!this._hasSplits) {
			return docPos - this._docVisStart;
		}

		if (docPos <= this._splitPos) {
			return docPos;
		}

		// max here is to prevent encroachment of the fixed pane-area.
		return Math.max(docPos - this._docVisStart, this._splitPos);
	}

	headerToDocPos (hdrPos: number): number {
		if (!this._hasSplits) {
			return hdrPos + this._docVisStart;
		}

		if (hdrPos <= this._splitPos) {
			return hdrPos;
		}

		return hdrPos + this._docVisStart;
	}

	isZeroSize (i: number): boolean {
		const elem = this._elements[i];
		window.app.console.assert(elem, 'queried a non existent row/col in the header : ' + i);
		return elem.size === 0;
	}

	getMinIndex(): number {
		return this._hasSplits ? 0 : this._startIndex;
	}

	getMaxIndex(): number {
		return this._endIndex;
	}

	getElementData (index: number): HeaderEntryData {
		return this._elements[index];
	}

	getRowData (index: number): HeaderEntryData {
		window.app.console.assert(!this._isColumn, 'this is a column header instance!');
		return this.getElementData(index);
	}

	getColData (index: number): HeaderEntryData {
		window.app.console.assert(this._isColumn, 'this is a row header instance!');
		return this.getElementData(index);
	}

	getPreviousIndex (index: number): number {

		let prevIndex: number;
		if (this._splitIndex && index === this._startIndex) {
			prevIndex = this._splitIndex - 1;
		}
		else {
			prevIndex = index - 1;
		}

		return prevIndex;
	}

	getNextIndex (index: number): number {

		let nextIndex;
		if (this._splitIndex && index === (this._splitIndex - 1)) {
			nextIndex = this._startIndex;
		}
		else {
			nextIndex = index + 1;
		}

		return nextIndex;
	}

	forEachElement (callback: (entry: HeaderEntryData) => boolean): void {
		let idx: number;
		if (this._hasSplits) {
			for (idx = 0; idx < this._splitIndex; ++idx) {
				window.app.console.assert(this._elements[idx], 'forEachElement failed');
				if (callback(this._elements[idx])) {
					return;
				}
			}
		}
		for (idx = this._startIndex; idx <= this._endIndex; ++idx) {
			window.app.console.assert(this._elements[idx], 'forEachElement failed');
			if (callback(this._elements[idx])) {
				return;
			}
		}
	}

}

}

L.Control.Header = cool.Header;
L.Control.Header.HeaderInfo = cool.HeaderInfo;
