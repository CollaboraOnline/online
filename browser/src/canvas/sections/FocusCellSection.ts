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
/* See CanvasSectionContainer.ts for explanations. */

class FocusCellSection extends CanvasSectionObject {
	name: string = L.CSections.FocusCell.name;
	processingOrder: number = L.CSections.FocusCell.processingOrder;
	drawingOrder: number = L.CSections.FocusCell.drawingOrder;
	zIndex: number = L.CSections.FocusCell.zIndex;
	documentObject: boolean = true;
	interactable: boolean = false;
	static instance: FocusCellSection = null;

	constructor() {
		super();

		this.sectionProperties.columnRectangle = null;
		this.sectionProperties.rowRectangle = null;
		this.sectionProperties.maxCol = 268435455;
		this.sectionProperties.maxRow = 20971124;
	}

	private static addFocusCellSection() {
		if (FocusCellSection.instance === null) {
			FocusCellSection.instance = new FocusCellSection();
			app.sectionContainer.addSection(FocusCellSection.instance);
		}

		// Make this always visible.
		this.instance.size = [10000000, 10000000];
		this.instance.setPosition(1, 1);

		if (!this.instance.showSection) this.instance.setShowSection(true);
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

		this.context.fillRect(
			app.calc.cellCursorRectangle.pX1 - this.position[0],
			-this.position[1],
			app.calc.cellCursorRectangle.pWidth,
			this.sectionProperties.maxCol,
		);

		this.context.fillRect(
			-this.position[0],
			app.calc.cellCursorRectangle.pY1 - this.position[1],
			this.sectionProperties.maxRow,
			app.calc.cellCursorRectangle.pHeight,
		);

		this.context.globalAlpha = 1;
		this.context.lineWidth = 2 * app.dpiScale;

		this.context.strokeRect(
			app.calc.cellCursorRectangle.pX1 - this.position[0],
			-this.position[1],
			app.calc.cellCursorRectangle.pWidth,
			this.sectionProperties.maxCol,
		);

		this.context.strokeRect(
			-this.position[0],
			app.calc.cellCursorRectangle.pY1 - this.position[1],
			this.sectionProperties.maxRow,
			app.calc.cellCursorRectangle.pHeight,
		);
	}
}
