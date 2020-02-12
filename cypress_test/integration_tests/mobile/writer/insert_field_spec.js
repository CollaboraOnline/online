/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Insert fields via insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('simple.odt', 'writer');

		// Click on edit button
		cy.get('#mobile-edit-button').click();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.should('not.have.class', 'disabled')
			.click();
	});

	afterEach(function() {
		helper.afterAll();
	});

	it('Insert page number field.', function() {
		// Open fields submenu
		cy.get('.sub-menu-title')
			.contains('More Fields...')
			.click();

		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Page Number')
			.click();

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

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

		helper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'THEME');
	});
});
