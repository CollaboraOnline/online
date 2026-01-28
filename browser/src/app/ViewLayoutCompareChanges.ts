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

enum TileMode {
	LeftSide = 1,
	RightSide = 2,
}

class ViewLayoutCompareChanges extends ViewLayoutMultiPage {
	public readonly type: string = 'ViewLayoutCompareChanges';
	private halfWidth = 0; // Half width of the view.
	private viewGap = Math.round(20 / app.dpiScale); // The gap between the 2 views.
	private yStart = Math.round(20 / app.dpiScale); // The space above the first page.

	constructor() {
		super();
	}

	protected refreshCurrentCoordList() {
		super.refreshCurrentCoordList();

		const additionalCoords: Array<TileCoordData> = [];

		for (let i = 0; i < this.currentCoordList.length; i++) {
			const item: TileCoordData = this.currentCoordList[i];

			additionalCoords.push(
				new TileCoordData(
					item.x,
					item.y,
					item.z,
					item.part,
					TileMode.RightSide,
				),
			);

			item.mode = TileMode.LeftSide;
		}

		for (let i = 0; i < additionalCoords.length; i++) {
			this.currentCoordList.push(additionalCoords[i]);
		}
	}

	protected refreshVisibleAreaRectangle(): void {
		const documentAnchor = this.getDocumentAnchorSection();

		this._viewedRectangle = cool.SimpleRectangle.fromCorePixels([
			this.scrollProperties.viewX,
			this.scrollProperties.viewY - this.yStart,
			this.halfWidth - this.viewGap,
			documentAnchor.size[1],
		]);
	}

	protected updateViewData() {
		Util.ensureValue(app.activeDocument);

		if (!app.file.writer.pageRectangleList.length) return;

		const anchorSection = this.getDocumentAnchorSection();
		this.halfWidth = Math.round(anchorSection.size[0] * 0.5);

		this._viewSize = cool.SimplePoint.fromCorePixels([
			Math.max(
				this.halfWidth,
				app.activeDocument.fileSize.pX + 2 * this.viewGap,
			),
			Math.max(
				anchorSection.size[1],
				app.activeDocument.fileSize.pY + this.yStart,
			),
		]);

		this.refreshVisibleAreaRectangle();

		if (app.map._docLayer?._cursorMarker)
			app.map._docLayer._cursorMarker.update();

		this.sendClientVisibleArea();

		this.refreshCurrentCoordList();
		TileManager.checkRequestTiles(this.currentCoordList);
	}

	public documentToViewX(point: cool.SimplePoint): number {
		Util.ensureValue(app.activeDocument);

		if (point.mode === TileMode.LeftSide)
			return (
				this.halfWidth -
				app.activeDocument.fileSize.pX +
				point.pX -
				this.scrollProperties.viewX -
				this.viewGap
			);
		else
			return (
				point.pX - this.scrollProperties.viewX + this.halfWidth + this.viewGap
			);
	}

	public documentToViewY(point: cool.SimplePoint): number {
		return point.pY + this.yStart - this.scrollProperties.viewY;
	}

	public canvasToDocumentPoint(point: cool.SimplePoint): cool.SimplePoint {
		const result = point.clone();

		if (this.scrollProperties.viewX) result.pX += this.scrollProperties.viewX;
		result.pY += this.scrollProperties.viewY;

		return result;
	}

	public scrollTo(pX: number, pY: number): void {
		const point = cool.SimplePoint.fromCorePixels([pX, pY]);
		if (!this.viewedRectangle.containsPoint(point.toArray())) {
			return;
		}
	}

	public reset() {
		this.updateViewData();
	}
}
