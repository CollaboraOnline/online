/* global describe it cy require*/

var helper = require('../common/helper');

describe('Example test suit 2', function() {
	it('Example test case 1', function() {
		helper.loadTestDoc('simple.odt');

		// Select a text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Click on bold toolbar button
		cy.get('#tb_editbar_item_italic').click();

		// Remove selection and do a reselection
		cy.get('#document-container').click();
		cy.get('.leaflet-marker-icon').should('not.be.visible');

		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Bold toolbar button is checked
		cy.get('#tb_editbar_item_italic table.w2ui-button.checked');

		// Click on bold toolbar button
		cy.get('#tb_editbar_item_italic').click();
	});
});
