/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class ChartContextButtonSection extends HTMLObjectSection {
	static readonly namePrefix: string = 'ChartContextButton_';

	constructor(buttonType: number) {
		super(
			ChartContextButtonSection.namePrefix + buttonType,
			32,
			32,
			new cool.SimplePoint(
				GraphicSelection.rectangle.x2,
				GraphicSelection.rectangle.y1,
			),
			'table-add-col-row-marker',
			true,
		);
		this.sectionProperties.buttonType = buttonType;
		this.sectionProperties.lastInputEvent = null;
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

	public showChartContextToolbar(): void {
		this.setShowSection(true);
	}

	setLastInputEventType(e: any) {
		this.sectionProperties.lastInputEvent = e;
	}
}
