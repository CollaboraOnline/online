/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

var origTestFileName = 'overlays.ods';
var testFileName;

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Overlay bounds.', function () {

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Cell cursor overlay bounds', function () {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		var cellA1Bounds = new helper.Bounds();
		helper.getOverlayItemBounds('#test-div-overlay-cell-cursor-border-0', cellA1Bounds);

		helper.typeIntoInputField('input#addressInput', 'C3');

		var cellC3Bounds = new helper.Bounds();
		helper.overlayItemHasDifferentBoundsThan('#test-div-overlay-cell-cursor-border-0', cellA1Bounds);
		helper.getOverlayItemBounds('#test-div-overlay-cell-cursor-border-0', cellC3Bounds);

		helper.typeIntoInputField('input#addressInput', 'B2');

		cy.wrap(true).then(function () {
			cy.log('cellA1Bounds = ' + cellA1Bounds + ', cellC3Bounds = ' + cellC3Bounds);

			// Compute the expected bounds of cell-cursor at B2 from that at A1 and C3.
			var cellB2Bounds = new helper.Bounds(
				cellA1Bounds.top + cellA1Bounds.height,
				cellA1Bounds.left + cellA1Bounds.width);

			cellB2Bounds.width = cellC3Bounds.left - cellB2Bounds.left;
			cellB2Bounds.height = cellC3Bounds.top - cellB2Bounds.top;

			helper.overlayItemHasBounds('#test-div-overlay-cell-cursor-border-0', cellB2Bounds);
		});
	});

	it('Cell range selection overlay bounds', function () {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		var cellA1Bounds = new helper.Bounds();
		helper.getOverlayItemBounds('#test-div-overlay-cell-cursor-border-0', cellA1Bounds);

		helper.typeIntoInputField('input#addressInput', 'D4');

		var cellD4Bounds = new helper.Bounds();
		helper.overlayItemHasDifferentBoundsThan('#test-div-overlay-cell-cursor-border-0', cellA1Bounds);
		helper.getOverlayItemBounds('#test-div-overlay-cell-cursor-border-0', cellD4Bounds);

		helper.typeIntoInputField('input#addressInput', 'A1:D4');

		cy.wrap(true).then(function () {
			cy.log('cellA1Bounds = ' + cellA1Bounds + ', cellD4Bounds = ' + cellD4Bounds);

			// Compute the expected bounds of the selection A1:D4 using the bounds of A1 and D4 cell cursors.
			var rangeA1D4Bounds = new helper.Bounds(
				cellA1Bounds.top,
				cellA1Bounds.left);

			rangeA1D4Bounds.width = cellD4Bounds.left + cellD4Bounds.width - cellA1Bounds.left;
			rangeA1D4Bounds.height = cellD4Bounds.top + cellD4Bounds.height - cellA1Bounds.top;

			helper.overlayItemHasBounds('#test-div-overlay-selections-border-0', rangeA1D4Bounds);
		});
	});
});
