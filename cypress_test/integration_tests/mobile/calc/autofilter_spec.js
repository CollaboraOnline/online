/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe.skip(['tagmobile', 'tagnextcloud', 'tagproxy'], 'AutoFilter', function() {
	var origTestFileName = 'autofilter.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Sort by ascending/descending', function() {
		calcHelper.openAutoFilterMenu();

		//sort by descending order
		cy.cGet('body').contains('.mobile-wizard', 'Sort Descending').click();

		helper.waitUntilIdle('#copy-paste-container tbody');

		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 5', 'Fail', 'Test 4', '', 'Test 3', 'Pass', 'Test 2', 'Fail', 'Test 1', 'Pass']);

		//sort by ascending order
		calcHelper.openAutoFilterMenu();

		cy.cGet('body').contains('.mobile-wizard', 'Sort Ascending').click();

		// Without this the copy-paste-container doesn't seem to get updated although the table
		// has correct values.
		calcHelper.selectEntireSheet();

		helper.waitUntilIdle('#copy-paste-container tbody');

		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});
});
