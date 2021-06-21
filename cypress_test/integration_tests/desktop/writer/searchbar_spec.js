/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var writerHelper = require('../../common/writer_helper');

describe('Searching via search bar' ,function() {
	var testFileName = 'search_bar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();

		cy.get('input#search-input')
			.clear()
			.type('q');

		cy.get('input#search-input')
			.should('have.prop', 'value', 'q');

		cy.get('#tb_actionbar_item_searchprev')
			.should('have.class', 'disabled');

		cy.get('#tb_actionbar_item_searchnext')
			.should('have.class', 'disabled');

		cy.get('#tb_actionbar_item_cancelsearch')
			.should('not.be.visible');

		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		//search next instance
		searchHelper.searchNextDesktop();

		cy.get('#copy-paste-container p b')
			.should('exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search prev instance
		searchHelper.searchPrevDesktop();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});
	it('Search wrap at document end.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		searchHelper.searchNextDesktop();

		cy.get('#copy-paste-container p b')
			.should('exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNextDesktop();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Cancel search.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Cancel search -> selection removed
		searchHelper.cancelSearchDesktop();

		helper.textSelectionShouldNotExist();

		cy.get('input#search-input')
			.should('be.visible');
	});
});
