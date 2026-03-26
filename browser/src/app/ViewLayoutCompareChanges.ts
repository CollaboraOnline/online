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

class ViewLayoutCompareChanges extends ViewLayoutNewBase {
	public readonly type: string = 'ViewLayoutCompareChanges';

	/// Last tile mode seen when converting from canvas to document coordinates.
	public lastTileMode: TileMode = TileMode.RightSide;

	private halfWidth = 0; // Half width of the view.
	private viewGap = Math.round(20 / app.dpiScale); // The gap between the 2 views.
	private yStart = Math.round(20 / app.dpiScale); // The space above the first page.

	constructor() {
		super();

		app.map.on('zoomend', this.onZoomEnd.bind(this));

		this.adjustViewZoomLevel();

		app.layoutingService.appendLayoutingTask(() => {
			app.sectionContainer.reNewAllSections();
			this.updateViewData();
		});
	}

	/// Refresh the view after scroll or zoom change.
	private refreshView(): void {
		this.updateViewData();
		app.sectionContainer.requestReDraw();
	}

	private onZoomEnd(): void {
		this.refreshView();
	}

	public override adjustViewZoomLevel() {
		Util.ensureValue(app.activeDocument);

		const min = 0.1;
		const max = 10;

		const anchorSection = this.getDocumentAnchorSection();
		this.halfWidth = Math.round(anchorSection.size[0] * 0.5);

		const ratio = this.halfWidth / app.activeDocument.fileSize.pX;
		let zoom = app.map.getScaleZoom(ratio);
		zoom = Math.min(max, Math.max(min, zoom));

		if (zoom > 1) zoom = Math.floor(zoom);

		app.map.setZoom(zoom, { animate: false });
	}

	protected override refreshCurrentCoordList() {
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

		// Notify the section container that the document visible area changed, necessary
		// for comment positions to update.
		app.sectionContainer.onNewDocumentTopLeft();
	}

	protected updateViewData() {
		Util.ensureValue(app.activeDocument);

		const anchorSection = this.getDocumentAnchorSection();

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

		app.map._docLayer._sendClientZoom();
		this.sendClientVisibleArea();

		this.refreshCurrentCoordList();
		TileManager.beginTransaction();
		TileManager.checkRequestTiles(this.currentCoordList);
		TileManager.endTransaction(null);
	}

	private getDeflectionX(mode: TileMode): number {
		Util.ensureValue(app.activeDocument);

		if (mode === TileMode.LeftSide)
			return (
				this.halfWidth -
				app.activeDocument.fileSize.pX -
				this.scrollProperties.viewX -
				this.viewGap
			);
		else return this.halfWidth + this.viewGap - this.scrollProperties.viewX;
	}

	public override documentToViewX(point: cool.SimplePoint): number {
		Util.ensureValue(app.activeDocument);

		// Default to right side.
		if (point.mode === -1) point.mode = TileMode.RightSide;

		return (
			point.pX +
			this.getDeflectionX(point.mode) +
			this._documentAnchorPosition[0]
		);
	}

	public override documentToViewY(point: cool.SimplePoint): number {
		return (
			point.pY +
			this.yStart -
			this.scrollProperties.viewY +
			this._documentAnchorPosition[1]
		);
	}

	public override canvasToDocumentPoint(
		point: cool.SimplePoint,
	): cool.SimplePoint {
		const result = point.clone();

		point.mode =
			point.pX < this.halfWidth ? TileMode.LeftSide : TileMode.RightSide;

		// Remember which tile mode was used last.
		this.lastTileMode = point.mode;

		result.pX -=
			this.getDeflectionX(point.mode) + this._documentAnchorPosition[0];
		result.pY +=
			this.scrollProperties.viewY -
			this.yStart -
			this._documentAnchorPosition[1];

		return result;
	}

	public override canScrollHorizontal(
		documentAnchor: CanvasSectionObject,
	): boolean {
		return this.viewSize.pX > Math.round(documentAnchor.size[0] * 0.5);
	}

	public override scroll(pX: number, pY: number): boolean {
		const scrolled = super.scroll(pX, pY);

		if (scrolled) {
			this.refreshView();
		}

		return scrolled;
	}
}
