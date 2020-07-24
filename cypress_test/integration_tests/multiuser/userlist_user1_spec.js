/* global describe it cy beforeEach require afterEach */

var helper = require('../common/helper');

describe('Check user list with user-1.', function() {
	var testFileName = 'userlist.odt';

	beforeEach(function() {
		helper.beforeAllDesktop(testFileName);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Userlist visibility.', function() {
		// user-2 loads the same document

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// Change the paragraph alignment
		cy.get('#tb_editbar_item_leftpara .w2ui-button')
			.should('have.class', 'checked');

		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.click();

		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.should('have.class', 'checked');
	});

});
