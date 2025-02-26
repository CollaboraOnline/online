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

class Zone {
	public viewedRectangle: cool.SimpleRectangle;
	public part: number;
	public mode: number;
	public show: boolean;

	constructor(
		viewedRectangle: cool.SimpleRectangle,
		part: number,
		mode: number = 0,
		show: boolean = true,
	) {
		this.viewedRectangle = viewedRectangle;
		this.part = part;
		this.mode = mode;
		this.show = show;
	}
}

class ViewLayout {
	private static clientVisibleArea: string = '';
	private static selectedZone: number = 0;

	private static zoneList: Array<Zone> = new Array(1); // 1 zone for the whole document as default.

	public static initialize(): void {
		this.zoneList[0] = new Zone(new cool.SimpleRectangle(0, 0, 0, 0), 0);
	}

	static getZoneList(): Array<Zone> {
		return this.zoneList;
	}

	private static getSplitPos(): cool.SimplePoint {
		if (app.map._docLayer._splitPanesContext) {
			const splitPos = app.map._docLayer._splitPanesContext
				.getSplitPos()
				.multiplyBy(app.dpiScale);
			return new cool.SimplePoint(
				splitPos.x * app.pixelsToTwips,
				splitPos.y * app.pixelsToTwips,
			);
		} else return new cool.SimplePoint(0, 0);
	}

	private static getVisibleAreaString(splitPos: cool.SimplePoint): string {
		const selectedZone = this.zoneList[this.selectedZone];
		const viewedRectangle = selectedZone.viewedRectangle;

		return (
			'clientvisiblearea x=' +
			Math.round(viewedRectangle.x1) +
			' y=' +
			Math.round(viewedRectangle.y1) +
			' width=' +
			Math.round(viewedRectangle.width) +
			' height=' +
			Math.round(viewedRectangle.height) +
			' splitx=' +
			Math.round(splitPos.x) +
			' splity=' +
			Math.round(splitPos.y)
		);
	}

	public static sendClientVisibleArea(forceUpdate: boolean = false): void {
		if (!app.map._docLoaded) return;

		var splitPos = app.map._docLayer._splitPanesContext
			? app.map._docLayer._splitPanesContext.getSplitPos()
			: new cool.SimplePoint(0, 0);

		splitPos = this.getSplitPos();
		const newClientVisibleArea: string = this.getVisibleAreaString(splitPos);

		if (app.map._docLayer._ySplitter)
			app.map._docLayer._ySplitter.onPositionChange();
		if (app.map._docLayer._xSplitter)
			app.map._docLayer._xSplitter.onPositionChange();

		if (this.clientVisibleArea !== newClientVisibleArea || forceUpdate) {
			// Visible area is dirty, update it on the server
			app.socket.sendMessage(newClientVisibleArea);
			if (!app.map._fatal && app.idleHandler._active && app.socket.connected())
				this.clientVisibleArea = newClientVisibleArea;
		}
	}

	public static getViewedRectangleOf(zoneIndex: number = 0) {
		return this.zoneList[zoneIndex].viewedRectangle;
	}

	// ToDo: _splitPanesContext should be an app variable.
	public static isPointVisibleInTheDisplayedArea(
		twipsArray: Array<number> /* x, y */,
	) {
		if (app.map._docLayer._splitPanesContext) {
			const rectangles = this.getSplitViewRectangles();
			for (let i = 0; i < rectangles.length; i++) {
				if (rectangles[i].containsPoint(twipsArray)) return true;
			}
			return false;
		} else {
			return this.getViewedRectangle().containsPoint(twipsArray);
		}
	}

	public static isRectangleVisibleInTheDisplayedArea(
		twipsArray: Array<number> /* x, y, width, height */,
	) {
		if (app.map._docLayer._splitPanesContext) {
			const rectangles = this.getSplitViewRectangles();
			for (let i = 0; i < rectangles.length; i++) {
				if (rectangles[i].intersectsRectangle(twipsArray)) return true;
			}
			return false;
		} else {
			return this.getViewedRectangle().intersectsRectangle(twipsArray);
		}
	}

	public static getSplitViewRectangles() {
		// This is zone-agnostic for now.
		if (app.map._docLayer._splitPanesContext)
			return app.map._docLayer._splitPanesContext.getViewRectangles();
		else return [this.getViewedRectangle().clone()];
	}

	public static getViewedRectangle() {
		return this.zoneList[this.selectedZone].viewedRectangle;
	}

	public static setViewedRectangleOf(
		viewedRectangle: cool.SimpleRectangle,
		zoneIndex: number = 0,
	) {
		this.zoneList[zoneIndex].viewedRectangle = viewedRectangle;
	}

	public static setViewedRectangle(viewedRectangle: cool.SimpleRectangle) {
		this.zoneList[this.selectedZone].viewedRectangle = viewedRectangle;
	}

	public static switchToSingleZoneLayout() {
		return false;
	}

	public static switchToMultiZoneLayout() {
		return false;
	}
}
