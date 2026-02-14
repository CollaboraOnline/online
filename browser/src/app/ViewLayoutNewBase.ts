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

/*
        With the relatively new "ViewLayout" class, a new phase has started.

        In this phase, "View"s will try to carry the burden of coordinate systems,
    where CanvasSectionContainer should only know about screen coordinates. For now, CSC also knows about document coordinates.

        ViewLayoutBase represents some parts of our old approach. "ViewLayoutMultiPage" and "ViewLayoutCompareChanges" represent mostly the new approach.
    So the latter 2 are closer to each other than they are to "ViewLayoutBase".

        This differences require a new base class (ViewLayoutNewBase) for new approach's classes. It is "required", because there are duplicated code otherwise.
    This class may be merged with "ViewLayoutBase" in the future.
*/

class ViewLayoutNewBase extends ViewLayoutBase {
	public readonly type: string = 'ViewLayoutNewBase';

	constructor() {
		super();
	}

	public getClientVisibleAreaPayload(): string {
		return 'x=' +
			this.viewedRectangle.x1 +
			' y=' +
			this.viewedRectangle.y1 +
			' width=' +
			this.viewedRectangle.width +
			' height=' +
			this.viewedRectangle.height;
	}

	public sendClientVisibleArea() {
		app.socket.sendMessage('clientvisiblearea ' + this.getClientVisibleAreaPayload());

		return new cool.Bounds(
			new cool.Point(this.viewedRectangle.pX1, this.viewedRectangle.pY1),
			new cool.Point(this.viewedRectangle.pX2, this.viewedRectangle.pY2),
		);
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

	public scroll(pX: number, pY: number): boolean {
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
			pY /= 10;

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
		return scrolled;
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
}
