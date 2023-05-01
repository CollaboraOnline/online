/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe.skip('Searching via search bar.', function() {
	var origTestFileName = 'search_bar.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();

		searchHelper.showSearchBar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Search existing word.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');
	});

	it('Search not existing word.', function() {
		impressHelper.selectTextShapeInTheCenter();

		impressHelper.dblclickOnSelectedShape();

		helper.selectAllText();

		helper.textSelectionShouldExist();

		searchHelper.tpyeIntoSearchField('q');

		searchHelper.searchNext();

		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.getCursorPos('left', 'cursorOrigLeft');

		helper.expectTextForClipboard('a');

		// Search next instance
		searchHelper.searchNext();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		cy.cGet('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.cGet('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Search prev instance
		searchHelper.searchPrev();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		//cy.get('@cursorOrigLeft')
		//	.then(function(cursorOrigLeft) {
		//		cy.get('.blinking-cursor')
		//			.should(function(cursor) {
		//				expect(cursor.offset().left).to.be.equal(cursorOrigLeft);
		//			});
		//	});
	});

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		helper.getCursorPos('left', 'cursorOrigLeft');

		// Search next instance
		searchHelper.searchNext();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		cy.cGet('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.cGet('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.greaterThan(cursorOrigLeft);
					});
			});

		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		cy.cGet('@cursorOrigLeft')
			.then(function(cursorOrigLeft) {
				cy.cGet('.blinking-cursor')
					.should(function(cursor) {
						expect(cursor.offset().left).to.be.equal(cursorOrigLeft);
					});
			});
	});

	it('Cancel search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		cy.cGet('.transform-handler--rotate').should('not.exist');
		cy.cGet('.leaflet-selection-marker-start').should('not.exist');
		cy.cGet('input#search-input').should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		//cy.get('.transform-handler--rotate')
		//	.should('be.not.visible');
		cy.cGet('.leaflet-selection-marker-start').should('be.visible');

		helper.expectTextForClipboard('a');

		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
