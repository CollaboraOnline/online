/* global cy */

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

module.exports.showSidebar = showSidebar;
module.exports.hideSidebar = hideSidebar;
