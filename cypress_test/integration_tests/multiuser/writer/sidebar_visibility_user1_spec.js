/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe.skip('Sidebar visibility: user-1.', function() {
	var testFileName = 'sidebar_visibility.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Show/hide sidebar.', function() {
		// user-2 loads the same document

		cy.get('#tb_actionbar_item_userlist')
			.should('be.visible');

		cy.get('#tb_actionbar_item_userlist .w2ui-tb-caption')
			.should('have.text', '2 users');

		// Visible by default
		cy.get('#sidebar-panel')
			.should('be.visible');

		desktopHelper.hideSidebar();

		// Change paragraph alignment to trigger user-2 actions
		cy.get('#tb_editbar_item_centerpara .w2ui-button')
			.click();

		// user-2 changes the paragraph alignment
		cy.get('#tb_editbar_item_rightpara .w2ui-button')
			.should('have.class', 'checked');

		// sidebar should be still invisible
		cy.get('#sidebar-panel')
			.should('not.be.visible');

		// Show sidebar again
		desktopHelper.showSidebar();

		// Change paragraph alignment to trigger user-2 actions
		cy.get('#tb_editbar_item_justifypara .w2ui-button')
			.click();

		// user-2 changes the paragraph alignment
		cy.get('#tb_editbar_item_leftpara .w2ui-button')
			.should('have.class', 'checked');

		// sidebar should be still visible
		cy.get('#sidebar-panel')
			.should('be.visible');
	});

});
