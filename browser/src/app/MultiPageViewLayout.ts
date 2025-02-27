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

class LayoutRow {
	public startY: number;
	public rectangles: Array<Array<number>>;
	public width: number = 0;
	public height: number = 0;

	constructor() {
		this.rectangles = [];
		this.width = 0;
		this.height = 0;
	}

	private adjustX() {
		let x = Math.round((MultiPageViewLayout.totalWidth - this.width) / 2);

		for (let i = 0; i < this.rectangles.length; i++) {
			const gap = i > 0 ? MultiPageViewLayout.gapBetweenPages : 0;
			this.rectangles[i][0] = x + gap;
			x += this.rectangles[i][2] + gap;
		}
	}

	private adjustY() {
		for (let i = 0; i < this.rectangles.length; i++) {
			this.rectangles[i][1] =
				this.startY + Math.round((this.height - this.rectangles[i][3]) / 2);
		}
	}

	public addRectangle(rectangle: Array<number>) {
		if (this.rectangles.length) rectangle[1] = this.rectangles[0][1];

		this.rectangles.push(rectangle);
		this.width +=
			rectangle[2] +
			(this.rectangles.length > 0 ? MultiPageViewLayout.gapBetweenPages : 0);

		this.height = Math.max(this.height, rectangle[3]);

		this.adjustX();
		this.adjustY();
	}
}

class MultiPageViewLayout {
	private static sideMargins = 20; // Core pixels.
	public static gapBetweenPages = 20; // Core pixels.
	public static rows: Array<LayoutRow> = [];
	public static availableWidth = 0;
	public static totalWidth = 0;
	private static maxRowsSize = 2;

	public static resetViewLayout() {
		if (
			!app.file.writer.multiPageView ||
			!app.file.writer.pageRectangleList.length
		)
			return;

		this.rows.length = 0;

		this.totalWidth = (
			app.sectionContainer as CanvasSectionContainer
		).getViewSize()[0];

		this.availableWidth = this.totalWidth - this.sideMargins * 2;

		const rectangles = app.file.writer.pageRectangleList.map(
			(rectangle: Array<number>) => {
				return [
					Math.round(rectangle[0] * app.twipsToPixels),
					Math.round(rectangle[1] * app.twipsToPixels),
					Math.round(rectangle[2] * app.twipsToPixels),
					Math.round(rectangle[3] * app.twipsToPixels),
				];
			},
		);

		while (rectangles.length > 0) {
			const row = new LayoutRow();

			row.startY = this.gapBetweenPages;
			row.startY +=
				this.rows.length > 0
					? this.rows[this.rows.length - 1].startY +
						this.rows[this.rows.length - 1].height
					: 0;

			row.addRectangle(rectangles.shift());

			while (row.width < this.availableWidth && rectangles.length > 0) {
				const next = rectangles[0];
				if (
					row.width + next[2] + this.gapBetweenPages < this.availableWidth &&
					row.rectangles.length < this.maxRowsSize
				)
					row.addRectangle(rectangles.shift());
				else break;
			}

			this.rows.push(row);
		}
	}
}
