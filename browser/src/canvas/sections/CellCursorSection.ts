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
	name: string = "OwnCellCursor";
	processingOrder: number = L.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = L.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = L.CSections.AutoFillMarker.zIndex;

	constructor (color: string, weight: number, viewId: number) {
        super();

		this.documentObject = true;

		this.sectionProperties.viewId = viewId;
		this.sectionProperties.weight = weight;
		this.sectionProperties.color = color;
		this.sectionProperties.paneIndex = null;
		this.sectionProperties.paneCount = null;
	}

	public getViewId(): number {
		return this.sectionProperties.viewId;
	}

	public setViewId(viewId: number) {
		this.sectionProperties.viewId = viewId;
	}

	private getContainingPane() {
		const rectangles = app.getViewRectangles();

		this.sectionProperties.paneIndex = -1;
		this.sectionProperties.paneCount = 1;

		if (rectangles.length > 1) { // We have split panes.
			this.sectionProperties.paneCount = rectangles.length;
			for (let i = 0; i < rectangles.length; i++) {
				if (rectangles[i].pContainsRectangle([
						this.position[0],
						this.position[1],
						app.calc.cellCursorRectangle.pWidth,
						app.calc.cellCursorRectangle.pHeight
					]
				)) {
					this.sectionProperties.paneIndex = i;
					return rectangles[i];
				}
			}
			return null;
		}
		else
			return app.calc.cellCursorRectangle;
	}

	public onDraw() {
		const pane = this.getContainingPane();

		if (app.calc.cellCursorVisible && pane) {
			this.context.lineJoin = 'miter';
			this.context.lineCap = 'butt';
			this.context.lineWidth = 1;

			this.context.strokeStyle = this.sectionProperties.color;

			let penX = this.myTopLeft[0];
			let penY = this.myTopLeft[1];

			const movePen = this.sectionProperties.paneIndex !== -1 && this.sectionProperties.paneCount - 1 !== this.sectionProperties.paneIndex;

			if (movePen) {
				if (pane.x1 === 0) penX = this.position[0] + this.containerObject.getDocumentAnchor()[0];
				if (pane.y1 === 0) penY = this.position[1] + this.containerObject.getDocumentAnchor()[1];

				this.context.translate(penX - this.myTopLeft[0], penY - this.myTopLeft[1]);
			}

			let x: number = 0;
			if (app.isCalcRTL()) {
				const rightMost = this.containerObject.getDocumentAnchor()[0] + this.containerObject.getDocumentAnchorSection().size[0];
				x = rightMost - penX * 2 - app.calc.cellCursorRectangle.pWidth;
			}

			for (let i: number = 0; i < this.sectionProperties.weight; i++)
				this.context.strokeRect(x + -0.5 - i, -0.5 - i, app.calc.cellCursorRectangle.pWidth + i * 2, app.calc.cellCursorRectangle.pHeight + i * 2);

			if (window.prefs.getBoolean('darkTheme')) {
				this.context.strokeStyle = 'white';
				const diff = 1;
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, app.calc.cellCursorRectangle.pWidth - 2 * diff, app.calc.cellCursorRectangle.pHeight - 2 * diff);
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, app.calc.cellCursorRectangle.pWidth - 2 * diff, app.calc.cellCursorRectangle.pHeight - 2 * diff);
			}

			if (movePen)
				this.context.translate(-penX + this.myTopLeft[0], -penY + this.myTopLeft[1]);
		}
	}

	onNewDocumentTopLeft(size: Array<number>): void {
		if (this.getContainingPane())
			this.isVisible = true;
	}

	onCellAddressChanged(): void {
		if (this.getContainingPane())
			this.isVisible = true;
	}
}

app.definitions.cellCursorSection = CellCursorSection;
