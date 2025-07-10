/* global describe it cy beforeEach require */

var helper = require('../../common/helper');

describe(['tagdesktop'], 'Test style sidebar', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/stylebar.odt');

		cy.cGet('#Format-tab-label').click();
		cy.cGet('#format-style-dialog').click();
	});

	it('Style sidebar context menu on node with spaces', function() {
		cy.cGet('#treeview .ui-treeview-cell-text img.ui-treeview-custom-render[alt="Complimentary Close"]').click();
		cy.cGet('#treeview .ui-treeview-cell-text img.ui-treeview-custom-render[alt="Complimentary Close"]').rightclick();
		cy.cGet('#__MENU__').should('exist');
	});
});
