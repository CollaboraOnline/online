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
		cy.cGet('#format-FormatMenu-dropdown').should('exist');
		cy.cGet('#format-FormatMenu-dropdown #format-FormatMenu-entry-0').click(); // Bold
		cy.cGet('#format-FormatMenu-dropdown').should('not.exist');
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

describe(['tagdesktop'], 'Notebookbar review operations.', function() {
	it('Go to the next change', function() {
		// Given a document where the first redline is inside a table:
		helper.setupAndLoadDocument('writer/notebookbar-redline.odt');
		desktopHelper.switchUIToNotebookbar();

		// When going to the next redline:
		cy.cGet('#Review-tab-label').click();
		cy.cGet('.ui-scroll-right').click();
		cy.cGet('#review-next-tracked-change-button').click();
		cy.cGet('#Table-tab-label').should('not.have.class', 'hidden');

		// Then make sure that by the time the Table tab is visible, the Review tab is still
		// selected:
		// Without the accompanying fix in place, this test would have failed with:
		// AssertionError: Timed out retrying after 10000ms: expected '<button#Review-tab-label.ui-tab.notebookbar>' to have class 'selected'
		cy.cGet('#Review-tab-label').should('have.class', 'selected');
	});
});
