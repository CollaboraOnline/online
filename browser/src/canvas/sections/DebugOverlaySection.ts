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

class DebugOverlaySection extends app.definitions.canvasSectionObject {
	name: string = L.CSections.Debug.DebugOverlay.name;
    interactable: boolean = false;
    anchor: string[] = ['top', 'left'];
    processingOrder: number = L.CSections.Debug.DebugOverlay.processingOrder;
    drawingOrder: number = L.CSections.Debug.DebugOverlay.drawingOrder;
    zIndex: number = L.CSections.Debug.DebugOverlay.zIndex;
    boundToSection: string = 'tiles';

    constructor () { super(); }

    onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: Bounds): void {

            var msgs = this._map._debug.getOverlayMessages();

	    // FIXME: filter top / bottom
	    const textLines = msgs.values().join('\n').split('\n');

	    this.context.font = "16px Arial";
	    this.context.fillStyle = "black";

	    var lineHeight = 20;
	    var xpad = lineHeight;
	    var ypad = lineHeight;
	    textLines.forEach((txt: string, i: number) => {
		    this.context.fillText(txt, xpad, ypad + (i * lineHeight));
	    });

//	    height = this.context.canvas.height;
    }
}

app.definitions.debugOverlaySection = DebugOverlaySection;
