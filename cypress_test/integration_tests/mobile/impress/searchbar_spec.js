/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var searchHelper = require('../../common/search_helper');
var mobileHelper = require('../../common/mobile_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		searchHelper.showSearchBar();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Search existing word.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');
	});

	it('Search not existing word.', function() {
		impressMobileHelper.selectTextShapeInTheCenter();

		impressMobileHelper.dblclickOnSelectedShape();

		helper.selectAllText();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		searchHelper.tpyeIntoSearchField('q');

		searchHelper.searchNext();

		// Should be no selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Search next / prev instance.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.getCursorPos('left', 'cursorOrigLeft');

		helper.expectTextForClipboard('a');

		// Search next instance
		searchHelper.searchNext();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
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
		searchHelper.searchPrev();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
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

	it('Search at the document end.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		helper.getCursorPos('left', 'cursorOrigLeft');

		// Search next instance
		searchHelper.searchNext();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
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
		searchHelper.searchNext();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
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
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		cy.get('.transform-handler--rotate')
			.should('not.exist');
		cy.get('.leaflet-selection-marker-start')
			.should('not.exist');

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		searchHelper.tpyeIntoSearchField('a');

		searchHelper.searchNext();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		// Close search -> search bar is closed
		searchHelper.closeSearchBar();
	});
});
