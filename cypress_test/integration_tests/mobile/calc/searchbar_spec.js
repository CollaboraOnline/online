/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		searchHelper.showSearchBar();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Search existing word.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// First cell should be selected
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Search not existing word.', function() {
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A2');

		searchHelper.tpyeIntoSearchField('q');

		// Should be no new selection
		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A2');
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance
		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search prev instance
		searchHelper.searchPrev();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance
		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');
	});

	it('Cancel search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('#copy-paste-container table td')
			.should('have.text', 'a');

		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
