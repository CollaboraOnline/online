/* global describe it cy expect beforeEach require afterEach*/

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');

describe.skip('Searching via search bar' ,function() {
	var origTestFileName = 'search_bar.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		helper.textSelectionShouldExist();

		helper.expectTextForClipboard('a');
	});

	it('Search not existing word.', function() {
		cy.get('.leaflet-layer').dblclick('center');

		cy.wait(2000);

		helper.selectAllText();

		cy.wait(2000);

		helper.textSelectionShouldExist();

		searchHelper.typeIntoSearchFieldDesktop('q');

		searchHelper.searchNextDesktop();

		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.getCursorPos('left', 'cursorOrigLeft');

		helper.expectTextForClipboard('a');

		// Search next instance
		searchHelper.searchNextDesktop();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Search prev instance
		searchHelper.searchPrevDesktop();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		//cy.get('@cursorOrigLeft')
		//	.then(function(cursorOrigLeft) {
		//		cy.get('.blinking-cursor')
		//			.should(function(cursor) {
		//				expect(cursor.offset().left).to.be.equal(cursorOrigLeft);
		//			});
		//	});
	});

	it('Search wrap at the document end.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		helper.getCursorPos('left', 'cursorOrigLeft');

		// Search next instance
		searchHelper.searchNextDesktop();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNextDesktop();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		cy.get('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.get('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.equal(cursorOrigLeft);
					});
			});
	});
	it('Cancel search.', function() {
		searchHelper.typeIntoSearchFieldDesktop('a');

		searchHelper.searchNextDesktop();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		searchHelper.cancelSearchDesktop();

		cy.get('.transform-handler--rotate')
			.should('not.exist');
		cy.get('.leaflet-selection-marker-start')
			.should('not.exist');

		cy.get('input#search-input')
			.should('be.visible');
	});
});
