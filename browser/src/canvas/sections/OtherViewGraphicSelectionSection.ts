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

// This is used for other views' graphic selections.

class OtherViewGraphicSelectionSection extends CanvasSectionObject {
    documentObject: boolean = true;
    interactable: boolean = false; // We don't bother with events.
    zIndex: number = L.CSections.DefaultForDocumentObjects.processingOrder;
    drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder;
    processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;

    static sectionNamePrefix = 'OtherViewGraphicSelection ';
    static sectionPointers: Array<OtherViewGraphicSelectionSection> = [];

    constructor(viewId: number, rectangle: cool.SimpleRectangle, part: number, mode: number) {
        super();

        this.size = [rectangle.pWidth, rectangle.pHeight];
        this.position = [rectangle.pX1, rectangle.pY1];
        this.sectionProperties.color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));
        this.name = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;

        this.sectionProperties.viewId = viewId;
        this.sectionProperties.part = part;
        this.sectionProperties.mode = mode;
    }

    onDraw(frameCount?: number, elapsedTime?: number, subsetBounds?: Bounds): void {
        this.context.strokeStyle = this.sectionProperties.color;
        this.context.lineWidth = 2;
        this.context.strokeRect(-0.5, -0.5, this.size[0], this.size[1]);
    }

    checkMyVisibility() {
        let result = this.size[0] > 0 && this.size[1] > 0;

        if (result) {
            if (!app.map._docLayer.isWriter()) {
                if (this.sectionProperties.part !== app.map._docLayer._selectedPart || this.sectionProperties.mode !== app.map._docLayer._selectedMode)
                    result = false;
            }
        }
        return result;
    }

    public static addOrUpdateGraphicSelectionIndicator(viewId: number, rectangleData: Array<string>, part: number, mode: number) {
        let rectangle = new cool.SimpleRectangle(0, 0, 0, 0);
        if (rectangleData)
            rectangle = new app.definitions.simpleRectangle(parseInt(rectangleData[0]), parseInt(rectangleData[1]), parseInt(rectangleData[2]), parseInt(rectangleData[3]));

        const sectionName = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
        let section: OtherViewGraphicSelectionSection;
        if (app.sectionContainer.doesSectionExist(sectionName)) {
            section = app.sectionContainer.getSectionWithName(sectionName);
            section.sectionProperties.part = part;
            section.sectionProperties.mode = mode;
            section.size[0] = rectangle.pWidth;
            section.size[1] = rectangle.pHeight;
            section.setPosition(rectangle.pX1, rectangle.pY1);
        }
        else {
            section = new OtherViewGraphicSelectionSection(viewId, rectangle, part, mode);
            app.sectionContainer.addSection(section);
            OtherViewGraphicSelectionSection.sectionPointers.push(section);
        }

        section.setShowSection(section.checkMyVisibility());
        app.sectionContainer.requestReDraw();
    }

    public static removeView(viewId: number) {
        const sectionName = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
        if (app.sectionContainer.doesSectionExist(sectionName)) {
            const section = app.sectionContainer.getSectionWithName(sectionName);
            OtherViewGraphicSelectionSection.sectionPointers.splice(OtherViewGraphicSelectionSection.sectionPointers.indexOf(section), 1);
            app.sectionContainer.removeSection(sectionName);
            app.sectionContainer.requestReDraw();
        }
    }

    public static updateVisibilities() {
        for (let i = 0; i < OtherViewGraphicSelectionSection.sectionPointers.length; i++) {
            const section = OtherViewGraphicSelectionSection.sectionPointers[i];
            section.setShowSection(section.checkMyVisibility());
        }
        app.sectionContainer.requestReDraw();
    }
}

app.definitions.otherViewGraphicSelectionSection = OtherViewGraphicSelectionSection;
