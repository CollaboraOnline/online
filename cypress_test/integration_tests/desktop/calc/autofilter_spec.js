/* global describe it Cypress cy expect beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mode = Cypress.env('USER_INTERFACE');

describe('AutoFilter', function() {
	var testFileName = 'autofilter.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		toggleAutofilter();

		assertData(['Cypress Test', 'Test 1', 'Test 2', 'Test 3', 'Test 4', 'Test 5'],
			['Status', 'Pass', 'Fail', 'Pass', '', 'Fail']);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function toggleAutofilter() {
		//enable/disable autofilter
		if (mode === 'notebookbar') {
			helper.waitUntilIdle('#toolbar-up');

			cy.get('#toolbar-up .w2ui-scroll-right').then($button => {

				while ($button.is(':visible')) {
					$button.click();
				}
			});

			cy.get('#table-Home-Section-Find #DataFilterAutoFilter')
				.click();
		} else {
			helper.clickOnIdle('#menu-data');

			cy.contains('#menu-data li', 'AutoFilter')
				.click();
		}
	}
	function assertData(arr1, arr2) {
		calcHelper.selectEntireSheet();

		helper.waitUntilIdle('#copy-paste-container');

		cy.get('#copy-paste-container tbody')
			.within(() => {
				for (let i=0;i < arr1.length; i++) {
					cy.get('tr').eq(i).within(() => {
						cy.get('td').eq(0).should('have.text', arr1[i]);
						cy.get('td').eq(1).should('have.text', arr2[i]);
					});
				}
			});

		calcHelper.clickOnFirstCell();
	}

	//If we select entire sheet , there is no data about table in copy-paste-container when autofilter
	//is enabled
	function assertDataOnFilter(arr1, arr2) {
		calcHelper.clickOnFirstCell();

		for (let i=0; i < arr1.length; i++) {
			helper.typeIntoDocument('{shift}{rightarrow}');

			cy.wait(500);

			cy.get('#copy-paste-container tbody')
				.within(() => {
					cy.get('tr').eq(0).within(() => {
						cy.get('td').eq(0).should('have.text', arr1[i]);
						cy.get('td').eq(1).should('have.text', arr2[i]);
					});
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
		cy.get('#map')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				var XPos = items[0].getBoundingClientRect().left + x;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.get('body')
					.click(XPos, YPos);
			});
	}

	it('Enable/Disable autofilter', function() {
		//it gets enable before the test body starts
		//filter by pass
		openAutoFilterMenu(true);

		cy.get('.autofilter-container').should('be.visible');

		cy.get('.autofilter.ui-treeview-checkbox').eq(0)
			.uncheck();

		cy.get('.autofilter.ui-treeview-checkbox').eq(1)
			.uncheck();

		cy.get('.autofilter.ui-button-box-right #ok')
			.click();

		assertDataOnFilter(['Cypress Test', 'Test 1', 'Test 3'],
			['Status', 'Pass', 'Pass']);

		//disable autofilter
		//all the data should be unfiltered
		toggleAutofilter();

		assertData(['Cypress Test', 'Test 1', 'Test 2', 'Test 3', 'Test 4', 'Test 5'],
			['Status', 'Pass', 'Fail', 'Pass', '', 'Fail']);
	});

	it('Sort by ascending/descending', function() {
		openAutoFilterMenu();

		//sort by descending order
		cy.contains('.autofilter', 'Sort Descending')
			.click();

		var col1 = ['Cypress Test','Test 5', 'Test 4', 'Test 3', 'Test 2', 'Test 1'];
		var col2 = ['Status', 'Fail', '', 'Pass', 'Fail', 'Pass'];
		assertData(col1, col2);

		//sort by ascending order
		openAutoFilterMenu();

		cy.contains('.autofilter', 'Sort Ascending')
			.click();

		col1 = ['Cypress Test', 'Test 1', 'Test 2', 'Test 3', 'Test 4', 'Test 5'];
		col2 = ['Status', 'Pass', 'Fail', 'Pass', '', 'Fail'];

		assertData(col1, col2);
	});

	it('Filter empty/non-empty cells', function() {
		//empty
		openAutoFilterMenu(true);

		cy.contains('.autofilter', 'Empty')
			.click();

		assertDataOnFilter(['Cypress Test', 'Test 4'], ['Status', '']);

		//non-empty
		openAutoFilterMenu(true);

		cy.contains('.autofilter', 'Not Empty')
			.click();

		assertDataOnFilter(['Cypress Test', 'Test 1', 'Test 2', 'Test 3', 'Test 5'], ['Status', 'Pass', 'Fail', 'Pass', 'Fail']);
	});
});
