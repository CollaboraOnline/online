/* global describe it cy require afterEach beforeEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Slide operations', function() {
	var origTestFileName = 'slide_operations.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
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
		cy.cGet('#tb_presentation-toolbar_item_deletepage')
			.should('not.have.class', 'disabled')
			.click();

		cy.cGet('#modal-dialog-deleteslide-modal .button-primary').click();

		cy.cGet('#tb_presentation-toolbar_item_deletepage')
			.should('have.class', 'disabled');

		impressHelper.assertNumberOfSlidePreviews(1);

	});

	it('Duplicate slide', function() {
		helper.clickOnIdle('#tb_presentation-toolbar_item_duplicatepage');

		impressHelper.assertNumberOfSlidePreviews(2);

	});
});
