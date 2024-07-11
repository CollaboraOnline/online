/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

const sectionName = 'TileInvalidationRectangle';
let counter = 0; // Unique counter.
let sectionCount = 0;

class InvalidationRectangleSection extends CanvasSectionObject {
    name: string = sectionName;
    documentObject: boolean = true;
    showSection: boolean = true;
    zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder;
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;

    constructor() {
        super();

        this.name += ' ' + counter;
        counter += 1;
        sectionCount++;

        this.sectionProperties.deletionTimeout = null;
    }

    onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: Bounds): void {
        if (!this.sectionProperties.deletionTimeout && (sectionCount > 1 || !app.map._docLayer._debug.tileInvalidationsOn))
            this.deleteThisSection();

        this.context.globalAlpha = 0.5;
        this.context.strokeStyle = 'red';
        this.context.strokeRect(0, 0, this.size[0], this.size[1]);
        this.context.globalAlpha = 1;
    }

    deleteThisSection() {
        sectionCount--;
        this.sectionProperties.deletionTimeout = setTimeout(() => {
            app.sectionContainer.removeSection(this.name);
        }, 1000);
    }

    public static setRectangle(x: number, y: number, width: number, height: number) {
        const section = new InvalidationRectangleSection();
        app.sectionContainer.addSection(section);
        section.size[0] = width;
        section.size[1] = height;
        section.setPosition(x, y);
    }
}

app.definitions.invalidationRectangleSection = InvalidationRectangleSection;
