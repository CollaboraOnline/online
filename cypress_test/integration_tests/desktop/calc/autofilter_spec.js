/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'AutoFilter', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/autofilter.ods');
		desktopHelper.switchUIToCompact();
		toggleAutofilter();
		helper.setDummyClipboardForCopy();
		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail'], true);
	});

	function toggleAutofilter() {
		//enable/disable autofilter
		cy.cGet('#menu-data').click();
		cy.cGet('body').contains('#menu-data li', 'AutoFilter').click();
	}

	it.skip('Enable/Disable autofilter', function() {
		//filter by pass
		calcHelper.openAutoFilterMenu(true);
		cy.cGet('.autofilter .vertical').should('be.visible');
		cy.cGet('.autofilter .ui-treeview-checkbox').eq(0).uncheck();
		cy.cGet('.autofilter .ui-treeview-checkbox').eq(1).uncheck();
		cy.cGet('.autofilter .ui-button-box-right #ok').click();
		// Wait for autofilter dialog to close
		cy.cGet('div.autofilter').should('not.exist');

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 3', 'Pass']);

		// Disable autofilter
		// First toggle fails when whole sheet is selected, as it is after assertSheetContents
		toggleAutofilter();
		toggleAutofilter();

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail']);
	});

	it('Sort by ascending/descending', function() {
		calcHelper.openAutoFilterMenu();

		//sort by descending order
		cy.cGet('body').contains('.autofilter', 'Sort Descending').click();
		// Wait for autofilter dialog to close
		cy.cGet('div.autofilter').should('not.exist');

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 5', 'Fail', 'Test 4', '', 'Test 3', 'Pass', 'Test 2', 'Fail', 'Test 1', 'Pass'], true);

		//sort by ascending order
		calcHelper.openAutoFilterMenu();
		cy.cGet('body').contains('.autofilter', 'Sort Ascending').click();
		// Wait for autofilter dialog to close
		cy.cGet('div.autofilter').should('not.exist');

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail'], true);
	});

	it('Filter empty/non-empty cells', function() {
		//empty
		calcHelper.openAutoFilterMenu(true);
		cy.cGet('#check_list_box > tbody > ul > li:nth-child(1) > span > input').click();
		cy.cGet('#ok').click();
		// Wait for autofilter dialog to close
		cy.cGet('div.autofilter').should('not.exist');

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 5', 'Fail'], true);
	});

	it('Close autofilter popup by click outside', function() {
		// Test sometimes fails without this wait, no idea why.
		cy.wait(1000);

		calcHelper.openAutoFilterMenu();

		cy.cGet('.autofilter .vertical').should('be.visible');
		cy.cGet('div.jsdialog-overlay').should('be.visible');
		cy.cGet('div.jsdialog-overlay').click();

		// Wait for autofilter dialog to close
		cy.cGet('div.autofilter').should('not.exist');
		cy.wait(500);

		calcHelper.dblClickOnFirstCell();
		helper.typeIntoDocument('New content{enter}');

		calcHelper.assertSheetContents(['CNew contentypress Test', 'Status', 'Test 1', 'Pass', 'Test 2', 'Fail', 'Test 3', 'Pass', 'Test 4', '', 'Test 5', 'Fail'], true);
	});

	// check if filter by color applied or not
	it('Filter by color', function() {
		// apply background color to some cells
		calcHelper.selectCellsInRange('A2:A2');
		cy.cGet('#backgroundcolor .arrowbackground').click();
		desktopHelper.selectColorFromPalette('8E7CC3');

		calcHelper.openAutoFilterMenu();
		
		//Click on `Filter by Color`
		cy.cGet('body').contains('.autofilter', 'Filter by Color').click();

		// Find the table element with ID "background"
		cy.cGet('table#background')
		.find('input') // Find all input elements inside the table
		.each(($input) => { // Iterate through each input element
			// Assert that each input is of type radio
			cy.wrap($input).should('have.attr', 'type', 'radio');
		});

		// Find the table element with ID "background"
		cy.cGet('table#background')
		.find('img') // Find all input elements inside the table
		.first() // Select the first input element
		.click(); // Click on the first input element

		calcHelper.assertSheetContents(['Cypress Test', 'Status', 'Test 1', 'Pass'], true);
	});
});
