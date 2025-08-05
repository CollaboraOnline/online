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

class ViewLayoutBase {
	public readonly type: string = 'ViewLayoutBase';
	protected _viewedRectangle: cool.SimpleRectangle;
	private lastViewedRectangle: cool.SimpleRectangle;
	protected clientVisibleAreaCommand: string = '';
	protected _viewSize: cool.SimplePoint;

	constructor() {
		this._viewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
		this.lastViewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
		this._viewSize = new cool.SimplePoint(0, 0);
	}

	public resetClientVisibleArea(): void {
		this.lastViewedRectangle = new cool.SimpleRectangle(0, 0, 0, 0);
	}

	public sendClientVisibleArea(forceUpdate: boolean = false): void {
		if (!app.map._docLoaded) return;

		var splitPos = app.map._docLayer._splitPanesContext
			? app.map._docLayer._splitPanesContext.getSplitPos()
			: new L.Point(0, 0);

		var visibleArea = app.map.getPixelBounds();
		visibleArea = new L.Bounds(
			app.map._docLayer._pixelsToTwips(visibleArea.min),
			app.map._docLayer._pixelsToTwips(visibleArea.max),
		);
		splitPos = app.map._docLayer._corePixelsToTwips(splitPos);
		var size = visibleArea.getSize();
		var visibleTopLeft = visibleArea.min;
		var newClientVisibleAreaCommand =
			'clientvisiblearea x=' +
			Math.round(visibleTopLeft.x) +
			' y=' +
			Math.round(visibleTopLeft.y) +
			' width=' +
			Math.round(size.x) +
			' height=' +
			Math.round(size.y) +
			' splitx=' +
			Math.round(splitPos.x) +
			' splity=' +
			Math.round(splitPos.y);

		if (this.clientVisibleAreaCommand !== newClientVisibleAreaCommand) {
			// Only update on some change
			if (app.map._docLayer._ySplitter) {
				app.map._docLayer._ySplitter.onPositionChange();
			}
			if (app.map._docLayer._xSplitter) {
				app.map._docLayer._xSplitter.onPositionChange();
			}
			// Visible area is dirty, update it on the server
			app.socket.sendMessage(newClientVisibleAreaCommand);
			if (app.map.contextToolbar) app.map.contextToolbar.hideContextToolbar(); // hide context toolbar when scroll/window resize etc...
			if (!app.map._fatal && app.idleHandler._active && app.socket.connected())
				this.clientVisibleAreaCommand = newClientVisibleAreaCommand;
		}
	}

	public getLastPanDirection(): Array<number> {
		var dx: number = this._viewedRectangle.pX1 - this.lastViewedRectangle.pX1;
		var dy: number = this._viewedRectangle.pY1 - this.lastViewedRectangle.pY1;
		return [Math.sign(dx), Math.sign(dy)];
	}

	public get viewedRectangle() {
		return this._viewedRectangle;
	}

	public set viewedRectangle(rectangle: cool.SimpleRectangle) {
		this._viewedRectangle = rectangle;

		// maintain a view of where we're panning to.
		if (!this._viewedRectangle.equals(this.lastViewedRectangle.toArray()))
			this.lastViewedRectangle = this._viewedRectangle.clone();

		app.sectionContainer.onNewDocumentTopLeft();
		app.sectionContainer.requestReDraw();
	}

	public get viewSize() {
		return this._viewSize;
	}

	public set viewSize(size: cool.SimplePoint) {
		this._viewSize = size;
	}
}
