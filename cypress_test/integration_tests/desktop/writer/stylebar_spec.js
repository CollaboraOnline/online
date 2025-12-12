/* global describe it cy beforeEach require */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Test style sidebar', function() {

	beforeEach(function() {
		cy.viewport(1920,1080);
		helper.setupAndLoadDocument('writer/stylebar.odt');

		cy.cGet('#Format-tab-label').click();
		cy.cGet('#toolbar-up [id^="format-style-dialog"] button:visible').click();
		cy.cGet('#StyleListDeck').should('exist').should('be.visible');

		cy.viewport(1000,660);

		// show and trigger render
		cy.cGet('#treeview .ui-treeview-cell-text').contains('Complimentary Close')
			.should('exist').scrollIntoView();

		cy.wait(2000); // stabilize
	});

	function getEntry(text) {
		return cy.cGet('#treeview img.ui-treeview-custom-render[alt="' + text + '"]').should('exist');
	}

	it('Style sidebar updates rendered preview on added style', function() {
		getEntry('Complimentary Close').click();

		cy.wait(2000); // stabilize
		cy.cGet('#sidebar-dock-wrapper').compareSnapshot('style_initial', 0.05);

		// open context menu and "new" dialog
		getEntry('Complimentary Close').rightclick();
		cy.cGet('#__MENU__').should('exist');
		cy.cGet('#__MENU__ .ui-treeview-cell-text-content').contains('New').click();

		// add new style
		cy.cGet('[id^="TemplateDialog"].jsdialog').should('exist');
		cy.cGet('.button-primary').click();
		cy.cGet('[id^="TemplateDialog"].jsdialog').should('not.exist');
		cy.wait(2000); // stabilize

		// check image after style was added
		getEntry('Complimentary Close').parent().parent().parent().parent()
			.find('.ui-treeview-expander-column').should('exist').click();

		cy.wait(2000); // stabilize
		cy.cGet('#sidebar-dock-wrapper').compareSnapshot('style_added', 0.05);
	});

	it('Style sidebar context menu on node with spaces', function() {
		getEntry('Complimentary Close').click();
		getEntry('Complimentary Close').rightclick();

		cy.cGet('#__MENU__').should('exist');

		// visually check position and renders
		cy.wait(500);
		cy.cGet('#sidebar-dock-wrapper').compareSnapshot('style_sidebar_context_menu', 0.1);
	});
});
