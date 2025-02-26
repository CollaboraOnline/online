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

class ViewLayout {
	private static clientVisibleArea: string = '';

	private static zoneList: Array<cool.SimpleRectangle> = new Array(1); // 1 zone for the whole document as default.

	static getZoneList(): Array<cool.SimpleRectangle> {
		return this.zoneList;
	}

	private static getVisibleAreaString(splitPos: cool.SimplePoint): string {
		return (
			'clientvisiblearea x=' +
			Math.round(app.file.viewedRectangle.x) +
			' y=' +
			Math.round(app.file.viewedRectangle.y) +
			' width=' +
			Math.round(app.file.viewedRectangle.width) +
			' height=' +
			Math.round(app.file.viewedRectangle.height) +
			' splitx=' +
			Math.round(splitPos.x) +
			' splity=' +
			Math.round(splitPos.y)
		);
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

	public static switchToSingleZoneLayout() {
		return false;
	}

	public static switchToMultiZoneLayout() {
		return false;
	}
}
