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
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		searchHelper.tpyeIntoSearchField('q');

		// Should be no selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search prev instance
		searchHelper.searchPrev();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Cancel search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		cy.get('.leaflet-marker-icon')
			.should('not.exist');

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
