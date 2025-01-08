/* global describe it cy beforeEach require*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Searching via search bar.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/search_bar.ods');
		cy.wait(500);
		cy.cGet(helper.addressInputSelector).should('have.value', 'A2');
	});

	it('Search existing word.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');

		searchHelper.searchNext();

		// First cell should be selected
		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		searchHelper.searchNext();
		cy.cGet(helper.addressInputSelector).should('have.value', 'B1');

		searchHelper.typeIntoSearchField('c');
		searchHelper.searchNext();

		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'c');

		searchHelper.searchNext();
		cy.cGet(helper.addressInputSelector).should('have.value', 'A301');
	});

	it('Search not existing word.', function() {
		searchHelper.typeIntoSearchField('q');

		// Should be no new selection
		cy.cGet(helper.addressInputSelector).should('have.value', 'A2');
	});

	it('Search next / prev instance.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('d');
		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A472');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');

		// Search next instance
		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'D1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');

		// Search prev instance
		searchHelper.searchPrev();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A472');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');
	});

	it('Search wrap at document end', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');

		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		// Search next instance
		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'B1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');
	});

	it('Cancel search.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');

		searchHelper.searchNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		cy.cGet('input#search-input').should('be.visible');
	});

});
