/* global describe it cy beforeEach require  */

var helper = require('../../common/helper');

describe(['tagdesktop', 'tagnextcloud', 'tagscreenshot'], 'Manage Changes Dialog', function () {

	beforeEach(function () {
		helper.setupAndLoadDocument('writer/manage_tracking_changes.odt');
	});

	it('Manage changes dialog visual test', function () {
		cy.cGet('.notebookbar #Review-tab-label').click();
		cy.cGet('.notebookbar #overflow-button-review-tracking').click();
		cy.cGet('.notebookbar #review-accept-tracked-changes').click();
		cy.cGet('#AcceptRejectChangesDialog').should('be.visible');
		cy.cGet('#writerchanges .ui-treeview-entry.ui-treeview-expandable[aria-level="1"] .ui-treeview-expander-column').click();
		cy.wait(100);
		cy.cGet('#writerchanges .ui-treeview-entry.ui-treeview-expandable[aria-level="2"][aria-expanded="false"] .ui-treeview-expander-column')
			.eq(0).click();
		cy.wait(100);
		cy.cGet('#writerchanges .ui-treeview-entry.ui-treeview-expandable[aria-level="2"][aria-expanded="false"] .ui-treeview-expander-column')
			.eq(0).click();
		cy.cGet('#writerchanges').compareSnapshot('writer_manage_changes_tree', 0.1);
	});
});
