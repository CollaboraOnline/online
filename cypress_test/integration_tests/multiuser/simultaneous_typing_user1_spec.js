/* global describe it cy beforeEach require afterEach */

var helper = require('../common/helper');

describe('Simultaneous typing: user-1.', function() {
	var testFileName = 'simultaneous_typing.odt';

	beforeEach(function() {
		helper.beforeAllDesktop(testFileName);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Simultaneous typing.', function() {
		// user-2 loads the same document

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// We have a table in the document, move the cursor into the second row.
		cy.get('textarea.clipboard')
			.type('{downarrow}');
		// And now type some text, while user-2 does the same.
		var text = 'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
		helper.typeText('textarea.clipboard', text, 100);

		helper.selectAllText();

		cy.get('#copy-paste-container p')
			.should('have.text', text);

		// Change paragraph alignment to trigger user-2 actions
		cy.get('textarea.clipboard')
			.type('{uparrow}');

		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.click();

		// user-2 changes the paragraph alignment after finished
		cy.get('#tb_editbar_item_rightpara .w2ui-button')
			.should('have.class', 'checked');
	});

});
