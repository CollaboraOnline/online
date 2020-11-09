/* global cy Cypress */

function showSidebar() {
	cy.log('Showing sidebar - start.');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('not.have.class', 'checked');
	cy.get('#sidebar-panel')
		.should('not.be.visible');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.click({force: true});

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('have.class', 'checked');
	cy.get('#sidebar-panel')
		.should('be.visible');

	cy.log('Showing sidebar - end.');
}

function hideSidebar() {
	cy.log('Hiding sidebar - start.');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('have.class', 'checked');
	cy.get('#sidebar-panel')
		.should('be.visible');

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.click({force: true});

	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.should('not.have.class', 'checked');
	cy.get('#sidebar-panel')
		.should('not.be.visible');

	cy.log('Hiding sidebar - end.');
}

function showStatusBarIfHidden() {
	cy.get('#toolbar-down')
		.then(function(statusbar) {
			if (!Cypress.dom.isVisible(statusbar[0])) {
				cy.get('#menu-view')
					.click();

				cy.get('#menu-showstatusbar')
					.click();
			}
		});

	cy.get('#toolbar-down')
		.should('be.visible');
}

function showSidebarIfHidden() {
	cy.get('#tb_editbar_item_sidebar .w2ui-button')
		.then(function(sidebarItem) {
			if (!sidebarItem.hasClass('checked')) {
				showSidebar();
			}
		});
}

module.exports.showSidebar = showSidebar;
module.exports.hideSidebar = hideSidebar;
module.exports.showStatusBarIfHidden = showStatusBarIfHidden;
module.exports.showSidebarIfHidden = showSidebarIfHidden;
