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
			// Wait for animation
			cy.wait(500);
		}
		enableRecord();

		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		cy.cGet('#insertannotation').click();
		cy.cGet('#annotation-modify-textarea-new').type('some text2', { force: true });
		cy.cGet('#annotation-save-new').click({force: true});
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
			// Wait for animation
			cy.wait(500);
		}
		enableRecord();

		desktopHelper.getCompactIconArrow('DefaultNumbering').click();
		cy.cGet('#insertannotation').click();
		cy.cGet('#annotation-modify-textarea-new').type('some text2', { force: true });
		cy.cGet('#annotation-save-new').click({force: true});
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

		// And when closing the dialog and entering doc compare mode:
		cy.cGet('#AcceptRejectChangesDialog').parents('.jsdialog-window').find('.ui-dialog-titlebar-close').click();
		cy.cGet('#AcceptRejectChangesDialog').should('not.exist');
		desktopHelper.getNbIconArrow('TrackChanges', 'Review').click();
		cy.cGet('#compare-tracked-change').filter(':visible').click();

		// Then the left label should show the old document name:
		cy.cGet('#compare-changes-left-title').should(function($el) {
			expect($el.text()).to.match(/^track_changes_old\.odt/);
		});
	});

	it('Compare remote documents', function () {
		// Given a document:
		desktopHelper.switchUIToNotebookbar();
		// Switch to the 'Review' tab.
		cy.cGet('#Review-tab-label').click();

		// When getting an Action_CompareDocuments message with a filename:
		cy.getFrameWindow().then(function(win) {
			const message = {
				'MessageId': 'Action_CompareDocuments',
				'Values': {
					'url': 'https://www.example.com/dummy',
					'filename': 'remote_old.odt',
				}
			};
			win.postMessage(JSON.stringify(message), '*');
		});

		// Then the doc compare mode left label should show the old document name:
		// Click on 'Tracking' -> 'View Changes'.
		cy.cGet('#review-tracking').click();
		// If this is visible or not is not interesting, we want to assert the resulting
		// title.
		cy.cGet('#compare-tracked-change').click({force: true});
		cy.cGet('#compare-changes-left-title').should(function($el) {
			expect($el.text()).to.match(/^remote_old\.odt/);
		});
	});

	it('View Changes mode has tiles for both modes', function () {
		// Given a document with tracked changes:
		desktopHelper.switchUIToNotebookbar();
		// No labels by default:
		cy.cGet('.compare-changes-labels').should('have.css', 'display', 'none');

		cy.cGet('#Review-tab-label').click();

		// When entering doc compare mode via View Changes:
		desktopHelper.getNbIconArrow('TrackChanges', 'Review').click();
		cy.cGet('#compare-tracked-change').filter(':visible').click();

		// Then tiles should exist for both mode=1 (LeftSide) and mode=2 (RightSide)
		// with content:
		cy.getFrameWindow().then(function(win) {
			cy.wrap(null).should(function() {
				const tiles = win.TileManager.getTiles();
				let hasMode1 = false;
				let hasMode2 = false;
				tiles.forEach(function(tile) {
					if (tile.coords.mode === 1 && tile.hasContent() && tile.distanceFromView < Number.MAX_SAFE_INTEGER) {
						hasMode1 = true;
					}
					if (tile.coords.mode === 2 && tile.hasContent() && tile.distanceFromView < Number.MAX_SAFE_INTEGER) {
						hasMode2 = true;
					}
				});
				// Without the accompanying fix in place, this test would have failed with:
				// Timed out retrying after 10000ms: mode=1 (LeftSide) tiles with content and valid distance: expected false to be true
				// i.e. left side tiles were missing.
				expect(hasMode1, 'mode=1 (LeftSide) tiles with content and valid distance').to.be.true;
				expect(hasMode2, 'mode=2 (RightSide) tiles with content and valid distance').to.be.true;
			});
		});
		// Labels should be visible:
		cy.cGet('.compare-changes-labels').should('not.have.css', 'display', 'none');
	});

	it('Tooltip position in compare changes mode', function () {
		// Given a document in compare changes mode:
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#Review-tab-label').click();
		desktopHelper.getNbIconArrow('TrackChanges', 'Review').click();
		cy.cGet('#compare-tracked-change').filter(':visible').click();
		cy.cGet('.compare-changes-labels').should('not.have.css', 'display', 'none');

		// When faking a tooltip message for a tracked change on the right side:
		cy.getFrameWindow().then(function(win) {
			win.app.map.uiManager.showDocumentTooltip({
				type: 'generaltooltip',
				text: 'Inserted: LocalUser#0 - 02/11/2026 11:44:56',
				rectangle: '5785, 2293, 1240, 275',
			});
		});

		// Then the tooltip should appear on the right half of the viewport:
		// Without the accompanying fix in place, this test would have failed, the
		// tooltip x position was too small (on the left side, outside the right page).
		// The viewport size is 1400, so the mid point is 700, the good position is 988, the
		// bad one is 671.
		cy.cGet('.ui-tooltip').should(function($el) {
			const left = parseFloat($el.css('left'));
			const viewportMidpoint = Cypress.config('viewportWidth') / 2;
			expect(left, 'tooltip left position').to.be.greaterThan(viewportMidpoint);
		});
	});

	it('Tooltip anchor rectangles in compare changes mode', function () {
		// Given a document in compare changes mode:
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#Review-tab-label').click();
		desktopHelper.getNbIconArrow('TrackChanges', 'Review').click();
		cy.cGet('#compare-tracked-change').filter(':visible').click();
		cy.cGet('.compare-changes-labels').should('not.have.css', 'display', 'none');

		// When faking a tooltip message with anchor rectangles for a deletion:
		cy.getFrameWindow().then(function(win) {
			win.app.map.uiManager.showDocumentTooltip({
				type: 'generaltooltip',
				text: 'Deleted: LocalUser#0 - 02/19/2026 14:54:27',
				rectangle: '1418, 1701, 9971, 529',
				redlineType: 'Delete',
				anchorRectangles: ['1418, 1966, 2390, 264', '2159, 1701, 9231, 264'],
			});
		});

		// Then we should have two tooltip anchor sections, one on each side:
		const viewportMidpoint = Cypress.config('viewportWidth') / 2;
		cy.cGet('[id="test-div-tooltip anchor left"]').should(function(elements) {
			const left = parseFloat(elements[0].style.left);
			// left section position: expected 153 to be below 500
			expect(left, 'left section position').to.be.lessThan(viewportMidpoint);
		});
		cy.cGet('[id="test-div-tooltip anchor right"]').should(function(elements) {
			const left = parseFloat(elements[0].style.left);
			// right section position: expected 786 to be above 500
			expect(left, 'right section position').to.be.greaterThan(viewportMidpoint);
		});
	});

	it.skip('Comment Undo-Redo', function () {
		for (var n = 0; n < 2; n++) {
			desktopHelper.getCompactIconArrow('DefaultNumbering').click();
			cy.cGet('#insertannotation').click();
			cy.cGet('#annotation-modify-textarea-new').type('some text' + n);
			cy.cGet('#annotation-save-new').click();
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
