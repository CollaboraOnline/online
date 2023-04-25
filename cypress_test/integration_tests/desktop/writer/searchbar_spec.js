/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Searching via search bar' ,function() {
	var origTestFileName = 'search_bar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.expectTextForClipboard('a');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();
		cy.cGet('input#search-input').clear().type('q');
		cy.cGet('input#search-input').should('have.prop', 'value', 'q');
		cy.cGet('#tb_actionbar_item_searchprev').should('have.class', 'disabled');
		cy.cGet('#tb_actionbar_item_searchnext').should('have.class', 'disabled');
		cy.cGet('#tb_actionbar_item_cancelsearch').should('not.be.visible');
		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		//search next instance
		searchHelper.searchNextDesktop();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search prev instance
		searchHelper.searchPrevDesktop();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});
	it('Search wrap at document end.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		// Search next instance
		searchHelper.searchNextDesktop();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNextDesktop();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});

	it('Cancel search.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		searchHelper.cancelSearchDesktop();

		helper.textSelectionShouldNotExist();

		cy.cGet('input#search-input').should('be.visible');
	});
});
