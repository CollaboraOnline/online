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

class LayoutPageRectangle extends cool.SimpleRectangle {
	// X and Y coordinates of the rectangle in multi page view.
	layoutX: number = 0;
	layoutY: number = 0;
	part: number;
}

class MultiPageViewLayout {
	public static gapBetweenPages = 20; // Core pixels.
	public static availableWidth = 0;
	private static maxRowsSize = 2;
	public static layoutRectangles = Array<LayoutPageRectangle>();

	private static sendClientVisibleArea() {
		const visibleArea = this.getVisibleAreaRectangle();

		const visibleAreaCommand =
			'clientvisiblearea x=' +
			visibleArea.x1 +
			' y=' +
			visibleArea.y1 +
			' width=' +
			visibleArea.width +
			' height=' +
			visibleArea.height;
		+' splitx=' + Math.round(0) + ' splity=' + Math.round(0);

		app.socket.sendMessage(visibleAreaCommand);

		return new L.Bounds(
			new L.Point(visibleArea.pX1, visibleArea.pY1),
			new L.Point(visibleArea.pX2, visibleArea.pY2),
		);
	}

	private static resetViewLayout() {
		this.layoutRectangles.length = 0;

		const canvasSize = app.sectionContainer.getViewSize();

		// Copy the page rectangle array.
		for (let i = 0; i < app.file.writer.pageRectangleList.length; i++) {
			const temp = app.file.writer.pageRectangleList[i];
			this.layoutRectangles.push(
				new LayoutPageRectangle(temp[0], temp[1], temp[2], temp[3]),
			);

			const currentPageRectangle = this.layoutRectangles[i];
			currentPageRectangle.part = i;
		}

		let lastY = this.gapBetweenPages;
		app.view.size.pX = canvasSize[0];

		for (let i = 0; i < this.layoutRectangles.length; i++) {
			let x = 0;

			let j = i;
			let totalWidth = 0;
			let go = true;

			while (
				go &&
				j - i < this.maxRowsSize &&
				j < this.layoutRectangles.length
			) {
				const addition = this.layoutRectangles[j].pWidth + this.gapBetweenPages;
				if (x + addition < canvasSize[0] || j === i) {
					if (x + addition > canvasSize[0]) {
						go = false;
					}

					x += addition;
					totalWidth += this.layoutRectangles[j].pWidth;

					j++;
				} else go = false;
			}

			if (x < canvasSize[0]) {
				const rowItemCount = j - i;
				const gap = (rowItemCount - 1) * this.gapBetweenPages;
				const margin = (canvasSize[0] - totalWidth + gap) * 0.5;
				let currentX = margin + app.file.viewedRectangle.pX1;
				let maxY = 0;
				for (let k = i; k < j; k++) {
					this.layoutRectangles[k].layoutX = currentX;
					this.layoutRectangles[k].layoutY = lastY;
					currentX += this.layoutRectangles[k].pWidth + this.gapBetweenPages;
					maxY = Math.max(maxY, this.layoutRectangles[k].pHeight);
				}

				lastY += maxY + this.gapBetweenPages;
			} else {
				if (x > app.view.size.pX)
					app.view.size.pX = x + this.gapBetweenPages * 2;

				this.layoutRectangles[i].layoutX = this.gapBetweenPages;
				this.layoutRectangles[i].layoutY = lastY;
				lastY += this.layoutRectangles[i].pHeight + this.gapBetweenPages;
			}

			i = j - 1;
		}

		app.view.size.pY = Math.max(lastY, canvasSize[1]);
	}

	public static getVisibleAreaRectangle() {
		const viewedRectangle = app.file.viewedRectangle.clone();
		viewedRectangle.pWidth = app.view.size.pX;
		viewedRectangle.pHeight = app.view.size.pY;
		const resultingRectangle = new cool.SimpleRectangle(
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		);

		for (let i = 0; i < this.layoutRectangles.length; i++) {
			const rectangle = this.layoutRectangles[i];
			const controlRectangle = [
				rectangle.layoutX,
				rectangle.layoutY,
				rectangle.pWidth,
				rectangle.pHeight,
			];
			const intersection = LOUtil._getIntersectionRectangle(
				viewedRectangle.pToArray(),
				controlRectangle,
			);

			if (intersection) {
				if (resultingRectangle.pX1 > rectangle.pX1)
					resultingRectangle.pX1 = rectangle.pX1;

				if (resultingRectangle.pY1 > rectangle.pY1)
					resultingRectangle.pY1 = rectangle.pY1;

				if (resultingRectangle.pX2 < rectangle.pX2)
					resultingRectangle.pX2 = rectangle.pX2;

				if (resultingRectangle.pY2 < rectangle.pY2)
					resultingRectangle.pY2 = rectangle.pY2;
			}
		}

		resultingRectangle.pX1 -= TileManager.tileSize;
		resultingRectangle.pY1 -= TileManager.tileSize;
		resultingRectangle.pWidth += TileManager.tileSize * 2;
		resultingRectangle.pHeight += TileManager.tileSize * 2;

		return resultingRectangle;
	}

	public static reset() {
		if (
			!app.file.writer.multiPageView ||
			!app.file.writer.pageRectangleList.length
		)
			return;

		this.resetViewLayout();
		app.map._docLayer._sendClientZoom();
		const bounds = this.sendClientVisibleArea();
		TileManager.udpateLayoutView(bounds);
	}
}
