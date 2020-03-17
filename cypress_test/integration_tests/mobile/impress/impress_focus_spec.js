/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Impress focus tests', function() {
	beforeEach(function() {
		helper.beforeAllMobile('focus.odp', 'impress');
	});

	afterEach(function() {
		helper.afterAll('focus.odp');
	});

	it.skip('Basic document focus.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled');

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// One tap on a text shape does not grab the focus to the document
		cy.get('#document-container')
			.click();

		// Shape selection
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Double tap on a text shape gives the focus to the document
		cy.get('#document-container')
			.dblclick();

		// Document has the focus
		// TODO: Focus is inconsistent here.
		//cy.document().its('activeElement.className')
		//	.should('be.eq', 'clipboard');
	});
});
