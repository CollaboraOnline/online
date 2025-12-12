/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Stylesview Iconview Tests', function() {
	// check expand button visibility and click on it
	const openExpander = () => {
		cy.cGet('#stylesview-expand-button').should('exist').should('be.visible');
		cy.cGet('#stylesview-expand-button').click();
		desktopHelper.getDropdown('stylesview').should('exist');
		cy.cGet('.jsdialog #stylesview').should('exist').should('be.visible');
	}

	beforeEach(function() {
		cy.viewport(1920, 1080);
		helper.setupAndLoadDocument('writer/styles.odt');
		desktopHelper.switchUIToNotebookbar();
		desktopHelper.sidebarToggle();
		cy.cGet('.notebookbar #stylesview').should('exist').should('be.visible');
	});

	it('Scroll Up/Down Buttons', function() {
		cy.cGet('#stylesview-scroll-up').should('exist').should('be.visible');
		cy.cGet('#stylesview-scroll-down').should('exist').should('be.visible');
		cy.cGet('#stylesview-iconview_0').should('exist').should('be.visible');

		cy.cGet('#stylesview-scroll-down').click();
		cy.cGet('#stylesview-iconview_0').should('exist').should('not.be.visible');
		cy.cGet('#stylesview-scroll-up').click();
		cy.cGet('#stylesview-iconview_0').should('exist').should('be.visible');
	});

	it('Expander Button', function() {
		openExpander();
		cy.cGet('#stylesview_59').should('exist').should('be.visible'); // Contents 9
		cy.cGet('#stylesview_60').should('exist').should('not.be.visible');
	});

	it('Open Styles Sidebar Button', function() {
		openExpander();

		// open sidebar
		cy.cGet('#format-style-list-dialog-button').should('exist').should('be.visible');
		cy.cGet('#format-style-list-dialog-button').click();

		// close dropdown on button click
		desktopHelper.getDropdown('stylesview').should('not.exist');

		cy.cGet('#StyleListDeck').should('exist').should('be.visible');
	});

	it('Resize', function() {
		// the dropdown should close on resize
		openExpander();
		cy.cGet('.jsdialog #stylesview').should('exist').should('be.visible');
		cy.viewport(650, 1080);
		cy.cGet('.jsdialog #stylesview').should('not.exist');

		// with reduced width, only one column should be visible
		openExpander();
		cy.cGet('#stylesview_11').should('exist').should('be.visible'); // Standardstyckeformatmall
		cy.cGet('#stylesview_12').should('exist').should('not.be.visible');

		// NOTE: changes to the height don't trigger the resize observer,
		// thus the dropdown doesn't disappear. so no need to call
		// `openExpander` again.

		// with reduced height:
		// - only a few rows should be visible.
		// - the open styles sidebar button should be visible.
		cy.viewport(650, 454);
		cy.cGet('#stylesview_6').should('exist').should('be.visible'); // Title
		cy.cGet('#stylesview_7').should('exist').should('not.be.visible'); // Subtitle
		cy.cGet('#format-style-list-dialog-button').should('exist').should('be.visible');
	});
});
