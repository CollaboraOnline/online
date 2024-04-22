/* global describe it cy beforeEach require expect */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Insert objects via insertion wizard.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/insert_object.odt');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	it('Insert Dropdown.', function() {
		mobileHelper.openInsertionWizard();

		// Insert dropdown
		cy.cGet('body').contains('.menu-entry-with-icon', /^Form$/).click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Dropdown').click();

		// Open Properties dialog
		mobileHelper.openInsertionWizard();
		cy.cGet('body').contains('.menu-entry-with-icon', /^Form$/).click();
		cy.cGet('body').contains('.menu-entry-with-icon', 'Properties').click();

		cy.cGet('#mobile-wizard-title').should('have.text', 'Content Control Properties');
		cy.cGet('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry').should('have.length', 1);

		// Add new entry
		cy.cGet('body').contains('button', 'Add').click();
		cy.cGet('#mobile-wizard-title').should('have.text', 'Content Control List Item Properties');
		cy.cGet('#displayname').type('some text');
		cy.cGet('#value').type('something');
		cy.cGet('#ContentControlListItemDialog button#ok').click();

		// Verify we are back in parent window and added entries
		cy.cGet('#mobile-wizard-title').should('have.text', 'Content Control Properties');
		cy.cGet('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry').should('have.length', 2);
		cy.cGet('#listitems .mobile-wizard.ui-treeview-body .ui-listview-entry').each((item, index) => {
				if (index == 0)
					expect(item.get(0).innerText).to.eq('\tChoose an item');
				else if (index == 1)
					expect(item.get(0).innerText).to.eq('some text\tsomething');
			});
	});
});
