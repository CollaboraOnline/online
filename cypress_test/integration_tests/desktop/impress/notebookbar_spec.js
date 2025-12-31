/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Notebookbar tests', function() {
	var newFilePath;

	beforeEach(function() {
		newFilePath = helper.setupAndLoadDocument('impress/statusbar.odp');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Ruler visible after reload', function() {
		// Visible check and enable if needed
		cy.cGet('#View-tab-label').click();

		cy.cGet('#showruler-input').then(($input) => {
			if (!$input.is(':checked')) {
				cy.wrap($input).check();
			}
		});

		// Verify ruler is visible
		cy.cGet('#showruler-input').should('be.checked');
		cy.cGet('.cool-ruler').should('be.visible');

		// Reload
		helper.reloadDocument(newFilePath);

		// Verify ruler is still visible
		cy.cGet('.cool-ruler').should('be.visible');
	});
});
