/* global describe it cy beforeEach require Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop'], 'Notebookbar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/notebookbar.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.viewport(1920,1080);

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebar();
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

describe(['tagdesktop'], 'Notebookbar checkbox widgets', function() {
	beforeEach(function() {
		helper.setupAndLoadDocument('writer/notebookbar.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#View-tab-label').click();
	});

	it('Ruler Toggle', function() {
		cy.cGet('#showruler').should('be.visible');
		cy.cGet('#showruler-input').should('be.visible').should('not.be.checked');
		cy.cGet('.cool-ruler').should('not.be.visible');

		cy.cGet('#showruler-input').check();
		cy.cGet('#showruler-input').should('be.checked');
		cy.cGet('.cool-ruler').should('be.visible');

		cy.cGet('#showruler-input').uncheck();
		cy.cGet('#showruler-input').should('not.be.checked');
		cy.cGet('.cool-ruler').should('not.be.visible');
	});
});

describe(['tagdesktop'], 'Notebookbar review operations.', function() {
	it.skip('Go to the next change', function() {
		// Given a document where the first redline is inside a table:
		helper.setupAndLoadDocument('writer/notebookbar-redline.odt');
		desktopHelper.switchUIToNotebookbar();
		cy.viewport(1920,1080);

		// When going to the next redline:
		cy.cGet('#Review-tab-label').click();
		cy.cGet('#Review-tab-label').should('have.class', 'selected');
		cy.cGet('#overflow-button-review-tracking .arrowbackground').click();
		cy.cGet('#review-next-tracked-change-button').click();
		cy.cGet('#Table-tab-label').should('not.have.class', 'hidden');

		// Then make sure that by the time the Table tab is visible, the Review tab is still
		// selected:
		// Without the accompanying fix in place, this test would have failed with:
		// AssertionError: Timed out retrying after 10000ms: expected '<button#Review-tab-label.ui-tab.notebookbar>' to have class 'selected'
		cy.cGet('#Review-tab-label').should('have.class', 'selected');
	});
});

describe(['tagdesktop'], 'HideChangeTrackingControls mode tests.', function() {
	it('Check that track change controls are not shown', function() {
		helper.setupAndLoadDocument('writer/hide_change_tracking_controls.odt', /* isMultiUser */ false, /* copyCertificates copies .wopi.json */ true);
		desktopHelper.switchUIToNotebookbar();
		cy.viewport(1920,1080);

		cy.cGet('.notebookbar #Review-tab-label').click();
		cy.cGet('.notebookbar #Review-container').should('exist');
		cy.cGet('.notebookbar #review-tracking').should('not.exist');
		cy.cGet('.notebookbar .unoTrackChanges').should('not.exist');
		cy.cGet('.notebookbar .unoShowTrackedChanges').should('not.exist');
		cy.cGet('.notebookbar .unoNextTrackedChange').should('not.exist');
		cy.cGet('.notebookbar .unoPreviousTrackedChange').should('not.exist');
		cy.cGet('.notebookbar .unoAcceptTrackedChangeToNext').should('not.exist');
		cy.cGet('.notebookbar .unoRejectTrackedChangeToNext').should('not.exist');
		cy.cGet('.notebookbar .unoReinstateTrackedChange').should('not.exist');
		cy.cGet('.notebookbar .unoAcceptTrackedChanges').should('not.exist');
	});
});
