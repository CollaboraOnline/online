/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class CellCursorSection extends CanvasSectionObject {
    zIndex: number = L.CSections.CellCursor.zIndex;
    drawingOrder: number = L.CSections.CellCursor.drawingOrder;
    processingOrder: number = L.CSections.CellCursor.processingOrder;

	constructor (color: string, weight: number, viewId: number) {
        super(L.CSections.CellCursor.name);

		this.documentObject = true;

		this.sectionProperties.viewId = viewId;
		this.sectionProperties.weight = weight;
		this.sectionProperties.color = color;
		this.sectionProperties.mouseInside = true;
	}

	public getViewId(): number {
		return this.sectionProperties.viewId;
	}

	public setViewId(viewId: number) {
		this.sectionProperties.viewId = viewId;
	}

	// If the split panes are active and the cell cursor overlaps with the split pane, we adjust the size and position.
	public static adjustSizePos(defaultSizePos: number[]): number[] {
		const splitPos = app.map._docLayer._splitPanesContext ? app.map._docLayer._splitPanesContext.getSplitPos() : null;

		if (!splitPos || (splitPos.x === 0 && splitPos.y === 0) || !app.activeDocument || (app.activeDocument.activeView.viewedRectangle.pX1 === 0 && app.activeDocument.activeView.viewedRectangle.pY1 === 0)) return defaultSizePos;

		if (defaultSizePos[0] < splitPos.x && defaultSizePos[0] + defaultSizePos[2] > splitPos.x)
			defaultSizePos[2] = Math.max(splitPos.x - defaultSizePos[0], defaultSizePos[2] - app.activeDocument.activeView.viewedRectangle.pX1);

		if (defaultSizePos[0] >= splitPos.x && app.activeDocument.activeView.viewedRectangle.pX1 + splitPos.x > defaultSizePos[0]) {
			defaultSizePos[2] = (defaultSizePos[0] + defaultSizePos[2]) - (app.activeDocument.activeView.viewedRectangle.pX1 + splitPos.x);
			defaultSizePos[0] = splitPos.x + app.activeDocument.activeView.viewedRectangle.pX1;
		}

		if (defaultSizePos[1] < splitPos.y && defaultSizePos[1] + defaultSizePos[3] > splitPos.y)
			defaultSizePos[3] = Math.max(splitPos.y - defaultSizePos[1], defaultSizePos[3] - app.activeDocument.activeView.viewedRectangle.pY1);

		if (defaultSizePos[1] >= splitPos.y && app.activeDocument.activeView.viewedRectangle.pY1 + splitPos.y > defaultSizePos[1]) {
			defaultSizePos[3] = (defaultSizePos[1] + defaultSizePos[3]) - (app.activeDocument.activeView.viewedRectangle.pY1 + splitPos.y);
			defaultSizePos[1] = splitPos.y + app.activeDocument.activeView.viewedRectangle.pY1;
		}

		return defaultSizePos;
	}

	public onDraw() {
		if (app.calc.cellCursorVisible) {
			this.context.lineJoin = 'miter';
			this.context.lineCap = 'butt';
			this.context.lineWidth = 1;

			this.context.strokeStyle = this.sectionProperties.color;

			const tempSizePos = CellCursorSection.adjustSizePos([this.position[0], this.position[1], this.size[0], this.size[1]]);

			let x: number = (tempSizePos[0] - this.position[0]);
			const y: number = (tempSizePos[1] - this.position[1]);
			if (app.calc.isRTL()) {
				const rightMost = this.containerObject.getDocumentAnchor()[0] + this.containerObject.getDocumentAnchorSection().size[0];
				x = rightMost - tempSizePos[2] + (tempSizePos[0] - this.position[0]);
			}

			for (let i: number = 0; i < this.sectionProperties.weight; i++)
				this.context.strokeRect(x + -0.5 - i, y - 0.5 - i, tempSizePos[2] + i * 2, tempSizePos[3] + i * 2);

			if (window.prefs.getBoolean('darkTheme')) {
				this.context.strokeStyle = 'white';
				const diff = 1;
				this.context.strokeRect(x + -0.5 + diff, y - 0.5 + diff, tempSizePos[2] - 2 * diff, tempSizePos[3] - 2 * diff);
				this.context.strokeRect(x + -0.5 + diff, y - 0.5 + diff, tempSizePos[2] - 2 * diff, tempSizePos[3] - 2 * diff);
			}
		}
	}

	public onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		this.sectionProperties.mouseInside = true;
		if (!app.file.textCursor.visible) return;
		const grid: any = document.querySelector('.leaflet-map-pane');
		grid.classList.remove('spreadsheet-cursor');
		grid.style.cursor = 'text';
	}

	public onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		this.sectionProperties.mouseInside = false;
		const grid: any = document.querySelector('.leaflet-map-pane');
		grid.classList.add('spreadsheet-cursor');
		grid.style.cursor = '';
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		this.sectionProperties.mouseInside = true;
	}
}
