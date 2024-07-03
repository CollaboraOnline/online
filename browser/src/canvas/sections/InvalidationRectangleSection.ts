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

class InvalidationRectangleSection extends CanvasSectionObject {
    name: string = sectionName;
    documentObject: boolean = true;
    showSection: boolean = true;
    zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
    drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder;
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;

    constructor() {
        super();

        this.sectionProperties.deletionTimeout = null;
    }

    onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: Bounds): void {
        if (!app.map._docLayer._debug.tileInvalidationsOn && !this.sectionProperties.deletionTimeout) {
            this.sectionProperties.deletionTimeout = setTimeout(() => {
                this.deleteThisSection();
            }, 200);
        }
        this.context.strokeStyle = 'red';
        this.context.strokeRect(0, 0, this.size[0], this.size[1]);
    }

    deleteThisSection() {
        app.sectionContainer.removeSection(sectionName);
    }

    public static setRectangle(x: number, y: number, width: number, height: number) {
        let section = app.sectionContainer.getSectionWithName(sectionName);
        if (!section) {
            section = new InvalidationRectangleSection();
            app.sectionContainer.addSection(section);
        }

        section.size[0] = width;
        section.size[1] = height;
        section.setPosition(x, y);
    }
}

app.definitions.invalidationRectangleSection = InvalidationRectangleSection;
