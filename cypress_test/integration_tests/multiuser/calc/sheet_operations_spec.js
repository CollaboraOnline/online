/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Multiuser sheet operations', function() {
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
		cy.customGet('.spreadsheet-tab', frameId1)
			.should('have.length', 1);
		cy.customGet('#spreadsheet-tab0', frameId1)
			.should('have.text', 'Sheet1');

		//assert for user-1/2
		cy.customGet('.spreadsheet-tab', frameId2)
			.should('have.length', 1);
		cy.customGet('#spreadsheet-tab0', frameId2)
			.should('have.text', 'Sheet1');

		// Add one more sheet
		cy.customGet('#tb_spreadsheet-toolbar_item_insertsheet', frameId1)
			.click();

		//assert for user-1/2
		cy.customGet('.spreadsheet-tab', frameId1)
			.should('have.length', 2);

		cy.customGet('#spreadsheet-tab1', frameId1)
			.should('have.text', 'Sheet2');

		//assert for user-1/2
		cy.customGet('.spreadsheet-tab', frameId2)
			.should('have.length', 2);

		cy.customGet('#spreadsheet-tab1', frameId2)
			.should('have.text', 'Sheet2');

		cy.wait(2000);

		//user-1/2 removes it
		cy.customGet('#spreadsheet-tab0', frameId2)
			.rightclick();

		cy.iframe(frameId2).contains('.context-menu-link', 'Delete Sheet...')
			.click();

		cy.customGet('#delete-sheet-modal-response', frameId2)
			.click();

		//assert for user-1/2
		cy.customGet('.spreadsheet-tab', frameId2)
			.should('have.length', 1);

		cy.customGet('#spreadsheet-tab0', frameId2)
			.should('have.text', 'Sheet2');

		//assert for user-1/2
		cy.customGet('.spreadsheet-tab', frameId1)
			.should('have.length', 1);

		cy.customGet('#spreadsheet-tab0', frameId1)
			.should('have.text', 'Sheet2');
	}
	it('user-1 insert and user-2 delete sheet.', function() {
		testInsertDelete('#iframe1', '#iframe2');
	});

	it('user-2 insert and user-1 delete sheet', function() {
		testInsertDelete('#iframe2', '#iframe1');
	});

});
