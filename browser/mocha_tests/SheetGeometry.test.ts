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

/// <reference path="./refs/globals.ts"/>
/// <reference path="./data/SheetGeometryTestData.ts" />
/// <reference path="../src/core/geometry.ts" />

var assert = require('assert').strict;

describe('SheetGeometry public methods tests', function () {

    // To debug tests for some/one particular zoom levels, add to this array.
    var runOnlyForZooms: number[] = [];
    var runTestData = testData;
    if (runOnlyForZooms.length) {
        runTestData = testData.filter(testDataForZoom => runOnlyForZooms.includes(testDataForZoom.zoom));
    }

    runTestData.forEach(function(testDataForZoom) {

        describe('Document zoom level = ' + testDataForZoom.zoom, function () {
            testsForDocZoom(testDataForZoom);
        });
    });

});

describe('SheetGeometry bugfix tests', function () {

    describe('update: On ungroup groups key will have an empty string - should not skip parsing', function () {
        var sgObj = {
            commandName: ".uno:SheetGeometryData",
            maxtiledcolumn: "1023",
            maxtiledrow: "500000",
            columns: {
                sizes: "1280:1023 ",
                hidden: "0:1023 ",
                filtered: "0:1023 ",
                groups: ""
            },
            rows: {
                sizes: "256:1048575 ",
                hidden: "0:1048575 ",
                filtered: "0:1048575 ",
                groups: "10:14:0:1, 13:9:0:1, 17:4:1:1, "
            }
        };

        var tileSizePx = 256;
        // Important: this mirrors how it is done in CanvasTileLayer.js
        var tileWidthTwips = Math.round(tileSizePx * 15 / zoomToAbsScale(10));
        var tileHeightTwips = tileWidthTwips;

        var sg = new cool.SheetGeometry(sgObj, tileWidthTwips, tileHeightTwips, tileSizePx, 0);
        it('correctness of getRowGroupLevels() before ungroup', function () {
            assert.equal(sg.getRowGroupLevels(), 3);
        });

        it('correctness of getRowGroupLevels() after ungroup', function () {
            sgObj.rows.groups = "";
            sg.update(sgObj, true, 0);
            assert.equal(sg.getRowGroupLevels(), 0);
        });
    });
});

function zoomToAbsScale(level: number): number {
    return Math.pow(1.2, level - 10);
}

function testsForDocZoom(testDataForZoom: TestDataForZoom) {
    var tileSizePx = 256;
    // Important: this mirrors how it is done in CanvasTileLayer.js
    var tileWidthTwips = Math.round(tileSizePx * 15 / zoomToAbsScale(testDataForZoom.zoom));
    var tileHeightTwips = tileWidthTwips;

    // To debug tests for some/one particular part levels, add to this array.
    var runOnlyForParts: number[] = [];
    var runPartsData = testDataForZoom.partsTestData;
    if (runOnlyForParts.length) {
        runPartsData = testDataForZoom.partsTestData.filter(partTestData => runOnlyForParts.includes(partTestData.part));
    }

    runPartsData.forEach(function(partTestData) {
        var part = partTestData.part;
        var partTestDesc = ' part#' + part + ' - ' + partTestData.description;
        var sg = new cool.SheetGeometry(partTestData.sheetgeometrymsg,
            tileWidthTwips, tileHeightTwips, tileSizePx, part);

        var viewBoundsTwips = testDataForZoom.viewBoundsTwips;
        sg.setViewArea(viewBoundsTwips.min, viewBoundsTwips.getSize());

        describe('Tests for' + partTestDesc, function () {
            testsForPart(partTestData, part, testDataForZoom.zoom, sg);
        });
    });
}

function testsForPart(partTestData: PartTestData, part: number, zoom: number, sg: cool.SheetGeometry) {
    it('correctness of getPart()', function () {
        assert.equal(sg.getPart(), part);
    });

    it('correctness of getViewColumnRange()', function () {
        var colrange = sg.getViewColumnRange();
        assert.deepEqual(colrange, partTestData.viewCellArea.columnrange);
    });

    it('correctness of getViewRowRange()', function () {
        var rowrange = sg.getViewRowRange();
        assert.deepEqual(rowrange, partTestData.viewCellArea.rowrange);
    });

    it('correctness of getRowData()', function () {
        var possize = sg.getRowData(partTestData.rowData.rowIndex);
        assert.deepEqual(possize, partTestData.rowData.possize);
    });

    it('correctness of getColumnGroupLevels()', function () {
        var levels = sg.getColumnGroupLevels();
        assert.equal(levels, partTestData.colGroupLevels);
    });

    it('correctness of getRowGroupLevels()', function () {
        var levels = sg.getRowGroupLevels();
        assert.equal(levels, partTestData.rowGroupLevels);
    });

    it('correctness of getColumnGroupsDataInView()', function () {
        var groups = sg.getColumnGroupsDataInView();
        assert.deepEqual(groups, partTestData.colGroupsInView);
    });

    it('correctness of getRowGroupsDataInView()', function () {
        var groups = sg.getRowGroupsDataInView();
        assert.deepEqual(groups, partTestData.rowGroupsInView);
    });

    it('correctness of getTileTwipsAtZoom()', function () {
        var ttwipsAtZoom = sg.getTileTwipsAtZoom(partTestData.tileTwipsAtZoom.inputPoint, partTestData.tileTwipsAtZoom.zoomScale);
        assert.deepEqual(ttwipsAtZoom, partTestData.tileTwipsAtZoom.outputPoint);
    });

    it('correctness of getTileTwipsPointFromPrint()', function () {
        var ttwips = sg.getTileTwipsPointFromPrint(partTestData.printTwipsToTile.inputPoint);
        assert.deepEqual(ttwips, partTestData.printTwipsToTile.outputPoint);
    });

    it('correctness of getPrintTwipsPointFromTile()', function () {
        // Use the data for getTileTwipsPointFromPrint.
        var ptwips = sg.getPrintTwipsPointFromTile(partTestData.printTwipsToTile.outputPoint);
        assert.deepEqual(ptwips, partTestData.printTwipsToTile.inputPoint);
    });

    it('correctness of getTileTwipsSheetAreaFromPrint()', function () {
        var ptwips = sg.getTileTwipsSheetAreaFromPrint(partTestData.printTwipsSheetAreatoTile.inputArea);
        assert.deepEqual(ptwips, partTestData.printTwipsSheetAreatoTile.outputArea);
    });

    it('correctness of getSize()', function () {
        var sheetSizeCorePixels = sg.getSize('corepixels');
        assert.deepEqual(sheetSizeCorePixels, partTestData.sheetSize.corePixels,
            'Incorrect sheet size returned in core-pixels');

        var sheetSizeTileTwips = sg.getSize('tiletwips');
        assert.deepEqual(sheetSizeTileTwips, partTestData.sheetSize.tileTwips,
            'Incorrect sheet size returned in tile-twips');

        var sheetSizePrintTwips = sg.getSize('printtwips');
        assert.deepEqual(sheetSizePrintTwips, partTestData.sheetSize.printTwips,
            'Incorrect sheet size returned in print-twips');
    });

    it('correctness of getCellRect()', function () {
        var cellRectData = partTestData.cellRectData;
        var cellBounds = sg.getCellRect(cellRectData.col, cellRectData.row, cellRectData.zoomScale);
        assert.deepEqual(cellBounds, cellRectData.cpixBoundsAtZoom, 'Incorrect cell bounds at zoom returned');

        var selfZoomScale = zoomToAbsScale(zoom);
        cellBounds = sg.getCellRect(cellRectData.col, cellRectData.row, selfZoomScale);
        assert.deepEqual(cellBounds, cellRectData.cpixBoundsAtSelfZoom, 'Incorrect cell bounds at self zoom returned');
    });

    it('correctness of getCellFromPos()', function () {
        var cellRectData = partTestData.cellRectData;
        var midPoint = cellRectData.cpixBoundsAtSelfZoom.getCenter(true);
        var cell = sg.getCellFromPos(midPoint, 'corepixels');
        assert.deepEqual(cell, new cool.Point(cellRectData.col, cellRectData.row), 'Incorrect cell indices at self zoom returned');
    });

    it('correctness of getSnapDocPosX() and getSnapDocPosY()', function () {
        var cellRectData = partTestData.cellRectData;
        var midPoint = cellRectData.cpixBoundsAtSelfZoom.getCenter(true);

        var cellX = sg.getSnapDocPosX(midPoint.x, 'corepixels');
        assert.deepEqual(cellX, cellRectData.cpixBoundsAtSelfZoom.min.x, 'Incorrect cellX at self zoom returned');

        var cellY = sg.getSnapDocPosY(midPoint.y, 'corepixels');
        assert.deepEqual(cellY, cellRectData.cpixBoundsAtSelfZoom.min.y, 'Incorrect cellY at self zoom returned');
    });
}
