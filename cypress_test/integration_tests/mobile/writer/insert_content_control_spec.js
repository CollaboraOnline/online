/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Insert objects via insertion wizard.', function() {
	var origTestFileName = 'insert_object.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Dropdown.', function() {
		mobileHelper.openInsertionWizard();

		// Insert dropdown
		cy.contains('.menu-entry-with-icon', /^Form$/)
			.click();

		cy.contains('.menu-entry-with-icon', 'Dropdown')
			.click();

		// Open Properties dialog
		mobileHelper.openInsertionWizard();

		cy.contains('.menu-entry-with-icon', /^Form$/)
			.click();

		cy.contains('.menu-entry-with-icon', 'Properties')
			.click();

		cy.get('#mobile-wizard-title')
			.should('have.text', 'Content Control Properties');

		cy.get('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry')
			.should('have.length', 1);

		// Add new entry
		cy.contains('button', 'Add')
			.click();

		cy.get('#mobile-wizard-title')
			.should('have.text', 'Content Control List Item Properties');

		cy.get('#displayname')
			.type('some text');
		cy.get('#value')
			.type('something');

		cy.get('#ContentControlListItemDialog button#ok')
			.click();

		// Verify we are back in parent window and added entries
		cy.get('#mobile-wizard-title')
			.should('have.text', 'Content Control Properties');

		cy.get('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry')
			.should('have.length', 2);

		cy.get('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry')
			.each((item, index) => {
				if (index == 0)
					expect(item.get(0).innerText).to.eq('\tChoose an item');
				else if (index == 1)
					expect(item.get(0).innerText).to.eq('some text\tsomething');
			});
	});
});
