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
	}
}
