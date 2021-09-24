/// <reference path="./data/SheetGeometryTestData.ts" />

var assert = require('assert').strict;

describe('SheetGeometry tests', function () {

    testData.forEach(function(testDataForZoom) {

        describe('Document zoom level = ' + testDataForZoom.zoom, function () {
            testsForDocZoom(testDataForZoom);
        });
    });

});

function zoomToAbsScale(level: number): number {
    return Math.pow(1.2, level - 10);
}

function testsForDocZoom(testDataForZoom: TestDataForZoom) {
    var tileSizePx = 256;
    var tileWidthTwips = Math.round(tileSizePx * 15 / zoomToAbsScale(testDataForZoom.zoom));
    var tileHeightTwips = tileWidthTwips;

    testDataForZoom.partsTestData.forEach(function(partTestData) {
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
