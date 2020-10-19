/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerMobileHelper = require('./writer_mobile_helper');

describe('Searching via search bar.', function() {
	var testFileName = 'search_bar.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

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

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search not existing word.', function() {
		writerMobileHelper.selectAllMobile();

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('input#search-input')
			.type('q');

		// Should be no selection
		cy.get('.leaflet-marker-icon')
			.should('not.exist');
	});

	it('Search next / prev instance.', function() {
		cy.get('input#search-input')
			.type('a');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		cy.get('#tb_searchbar_item_searchnext')
			.click();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search prev instance
		cy.get('#tb_searchbar_item_searchprev')
			.click();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Search at the document end.', function() {
		cy.get('input#search-input')
			.type('a');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		// Search next instance
		cy.get('#tb_searchbar_item_searchnext')
			.click();

		cy.get('#copy-paste-container p b')
			.should('exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Search next instance, which is in the beginning of the document.
		cy.get('#tb_searchbar_item_searchnext')
			.click();

		cy.get('#copy-paste-container p b')
			.should('not.exist');

		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');
	});

	it('Cancel search.', function() {
		cy.get('input#search-input')
			.type('a');

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Cancel search -> selection removed
		cy.get('#tb_searchbar_item_cancelsearch')
			.click();

		cy.get('.leaflet-marker-icon')
			.should('not.exist');

		cy.get('input#search-input')
			.should('be.visible');
	});

	it('Close search.', function() {
		cy.get('input#search-input')
			.type('a');

		// Part of the text should be selected
		cy.get('.leaflet-marker-icon')
			.should('exist');

		cy.get('#copy-paste-container p')
			.should('have.text', '\na');

		// Close search -> search bar is closed
		cy.get('#tb_searchbar_item_hidesearchbar')
			.click();

		cy.get('input#search-input')
			.should('not.be.visible');

		cy.get('#tb_editbar_item_bold')
			.should('be.visible');
	});
});
