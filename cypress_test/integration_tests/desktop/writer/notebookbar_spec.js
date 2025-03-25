/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop'], 'Notebookbar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/notebookbar.odt');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebarIfHidden();
		}

		writerHelper.selectAllTextOfDoc();
	});

	it('Apply bold font from dropdown in Format tab', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('.notebookbar #Format-tab-label').click();
		cy.cGet('.notebookbar .unoFormatMenu .unoarrow').click();
		cy.cGet('#format-dropdown').should('exist');
		cy.cGet('#format-dropdown #format-entry-0').click(); // Bold
		cy.cGet('#format-dropdown').should('not.exist');
		writerHelper.selectAllTextOfDoc();
		helper.copy();
		cy.cGet('#copy-paste-container p b').should('exist');
	});

	it('Check label showing heuristic', function() {
		// no label
		cy.cGet('.notebookbar .unoBold').should('be.visible');
		cy.cGet('.notebookbar .unoBold span').should('not.exist');

		// with label
		cy.cGet('.notebookbar #Review-tab-label').click();
		cy.cGet('.notebookbar .unoSpellOnline').should('be.visible');
		cy.cGet('.notebookbar .unoSpellOnline span').contains('Automatic Spell Checking');
	});
});
