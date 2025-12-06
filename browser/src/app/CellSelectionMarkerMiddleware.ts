/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class CellSelectionMarkers {
	static start: CellSelectionHandle;
	static end: CellSelectionHandle;
	private static initiated: boolean = false;

	public static initiate() {
		if (app.map._docLayer._docType !== 'spreadsheet')
			// Calc only.
			return;

		this.initiated = true;

		// Cell selection handles (mobile & tablet).
		this.start = new CellSelectionHandle('cell_selection_handle_start');
		this.end = new CellSelectionHandle('cell_selection_handle_end');
		app.sectionContainer.addSection(this.start);
		app.sectionContainer.addSection(this.end);
	}

	public static update() {
		if (window.mode.isDesktop()) return; // Not shown on desktop.

		if (!this.initiated) return;

		var showMarkers =
			app.map._docLayer._cellSelectionArea || app.calc.cellCursorVisible;

		if (showMarkers) {
			this.start.setShowSection(true);
			this.end.setShowSection(true);

			Util.ensureValue(app.calc.cellCursorRectangle);
			var cellRectangle = app.map._docLayer._cellSelectionArea
				? app.map._docLayer._cellSelectionArea.clone()
				: app.calc.cellCursorRectangle.clone();

			const posStart = new cool.SimplePoint(cellRectangle.x1, cellRectangle.y1);
			const posEnd = new cool.SimplePoint(cellRectangle.x2, cellRectangle.y2);

			const offset = this.start.sectionProperties.circleRadius;
			this.start.setPosition(posStart.pX - offset, posStart.pY - offset);
			this.end.setPosition(posEnd.pX - offset, posEnd.pY - offset);
		} else {
			this.start.setShowSection(false);
			this.end.setShowSection(false);
		}
	}
}
