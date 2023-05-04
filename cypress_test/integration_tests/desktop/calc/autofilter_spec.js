/* global describe it cy expect beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'AutoFilter', function() {
	var origTestFileName = 'autofilter.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		toggleAutofilter();
		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function toggleAutofilter() {
		//enable/disable autofilter
		helper.clickOnIdle('#menu-data');
		cy.cGet('body').contains('#menu-data li', 'AutoFilter').click();
	}

	//If we select entire sheet , there is no data about table in copy-paste-container when autofilter
	//is enabled
	function assertDataOnFilter(arr1) {
		cy.wait(500);

		calcHelper.clickOnFirstCell();

		for (let i=0; i < arr1.length; i+=2) {
			helper.typeIntoDocument('{shift}{rightarrow}');

			helper.waitUntilIdle('#copy-paste-container tbody');

			var tableData = [];

			cy.cGet('#copy-paste-container tbody').find('td').each(($el) => {
				cy.wrap($el)
					.invoke('text')
					.then(text => {
						tableData.push(text);
					});
			}).then(() => {
				expect(tableData).to.deep.eq([arr1[i], arr1[i+1]]);
				tableData = [];
			});

			helper.typeIntoDocument('{downarrow}');
		}
		calcHelper.clickOnFirstCell();
	}

	function openAutoFilterMenu(secondColumn) {
		let x = 95;
		if (secondColumn) {
			x += 105;
		}
		cy.cGet('#map')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				var XPos = items[0].getBoundingClientRect().left + x;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.cGet('body').click(XPos, YPos);
			});
	}

	it('Enable/Disable autofilter', function() {
		//it gets enable before the test body starts
		//filter by pass
		openAutoFilterMenu(true);

		cy.cGet('.autofilter .vertical').should('be.visible');
		cy.cGet('.autofilter .ui-treeview-checkbox').eq(0).uncheck();
		cy.cGet('.autofilter .ui-treeview-checkbox').eq(1).uncheck();
		cy.cGet('.autofilter .ui-button-box-right #ok').click();

		assertDataOnFilter(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 3', 'Pass']);

		//disable autofilter
		//all the data should be unfiltered
		toggleAutofilter();

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});

	it('Sort by ascending/descending', function() {
		openAutoFilterMenu();

		//sort by descending order
		cy.cGet('body').contains('.autofilter', 'Sort Descending').click();

		helper.waitUntilIdle('#copy-paste-container tbody');

		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 5', 'Fail', 'Test 4', '', 'Test 3', 'Pass', 'Test 2', 'Fail', 'Test 1', 'Pass']);

		//sort by ascending order
		openAutoFilterMenu();

		cy.cGet('body').contains('.autofilter', 'Sort Ascending').click();

		// Without this the copy-paste-container doesn't seem to get updated although the table
		// has correct values.
		calcHelper.selectEntireSheet();

		helper.waitUntilIdle('#copy-paste-container tbody');

		calcHelper.assertDataClipboardTable(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});

	it('Filter empty/non-empty cells', function() {
		//empty
		openAutoFilterMenu(true);

		cy.cGet('#check_list_box > tbody > ul > li:nth-child(1) > span > input').click();

		cy.cGet('#ok').click();

		assertDataOnFilter(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 5', 'Fail']);
	});
});
