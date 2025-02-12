/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Scroll through document, modify heading', function() {

	function expandSecion(name) {
		cy.cGet('#contenttree')
			.contains('.jsdialog.sidebar.ui-treeview-cell-text', name)
			.parent() // .ui-treeview-cell-text
			.parent() // .ui-treeview-cell
			.parent() // div - column
			.parent() // .ui-treeview-entry
			.find('.ui-treeview-expander-column')
			.click();
	}

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/navigator.odt');

		cy.cGet('#Navigator-button').click();
	});

	it('Navigator visual test', function() {
		cy.cGet('#contenttree').compareSnapshot('navigator_writer', 0.05);
	});

	it('Jump to element. Navigator -> Document', function() {
		// Expand Tables, Frames, Images
		// Note click()/dblclick() scrolls the contenttree even if it would be not needed to click
		expandSecion('Tables');
		expandSecion('Frames');
		expandSecion('Images');

		//Scroll back to Top
		cy.cGet('#contenttree').scrollTo(0,0);

		// Doubleclick several items, and check if the document is scrolled to the right page
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Feedback').dblclick();
		desktopHelper.assertVisiblePage(2, 2, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Text').dblclick();
		desktopHelper.assertVisiblePage(5, 6, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Replacing').dblclick();
		desktopHelper.assertVisiblePage(7, 7, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Table15').dblclick();
		desktopHelper.assertVisiblePage(2, 2, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Frame39').dblclick();
		desktopHelper.assertVisiblePage(4, 4, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Frame27').dblclick();
		desktopHelper.assertVisiblePage(6, 6, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'graphics3').dblclick();
		desktopHelper.assertVisiblePage(1, 1, 8);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'graphics10').dblclick();
		desktopHelper.assertVisiblePage(5, 5, 8);
	});

	it('Jump to element even when cursor not visible', function() {
		// Expand Tables, Frames, Images
		// Note click()/dblclick() scrolls the contenttree even if it would be not needed to click
		expandSecion('Tables');
		expandSecion('Frames');
		expandSecion('Images');

		//Scroll back to Top
		cy.cGet('#contenttree').scrollTo(0,0);

		// Doubleclick several items, and check if the document is scrolled to the right page
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Feedback').dblclick();
		desktopHelper.assertVisiblePage(2, 2, 8);

		desktopHelper.assertScrollbarPosition('vertical', 55, 70);

		// Scroll document to the top so cursor is no longer visible, that turns following off
		desktopHelper.scrollWriterDocumentToTop();
		desktopHelper.updateFollowingUsers();

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Text').dblclick();
		desktopHelper.assertVisiblePage(5, 6, 8);

		desktopHelper.assertScrollbarPosition('vertical', 235, 250);

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Replacing').dblclick();
		desktopHelper.assertVisiblePage(7, 7, 8);

		desktopHelper.assertScrollbarPosition('vertical', 335, 355);
	});

	it.skip('Jump to element. Document -> Navigator', function() {
		// Move the cursor into elements in Document, and check
		// if navigator contentTree scroll to the element and select that,
		// and if necessary expand contentypes, to make the element visible.

		// Move into a hyperlink
		desktopHelper.pressKey(2, 'pagedown');
		desktopHelper.pressKey(3, 'downArrow');
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'http://www.gnu.org/licenses/gpl.html').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','http://www.gnu.org/licenses/gpl.html');

		// Move into a Table
		desktopHelper.pressKey(2, 'pagedown');
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Table15').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','Table15');

		// Move into a Headings
		// Previous headings was in a section, and navigator selected the section instead.
		desktopHelper.pressKey(3, 'pagedown');
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Introduction').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','Introduction');
		// hyperlinks should be not visible, as they are so far from Introduction
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'http://www.gnu.org/licenses/gpl.html').should('be.not.visible');

		desktopHelper.pressKey(1, 'pagedown');
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Leading zeroes').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','Leading zeroes');

		// Risky: blind click into a big image, because cursor avoid images.
		cy.cGet('.leaflet-layer').click(450,450);
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'graphics36').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','graphics36');

		desktopHelper.pressKey(2, 'pagedown');
		desktopHelper.pressKey(1, 'downArrow');
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Table14').should('be.visible');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','Table14');
	});

	it.skip('Rewrite Heading', function() {
		// Write into a heading, and check if it changed in navigator contentTree.
		desktopHelper.pressKey(7, 'pagedown');
		desktopHelper.pressKey(1, 'A');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','IntroAduction');
	});
});
