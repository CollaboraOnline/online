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

class ShapeHandlePolySubSection extends ShapeHandleCustomSubSection {
	constructor (parentHandlerSection: ShapeHandlesSection, sectionName: string, size: number[], documentPosition: cool.SimplePoint, ownInfo: any) {
        super(parentHandlerSection, sectionName, size, documentPosition, ownInfo);
		this.sectionProperties.mousePointerType = 'move';
	}
}

app.definitions.shapeHandlePolySubSection = ShapeHandlePolySubSection;
