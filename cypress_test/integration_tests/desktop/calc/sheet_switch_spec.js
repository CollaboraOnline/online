/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sheet switching tests', function() {
	var testFileName = 'switch.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	/* switch.ods has 2 sheets, 1st with data in G45, 2nd with data in F720*/

	it('Check view position on sheet switch', function() {
		// go to sheet 1
		cy.cGet('#spreadsheet-tab0').click();

		desktopHelper.assertScrollbarPosition('vertical', 35, 45);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'G45');

		// go to sheet 2
		cy.cGet('#spreadsheet-tab1').click();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');
		desktopHelper.assertScrollbarPosition('vertical', 320, 330);

		cy.cGet('input#addressInput').type('{selectAll}A2{enter}');
		desktopHelper.assertScrollbarPosition('vertical', 15, 25);
	});

	it('Check view position on repeated selection of currently selected sheet', function() {
		// initially we are on sheet 2 tab
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');
		desktopHelper.assertScrollbarPosition('vertical', 320, 330);

		// click on sheet 2 tab (yes, current one)
		cy.cGet('#spreadsheet-tab1').click();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');
		desktopHelper.assertScrollbarPosition('vertical', 320, 330);

		// go to different place in the spreadsheet
		cy.cGet('input#addressInput').type('{selectAll}A2{enter}');
		desktopHelper.assertScrollbarPosition('vertical', 15, 25);

		// validate we didn't jump back after some time
		cy.wait(1000);
		desktopHelper.assertScrollbarPosition('vertical', 15, 25);
	});

	// TODO: remove if multiple sheet selection feature will be implemented
	it('Check if multiple sheet selection is disabled', function() {
		// go to sheet 1
		cy.cGet('#spreadsheet-tab0').click();

		desktopHelper.assertScrollbarPosition('vertical', 35, 45);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'G45');
		cy.cGet('#spreadsheet-tab0').should('have.class', 'spreadsheet-tab-selected');
		cy.cGet('#spreadsheet-tab1').should('not.have.class', 'spreadsheet-tab-selected');

		// try to add sheet 2 to sheets selection
		helper.typeIntoDocument('{ctrl}{shift}{pageDown}');

		// we expect no effect
		desktopHelper.assertScrollbarPosition('vertical', 35, 45);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'G45');
		cy.cGet('#spreadsheet-tab0').should('have.class', 'spreadsheet-tab-selected');
		cy.cGet('#spreadsheet-tab1').should('not.have.class', 'spreadsheet-tab-selected');
	});

	// TODO: enable if multiple sheet selection feature will be implemented
	//       this tests serious regression we had, so be sure it works properly
	it.skip('Check view position when having multiple sheet selection', function() {
		// go to sheet 1
		cy.cGet('#spreadsheet-tab0').click();

		desktopHelper.assertScrollbarPosition('vertical', 35, 45);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'G45');
		cy.cGet('#spreadsheet-tab0').should('have.class', 'spreadsheet-tab-selected');
		cy.cGet('#spreadsheet-tab1').should('not.have.class', 'spreadsheet-tab-selected');

		// add sheet 2 to sheets selection
		helper.typeIntoDocument('{ctrl}{shift}{pageDown}');

		desktopHelper.assertScrollbarPosition('vertical', 320, 330);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');
		cy.cGet('#spreadsheet-tab0').should('have.class', 'spreadsheet-tab-selected');
		cy.cGet('#spreadsheet-tab1').should('have.class', 'spreadsheet-tab-selected');

		// try to go to sheet 1 using keyboard shortcut - it is not allowed in the core
		helper.typeIntoDocument('{ctrl}{alt}{pageUp}');

		// we still have selected two sheets so we see cell data from sheet 2
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');

		// go to sheet 2 using tab
		cy.cGet('#spreadsheet-tab1').click();
		cy.cGet('input#addressInput').should('have.prop', 'value', 'F720');

		// go to different place in the spreadsheet
		cy.cGet('input#addressInput').type('{selectAll}A2{enter}');
		helper.typeIntoDocument('some text');

		// validate we didn't jump back after some time
		cy.wait(1000);
		desktopHelper.assertScrollbarPosition('vertical', 15, 25);
	});
});
