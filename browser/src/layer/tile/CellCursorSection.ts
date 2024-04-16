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

	constructor (viewId: number) {
        super({
			name: "cellcursor", // There will be multiple instances of this class. For the viewer's cursor, name will be owncellcursor. Others will have viewId-cellcursor.
			anchor: [],
			position: new Array<number>(0),
			size: new Array<number>(0),
			expand: '',
			showSection: true,
			processingOrder: L.CSections.AutoFillMarker.processingOrder,
			drawingOrder: L.CSections.AutoFillMarker.drawingOrder,
			zIndex: L.CSections.AutoFillMarker.zIndex,
			interactable: true,
			sectionProperties: {},
		});

		this.documentObject = true;

		this.sectionProperties.viewId = viewId;
        this.sectionProperties.cursorWeight = 2;
	}

	public getViewId(): number {
		return this.sectionProperties.viewId;
	}

	public setViewId(viewId: number) {
		this.sectionProperties.viewId = viewId;
	}

	public onDraw() {
		this.context.strokeStyle = 'black';
		this.context.lineJoin = 'miter';
		this.context.lineCap = 'butt';
		this.context.lineWidth = 1;

		// top white line
		this.context.beginPath();
		this.context.moveTo(-0.5, -0.5);
		this.context.strokeRect(0, 0, app.calc.cellCursorRectangle.pWidth, app.calc.cellCursorRectangle.pHeight);
	}
}

app.definitions.cellCursorSection = CellCursorSection;
