/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		// First cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Search not existing word.', function() {
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A2');

		searchHelper.typeIntoSearchFieldDesktop('q');

		// Should be no new selection
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A2');
	});

	it('Search next / prev instance.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance
		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search prev instance
		searchHelper.searchPrevDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Search wrap at document end', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance
		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Cancel search.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Cancel search -> selection removed
		searchHelper.cancelSearchDesktop();

		cy.get('input#search-input')
			.should('be.visible');
	});

});
