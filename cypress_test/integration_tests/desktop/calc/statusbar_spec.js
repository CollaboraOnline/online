/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe('Statubar tests.', function() {
	var testFileName = 'statusbar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden ();
		}

		cy.wait(1000);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Selected sheet.', function() {
		cy.get('#StatusDocPos')
			.should('have.text', 'Sheet 1 of 2');

		helper.clickOnIdle('.spreadsheet-tab', 'Sheet2');

		cy.get('#StatusDocPos')
			.should('have.text', 'Sheet 2 of 2');

		helper.clickOnIdle('.spreadsheet-tab', 'Sheet1');

		cy.get('#StatusDocPos')
			.should('have.text', 'Sheet 1 of 2');
	});

	it('Multiple cell selection.', function() {
		cy.get('#RowColSelCount')
			.should('have.text', '\u00a0Select multiple cells\u00a0');

		helper.typeIntoInputField('input#addressInput', 'A1:A2');

		cy.get('#RowColSelCount')
			.should('have.text', 'Selected: 2 rows, 1 column');

		helper.typeIntoInputField('input#addressInput', 'A1');

		cy.get('#RowColSelCount')
			.should('have.text', '\u00a0Select multiple cells\u00a0');
	});

	it.skip('Text editing mode.', function() {
		cy.get('#InsertMode')
			.should('have.text', '\u00a0Insert mode: inactive\u00a0');

		calcHelper.dblClickOnFirstCell();

		cy.get('#InsertMode')
			.should('have.text', 'Insert');

		calcHelper.typeIntoFormulabar('{enter}');

		cy.get('#InsertMode')
			.should('have.text', '\u00a0Insert mode: inactive\u00a0');
	});

	it('Selected data summary.', function() {
		cy.get('#StateTableCell')
			.should('have.text', 'Average: ; Sum: 0');

		helper.typeIntoInputField('input#addressInput', 'A1:A2');

		cy.get('#StateTableCell')
			.should('have.text', 'Average: 15.5; Sum: 31');

		helper.typeIntoInputField('input#addressInput', 'A1');

		cy.get('#StateTableCell')
			.should('have.text', 'Average: 10; Sum: 10');
	});

	it('Change zoom level.', function() {
		desktopHelper.resetZoomLevel();

		desktopHelper.shouldHaveZoomLevel('100');

		desktopHelper.zoomIn();

		desktopHelper.shouldHaveZoomLevel('120');

		desktopHelper.zoomOut();

		desktopHelper.shouldHaveZoomLevel('100');
	});

	it('Select zoom level.', function() {
		desktopHelper.resetZoomLevel();

		desktopHelper.shouldHaveZoomLevel('100');

		desktopHelper.selectZoomLevel('280');

		desktopHelper.shouldHaveZoomLevel('280');
	});
});
