/* global describe it cy require afterEach beforeEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe('Slide operations', function() {
	var testFileName = 'slide_operations.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Add slides', function() {
		helper.clickOnIdle('#tb_presentation-toolbar_item_insertpage');

		impressHelper.assertNumberOfSlidePreviews(2);
	});

	it('Remove slides', function() {
		// Add slides
		helper.clickOnIdle('#tb_presentation-toolbar_item_insertpage');

		impressHelper.assertNumberOfSlidePreviews(2);

		// Remove Slides
		cy.get('#tb_presentation-toolbar_item_deletepage')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('.vex-dialog-button-primary').click();

		cy.get('#tb_presentation-toolbar_item_deletepage')
			.should('have.class', 'disabled');

		impressHelper.assertNumberOfSlidePreviews(1);

	});

	it('Duplicate slide', function() {
		helper.clickOnIdle('#tb_presentation-toolbar_item_duplicatepage');

		impressHelper.assertNumberOfSlidePreviews(2);

	});
});
