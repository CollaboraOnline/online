/* global describe it cy beforeEach require afterEach */

var helper = require('../common/helper');

describe('Change paragraph properties: user-2.', function() {
	var testFileName = 'paragraph_prop.odt';

	beforeEach(function() {
		// Wait here, before loading the document.
		// Opening two clients at the same time causes an issue.
		cy.wait(5000);
		helper.beforeAllDesktop(testFileName);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Change paragraph alignment.', function() {
		// user-1 loads the same document

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// user-1 changes the paragraph alignment
		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.should('have.class', 'checked');

		cy.get('#tb_editbar_item_rightpara .w2ui-button')
			.click();
	});
});
