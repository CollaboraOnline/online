/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Sheet operations: user-2.', function() {
	var testFileName = 'sheet_operations.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc', true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert/delete sheet.', function() {
		// user-1 loads the same document
		cy.get('#toolbar-down .w2ui-scroll-right')
			.click();

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// user-1 inserts a new sheet
		cy.get('.spreadsheet-tab')
			.should('have.length', 2);
		cy.get('#spreadsheet-tab0')
			.should('have.text', 'Sheet1');
		cy.get('#spreadsheet-tab1')
			.should('have.text', 'Sheet2');

		// remove the first tab
		cy.get('#spreadsheet-tab0')
			.rightclick();

		cy.contains('.context-menu-link', 'Delete Sheet...')
			.click();

		cy.get('.vex-dialog-form .vex-dialog-button-primary')
			.click();

		cy.get('.spreadsheet-tab')
			.should('have.length', 1);
		cy.get('#spreadsheet-tab0')
			.should('have.text', 'Sheet2');
	});
});
