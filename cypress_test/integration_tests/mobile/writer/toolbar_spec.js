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
		cy.cGet('#tb_actionbar_item_mobile_wizard').should('have.class', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#tb_actionbar_item_mobile_wizard').should('not.have.class', 'disabled');
	});

	it('State of insertion mobile wizard toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#tb_actionbar_item_insertion_mobile_wizard').should('have.class', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#tb_actionbar_item_insertion_mobile_wizard').should('not.have.class', 'disabled');
	});

	it('State of comment wizard toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#tb_actionbar_item_comment_wizard').should('not.have.class', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be enabled now
		cy.cGet('#tb_actionbar_item_comment_wizard').should('not.have.class', 'disabled');
	});

	it('State of undo toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#tb_actionbar_item_undo').should('have.class', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be still disabled
		cy.cGet('#tb_actionbar_item_undo').should('have.class', 'disabled');
		// Type something in the document
		helper.typeIntoDocument('x');
		// Button should become enabled
		cy.cGet('#tb_actionbar_item_undo').should('not.have.class', 'disabled');
	});

	it('State of redo toolbar item.', function() {
		// Insertion mobile wizard toolbar button is disabled by default
		cy.cGet('#tb_actionbar_item_redo').should('have.class', 'disabled');
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Button should be still disabled
		cy.cGet('#tb_actionbar_item_redo').should('have.class', 'disabled');
		// Type something in the document
		helper.typeIntoDocument('x');
		// Button should be still disabled
		cy.cGet('#tb_actionbar_item_redo').should('have.class', 'disabled');
		// Do an undo
		cy.cGet('#tb_actionbar_item_undo').should('not.have.class', 'disabled');
		cy.cGet('#tb_actionbar_item_undo').click();
		// Button should become enabled
		cy.cGet('#tb_actionbar_item_redo').should('not.have.class', 'disabled');
	});

	it('Open and close mobile wizard by toolbar item.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();
		// Click on mobile wizard toolbar item
		cy.cGet('#tb_actionbar_item_mobile_wizard').should('not.have.class', 'disabled').click();
		// Mobile wizard is opened and it has any content
		cy.cGet('#mobile-wizard-content').should('not.be.empty');
		// Toolbar button is checked
		cy.cGet('#tb_actionbar_item_mobile_wizard table').should('have.class', 'checked');
		cy.cGet('#tb_actionbar_item_mobile_wizard').click();
		// Mobile wizard is closed
		cy.cGet('#mobile-wizard').should('not.be.visible');
		cy.cGet('#tb_actionbar_item_mobile_wizard table').should('not.have.class', 'checked');
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
		cy.cGet('#tb_actionbar_item_comment_wizard').should('not.have.class', 'disabled').click();
		// Mobile wizard is opened and it has any content
		cy.cGet('#mobile-wizard-content').should('not.be.empty');
		// Toolbar button is checked
		cy.cGet('#tb_actionbar_item_comment_wizard table').should('have.class', 'checked');
		cy.cGet('#tb_actionbar_item_comment_wizard').click();
		// Mobile wizard is closed
		cy.cGet('#mobile-wizard').should('not.be.visible');
		cy.cGet('#tb_actionbar_item_comment_wizard table').should('not.have.class', 'checked');
	});
});
