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

class CellCursorSection extends app.definitions.canvasSectionObject {
	name: string = "cellcursor"; // There will be multiple instances of this class. For the viewer's cursor, name will be owncellcursor. Others will have viewId-cellcursor.
	processingOrder: number = L.CSections.AutoFillMarker.processingOrder;
	drawingOrder: number = L.CSections.AutoFillMarker.drawingOrder;
	zIndex: number = L.CSections.AutoFillMarker.zIndex;

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

	public onDraw() {
		if (app.calc.cellCursorVisible) {
			this.context.lineJoin = 'miter';
			this.context.lineCap = 'butt';
			this.context.lineWidth = 1;

			this.context.strokeStyle = this.sectionProperties.color;

			let x: number = 0;
			if (app.isCalcRTL()) {
				const rightMost = this.containerObject.getDocumentAnchor()[0] + this.containerObject.getDocumentAnchorSection().size[0];
				x = rightMost - this.myTopLeft[0] * 2 - app.calc.cellCursorRectangle.pWidth;
			}

			for (let i: number = 0; i < this.sectionProperties.weight; i++)
				this.context.strokeRect(x + -0.5 - i, -0.5 - i, app.calc.cellCursorRectangle.pWidth + i * 2, app.calc.cellCursorRectangle.pHeight + i * 2);

			if (window.prefs.getBoolean('darkTheme')) {
				this.context.strokeStyle = 'white';
				const diff = 1;
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, app.calc.cellCursorRectangle.pWidth - 2 * diff, app.calc.cellCursorRectangle.pHeight - 2 * diff);
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, app.calc.cellCursorRectangle.pWidth - 2 * diff, app.calc.cellCursorRectangle.pHeight - 2 * diff);
			}
		}
	}
}

app.definitions.cellCursorSection = CellCursorSection;
