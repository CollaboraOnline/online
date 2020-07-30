/* global describe it cy beforeEach require afterEach */

var helper = require('../common/helper');

describe('Simultaneous typing: user-2.', function() {
	var testFileName = 'simultaneous_typing.odt';

	beforeEach(function() {
		// Wait here, before loading the document.
		// Opening two clients at the same time causes an issue.
		cy.wait(5000);
		helper.beforeAllDesktop(testFileName);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Simultaneous typing.', function() {
		// user-1 loads the same document

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// Now type some text, while user-1 does the same.
		var text = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
		helper.typeText('textarea.clipboard', text, 100);

		helper.selectAllText();

		cy.get('#copy-paste-container p')
			.should('contain.text', text);

		// user-1 changes the paragraph alignment after finished
		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.should('have.class', 'checked');

		// Change paragraph alignment to trigger user-2 actions
		cy.get('#tb_editbar_item_rightpara .w2ui-button')
			.click();
	});
});
