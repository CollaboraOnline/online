/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Sheet operations: user-1.', function() {
	var testFileName = 'sheet_operations.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert/delete sheet.', function() {
		// user-2 loads the same document
		cy.get('#toolbar-down .w2ui-scroll-right')
			.click();

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// We have one sheet by default
		cy.get('.spreadsheet-tab')
			.should('have.length', 1);
		cy.get('#spreadsheet-tab0')
			.should('have.text', 'Sheet1');

		// Add one more sheet
		cy.get('#tb_spreadsheet-toolbar_item_insertsheet')
			.click();
		cy.get('.spreadsheet-tab')
			.should('have.length', 2);
		cy.get('#spreadsheet-tab1')
			.should('have.text', 'Sheet2');

		// user-2 remove the first sheet
		cy.get('.spreadsheet-tab')
			.should('have.length', 1);
		cy.get('#spreadsheet-tab0')
			.should('have.text', 'Sheet2');
	});

});
