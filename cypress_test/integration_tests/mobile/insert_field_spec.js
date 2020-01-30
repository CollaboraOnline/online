/* global describe it cy beforeEach require expect afterEach*/

var helper = require('../common/helper');

describe('Insert fields via insertion wizard.', function() {
	beforeEach(function() {
		helper.loadTestDoc('simple.odt', true);

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		cy.get('.closemobile').click();
		cy.wait(200); // wait some time to actually release the document
	});

	function generateTextHTML() {
		// Do a new selection
		helper.selectAllMobile();

		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(marker) {
				expect(marker).to.have.lengthOf(2);
				var XPos = (marker[0].getBoundingClientRect().right + marker[1].getBoundingClientRect().left) / 2;
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

	it('Insert page number field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Page Number')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'PAGE')
			.contains('1');
	});

	it('Insert page count field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Page Count')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCSTAT')
			.contains('1');
	});

	it('Insert date field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Date')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DATETIME')
			.should('have.attr', 'sdnum', '1033;1033;MM/DD/YY');
	});

	it('Insert time field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Time')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DATETIME')
			.should('have.attr', 'sdnum', '1033;1033;HH:MM:SS AM/PM');
	});

	it('Insert title field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Title')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'TITLE');
	});

	it('Insert author field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('First Author')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'CREATE')
			.should('have.attr', 'format', 'AUTHOR');
	});

	it('Insert subject field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Subject')
			.click();

		generateTextHTML();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'THEME');
	});
});
