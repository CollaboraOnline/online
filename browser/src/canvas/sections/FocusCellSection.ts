// @ts-strict-ignore
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
	See CanvasSectionContainer.ts explanations about sections, event handlers and more.

	This section is activated when user (currently) clicks on [View -> Focus Cell] button.
	When feature is activated, this section draws 2 rectangles:
		* One vertical that indicates the column of the cell cursor.
		* One horizontal that indicates the row of the cell cursor.

	So the purpose is to visually indicate the cell cursor position in the document better.
*/

class FocusCellSection extends CanvasSectionObject {
	processingOrder: number = app.CSections.FocusCell.processingOrder;
	drawingOrder: number = app.CSections.FocusCell.drawingOrder;
	zIndex: number = app.CSections.FocusCell.zIndex;
	documentObject: boolean = true;
	interactable: boolean = false;
	static instance: FocusCellSection = null;

	constructor() {
		super(app.CSections.FocusCell.name);

		this.sectionProperties.columnRectangle = null;
		this.sectionProperties.rowRectangle = null;
		this.sectionProperties.maxCol = 268435455;
		this.sectionProperties.maxRow = 20971124;
		this.isAlwaysVisible = true;
	}

	public onCellAddressChanged(): void {
		this.size[0] = app.calc.cellCursorRectangle.pWidth;
		this.size[1] = app.calc.cellCursorRectangle.pHeight;
		this.setPosition(
			app.calc.cellCursorRectangle.pX1,
			app.calc.cellCursorRectangle.pY1,
		);
	}

	setPosition(x: number, y: number): void {
		setCalcRTLAwareDocumentObjectPosition(this, x, y);
	}

	private static addFocusCellSection() {
		if (FocusCellSection.instance === null) {
			FocusCellSection.instance = new FocusCellSection();
			app.sectionContainer.addSection(FocusCellSection.instance);
		}

		if (!this.instance.showSection) this.instance.setShowSection(true);

		this.instance.onCellAddressChanged();
	}

	public static hideFocusCellSection() {
		if (FocusCellSection.instance)
			FocusCellSection.instance.setShowSection(false);
	}

	public static showFocusCellSection() {
		if (FocusCellSection.instance)
			FocusCellSection.instance.setShowSection(true);
		else {
			this.addFocusCellSection();
		}
	}

	public onDraw() {
		const style = getComputedStyle(document.documentElement).getPropertyValue(
			'--column-row-highlight',
		);

		this.context.fillStyle = style;
		this.context.strokeStyle = style;

		this.context.globalAlpha = 0.3;

		// In RTL the cell sits on the right of the tile, so -pX1 lands
		// far past the visible row; anchor the row bar at the tile
		// section's left edge instead so it spans the row.
		let rowX = -cursor.pX1;
		if (app.calc.isRTL()) {
			rowX = this.containerObject.getDocumentAnchor()[0] - this.myTopLeft[0];
		}

		this.context.fillRect(
			0,
			-app.calc.cellCursorRectangle.pY1,
			app.calc.cellCursorRectangle.pWidth,
			this.sectionProperties.maxCol,
		);

		this.context.fillRect(
			rowX,
			0,
			this.sectionProperties.maxRow,
			app.calc.cellCursorRectangle.pHeight,
		);

		this.context.globalAlpha = 1;
		this.context.lineWidth = 2 * app.dpiScale;

		this.context.strokeRect(
			0,
			-app.calc.cellCursorRectangle.pY1,
			app.calc.cellCursorRectangle.pWidth,
			this.sectionProperties.maxCol,
		);

		this.context.strokeRect(
			rowX,
			0,
			this.sectionProperties.maxRow,
			app.calc.cellCursorRectangle.pHeight,
		);
	}
}
