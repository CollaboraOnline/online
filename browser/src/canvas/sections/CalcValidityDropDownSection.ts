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

	constructor (sectionName: string, documentPosition: cool.SimplePoint, visible: boolean = true) {
		super(sectionName, 16, 16, documentPosition, 'spreadsheet-drop-down-marker', visible);
	}

    onClick(point: number[], e: MouseEvent): void {
		this.stopPropagating();
		if (app.map._docLayer._validatedCellAddress && app.calc.cellCursorVisible && app.map._docLayer._validatedCellAddress.equals(app.calc.cellAddress.toArray())) {
			app.map.sendUnoCommand('.uno:DataSelect');
		}
    }
}

app.definitions.calcValidityDropDown = CalcValidityDropDown;
