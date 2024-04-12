/* global describe it cy beforeEach require afterEach Cypress */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop'], 'Notebookbar tests.', function() {
	var origTestFileName = 'notebookbar.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.showSidebarIfHidden();
		}

		writerHelper.selectAllTextOfDoc();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
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
});
