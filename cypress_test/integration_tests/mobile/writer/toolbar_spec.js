/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Toolbar tests', function() {
	var origTestFileName = 'toolbar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('State of mobile wizard toolbar item.', function() {
		// Mobile wizard toolbar button is disabled by default
		cy.cGet('#toolbar-up #mobile_wizard').should('have.attr', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#toolbar-up #mobile_wizard').should('not.have.class', 'disabled');
	});

	it('State of insertion mobile wizard toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#toolbar-up #insertion_mobile_wizard').should('have.attr', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#toolbar-up #insertion_mobile_wizard').should('not.have.attr', 'disabled');
	});

	it('State of comment wizard toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#toolbar-up #comment_wizard').should('not.have.attr', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#toolbar-up #comment_wizard').should('not.have.attr', 'disabled');
	});

	it('State of undo toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#toolbar-up #undo').should('have.attr', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be still disabled
		cy.cGet('#toolbar-up #undo').should('have.attr', 'disabled');
		// Type something in the document
		helper.typeIntoDocument('x');
		// Button should become enabled
		cy.cGet('#toolbar-up #undo').should('not.have.attr', 'disabled');
	});

	it('State of redo toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#toolbar-up #redo').should('have.attr', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be still disabled
		cy.cGet('#toolbar-up #redo').should('have.attr', 'disabled');
		// Type something in the document
		helper.typeIntoDocument('x');
		// Button should be still disabled
		cy.cGet('#toolbar-up #redo').should('have.attr', 'disabled');
		// Do an undo
		cy.cGet('#toolbar-up #undo').should('not.have.attr', 'disabled');
		cy.cGet('#toolbar-up #undo').click();
		// Button should become enabled
		cy.cGet('#toolbar-up #redo').should('not.have.attr', 'disabled');
	});

	it('Open and close mobile wizard by toolbar item.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click on mobile wizard toolbar item
		cy.cGet('#toolbar-up #mobile_wizard').should('not.have.attr', 'disabled');
		cy.cGet('#toolbar-up #mobile_wizard button').click();
		// Mobile wizard is opened and it has any content
		cy.cGet('#mobile-wizard-content').should('not.be.empty');
		// Toolbar button is checked
		//cy.cGet('#toolbar-up #mobile_wizard').should('have.class', 'checked');
		cy.cGet('#toolbar-up #mobile_wizard button').click();
		// Mobile wizard is closed
		cy.cGet('#mobile-wizard').should('not.be.visible');
		//cy.cGet('#toolbar-up #mobile_wizard').should('not.have.class', 'checked');
	});

	it('Open and close insertion mobile wizard by toolbar item.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		mobileHelper.openInsertionWizard();
		mobileHelper.closeInsertionWizard();
		mobileHelper.openInsertionWizard();
	});

	it('Open comment wizard by toolbar item.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click on mobile wizard toolbar item
		cy.cGet('#toolbar-up #comment_wizard').should('not.have.attr', 'disabled');
		cy.cGet('#toolbar-up #comment_wizard button').click();
		// Mobile wizard is opened and it has any content
		cy.cGet('#mobile-wizard-content').should('not.be.empty');
		// Toolbar button is checked
		//cy.cGet('#toolbar-up #comment_wizard').should('have.class', 'checked');
		cy.cGet('#toolbar-up #comment_wizard button').click();
		// Mobile wizard is closed
		cy.cGet('#mobile-wizard').should('not.be.visible');
		//cy.cGet('#toolbar-up #comment_wizard').should('not.have.class', 'checked');
	});
});
