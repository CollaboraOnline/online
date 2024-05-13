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

class SplitSection extends app.definitions.canvasSectionObject {
	name: string = L.CSections.Debug.Splits.name;
    interactable: boolean = false;
    anchor: string[] = ['top', 'left'];
    processingOrder: number = L.CSections.Debug.Splits.processingOrder;
    drawingOrder: number = L.CSections.Debug.Splits.drawingOrder;
    zIndex: number = L.CSections.Debug.Splits.zIndex;
    boundToSection: string = 'tiles';
    sectionProperties: any = {
        docLayer: app.map._docLayer
    }

    constructor () { super(); }

    onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: Bounds): void {
		var splitPanesContext = this.sectionProperties.docLayer.getSplitPanesContext();
		if (splitPanesContext) {
			var splitPos = splitPanesContext.getSplitPos();
			this.context.strokeStyle = 'red';
			this.context.strokeRect(0, 0, splitPos.x * app.dpiScale, splitPos.y * app.dpiScale);
		}
    }
}

app.definitions.splitSection = SplitSection;
