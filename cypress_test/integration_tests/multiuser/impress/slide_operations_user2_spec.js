/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Slide operations: user-2.', function() {
	var testFileName = 'slide_operations.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress', true);
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert/delete slide.', function() {
		// user-1 loads the same document
		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// user-1 inserts a new slide
		impressHelper.assertNumberOfSlidePreviews(2);

		// remove the second slide
		cy.get('#slide-sorter .preview-frame:nth-of-type(3)')
			.click();

		cy.get('#slide-sorter .preview-frame:nth-of-type(3) .preview-img')
			.should('have.class', 'preview-img-currentpart');

		helper.clickOnIdle('#tb_presentation-toolbar_item_deletepage');

		cy.get('.vex-dialog-form .vex-dialog-button-primary')
			.click();

		impressHelper.assertNumberOfSlidePreviews(1);
	});
});
