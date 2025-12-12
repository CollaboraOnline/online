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

class ViewLayoutMultiPage extends ViewLayoutBase {
	public readonly type: string = 'ViewLayoutMultiPage';
	public gapBetweenPages = 20; // Core pixels.
	private maxRowsSize = 2;
	public documentRectangles = Array<cool.SimpleRectangle>();
	private viewRectangles = Array<cool.SimpleRectangle>();

	constructor() {
		super();

		app.events.on('resize', this.reset.bind(this));
		app.map.on('zoomend', this.reset.bind(this));

		this.reset();
	}

	public sendClientVisibleArea() {
		const visibleAreaCommand =
			'clientvisiblearea x=' +
			this.viewedRectangle.x1 +
			' y=' +
			this.viewedRectangle.y1 +
			' width=' +
			this.viewedRectangle.width +
			' height=' +
			this.viewedRectangle.height;

		app.socket.sendMessage(visibleAreaCommand);

		return new cool.Bounds(
			new cool.Point(this.viewedRectangle.pX1, this.viewedRectangle.pY1),
			new cool.Point(this.viewedRectangle.pX2, this.viewedRectangle.pY2),
		);
	}

	private resetViewLayout() {
		this.documentRectangles.length = 0;
		this.viewRectangles.length = 0;

		if (app.file.writer.pageRectangleList.length === 0) return;

		const canvasSize = app.sectionContainer.getViewSize();

		// Copy the page rectangle array.
		for (let i = 0; i < app.file.writer.pageRectangleList.length; i++) {
			const r = app.file.writer.pageRectangleList[i];
			this.documentRectangles.push(
				new cool.SimpleRectangle(r[0], r[1], r[2], r[3]),
			);
			this.viewRectangles.push(new cool.SimpleRectangle(0, 0, r[2], r[3])); // Width and height are the same. Screen positions will differ.

			this.documentRectangles[i].part = i;
			this.viewRectangles[i].part = i;
		}

		let lastY = this.gapBetweenPages;
		this._viewSize.pX = canvasSize[0];

		for (let i = 0; i < this.documentRectangles.length; i++) {
			let x = 0;

			let j = i;
			let totalWidth = 0;
			let go = true;

			while (
				go &&
				j - i < this.maxRowsSize &&
				j < this.documentRectangles.length
			) {
				const addition =
					this.documentRectangles[j].pWidth + this.gapBetweenPages;
				if (x + addition < canvasSize[0] || j === i) {
					if (x + addition > canvasSize[0]) {
						go = false;
					}

					x += addition;
					totalWidth += this.documentRectangles[j].pWidth;

					j++;
				} else go = false;
			}

			if (x < canvasSize[0]) {
				const rowItemCount = j - i;
				const gap = (rowItemCount - 1) * this.gapBetweenPages;
				const margin = (canvasSize[0] - (totalWidth + gap)) * 0.5;
				let currentX = margin;
				let maxY = 0;
				for (let k = i; k < j; k++) {
					this.viewRectangles[k].pX1 = currentX;
					this.viewRectangles[k].pY1 = lastY;

					currentX += this.documentRectangles[k].pWidth + this.gapBetweenPages;
					maxY = Math.max(maxY, this.documentRectangles[k].pHeight);
				}

				lastY += maxY + this.gapBetweenPages;
			} else {
				if (x > this._viewSize.pX)
					this._viewSize.pX = x + this.gapBetweenPages * 2;

				this.viewRectangles[i].pX1 = this.gapBetweenPages;
				this.viewRectangles[i].pY1 = lastY;

				lastY += this.documentRectangles[i].pHeight + this.gapBetweenPages;
			}

			i = j - 1;
		}

		this._viewSize.pY = Math.max(lastY, canvasSize[1]);
	}

	// Get the page rectangle or its corresponding view rectangle which contains the given point (document point or view point).
	public getClosestRectangleIndex(
		point: cool.SimplePoint,
		documentPoint = true,
	): number {
		const rectangleList =
			documentPoint === true ? this.documentRectangles : this.viewRectangles;

		for (let i = 0; i < rectangleList.length; i++) {
			if (rectangleList[i].containsPoint(point.toArray())) return i; // Return if a rectangle contains our point.
		}

		// Never return null here. This is the last stand. Find the closest rectangle.
		// This part assumes page rectangles are not angled (portrait / landscape is fine).
		let closest = Number.POSITIVE_INFINITY;
		let part = -1;
		for (let i = 0; i < rectangleList.length; i++) {
			const rectangle = rectangleList[i];
			let current: number;

			if (point.x >= rectangle.x1 && point.x <= rectangle.x2) {
				current = Math.min(
					Math.abs(point.y - rectangle.y2),
					Math.abs(point.y - rectangle.y1),
				);
			} else if (point.y >= rectangle.y1 && point.y <= rectangle.y2) {
				current = Math.min(
					Math.abs(point.x - rectangle.x2),
					Math.abs(point.x - rectangle.x1),
				);
			} else {
				current = Math.min(
					point.distanceTo([rectangle.x1, rectangle.y1]),
					point.distanceTo([rectangle.x2, rectangle.y1]),
					point.distanceTo([rectangle.x1, rectangle.y2]),
					point.distanceTo([rectangle.x2, rectangle.y2]),
				);
			}

			if (current < closest) {
				closest = current;
				part = i;
			}
		}

		return part;
	}

	private refreshVisibleAreaRectangle(): void {
		const documentAnchor = this.getDocumentAnchorSection();
		const view = cool.SimpleRectangle.fromCorePixels([
			this.scrollProperties.viewX,
			this.scrollProperties.viewY,
			documentAnchor.size[0],
			documentAnchor.size[1],
		]);
		const resultingRectangle: cool.SimpleRectangle = new cool.SimpleRectangle(
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			-10000,
			-10000,
		);

		for (let i = 0; i < this.documentRectangles.length; i++) {
			const documentRectangle = this.documentRectangles[i];
			const viewRectangle = this.viewRectangles[i];

			if (view.intersectsRectangle(viewRectangle.toArray())) {
				if (resultingRectangle.pX1 > documentRectangle.pX1)
					resultingRectangle.pX1 = documentRectangle.pX1;

				if (resultingRectangle.pY1 > documentRectangle.pY1)
					resultingRectangle.pY1 = documentRectangle.pY1;

				if (resultingRectangle.pX2 < documentRectangle.pX2)
					resultingRectangle.pX2 = documentRectangle.pX2;

				if (resultingRectangle.pY2 < documentRectangle.pY2)
					resultingRectangle.pY2 = documentRectangle.pY2;
			}
		}

		resultingRectangle.pX1 -= TileManager.tileSize;
		resultingRectangle.pY1 -= TileManager.tileSize;
		resultingRectangle.pWidth += TileManager.tileSize * 2;
		resultingRectangle.pHeight += TileManager.tileSize * 2;

		this._viewedRectangle = resultingRectangle;

		app.sectionContainer.onNewDocumentTopLeft();
		app.sectionContainer.requestReDraw();
	}

	private updateViewData() {
		if (!app.file.writer.pageRectangleList.length) return;

		this.refreshVisibleAreaRectangle();

		if (app.map._docLayer?._cursorMarker)
			app.map._docLayer._cursorMarker.update();

		this.sendClientVisibleArea();

		this.refreshCurrentCoordList();
		TileManager.checkRequestTiles(this.currentCoordList);
	}

	public documentToViewX(point: cool.SimplePoint): number {
		const index = this.getClosestRectangleIndex(point);
		return (
			this.viewRectangles[index].pX1 +
			(point.pX - this.documentRectangles[index].pX1) -
			this.scrollProperties.viewX +
			app.sectionContainer.getDocumentAnchor()[0]
		);
	}

	public documentToViewY(point: cool.SimplePoint): number {
		const index = this.getClosestRectangleIndex(point);
		return (
			this.viewRectangles[index].pY1 +
			(point.pY - this.documentRectangles[index].pY1) -
			this.scrollProperties.viewY +
			app.sectionContainer.getDocumentAnchor()[1]
		);
	}

	public canvasToDocumentPoint(point: cool.SimplePoint): cool.SimplePoint {
		point.pX += this.scrollProperties.viewX;
		point.pY += this.scrollProperties.viewY;

		const index = this.getClosestRectangleIndex(point, false);

		const result = point.clone();

		result.pX =
			this.documentRectangles[index].pX1 +
			(point.pX - this.viewRectangles[index].pX1);
		result.pY =
			this.documentRectangles[index].pY1 +
			(point.pY - this.viewRectangles[index].pY1);

		return result;
	}

	public refreshScrollProperties(): any {
		const documentAnchor = this.getDocumentAnchorSection();

		// The length of the railway that the scroll bar moves on up & down or left & right.
		this.scrollProperties.horizontalScrollLength = documentAnchor.size[0];
		this.scrollProperties.verticalScrollLength = documentAnchor.size[1];

		// Sizes of the scroll bars.
		this.calculateTheScrollSizes();

		// Properties for quick scrolling.
		this.scrollProperties.verticalScrollStep = documentAnchor.size[1] / 2;
		this.scrollProperties.horizontalScrollStep = documentAnchor.size[0] / 2;
	}

	public scroll(pX: number, pY: number): void {
		this.refreshScrollProperties();
		const documentAnchor = this.getDocumentAnchorSection();
		let scrolled = false;

		if (pX !== 0 && this.canScrollHorizontal(documentAnchor)) {
			const max =
				this.scrollProperties.horizontalScrollLength -
				this.scrollProperties.horizontalScrollSize;
			const min = 0;
			const current = this.scrollProperties.startX + pX;
			const endPosition = Math.max(min, Math.min(max, current));

			if (endPosition !== this.scrollProperties.startX) {
				this.scrollProperties.startX = endPosition;
				this.scrollProperties.viewX = Math.round(
					(endPosition / this.scrollProperties.horizontalScrollLength) *
						this.viewSize.pX,
				);
				scrolled = true;
			}
		}

		if (pY !== 0 && this.canScrollVertical(documentAnchor)) {
			const max =
				this.scrollProperties.verticalScrollLength -
				this.scrollProperties.verticalScrollSize;
			const min = 0;
			const current = this.scrollProperties.startY + pY;
			const endPosition = Math.max(min, Math.min(max, current));

			if (endPosition !== this.scrollProperties.startY) {
				this.scrollProperties.startY = endPosition;
				this.scrollProperties.viewY = Math.round(
					(endPosition / this.scrollProperties.verticalScrollLength) *
						this.viewSize.pY,
				);
				scrolled = true;
			}
		}

		if (scrolled) {
			this.sendClientVisibleArea();
			this.updateViewData();
			app.sectionContainer.requestReDraw();
		}
	}

	public scrollTo(pX: number, pY: number): void {
		const point = cool.SimplePoint.fromCorePixels([pX, pY]);
		if (!this.viewedRectangle.containsPoint(point.toArray())) {
			const index = this.getClosestRectangleIndex(point);
			const layoutR = this.documentRectangles[index];
			const viewR = this.viewRectangles[index];

			if (layoutR) {
				let scrolled = false;

				if (!this.viewedRectangle.containsX(point.x)) {
					this.scrollProperties.startX = Math.round(
						(viewR.pX1 / this._viewSize.pX) *
							this.scrollProperties.horizontalScrollLength,
					);
					this.scrollProperties.viewX = Math.round(
						(this.scrollProperties.startX /
							this.scrollProperties.horizontalScrollLength) *
							this.viewSize.pX,
					);
					scrolled = true;
				}

				if (!this.viewedRectangle.containsY(point.y)) {
					this.scrollProperties.startY = Math.round(
						(viewR.pY1 / this._viewSize.pY) *
							this.scrollProperties.verticalScrollLength,
					);
					this.scrollProperties.viewY = Math.round(
						(this.scrollProperties.startY /
							this.scrollProperties.verticalScrollLength) *
							this.viewSize.pY,
					);
					scrolled = true;
				}

				if (scrolled) {
					this.updateViewData();
					app.sectionContainer.requestReDraw();
				}
			}
		}
	}

	public reset() {
		if (!app.file.writer.pageRectangleList.length) return;

		this.resetViewLayout();
		this.updateViewData();
	}

	public get viewSize() {
		return this._viewSize;
	}

	public set viewSize(size: cool.SimplePoint) {
		return; // Disable setting the size externally.
	}

	public get viewedRectangle() {
		return this._viewedRectangle;
	}

	public set viewedRectangle(rectangle: cool.SimpleRectangle) {
		return; // Disable setting the viewed rectangle externally.
	}

	public getTotalSideSpace() {
		const maxX: number = this.viewRectangles.reduce((result, currentItem) => {
			return Math.max(currentItem.pX2, result);
		}, 0);
		const minX: number = this.viewRectangles.reduce((result, currentItem) => {
			return Math.min(currentItem.pX1, result);
		}, 100000);
		const width = maxX - minX;

		const sideSpace = this.viewSize.pX - width;

		if (sideSpace < 0) console.log('smaller than');

		return sideSpace;
	}
}
