/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Simultaneous typing: user-1.', function() {
	var testFileName = 'simultaneous_typing.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
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
		helper.moveCursor('down');

		// And now type some text, while user-2 does the same.
		var text = 'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
		helper.typeText('textarea.clipboard', text, 100);

		helper.selectAllText();

		cy.get('#copy-paste-container p')
			.should('contain.text', text);
	});

});
