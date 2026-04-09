/* global describe it cy require expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Compare Changes view with comments.', function() {

	function enterCompareChangesMode() {
		desktopHelper.getNbIconArrow('TrackChanges', 'Review').click();
		cy.cGet('#compare-tracked-change-button').filter(':visible').click();
		cy.cGet('#compare-tracked-change-entry-1').click();
		cy.cGet('.compare-changes-labels').should('not.have.css', 'display', 'none');
	}

	it('Comment does not overlap with page or sidebar.', function() {
		// Given a document with a comment, sidebar is visible:
		cy.viewport(1400, 600);
		helper.setupAndLoadDocument('writer/track_changes_comment.docx');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#Review-tab-label').click();
		cy.cGet('#sidebar-dock-wrapper').should('be.visible');

		// When changing to doc compare mode:
		enterCompareChangesMode();
		cy.getFrameWindow().then(function(win) {
			helper.processToIdle(win);
		});
		cy.cGet('#comment-container-1').should('exist');

		// Then make sure that we have the pages, then the comment, then the sidebar, with
		// no overlaps:
		cy.getFrameWindow().then(function(win) {
			var layout = win.app.activeDocument.activeLayout;
			var rightEdgePoint = new win.cool.SimplePoint(win.app.activeDocument.fileSize.pX, 0);
			rightEdgePoint.mode = 2; // TileMode.RightSide
			var rightPageEdge = layout.documentToViewX(rightEdgePoint) / win.app.dpiScale;

			cy.cGet('#comment-container-1').should(function($el) {
				expect($el.position().left, 'comment left vs right page edge').to.be.at.least(rightPageEdge);
			});
		});
		cy.cGet('#sidebar-dock-wrapper').then(function($sidebar) {
			var sidebarLeft = $sidebar[0].getBoundingClientRect().left;

			cy.cGet('#comment-container-1').should(function($el) {
				var commentRight = $el[0].getBoundingClientRect().right;
				// Without the accompanying fix in place, this test would have failed with:
				// - comment right vs sidebar left: expected 1290 to be at most 1071
				// while normally it's around 1015.
				expect(commentRight, 'comment right vs sidebar left').to.be.at.most(sidebarLeft);
			});
		});
	});
});
