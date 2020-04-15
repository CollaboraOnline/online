/* global describe it cy require afterEach*/

var helper = require('../common/helper');

describe('Slide operations', function() {

	afterEach(function() {
		helper.afterAll('focus.odp');
	});

	function assertNumberOfSlides(slides) {
		cy.get('.preview-frame')
			.should('have.length', slides + 1);
	}

	it('Add slides', function() {
		helper.loadTestDoc('focus.odp');

		cy.get('#tb_presentation-toolbar_item_insertpage')
			.should('not.have.class', 'disabled')
			.click();

		assertNumberOfSlides(2);
	});

	it('Remove slides', function() {
		helper.loadTestDoc('focus.odp');

		// Add slides
		cy.get('#tb_presentation-toolbar_item_insertpage')
			.should('not.have.class', 'disabled')
			.click();

		assertNumberOfSlides(2);

		// Remove Slides
		cy.get('#tb_presentation-toolbar_item_deletepage')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('.vex-dialog-button-primary').click();

		cy.get('#tb_presentation-toolbar_item_deletepage')
			.should('have.class', 'disabled');

		assertNumberOfSlides(1);

	});

	it('Duplicate slide', function() {
		helper.loadTestDoc('focus.odp');

		cy.get('#tb_presentation-toolbar_item_duplicatepage')
			.should('not.have.class', 'disabled')
			.click();

		assertNumberOfSlides(2);

	});
});
