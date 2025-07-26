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
	name: string = L.CSections.CellCursor.name;
    zIndex: number = L.CSections.CellCursor.zIndex;
    drawingOrder: number = L.CSections.CellCursor.drawingOrder;
    processingOrder: number = L.CSections.CellCursor.processingOrder;

	constructor (color: string, weight: number, viewId: number) {
        super();

		this.documentObject = true;

		this.sectionProperties.viewId = viewId;
		this.sectionProperties.weight = weight;
		this.sectionProperties.color = color;
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

		if (!splitPos || (splitPos.x === 0 && splitPos.y === 0)) return defaultSizePos;

		let newSizePos: number[] | null = null;

		if (!app.isXOrdinateInFrozenPane(defaultSizePos[0]) || !app.isYOrdinateInFrozenPane(defaultSizePos[1])) {
			const viewRectangles = app.getViewRectangles();

			const temp = LOUtil._getIntersectionRectangle(
				defaultSizePos,
				viewRectangles[viewRectangles.length - 1].pToArray()
			);

			if (temp) newSizePos = temp;
		}

		return newSizePos ? newSizePos : defaultSizePos;
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
}
