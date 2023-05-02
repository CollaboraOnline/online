/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe.skip('Searching via search bar.', function() {
	var origTestFileName = 'search_bar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
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
		helper.expectTextForClipboard('a');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();
		searchHelper.tpyeIntoSearchField('q');
		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		// Search next instance
		searchHelper.searchNext();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search prev instance
		searchHelper.searchPrev();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		// Search next instance
		searchHelper.searchNext();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});

	it('Cancel search.', function() {
		searchHelper.tpyeIntoSearchField('a');
		// Part of the text should be selected
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Cancel search -> selection removed
		searchHelper.cancelSearch();
		helper.textSelectionShouldNotExist();
		cy.cGet('input#search-input').should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');
		// Part of the text should be selected
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
