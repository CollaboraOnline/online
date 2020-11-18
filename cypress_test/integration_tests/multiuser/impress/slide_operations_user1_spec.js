/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Slide operations: user-1.', function() {
	var testFileName = 'slide_operations.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert/delete slide.', function() {
		// user-2 loads the same document
		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// We have one slide by default
		impressHelper.assertNumberOfSlidePreviews(1);

		// Add one more slide
		cy.get('#tb_presentation-toolbar_item_insertpage')
			.click();

		impressHelper.assertNumberOfSlidePreviews(2);

		// then user-2 removes one of the slides
		impressHelper.assertNumberOfSlidePreviews(1);
	});

});
