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
    zIndex: number = app.CSections.DefaultForDocumentObjects.processingOrder;
    drawingOrder: number = app.CSections.DefaultForDocumentObjects.drawingOrder;
    processingOrder: number = app.CSections.DefaultForDocumentObjects.processingOrder;

    static sectionNamePrefix = 'OtherViewGraphicSelection ';
    static sectionPointers: Array<OtherViewGraphicSelectionSection> = [];

    constructor(viewId: number, rectangle: cool.SimpleRectangle, part: number, mode: number) {
        super(OtherViewGraphicSelectionSection.sectionNamePrefix + viewId);

        this.size = [rectangle.pWidth, rectangle.pHeight];
        this.position = [rectangle.pX1, rectangle.pY1];
        this.sectionProperties.color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));

        this.sectionProperties.viewId = viewId;
        this.sectionProperties.part = part;
        this.sectionProperties.mode = mode;
        this.sectionProperties.viewLockInfo = null;
    }

    onDraw(frameCount?: number, elapsedTime?: number): void {
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
            rectangle = new cool.SimpleRectangle(parseInt(rectangleData[0]), parseInt(rectangleData[1]), parseInt(rectangleData[2]), parseInt(rectangleData[3]));

        if (app.map._docLayer.isCalc() && app.map._docLayer.sheetGeometry)
            app.map._docLayer.sheetGeometry.convertRectangleToTileTwips(rectangle);

        const sectionName = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
        let section: OtherViewGraphicSelectionSection;
        if (app.sectionContainer.doesSectionExist(sectionName)) {
            section = app.sectionContainer.getSectionWithName(sectionName) as OtherViewGraphicSelectionSection;
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
            const section = app.sectionContainer.getSectionWithName(sectionName) as OtherViewGraphicSelectionSection;
            OtherViewGraphicSelectionSection.sectionPointers.splice(OtherViewGraphicSelectionSection.sectionPointers.indexOf(section), 1);
            app.sectionContainer.removeSection(sectionName);
            app.sectionContainer.requestReDraw();
        }
    }

    public static setViewLockInfo(viewId: number, viewLockInfo: any) {
        const sectionName = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
        if (app.sectionContainer.doesSectionExist(sectionName)) {
            const section = app.sectionContainer.getSectionWithName(sectionName) as OtherViewGraphicSelectionSection;
            section.sectionProperties.viewLockInfo = viewLockInfo;
        }
    }

    public static hasViewLockInfo(viewId: number) {
        const sectionName = OtherViewGraphicSelectionSection.sectionNamePrefix + viewId;
        if (app.sectionContainer.doesSectionExist(sectionName)) {
            const section = app.sectionContainer.getSectionWithName(sectionName) as OtherViewGraphicSelectionSection;
            return section.sectionProperties.viewLockInfo !== null;
        }
        else return false;
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
