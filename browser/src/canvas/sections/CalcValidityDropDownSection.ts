/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

class CalcValidityDropDown extends HTMLObjectSection {
	zIndex: number = L.CSections.CalcValidityDropDown.zIndex;

	constructor (documentPosition: cool.SimplePoint, visible: boolean = true) {
		super(L.CSections.CalcValidityDropDown.name, 16, 16, documentPosition, 'spreadsheet-drop-down-marker', visible);

		this.sectionProperties.mouseEntered = false;
	}

	public onMouseEnter(point: Array<number>, e: MouseEvent): void {
		this.sectionProperties.mouseEntered = true;
	}

	public onMouseLeave() {
		this.sectionProperties.mouseEntered = false;
	}

	public onClick(point: Array<number>, e: MouseEvent): void {
		e.stopPropagation();
		e.preventDefault();
		this.stopPropagating();

		// Calculate the center position of the section. We will send this to core side.
		point[0] = this.position[0] + this.size[0] / 2;
		point[1] = this.position[1] + this.size[1] / 2;

		point[0] *= app.pixelsToTwips;
		point[1] *= app.pixelsToTwips;

		app.map._docLayer._postMouseEvent('buttondown', point[0], point[1], 1, 1, 0);
		app.map._docLayer._postMouseEvent('buttonup', point[0], point[1], 1, 1, 0);
	}
}
