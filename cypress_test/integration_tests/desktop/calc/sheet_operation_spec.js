/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sheet Operations.', function () {

	beforeEach(function () {
		helper.setupAndLoadDocument('calc/sheet_operation.ods');
	});

	it('Insert sheet', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
	});

	it.skip('Switching sheet sets the view that contains cell-cursor', function () {
		calcHelper.assertNumberofSheets(1);
		helper.typeIntoInputField('input#addressInput-input', 'A1');
		calcHelper.ensureViewContainsCellCursor();
		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab1').click();
		calcHelper.ensureViewContainsCellCursor();
		helper.typeIntoInputField('input#addressInput-input', 'A200');
		calcHelper.ensureViewContainsCellCursor();
		cy.cGet('#spreadsheet-tab0').click();
		calcHelper.ensureViewContainsCellCursor();
	});

	it('Insert sheet before', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		calcHelper.selectOptionFromContextMenu('Insert sheet before this');
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet1');
	});

	it('Insert sheet after', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		calcHelper.selectOptionFromContextMenu('Insert sheet after this');
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet2');
	});

	it('Delete sheet', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		calcHelper.selectOptionFromContextMenu('Delete Sheet...');
		cy.cGet('#delete-sheet-modal-response').click();
		calcHelper.assertNumberofSheets(1);
	});

	it('Rename sheet', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'Sheet1');
		calcHelper.selectOptionFromContextMenu('Rename Sheet...');
		cy.cGet('#modal-dialog-rename-calc-sheet').should('exist');
		cy.cGet('#input-modal-input').clear().type('renameSheet');
		cy.cGet('#response-ok').click();
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'renameSheet');
	});

	it('Hide/Show sheet', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		//hide sheet
		calcHelper.selectOptionFromContextMenu('Hide Sheet');
		calcHelper.assertNumberofSheets(1);
		//show sheet
		calcHelper.selectOptionFromContextMenu('Show Sheet');
		cy.cGet('#show-sheets-modal').should('exist');
		cy.cGet('#hidden-part-checkbox-1').check();
		cy.cGet('#show-sheets-modal-response').click();
		calcHelper.assertNumberofSheets(2);
	});

	it('Move sheet left/right', function () {
		calcHelper.assertNumberofSheets(1);
		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		//left
		calcHelper.selectOptionFromContextMenu('Move Sheet Left');
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');
		//right
		calcHelper.selectOptionFromContextMenu('Move Sheet Right');
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
	});
});
