/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Statubar tests.', function() {
	var origTestFileName = 'statusbar.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showStatusBarIfHidden();
		}
	});

	it('Selected sheet.', function() {
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 1 of 2');
		cy.cGet('#spreadsheet-tab1').click();
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 2 of 2');
		cy.cGet('#spreadsheet-tab0').click();
		cy.cGet('#StatusDocPos').should('have.text', 'Sheet 1 of 2');
	});

	it('Multiple cell selection.', function() {
		cy.cGet('#RowColSelCount').should('have.text', 'Select multiple cells');
		helper.typeIntoInputField('input#addressInput', 'A1:A2');
		cy.cGet('#RowColSelCount').should('have.text', 'Selected: 2 rows, 1 column');
		helper.typeIntoInputField('input#addressInput', 'A1');
		cy.cGet('#RowColSelCount').should('have.text', 'Select multiple cells');
	});

	it('Text editing mode.', function() {
		cy.cGet('#InsertMode').should('have.text', 'Insert mode: inactive');
		calcHelper.dblClickOnFirstCell();
		cy.cGet('#InsertMode').should('have.text', 'Insert');
		calcHelper.typeIntoFormulabar('{enter}');
		cy.cGet('#InsertMode').should('have.text', 'Insert mode: inactive');
	});

	it('Selected data summary.', function() {
		cy.cGet('#StateTableCell').should('have.text', 'Average: ; Sum: 0');
		helper.typeIntoInputField('input#addressInput', 'A1:A2');
		cy.cGet('#StateTableCell').should('have.text', 'Average: 15.5; Sum: 31');
		helper.typeIntoInputField('input#addressInput', 'A1');
		cy.cGet('#StateTableCell').should('have.text', 'Average: 10; Sum: 10');
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
