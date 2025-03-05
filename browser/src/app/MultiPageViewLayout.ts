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
	public rectangles: Array<Array<number>> = [];
	public width: number = 0;
	public height: number = 0;
	public startingPartNumber = 0;

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

	private static getVisibleTopLeft(): Array<number> {
		const viewedRectangle = app.file.viewedRectangle.pToArray();
		let intersection: Array<number> = null;

		for (let i = 0; i < this.rows.length && intersection === null; i++) {
			for (let j = 0; j < this.rows[i].rectangles.length; j++) {
				const nextIntersection = LOUtil._getIntersectionRectangle(
					viewedRectangle,
					this.rows[i].rectangles[j],
				);
				if (nextIntersection !== null) {
					if (intersection === null)
						intersection = [nextIntersection[0], nextIntersection[1]];
					else {
						if (nextIntersection[0] < intersection[0])
							intersection[0] = nextIntersection[0];

						if (nextIntersection[1] < intersection[1])
							intersection[1] = nextIntersection[1];
					}
				}
			}
		}

		return intersection;
	}

	private static getVisibleBottomRight(): Array<number> {
		const viewedRectangle = app.file.viewedRectangle.pToArray();
		let intersection: Array<number> = null;

		for (let i = this.rows.length - 1; i >= 0 && intersection === null; i--) {
			for (let j = this.rows[i].rectangles.length - 1; j >= 0; j--) {
				const nextIntersection = LOUtil._getIntersectionRectangle(
					viewedRectangle,
					this.rows[i].rectangles[j],
				);
				if (nextIntersection !== null) {
					if (intersection === null)
						intersection = [
							nextIntersection[0] + nextIntersection[2],
							nextIntersection[1] + nextIntersection[3],
						];
					else {
						if (nextIntersection[0] + nextIntersection[2] > intersection[0])
							intersection[0] = nextIntersection[0] + nextIntersection[2];

						if (nextIntersection[1] + nextIntersection[3] > intersection[1])
							intersection[1] = nextIntersection[1] + nextIntersection[3];
					}
				}
			}
		}

		return intersection;
	}

	public static sendClientVisibleArea() {
		const topLeft = this.getVisibleTopLeft();
		const bottomRight = this.getVisibleBottomRight();

		const visibleAreaCommand =
			'clientvisiblearea x=' +
			Math.round(topLeft[0] * app.pixelsToTwips) +
			' y=' +
			Math.round(topLeft[1] * app.pixelsToTwips) +
			' width=' +
			Math.round((bottomRight[0] - topLeft[0]) * app.pixelsToTwips) +
			' height=' +
			Math.round((bottomRight[1] - topLeft[1]) * app.pixelsToTwips);
		+' splitx=' + Math.round(0) + ' splity=' + Math.round(0);

		app.socket.sendMessage(visibleAreaCommand);
	}

	public static resetViewLayout() {
		if (
			!app.file.writer.multiPageView ||
			!app.file.writer.pageRectangleList.length
		)
			return;

		this.rows.length = 0;

		const canvasSize = app.sectionContainer.getViewSize();

		this.totalWidth = canvasSize[0];

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

		let currentPartNumber = 0;

		while (rectangles.length > 0) {
			const row = new LayoutRow();
			row.startingPartNumber = currentPartNumber;

			row.startY = this.gapBetweenPages;
			row.startY +=
				this.rows.length > 0
					? this.rows[this.rows.length - 1].startY +
						this.rows[this.rows.length - 1].height
					: 0;

			row.addRectangle(rectangles.shift());
			currentPartNumber++;

			while (row.width < this.availableWidth && rectangles.length > 0) {
				const next = rectangles[0];
				if (
					row.width + next[2] + this.gapBetweenPages < this.availableWidth &&
					row.rectangles.length < this.maxRowsSize
				) {
					row.addRectangle(rectangles.shift());
					currentPartNumber++;
				} else break;
			}

			this.rows.push(row);
		}

		app.view.size.pY = Math.max(
			this.rows[this.rows.length - 1].startY +
				this.rows[this.rows.length - 1].height +
				this.gapBetweenPages,
			canvasSize[1],
		);

		app.view.size.pX = this.totalWidth;

		this.sendClientVisibleArea();
	}
}
