/* global describe it cy beforeEach require afterEach*/

var helper = require('../common/helper');

describe('Calc focus tests', function() {
	beforeEach(function() {
		helper.beforeAllMobile('empty.ods');
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Basic document focus.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled');

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Double tap on a cell gives the focus to the document
		cy.get('#document-container')
			.dblclick(20, 20);

		// Document has the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');

		// One tap on an other cell -> no focus on the document
		cy.get('#document-container')
			.click(0, 0);

		cy.get('.leaflet-marker-icon.spreadsheet-cell-resize-marker');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');
	});
});
