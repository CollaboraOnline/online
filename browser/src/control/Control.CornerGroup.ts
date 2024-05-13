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
 * L.Control.CornerGroup
 */

/*
	This file is Calc only. This adds a header section for grouped columns and rows in Calc.
	When user uses row grouping and column grouping at the same time, there occurs a space at the crossing point of the row group and column group sections.
	This sections fills that gap.

	This class is an extended version of "CanvasSectionObject".
*/
namespace cool {

export class CornerGroup extends app.definitions.canvasSectionObject {
	name: string = L.CSections.CornerGroup.name;
	anchor: string[] = ['top', 'left'];
	processingOrder: number = L.CSections.CornerGroup.processingOrder;
	drawingOrder: number = L.CSections.CornerGroup.drawingOrder;
	zIndex: number = L.CSections.CornerGroup.zIndex;
	sectionProperties: any = { cursor: 'pointer' };

	_map: any;

	constructor() { super(); }

	public onInitialize(): void {
		this._map = L.Map.THIS;
		this._map.on('sheetgeometrychanged', this.update, this);
		this._map.on('viewrowcolumnheaders', this.update, this);

		// Style.
		const baseElem = document.getElementsByTagName('body')[0];
		const elem = L.DomUtil.create('div', 'spreadsheet-header-row', baseElem);
		this.backgroundColor = L.DomUtil.getStyle(elem, 'background-color'); // This is a section property.
		this.borderColor = this.backgroundColor; // This is a section property.
		L.DomUtil.remove(elem);
	}

	update(): void {
		// Below 2 sections exist (since this section is added), unless they are being removed.

		const rowGroupSection = this.containerObject.getSectionWithName(L.CSections.RowGroup.name) as RowGroup;
		if (rowGroupSection) {
			rowGroupSection.update(); // This will update its size.
			this.size[0] = rowGroupSection.size[0];
		}

		const columnGroupSection = this.containerObject.getSectionWithName(L.CSections.ColumnGroup.name) as ColumnGroup;
		if (columnGroupSection) {
			columnGroupSection.update(); // This will update its size.
			this.size[1] = columnGroupSection.size[1];
		}
	}

	onClick(): void {
		this._map.wholeRowSelected = true;
		this._map.wholeColumnSelected = true;
		this._map.sendUnoCommand('.uno:SelectAll');
		// Row and column selections trigger updatecursor: message
		// and eventually _updateCursorAndOverlay function is triggered and focus will be at the map
		// thus the keyboard shortcuts like delete will work again.
		// selecting whole page does not trigger that and the focus will be lost.
		const docLayer = this._map._docLayer;
		if (docLayer)
			docLayer._updateCursorAndOverlay();
	}

	onMouseEnter(): void {
		this.containerObject.getCanvasStyle().cursor = 'pointer';
		$.contextMenu('destroy', '#document-canvas');
	}

	onMouseLeave(): void {
		this.containerObject.getCanvasStyle().cursor = 'default';
	}

	/* Only background and border drawings are needed for this section. And they are handled by CanvasSectionContainer. */
}
}

L.Control.CornerGroup = cool.CornerGroup;

L.control.cornerGroup = function () {
	return new L.Control.CornerGroup();
};
