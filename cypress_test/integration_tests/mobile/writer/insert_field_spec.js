/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Insert fields via insertion wizard.', function() {
	var origTestFileName = 'insert_field.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openInsertionWizard();
		// Open fields submenu
		cy.cGet('body').contains('.menu-entry-with-icon.flex-fullwidth', 'More Fields...').click();
		cy.cGet('.ui-content.level-0.mobile-wizard').should('be.visible');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert page number field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Page Number').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'PAGE').should('have.text', '1');
	});

	it('Insert page count field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Page Count').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DOCSTAT').should('have.text', '1');
	});

	it('Insert date field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Date').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DATETIME');
		//var regex = new RegExp(';MM/DD/YY$');
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'sdnum').should('match', regex);
	});

	it('Insert time field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Time').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DATETIME');
		//var regex = new RegExp(';HH:MM:SS AM/PM$');
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'sdnum').should('match', regex);
	});

	it('Insert title field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Title').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DOCINFO').should('have.attr', 'subtype', 'TITLE');
	});

	it('Insert author field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'First Author').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DOCINFO').should('have.attr', 'subtype', 'CREATE').should('have.attr', 'format', 'AUTHOR');
	});

	it('Insert subject field.', function() {
		// Insert field
		cy.cGet('body').contains('.menu-entry-with-icon', 'Subject').click();
		writerHelper.selectAllTextOfDoc();
		//cy.get('#copy-paste-container p sdfield').should('have.attr', 'type', 'DOCINFO').should('have.attr', 'subtype', 'THEME');
	});
});
