/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class TableInsertMarkerSection extends HTMLObjectSection {
	static readonly namePrefix: string = 'TableInsertMarker_';

	constructor(type: 'row' | 'column', documentPosition: cool.SimplePoint) {
		super(
			TableInsertMarkerSection.namePrefix + type,
			0,
			0,
			documentPosition,
			'table-add-col-row-marker',
			true,
		);

		this.sectionProperties.markerType = type;
		this.sectionProperties.mouseEntered = false;

		const div = this.getHTMLObject();
		div.classList.add('table-add-col-row-marker');
	}

	public onMouseEnter() {
		this.sectionProperties.mouseEntered = true;
		this.getHTMLObject()?.classList.add('hovered');
	}

	public onMouseLeave() {
		this.sectionProperties.mouseEntered = false;
		this.getHTMLObject()?.classList.remove('hovered');
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		e.preventDefault();
		this.stopPropagating();
		e.stopPropagation();
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		e.preventDefault();
		this.stopPropagating();
		e.stopPropagation();

		this.handleClick();
	}

	public getMarkerType(): string {
		return this.sectionProperties.markerType;
	}

	public setMarkerSize(width: number, height: number): void {
		this.size = [width, height];
		const container = this.getHTMLObject();
		if (container) {
			container.style.width = `${width}px`;
			container.style.height = `${height}px`;
		}
	}

	private handleClick(): void {
		if (this.sectionProperties.markerType === 'column') {
			app.socket.sendMessage('uno .uno:InsertColumnsAfter');
		} else {
			app.socket.sendMessage('uno .uno:InsertRowsAfter');
		}
	}
}
