/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var writerHelper = require('./writer_helper');

describe('Insert fields via insertion wizard.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('insert_field.odt', 'writer');

		// Click on edit button
		helper.enableEditingMobile();

		// Open insertion wizard
		cy.get('#tb_actionbar_item_insertion_mobile_wizard')
			.click();
		cy.get('#mobile-wizard')
			.should('be.visible');

		// Open fields submenu
		cy.get('.menu-entry-with-icon.flex-fullwidth')
			.contains('More Fields...')
			.click();

		cy.get('.ui-content.level-0.mobile-wizard')
			.should('be.visible');
	});

	afterEach(function() {
		helper.afterAll('insert_field.odt');
	});

	it('Insert page number field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Page Number')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'PAGE')
			.contains('1');
	});

	it('Insert page count field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Page Count')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCSTAT')
			.contains('1');
	});

	it('Insert date field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Date')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DATETIME')
			.should('have.attr', 'sdnum', '1033;1033;MM/DD/YY');
	});

	it('Insert time field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Time')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DATETIME')
			.should('have.attr', 'sdnum', '1033;1033;HH:MM:SS AM/PM');
	});

	it('Insert title field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Title')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'TITLE');
	});

	it('Insert author field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('First Author')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'CREATE')
			.should('have.attr', 'format', 'AUTHOR');
	});

	it('Insert subject field.', function() {
		// Insert field
		cy.get('.menu-entry-with-icon')
			.contains('Subject')
			.click();

		writerHelper.copyTextToClipboard();

		cy.get('#copy-paste-container p span sdfield')
			.should('have.attr', 'type', 'DOCINFO')
			.should('have.attr', 'subtype', 'THEME');
	});
});
