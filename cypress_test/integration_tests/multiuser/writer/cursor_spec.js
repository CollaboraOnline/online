/* global describe it cy beforeEach require expect */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var writerHelper = require('../../common/writer_helper.js');

describe(['tagmultiuser'], 'Check cursor and view behavior', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/cursor_jump.odt', true);
		desktopHelper.switchUIToNotebookbar();
	});

	it('Show user name on mouse hover over other view cursor', function() {
		// Given a view cursor for the second iframe which is currently not visible:
		// Move cursor in first view to make sure it was shown already once in the second
		// view.
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('{rightArrow}');

		cy.cSetActiveFrame('#iframe2');
		// Wait for the cursor header to appear (shown when cursor moves), then
		// wait for it to auto-hide.
		cy.cGet('#canvas-container .html-object-section').should('contain.text', 'LocalUser');
		cy.cGet('#canvas-container .html-object-section').should('not.contain.text', 'LocalUser');

		// When moving the mouse over the view cursor in the second view:
		cy.getFrameWindow().then((win) => {
			const cursorSections = win.app.sectionContainer.sections.filter(
				(s) => s.name.startsWith('OtherViewCursor ')
			);
			expect(cursorSections.length).to.be.greaterThan(0);

			const cursorSection = cursorSections[0];
			// Get the cursor's position in CSS pixels relative to canvas.
			const x = cursorSection.myTopLeft[0] / win.app.dpiScale;
			const y = cursorSection.myTopLeft[1] / win.app.dpiScale;

			// Get canvas bounding rect to calculate viewport-relative coordinates.
			const canvas = win.document.getElementById('document-canvas');
			const rect = canvas.getBoundingClientRect();

			// Dispatch mouse events manually, which work on the canvas.
			const mouseEnterEvent = new win.MouseEvent('mouseenter', {
				clientX: rect.left + x,
				clientY: rect.top + y,
				bubbles: true,
				cancelable: true,
				view: win
			});
			canvas.dispatchEvent(mouseEnterEvent);
			const mouseMoveEvent = new win.MouseEvent('mousemove', {
				clientX: rect.left + x,
				clientY: rect.top + y,
				bubbles: true,
				cancelable: true,
				view: win
			});
			canvas.dispatchEvent(mouseMoveEvent);
		});

		// Then make sure that the cursor header appears on mouse enter:
		// Without the accompanying fix in place, this test would have failed with:
		// Timed out retrying after 10000ms: expected '[
		// <div.html-object-section.text-selection-handle-start>, 3 more... ]' to contain
		// text 'LocalUser', but the text was ''
		cy.cGet('#canvas-container .html-object-section')
			.should('contain.text', 'LocalUser');
	});

	it('Do not center the view if cursor is already visible', function() {
		// second view follow the first one
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#userListHeader').click();
		cy.cGet('.user-list-item').eq(1).click();
		cy.cGet('.jsdialog-overlay').should('not.exist');
		desktopHelper.assertScrollbarPosition('vertical', 0, 30);

		// first view goes somewhere down
		cy.cSetActiveFrame('#iframe1');
		writerHelper.openQuickFind();
		writerHelper.searchInQuickFind('Pellentesque porttitor');
		desktopHelper.assertScrollbarPosition('vertical', 380, 390);

		// verify that second view is scrolled to the editor
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 380, 390);

		// now move cursor a bit in the first view
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('{downArrow}{downArrow}{downArrow}{downArrow}{downArrow}{downArrow}');

		// verify that second view is still at the same position (no jump)
		cy.cSetActiveFrame('#iframe2');
		desktopHelper.assertScrollbarPosition('vertical', 380, 390);
	});
});
