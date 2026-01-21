/* global cy describe it beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Viewing Mode and Multi-Page View tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/notebookbar.odt');
	});

	it('Switch to Viewing mode and verify tiles', function() {
		cy.log('Switching to Viewing mode outside of multi-page view');

		cy.cGet('#viewModeDropdownButton').should('be.visible').click();

		desktopHelper.getDropdown('viewModeDropdownButton').contains('Viewing').click();

		cy.cGet('#PermissionMode').should('contain.text', 'Viewing');

		// Assert that the tiles are rendered (not white)
		helper.isCanvasWhite(false);
	});

	it('Switch to Multi-Page View then to Viewing mode', function() {
		cy.log('Switching to Multi-Page View then to Viewing mode');

		// Enable Multi-Page View from status bar
		cy.cGet('#multi-page-view').click();

		cy.wait(500);

		cy.cGet('#viewModeDropdownButton').should('be.visible').click();
		desktopHelper.getDropdown('viewModeDropdownButton').contains('Viewing').click();

		// Verify indicator
		cy.cGet('#PermissionMode').should('contain.text', 'Viewing');

		// Verify tiles (the core of the fix)
		helper.isCanvasWhite(false);
	});
});
