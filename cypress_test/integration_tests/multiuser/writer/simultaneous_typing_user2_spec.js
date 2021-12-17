/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Simultaneous typing: user-2.', function() {
	var origTestFileName = 'simultaneous_typing.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
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
	});
});
