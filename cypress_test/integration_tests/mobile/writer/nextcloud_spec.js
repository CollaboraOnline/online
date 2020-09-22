/* global describe it cy require afterEach Cypress */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Nextcloud specific tests.', function() {
	var testFileName = 'nextcloud.odt';

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Insert image from storage.', function() {
		helper.loadFileToNextCloud('image_to_insert.png', 'writer');

		helper.beforeAll(testFileName, 'writer', undefined, true);

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openInsertionWizard();

		cy.get('.insertgraphicremote')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '');
				cy.wrap(item)
					.click();
			});

		cy.get('.oc-dialog')
			.should('be.visible');

		cy.get('tr[data-entryname=\'image_to_insert.png\']')
			.click();

		cy.get('.oc-dialog-buttonrow .primary')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '2');
				cy.wrap(item)
					.click();
			});

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.Graphic')
			.should('exist');
	});

	it('Save as.', function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'Save As...')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '1');
				cy.wrap(item)
					.click();
			});

		cy.get('.oc-dialog')
			.should('be.visible');

		cy.get('.oc-dialog input')
			.clear()
			.type('1' + testFileName);

		cy.get('.oc-dialog-buttonrow .primary')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '2');
				cy.wrap(item)
					.click();
			});

		// Close the document
		cy.get('#mobile-edit-button')
			.should('be.visible');

		cy.get('#tb_actionbar_item_closemobile')
			.then(function(item) {
				cy.wrap(item)
					.click();
				Cypress.env('IFRAME_LEVEL', '');
			});

		cy.get('tr[data-file=\'1' + testFileName + '\']')
			.should('be.visible');

		cy.get('tr[data-file=\'' + testFileName + '\']')
			.should('be.visible');
	});

	it('Share.', function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'Share...')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '');
				cy.wrap(item)
					.click();
			});

		cy.get('#app-sidebar')
			.should('be.visible');

		// issue here
		//cy.get('section#sharing')
		//	.should('be.visible');

		cy.get('.app-sidebar__close.icon-close')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '2');
				cy.wrap(item)
					.click();
			});
	});

	it('Revision history.', function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		mobileHelper.openHamburgerMenu();

		cy.contains('.menu-entry-with-icon', 'File')
			.click();

		cy.contains('.menu-entry-with-icon', 'See revision history')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '');
				cy.wrap(item)
					.click();
			});

		cy.get('#app-sidebar')
			.should('be.visible');

		cy.get('section#tab-versionsTabView')
			.should('be.visible');

		cy.get('.app-sidebar__close.icon-close')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '1');
				cy.wrap(item)
					.click();
			});

		// issue here
		cy.get('#revViewerContainer .icon-close')
			.then(function(item) {
				Cypress.env('IFRAME_LEVEL', '2');
				cy.wrap(item)
					.click();
			});
	});
});

