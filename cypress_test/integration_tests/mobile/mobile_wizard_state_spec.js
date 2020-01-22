/* global describe it cy Cypress beforeEach*/

describe('Mobile wizard state tests', function() {
	beforeEach(function() {
		// Get a clean test document
		cy.task('copyFile', {
			sourceDir: Cypress.env('DATA_FOLDER'),
			destDir: Cypress.env('WORKDIR'),
			fileName: 'empty.odt',
		});

		// Open test document
		cy.viewport('iphone-3');
		cy.visit('http://localhost:9980/loleaflet/' +
			Cypress.env('WSD_VERSION_HASH') +
			'/loleaflet.html?file_path=file://' +
			Cypress.env('WORKDIR') + 'empty.odt');

		// Wait for the document to fully load
		cy.get('.leaflet-tile-loaded', {timeout : 10000});
	});

	it('Open and close mobile wizard by toolbar item.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Toolbar button is checked
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is closed
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('not.have.class', 'checked');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// Mobile wizard is opened and it has any content
		// TODO: fix this bug
		/*cy.get('#mobile-wizard-content')
			.should('not.be.empty'); */
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');
	});

	it('Close mobile wizard by hamburger menu.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#mobile-wizard-content')
			.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Open hamburger menu
		cy.get('#toolbar-hamburger').click();
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('About');

		// Close hamburger menu
		cy.get('#toolbar-hamburger').click();
		// Mobile wizard is closed
		cy.get('#mobile-wizard')
			.should('not.be.visible');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// TODO: fix this bug
		//cy.get('#mobile-wizard-content')
		//	.should('not.be.empty');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');
	});

	it('Close mobile wizard by context wizard.', function() {
		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Click on mobile wizard toolbar item
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();

		// Mobile wizard is opened and it has any content
		cy.get('#Character');
		cy.get('#tb_actionbar_item_mobile_wizard table')
			.should('have.class', 'checked');

		// Open context wizard by right click on document
		cy.get('#document-container').rightclick();
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon')
			.contains('Paste');

		// TODO: fix this bug
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('not.have.class', 'checked');

		// Open mobile wizard again
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		// TODO: fix this bug
		//cy.get('#mobile-wizard-content')
		//	.should('not.be.empty');
		//cy.get('#tb_actionbar_item_mobile_wizard table')
		//	.should('have.class', 'checked');
	});
});

