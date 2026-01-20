/* -*- js-indent-level: 8 -*- */
/* global describe it cy beforeEach require Cypress expect */

var helper = require('../../common/helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Track Changes', function () {

	beforeEach(function () {
		cy.viewport(1400, 600);
		helper.setupAndLoadDocument('writer/track_changes.odt');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up [id^="sidebar"] button:visible').click();
		desktopHelper.selectZoomLevel('50', false);
	});

	function confirmChange(action) {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).click();
		cy.cGet('#menu-changesmenu').should($el => { expect(Cypress.dom.isDetached($el)).to.eq(false); }).contains(action).click();
		cy.cGet('body').type('{esc}');
		cy.cGet('#menu-changesmenu').should('not.be.visible');
	}

	//enable record for track changes
	function enableRecord() {
		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Record').click();

		cy.cGet('body').type('{esc}');

		cy.cGet('#menu-editmenu').click();
		cy.cGet('#menu-changesmenu').click();
		cy.cGet('#menu-changesmenu').contains('Record').should('have.class', 'lo-menu-item-checked');

		//to close
		cy.cGet('#menu-changesmenu').click();
	}

	it('Accept All', function () {
		helper.typeIntoDocument('Hello World');
		cy.wait(3000);
		for (var n = 0; n < 2; n++) {
			desktopHelper.getCompactIconArrow('DefaultNumbering').click();
			cy.cGet('#insertannotation').click();
			cy.cGet('#annotation-modify-textarea-new').type('some text' + n, { force: true });
			cy.cGet('#annotation-save-new').click({force: true});
			cy.cGet('.jsdialog-overlay').click();
			// Wait for animation
			cy.wait(500);
		}
		enableRecord();

		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		cy.cGet('#insertannotation').click();
		cy.cGet('#annotation-modify-textarea-new').type('some text2', { force: true });
		cy.cGet('#annotation-save-new').click({force: true});
		cy.cGet('.jsdialog-overlay').click();
		cy.wait(500);
		helper.typeIntoDocument('{home}');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2 .cool-annotation-menubar .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item', 'Remove').click();
		cy.cGet('#comment-container-2').should('have.class','tracked-deleted-comment-show');
		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		confirmChange('Accept All');
		cy.cGet('#comment-container-1').should('contain','some text0');
		cy.cGet('#comment-container-2').should('not.exist');
		cy.cGet('#comment-container-3').should('contain','some text2');
		cy.cGet('div.cool-annotation').should('have.length', 2);

		helper.clearAllText();
		helper.selectAllText();
		cy.wait(500);
		confirmChange('Accept All');
		helper.typeIntoDocument('{ctrl}a');
		cy.wait(500);
		helper.textSelectionShouldNotExist();
	});

	it('Reject All', function () {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('Hello World');
		cy.wait(3000);
		for (var n = 0; n < 2; n++) {
			desktopHelper.getCompactIconArrow('DefaultNumbering').click();
			cy.cGet('#insertannotation').click();
			cy.cGet('#annotation-modify-textarea-new').type('some text' + n, { force: true });
			cy.cGet('#annotation-save-new').click({force: true});
			cy.cGet('.jsdialog-overlay').click();
			// Wait for animation
			cy.wait(500);
		}
		enableRecord();

		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		cy.cGet('#insertannotation').click();
		cy.cGet('#annotation-modify-textarea-new').type('some text2', { force: true });
		cy.cGet('#annotation-save-new').click({force: true});
		cy.cGet('.jsdialog-overlay').click();
		cy.wait(500);
		helper.typeIntoDocument('{home}');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2 .cool-annotation-menubar .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item', 'Remove').click();
		cy.cGet('#comment-container-2').should('have.class','tracked-deleted-comment-show');
		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		confirmChange('Reject All');
		cy.cGet('#comment-container-1').should('contain','some text0');
		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2').should('not.have.class','tracked-deleted-comment-show');
		cy.cGet('#comment-container-3').should('not.exist');
		cy.cGet('div.cool-annotation').should('have.length', 2);

		helper.clearAllText();
		helper.selectAllText();
		cy.wait(500);
		confirmChange('Reject All');
		cy.cGet('#document-container').click();
		helper.selectAllText();
		cy.wait(500);
		helper.copy();
		helper.expectTextForClipboard('Hello World');
	});

	it('Compare documents', function () {
		// Given an ~empty (new) document:
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#Review-tab-label').click();

		// When comparing it with an old document that has some content:
		// Without the accompanying fix in place, this test would have failed with:
		// - Timed out retrying after 10000ms: Expected to find element: #Review-container .unoCompareDocuments, but never found it.
		// i.e. the notebookbar didn't have a doc compare button.
		cy.cGet('#Review-container .unoCompareDocuments').filter(':visible').click();
		cy.cGet('#comparedocuments[type=file]').attachFile({ filePath: 'desktop/writer/track_changes_old.odt', encoding: 'binary' });

		// Then make sure the manage changes dialog finds a deletion:
		cy.cGet('#AcceptRejectChangesDialog img.swresredline_deletedimg').should('be.visible');
	});

	it.skip('Comment Undo-Redo', function () {
		for (var n = 0; n < 2; n++) {
			desktopHelper.getCompactIconArrow('DefaultNumbering').click();
			cy.cGet('#insertannotation').click();
			cy.cGet('#annotation-modify-textarea-new').type('some text' + n);
			cy.cGet('#annotation-save-new').click();
			cy.cGet('.jsdialog-overlay').click();
			// Wait for animation
			cy.wait(500);
		}
		enableRecord();

		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		cy.cGet('#insertannotation').click();
		cy.cGet('#annotation-modify-textarea-new').type('some text2');
		cy.cGet('#annotation-save-new').click();
		cy.wait(500);
		helper.typeIntoDocument('{home}');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		// simple undo
		cy.cGet('#undo').click();
		cy.cGet('#comment-container-3').should('not.exist');
		cy.cGet('div.cool-annotation').should('have.length', 2);

		// simple redo
		cy.wait(500);
		cy.cGet('#redo').click();
		// cy.wait(500);
		cy.cGet('#map').focus();
		helper.typeIntoDocument('{home}');
		cy.cGet('#comment-container-3').should('contain','some text2');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		// undo removed comment
		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2 .cool-annotation-menubar .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item', 'Remove').click();
		cy.cGet('#comment-container-2').should('have.class','tracked-deleted-comment-show');
		cy.cGet('div.cool-annotation').should('have.length', 3);
		cy.cGet('#undo').click();

		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2').should('not.have.class','tracked-deleted-comment-show');
		cy.cGet('div.cool-annotation').should('have.length', 3);

		// redo
		cy.cGet('#redo').click();
		cy.wait(500);

		cy.cGet('#comment-container-2').should('contain','some text1');
		cy.cGet('#comment-container-2').should('have.class','tracked-deleted-comment-show');
		cy.cGet('div.cool-annotation').should('have.length', 3);

	});
});

/* vim:set shiftwidth=8 softtabstop=8 noexpandtab: */
