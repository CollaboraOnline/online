/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe.skip(['tagmultiuser'], 'Multiuser sheet operations', function() {
	var origTestFileName = 'sheet_operations.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function testInsertDelete(frameId1, frameId2) {
		// We have one sheet by default
		//assert for user-1/2
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.spreadsheet-tab').should('have.length', 1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		//assert for user-1/2
		cy.cSetActiveFrame(frameId2);
		cy.cGet('.spreadsheet-tab').should('have.length', 1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet1');

		// Add one more sheet
		cy.cSetActiveFrame(frameId1);
		cy.cGet('#tb_spreadsheet-toolbar_item_insertsheet').click();

		//assert for user-1/2
		cy.cGet('.spreadsheet-tab').should('have.length', 2);
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet2');

		//assert for user-1/2
		cy.cSetActiveFrame(frameId2);
		cy.cGet('.spreadsheet-tab').should('have.length', 2);
		cy.cGet('#spreadsheet-tab1').should('have.text', 'Sheet2');
		cy.wait(2000);

		//user-1/2 removes it
		cy.cGet('#spreadsheet-tab0').rightclick();
		cy.cGet('body').contains('.context-menu-link', 'Delete Sheet...').click();
		cy.cGet('#delete-sheet-modal-response').click();

		//assert for user-1/2
		cy.cGet('.spreadsheet-tab').should('have.length', 1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');

		//assert for user-1/2
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.spreadsheet-tab').should('have.length', 1);
		cy.cGet('#spreadsheet-tab0').should('have.text', 'Sheet2');
	}
	it('user-1 insert and user-2 delete sheet.', function() {
		testInsertDelete('#iframe1', '#iframe2');
	});

	it('user-2 insert and user-1 delete sheet', function() {
		testInsertDelete('#iframe2', '#iframe1');
	});

});
