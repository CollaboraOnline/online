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
declare var L: any;
declare var app: any;

namespace cool {

export type SplitPanesOptions = {
	maxHorizontalSplitPercent: number;
	maxVerticalSplitPercent: number;
}

export type PaneStatus = {
	xFixed: boolean;
	yFixed: boolean;
}

/*
 * SplitPanesContext stores positions/sizes/objects related to split panes.
 */
export class SplitPanesContext {

	private static options: SplitPanesOptions = {
		maxHorizontalSplitPercent: 70,
		maxVerticalSplitPercent: 70,
	};

	protected _docLayer: any;
	protected _map: any;
	protected _splitPos: SimplePoint;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor(docLayer: any, createSplitters: boolean = false) {
		console.assert(docLayer, 'no docLayer!');
		console.assert(docLayer._map, 'no map!');

		this._docLayer = docLayer;
		this._map = docLayer._map;
		this._setDefaults();

		if (createSplitters) {
			this.updateSplitters();
		}
	}

	protected _setDefaults(): void {
		this._splitPos = new SimplePoint(0, 0);
	}

	public get options(): SplitPanesOptions {
		return SplitPanesContext.options;
	}

	public getMaxSplitPosX(): number {
		const rawMax = Math.floor(app.dpiScale * this._map.getSize().x * this.options.maxHorizontalSplitPercent / 100);
		return this._docLayer.getSnapDocPosX(rawMax);
	}

	public getMaxSplitPosY(): number {
		const rawMax = Math.floor(app.dpiScale * this._map.getSize().y * this.options.maxVerticalSplitPercent / 100);
		return this._docLayer.getSnapDocPosY(rawMax);
	}

	public setSplitPos(splitX: number, splitY: number, forceUpdate: boolean = false): void {

		var xchanged = this.setHorizSplitPos(splitX, forceUpdate, true /* noFire */);
		var ychanged = this.setVertSplitPos(splitY, forceUpdate, true /* noFire */);
		if (xchanged || ychanged)
			this._map.fire('splitposchanged');
	}

	public getSplitPos(): SimplePoint {
		return this._splitPos.divideBy(app.dpiScale as number);
	}

	public justifySplitPos(split: number, isHoriz: boolean): number {
		if (split <= 0) {
			return 0;
		}

		var maxSplitPos = isHoriz ? this.getMaxSplitPosX() : this.getMaxSplitPosY();
		if (split >= maxSplitPos) {
			return maxSplitPos;
		}

		return isHoriz ? this._docLayer.getSnapDocPosX(split) :
			this._docLayer.getSnapDocPosY(split);
	}

	public setHorizSplitPos(splitX: number, forceUpdate: boolean, noFire: boolean): boolean {

		console.assert(typeof splitX === 'number', 'splitX must be a number');

		if (this._splitPos.x === splitX) {
			if (forceUpdate || !this._docLayer.hasXSplitter()) {
				this._updateXSplitter();
			}
			return false;
		}

		var changed = false;
		var newX = this.justifySplitPos(splitX, true /* isHoriz */);
		if (newX !== this._splitPos.x) {
			this._splitPos.x = newX;
			changed = true;
		}

		this._updateXSplitter();

		if (!noFire)
			this._map.fire('splitposchanged');

		return changed;
	}

	public setVertSplitPos(splitY: number, forceUpdate: boolean, noFire: boolean): boolean {

		console.assert(typeof splitY === 'number', 'splitY must be a number');

		if (this._splitPos.y === splitY) {
			if (forceUpdate || !this._docLayer.hasYSplitter()) {
				this._updateYSplitter();
			}
			return false;
		}

		var changed = false;
		var newY = this.justifySplitPos(splitY, false /* isHoriz */);
		if (newY !== this._splitPos.y) {
			this._splitPos.y = newY;
			changed = true;
		}

		this._updateYSplitter();

		if (!noFire)
			this._map.fire('splitposchanged');

		return changed;
	}

	public updateSplitters(): void {
		this._updateXSplitter();
		this._updateYSplitter();
	}

	private _updateXSplitter(): void {
		this._docLayer.updateHorizPaneSplitter();
	}

	private _updateYSplitter(): void {
		this._docLayer.updateVertPaneSplitter();
	}

	public getPanesProperties(): PaneStatus[] {
		var paneStatusList: PaneStatus[] = [];
		if (this._splitPos.x && this._splitPos.y) {
			// top-left pane
			paneStatusList.push({
				xFixed: true,
				yFixed: true,
			});
		}

		if (this._splitPos.y) {
			// top-right pane or top half pane
			paneStatusList.push({
				xFixed: false,
				yFixed: true,
			});
		}

		if (this._splitPos.x) {
			// bottom-left pane or left half pane
			paneStatusList.push({
				xFixed: true,
				yFixed: false,
			});
		}

		// bottom-right/bottom-half/right-half pane or the full pane (when there are no split-panes active)
		paneStatusList.push({
			xFixed: false,
			yFixed: false,
		});

		return paneStatusList;
	}

	// returns all the pane rectangles for the provided full-map area (all in core pixels).
	public getPxBoundList(pxBounds?: Bounds): Bounds[] {
		if (!pxBounds) {
			pxBounds = this._map.getPixelBoundsCore() as Bounds;
		}
		var topLeft = pxBounds.getTopLeft();
		var bottomRight = pxBounds.getBottomRight();
		var boundList: Bounds[] = [];

		if (this._splitPos.x && this._splitPos.y) {
			// top-left pane
			boundList.push(new Bounds(
				new Point(0, 0),
				this._splitPos
			));
		}

		if (this._splitPos.y) {
			// top-right pane or top half pane
			boundList.push(new Bounds(
				new Point(topLeft.x + this._splitPos.x, 0),
				new Point(bottomRight.x, this._splitPos.y)
			));
		}

		if (this._splitPos.x) {
			// bottom-left pane or left half pane
			boundList.push(new Bounds(
				new Point(0, topLeft.y + this._splitPos.y),
				new Point(this._splitPos.x, bottomRight.y)
			));
		}

		if (!boundList.length) {
			// the full pane (when there are no split-panes active)
			boundList.push(new Bounds(
				topLeft,
				bottomRight
			));
		} else {
			// bottom-right/bottom-half/right-half pane
			boundList.push(new Bounds(
				topLeft.add(this._splitPos),
				bottomRight
			));
		}

		return boundList;
	}

	public getTwipsBoundList(pxBounds: Bounds): Bounds[] {
		var bounds = this.getPxBoundList(pxBounds);
		var docLayer = this._docLayer;
		return bounds.map(function (bound) {
			return new Bounds(
				docLayer._corePixelsToTwips(bound.min) as Point,
				docLayer._corePixelsToTwips(bound.max) as Point
			);
		});
	}

	public intersectsVisible(areaPx: Bounds): boolean {
		var pixBounds = this._map.getPixelBoundsCore() as Bounds;
		var boundList = this.getPxBoundList(pixBounds);
		for (var i = 0; i < boundList.length; ++i) {
			if (areaPx.intersects(boundList[i])) {
				return true;
			}
		}

		return false;
	}
}

}

L.SplitPanesContext = cool.SplitPanesContext;
