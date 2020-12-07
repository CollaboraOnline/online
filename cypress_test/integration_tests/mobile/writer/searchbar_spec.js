/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		mobileHelper.enableEditingMobile();

		searchHelper.showSearchBar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.tpyeIntoSearchField('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();

		searchHelper.tpyeIntoSearchField('q');

		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search prev instance
		searchHelper.searchPrev();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Cancel search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		helper.textSelectionShouldNotExist();

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
