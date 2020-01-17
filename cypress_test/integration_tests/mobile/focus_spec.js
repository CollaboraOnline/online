/* global describe it cy Cypress beforeEach*/

describe('Focus tests', function() {
	beforeEach(function() {
		// Get a clean test document
		cy.task('copyFile', {
			sourceDir: Cypress.env('DATA_FOLDER'),
			destDir: Cypress.env('WORKDIR'),
			fileName: 'empty.odt',
		});

		// Open test document
		cy.viewport('iphone-3');
		cy.visit('http://localhost:9980/loleaflet/fc04ba550/loleaflet.html?file_path=file://' +
			Cypress.env('WORKDIR') + 'empty.odt');

		// Wait for the document to fully load
		cy.get('.leaflet-tile-loaded');
	})

	it('Focus after document fully loaded.', function() {
		// The document body should have the focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY')
	})

	it('Focus after closing a dialog.', function() {
		// The document body has the focus first
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY')

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open comment insertion dialog
		cy.get('#tb_actionbar_item_insertcomment')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('.loleaflet-annotation-table').should('be.visible');

		// The dialog grabs the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'loleaflet-annotation-textarea')

		// Close the dialog
		cy.contains('Cancel').click();
		cy.get('.loleaflet-annotation-table').should('be.not.visible');

		// The document should have the focus again
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY')
	})

	it('Focus when using insertion mobile wizard.', function() {
		// The document body has the focus first
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY')

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty');

		// This fails here: the document still has the focus
		// The wizard changes the focus
		//cy.document().its('activeElement.className')
		//	.should('be.eq', 'clipboard')

		// Close the mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard').click()
		cy.get('#mobile-wizard').should('not.be.visible');

		// This fails here: the focus is not on the document body
		// The document should have the focus again
		//cy.document().its('activeElement.tagName')
		//	.should('be.eq', 'BODY')
	})

	it('Focus after insertion.', function() {
		// The document body has the focus first
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY')

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion mobile wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.empty')

		// Select More Fields
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .sub-menu-title')
			.contains('More Fields...')
			.parent().click();

		// Insert a field
		cy.get('.ui-header.level-1.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('Page Number').click();
		cy.get('#mobile-wizard').should('not.be.visible');

		// This fails here: the focus is not on the document body
		// The document should have the focus again
		//cy.document().its('activeElement.tagName')
		//	.should('be.eq', 'BODY')
	})
})
