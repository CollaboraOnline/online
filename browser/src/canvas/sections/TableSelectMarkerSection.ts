/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class TableSelectMarkerSection extends HTMLObjectSection {
	constructor(
		name: string,
		objectWidth: number,
		objectHeight: number,
		documentPosition: cool.SimplePoint,
		extraClass: string,
		markerType: string,
		showSection: boolean = true,
	) {
		super(
			name,
			objectWidth,
			objectHeight,
			documentPosition,
			extraClass,
			showSection,
		);

		this.sectionProperties.markerType = markerType;
	}

	public onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.add('hovered');
	}

	public onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.remove('hovered');
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	public onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	private stopEvents(e: MouseEvent) {
		this.stopPropagating();

		// We shouldn't need below 2 when we remove map element.
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
		if (this.sectionProperties.markerType === 'column') {
			const x1 = Math.round(
				(this.position[0] + this.size[0] * 0.5) * app.pixelsToTwips,
			);
			const y1 = Math.round(
				app.activeDocument.tableMiddleware.getTableTopY() * app.pixelsToTwips,
			);
			const x2 = x1;
			const y2 = Math.round(
				app.activeDocument.tableMiddleware.getTableBottomY() *
					app.pixelsToTwips,
			);

			app.map._docLayer._postSelectTextEvent('start', x1, y1 + 5);
			app.map._docLayer._postSelectTextEvent('end', x2, y2 - 5);
		} else {
			const x1 = Math.round(
				app.activeDocument.tableMiddleware.getTableLeftX() * app.pixelsToTwips,
			);
			const y1 = Math.round(
				(this.position[1] + this.size[1] * 0.5) * app.pixelsToTwips,
			);
			const x2 = Math.round(
				app.activeDocument.tableMiddleware.getTableRightX() * app.pixelsToTwips,
			);
			const y2 = y1;

			app.map._docLayer._postSelectTextEvent('start', x1 + 5, y1);
			app.map._docLayer._postSelectTextEvent('end', x2 - 5, y2);
		}
	}
}
