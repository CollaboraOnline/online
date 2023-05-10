/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Sheet Operations.', function () {
	var origTestFileName = 'sheet_operation.ods';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertNumberofSheets(n) {
		cy.cGet('button.spreadsheet-tab').should('have.length', n);
	}

	function selectOptionFromContextMenu(contextMenu) {
		cy.wait(1000);
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').rightclick();
		cy.cGet('body').contains('.context-menu-link', contextMenu).click();
	}

	it('Insert sheet', function () {
		assertNumberofSheets(1);
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);
	});

	it('Switching sheet sets the view that contains cell-cursor', function () {
		assertNumberofSheets(1);
		helper.typeIntoInputField('input#addressInput', 'A1');
		calcHelper.ensureViewContainsCellCursor();
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);
		helper.clickOnIdle('#spreadsheet-tab1');
		calcHelper.ensureViewContainsCellCursor();
		helper.typeIntoInputField('input#addressInput', 'A200');
		calcHelper.ensureViewContainsCellCursor();
		helper.clickOnIdle('#spreadsheet-tab0');
		calcHelper.ensureViewContainsCellCursor();
	});

	it('Insert sheet before', function () {
		assertNumberofSheets(1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		selectOptionFromContextMenu('Insert sheet before this');
		assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet1');
	});

	it('Insert sheet after', function () {
		assertNumberofSheets(1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		selectOptionFromContextMenu('Insert sheet after this');
		assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet2');
	});

	it('Delete sheet', function () {
		assertNumberofSheets(1);
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);
		selectOptionFromContextMenu('Delete Sheet...');
		cy.cGet('#delete-sheet-modal-response').click();
		assertNumberofSheets(1);
	});

	it('Rename sheet', function () {
		assertNumberofSheets(1);
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'Sheet1');
		selectOptionFromContextMenu('Rename Sheet...');
		cy.cGet('#modal-dialog-rename-calc-sheet').should('exist');
		cy.cGet('#input-modal-input').clear().type('renameSheet');
		cy.cGet('#response-ok').click();
		cy.cGet('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'renameSheet');
	});

	it('Hide/Show sheet', function () {
		assertNumberofSheets(1);
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);
		//hide sheet
		selectOptionFromContextMenu('Hide Sheet');
		assertNumberofSheets(1);
		//show sheet
		selectOptionFromContextMenu('Show Sheet');
		cy.cGet('#show-sheets-modal').should('exist');
		cy.cGet('#hidden-part-checkbox-1').check();
		cy.cGet('#show-sheets-modal-response').click();
		assertNumberofSheets(2);
	});

	it('Move sheet left/right', function () {
		assertNumberofSheets(1);
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
		//left
		selectOptionFromContextMenu('Move Sheet Left');
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');
		//right
		selectOptionFromContextMenu('Move Sheet Right');
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');
	});
});
