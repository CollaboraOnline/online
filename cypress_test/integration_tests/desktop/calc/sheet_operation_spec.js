/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Sheet Operations.', function () {
	var origTestFileName = 'sheet_operation.ods';
	var testFileName;

	beforeEach(function () {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertNumberofSheets(n) {
		cy.get('button.spreadsheet-tab').should('have.length', n);
	}

	function clickVexDialogButton(buttonText) {
		cy.get('.vex-content').should('exist');

		cy.contains('.vex-dialog-buttons button', buttonText)
			.click();
	}

	function selectOptionFromContextMenu(contextMenu) {
		cy.wait(1000);

		cy.get('.spreadsheet-tab.spreadsheet-tab-selected')
			.rightclick();

		cy.contains('.context-menu-link', contextMenu)
			.click();
	}

	it('Insert sheet', function () {
		assertNumberofSheets(1);

		cy.get('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);
	});

	it('Switching sheet sets the view that contains cell-cursor', function () {
		assertNumberofSheets(1);

		helper.typeIntoInputField('input#addressInput', 'A1');

		calcHelper.ensureViewContainsCellCursor();

		cy.get('#tb_spreadsheet-toolbar_item_insertsheet').click();
		assertNumberofSheets(2);

		cy.get('#spreadsheet-tab1').click();

		calcHelper.ensureViewContainsCellCursor();

		helper.typeIntoInputField('input#addressInput', 'A200');

		calcHelper.ensureViewContainsCellCursor();

		helper.waitUntilIdle('#spreadsheet-tab0');

		cy.get('#spreadsheet-tab0').click();

		calcHelper.ensureViewContainsCellCursor();
	});

	it('Insert sheet before', function () {
		assertNumberofSheets(1);

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet1');

		selectOptionFromContextMenu('Insert sheet before this');

		assertNumberofSheets(2);

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet2');

		cy.get('#spreadsheet-tab1').should('have.text', 'Sheet1');
	});

	it('Insert sheet after', function () {
		assertNumberofSheets(1);

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet1');

		selectOptionFromContextMenu('Insert sheet after this');

		assertNumberofSheets(2);

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet1');

		cy.get('#spreadsheet-tab1').should('have.text', 'Sheet2');
	});

	it('Delete sheet', function () {
		assertNumberofSheets(1);

		cy.get('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		selectOptionFromContextMenu('Delete Sheet...');

		cy.get('#delete-sheet-modal-response').click();

		assertNumberofSheets(1);
	});

	it('Rename sheet', function () {
		assertNumberofSheets(1);

		cy.get('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'Sheet1');

		selectOptionFromContextMenu('Rename Sheet...');

		cy.get('#modal-dialog-rename-calc-sheet').should('exist');

		cy.get('#input-modal-input').clear().type('renameSheet');

		cy.get('#response-ok').click();

		cy.get('.spreadsheet-tab.spreadsheet-tab-selected').should('have.text', 'renameSheet');
	});

	it('Hide/Show sheet', function () {
		assertNumberofSheets(1);

		cy.get('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		//hide sheet
		selectOptionFromContextMenu('Hide Sheet');

		assertNumberofSheets(1);

		//show sheet
		selectOptionFromContextMenu('Show Sheet');

		cy.get('.vex-content').should('exist');

		cy.get('#hidden-part-checkbox-1').check();

		clickVexDialogButton('Show Selected Sheets');

		assertNumberofSheets(2);
	});

	it('Move sheet left/right', function () {
		assertNumberofSheets(1);

		cy.get('#tb_spreadsheet-toolbar_item_insertsheet').click();

		assertNumberofSheets(2);

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet1');

		//left
		selectOptionFromContextMenu('Move Sheet Left');

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet2');

		//right
		selectOptionFromContextMenu('Move Sheet Right');

		cy.get('#spreadsheet-tab0').should('have.text', 'Sheet1');
	});
});
