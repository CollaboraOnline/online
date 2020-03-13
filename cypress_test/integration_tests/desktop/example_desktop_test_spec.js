/* global describe it cy require afterEach*/

var helper = require('../common/helper');

describe('Example test suit 1', function() {

	afterEach(function() {
		helper.afterAll('example.odt');
	});

	it('Example test case 1', function() {
		helper.loadTestDoc('example.odt');

		// Select a text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Click on bold toolbar button
		cy.get('#tb_editbar_item_bold').click();

		// Remove selection and do a reselection
		cy.get('#document-container').type('{leftarrow}');
		cy.get('.leaflet-marker-icon').should('not.be.visible');

		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Bold toolbar button is checked
		cy.get('#tb_editbar_item_bold table.w2ui-button.checked');

		// Click on bold toolbar button
		cy.get('#tb_editbar_item_bold').click();
	});
});
