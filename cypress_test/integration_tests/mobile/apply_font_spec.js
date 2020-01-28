/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Apply font changes.', function() {
	beforeEach(function() {
		helper.loadTestDoc('simple.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		cy.get('.closemobile').click();
		cy.wait(200); // wait some time to actually release the document
	});

	function generateTextHTML() {
		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos =  (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
				var YPos = marker[0].getBoundingClientRect().top;
				cy.get('body').rightclick(XPos, YPos);
			});

		// Execute copy
		cy.get('.ui-header.level-0.mobile-wizard.ui-widget .menu-entry-with-icon .context-menu-link')
			.contains('Copy')
			.click();

		// Close warning about clipboard operations
		cy.get('.vex-dialog-button-primary.vex-dialog-button.vex-first')
			.click();
	}

	it('Apply font name.', function() {
		// Select text
		cy.get('#document-container').dblclick();
		cy.get('.leaflet-marker-icon');

		// Change font name
		cy.get('#fontnamecombobox')
			.click();

		cy.get('.mobile-wizard.ui-combobox-text')
			.contains('Linux Libertine G')
			.click();

		cy.get('#mobile-wizard-back')
			.click();

		// Combobox entry contains the selected font name
		cy.get('#fontnamecombobox .ui-header-right')
			.contains('Linux Libertine G');

		// Close mobile wizard
		cy.get('#tb_actionbar_item_mobile_wizard')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p font')
			.should('have.attr', 'face', 'Linux Libertine G');
	});
});

