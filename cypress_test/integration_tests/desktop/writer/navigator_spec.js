/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe.skip(['tagdesktop'], 'Scroll through document, modify heading', function() {
	var testFileName = 'navigator.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		cy.cGet('#menu-view').click();
		cy.cGet('#menu-navigator').click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Jump to element. Navigator -> Document', function() {
		// Expand Tables, Frames, Images
		// Note click()/dblclick() scrolls the contenttree even if it would be not needed to click
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Tables').parent().prev().click();
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Frames').parent().prev().click();
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Images').parent().prev().click();

		//Scroll back to Top
		cy.cGet('#contenttree').scrollTo(0,0);

		// Doubleclick several items, and check if the document is scrolled to the right page
		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Feedback').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Text').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 5 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Replacing').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 7 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Table15').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 2 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Frame39').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 4 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'Frame27').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 6 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'graphics3').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 1 of 8');

		cy.cGet('#contenttree').contains('.jsdialog.sidebar.ui-treeview-cell-text', 'graphics10').dblclick();
		cy.cGet('#StatePageNumber').should('have.text', 'Page 5 of 8');
	});

	it('Jump to element. Document -> Navigator', function() {
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

	it('Rewrite Heading', function() {
		// Write into a heading, and check if it changed in navigator contentTree.
		desktopHelper.pressKey(7, 'pagedown');
		desktopHelper.pressKey(1, 'A');
		cy.cGet('#contenttree').find('.jsdialog.sidebar.ui-treeview-entry.ui-treeview-notexpandable.selected').find('.jsdialog.sidebar.ui-treeview-cell-text').should('have.text','IntroAduction');
	});
});
