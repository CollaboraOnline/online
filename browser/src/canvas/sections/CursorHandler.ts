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

// This is used for other views' cursors.

class CursorHandler extends HTMLObjectSection {
	public static objectWidth = 30; // leaflet-cursor-handler CSS width and height.
	public static objectHeight = 44;

	constructor() {
		super(
			app.CSections.CursorHandler.name,
			CursorHandler.objectWidth,
			CursorHandler.objectHeight,
			new cool.SimplePoint(0, 0),
			'leaflet-cursor-handler',
			false,
		);
	}

	onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		app.map._docLayer._postMouseEvent('buttondown', point.x, point.y, 1, 1, 0);
		app.map._docLayer._postMouseEvent('buttonup', point.x, point.y, 1, 1, 0);
	}

	setOpacity() {
		this.getHTMLObject().style.opacity = 0;
	}
}
