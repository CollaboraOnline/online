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
    zIndex: number = L.CSections.ColumnHeader.zIndex;
    drawingOrder: number = L.CSections.OtherViewCellCursor.drawingOrder;
    processingOrder: number = L.CSections.OtherViewCellCursor.processingOrder;

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
			if (app.calc.isRTL()) {
				const rightMost = this.containerObject.getDocumentAnchor()[0] + this.containerObject.getDocumentAnchorSection().size[0];
				x = rightMost - this.size[0];
			}

			for (let i: number = 0; i < this.sectionProperties.weight; i++)
				this.context.strokeRect(x + -0.5 - i, -0.5 - i, this.size[0] + i * 2, this.size[1] + i * 2);

			if (window.prefs.getBoolean('darkTheme')) {
				this.context.strokeStyle = 'white';
				const diff = 1;
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, this.size[0] - 2 * diff, this.size[1] - 2 * diff);
				this.context.strokeRect(x + -0.5 + diff, -0.5 + diff, this.size[0] - 2 * diff, this.size[1] - 2 * diff);
			}
		}
	}
}

app.definitions.cellCursorSection = CellCursorSection;
