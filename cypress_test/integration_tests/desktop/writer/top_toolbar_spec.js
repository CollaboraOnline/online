/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		helper.selectAllText(false);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		helper.selectAllText(false);

		cy.get('#copy-paste-container p b')
			.should('exist');
	});
});

