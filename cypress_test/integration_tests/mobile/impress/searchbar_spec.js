/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressMobileHelper = require('./impress_mobile_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		mobileHelper.enableEditingMobile();

		cy.get('#tb_editbar_item_showsearchbar')
			.click();

		cy.get('input#search-input')
			.should('be.visible');

		cy.get('#tb_editbar_item_bold')
			.should('not.be.visible');
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Search existing word.', function() {
		cy.get('input#search-input')
			.type('a');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

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

		cy.get('input#search-input')
			.type('q');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

		// Should be no selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Search next / prev instance.', function() {
		cy.get('input#search-input')
			.type('a');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.getCursorPos('left', 'cursorOrigLeft');

		helper.expectTextForClipboard('a');

		// Search next instance
		cy.get('#tb_searchbar_item_searchnext')
			.click();

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
		cy.get('#tb_searchbar_item_searchprev')
			.click();

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
		cy.get('input#search-input')
			.type('a');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

		// A shape and some text should be selected
		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		helper.getCursorPos('left', 'cursorOrigLeft');

		// Search next instance
		cy.get('#tb_searchbar_item_searchnext')
			.click();

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
		cy.get('#tb_searchbar_item_searchnext')
			.click();

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
		cy.get('input#search-input')
			.type('a');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		cy.get('#tb_searchbar_item_cancelsearch')
			.click();

		cy.get('.transform-handler--rotate')
			.should('not.exist');
		cy.get('.leaflet-selection-marker-start')
			.should('not.exist');

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		cy.get('input#search-input')
			.type('a');

		cy.get('#tb_searchbar_item_searchnext')
			.click();

		cy.get('.transform-handler--rotate')
			.should('be.visible');
		cy.get('.leaflet-selection-marker-start')
			.should('be.visible');

		helper.expectTextForClipboard('a');

		// Close search -> search bar is closed
		cy.get('#tb_searchbar_item_hidesearchbar')
			.click();

		cy.get('input#search-input')
			.should('not.be.visible');

		cy.get('#tb_editbar_item_bold')
			.should('be.visible');
	});
});
