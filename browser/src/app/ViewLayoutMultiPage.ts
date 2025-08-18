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

class LayoutPageRectangle extends cool.SimpleRectangle {
	// X and Y coordinates of the rectangle in multi page view.
	layoutX: number = 0;
	layoutY: number = 0;
	part: number;
}

class MultiPageViewLayout extends ViewLayoutBase {
	public readonly type: string = 'MultiPageViewLayout';
	public gapBetweenPages = 20; // Core pixels.
	public availableWidth = 0;
	private maxRowsSize = 2;
	public layoutRectangles = Array<LayoutPageRectangle>();

	constructor() {
		super();
	}

	public sendClientVisibleArea() {
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

		app.socket.sendMessage(visibleAreaCommand);

		return new L.Bounds(
			new L.Point(visibleArea.pX1, visibleArea.pY1),
			new L.Point(visibleArea.pX2, visibleArea.pY2),
		);
	}

	private resetViewLayout() {
		this.layoutRectangles.length = 0;

		if (app.file.writer.pageRectangleList.length === 0) return;

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
		this._viewSize.pX = canvasSize[0];

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
				let currentX =
					margin + app.activeDocument.activeView.viewedRectangle.pX1;
				let maxY = 0;
				for (let k = i; k < j; k++) {
					this.layoutRectangles[k].layoutX = currentX;
					this.layoutRectangles[k].layoutY = lastY;
					currentX += this.layoutRectangles[k].pWidth + this.gapBetweenPages;
					maxY = Math.max(maxY, this.layoutRectangles[k].pHeight);
				}

				lastY += maxY + this.gapBetweenPages;
			} else {
				if (x > this._viewSize.pX)
					this._viewSize.pX = x + this.gapBetweenPages * 2;

				this.layoutRectangles[i].layoutX = this.gapBetweenPages;
				this.layoutRectangles[i].layoutY = lastY;
				lastY += this.layoutRectangles[i].pHeight + this.gapBetweenPages;
			}

			i = j - 1;
		}

		this._viewSize.pY = Math.max(lastY, canvasSize[1]);
	}

	private getContainingPageRectangle(point: cool.SimplePoint) {
		for (let i = 0; i < this.layoutRectangles.length; i++) {
			if (this.layoutRectangles[i].containsPoint(point.toArray()))
				return this.layoutRectangles[i];
		}

		return null;
	}

	public viewPixelsToTwips(x: number, y: number): number[] {
		for (let i = 0; i < this.layoutRectangles.length; i++) {
			const rectangle = this.layoutRectangles[i];
			const bounds = [
				rectangle.layoutX - app.activeDocument.activeView.viewedRectangle.pX1,
				rectangle.layoutY - app.activeDocument.activeView.viewedRectangle.pY1,
				rectangle.pWidth,
				rectangle.pHeight,
			];

			if (x > bounds[0] && x < bounds[0] + bounds[2]) {
				if (y > bounds[1] && y < bounds[1] + bounds[3]) {
					return [
						Math.round(
							(rectangle.pX1 +
								(x -
									rectangle.layoutX +
									app.activeDocument.activeView.viewedRectangle.pX1)) *
								app.pixelsToTwips,
						),
						Math.round(
							(rectangle.pY1 +
								(y -
									rectangle.layoutY +
									app.activeDocument.activeView.viewedRectangle.pY1)) *
								app.pixelsToTwips,
						),
					];
				}
			}
		}

		return [-1, -1];
	}

	// Returns view coordinate of given document coordinate.
	public twipsToViewPixels(x: number, y: number): number[] {
		const point = new cool.SimplePoint(x, y);
		const containingRectangle = this.getContainingPageRectangle(point);

		if (containingRectangle) {
			return [
				containingRectangle.layoutX +
					(point.pX - containingRectangle.pX1) -
					app.activeDocument.activeView.viewedRectangle.pX1,
				containingRectangle.layoutY +
					(point.pY - containingRectangle.pY1) -
					app.activeDocument.activeView.viewedRectangle.pY1,
			];
		} else return [0, 0];
	}

	public getVisibleAreaRectangle() {
		const viewedRectangle =
			app.activeDocument.activeView.viewedRectangle.clone();
		viewedRectangle.pWidth = this._viewSize.pX;
		viewedRectangle.pHeight = this._viewSize.pY;
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

	public reset() {
		if (
			!app.file.writer.multiPageView ||
			!app.file.writer.pageRectangleList.length
		)
			return;

		this.resetViewLayout();
		app.map._docLayer._sendClientZoom();
		const bounds = this.sendClientVisibleArea();
		TileManager.updateLayoutView(bounds);
	}
}
