/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Transitions Iconview Tests', function() {
	const openExpander = () => {
		cy.cGet('#transitions_icons-expand-button').should('exist').should('be.visible');
		cy.cGet('#transitions_icons-expand-button').click();
		desktopHelper.getDropdown('transitions_icons').should('exist');
		cy.cGet('.jsdialog #transitions_icons').should('exist').should('be.visible');
	}

	beforeEach(function() {
		cy.viewport(1920, 1080);
		helper.setupAndLoadDocument('impress/slideshow.odp');
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#Transition-tab-label').click();
		cy.cGet('#transitions_icons').should('exist').should('be.visible');
	});

	it('Scroll Up/Down Buttons', function() {
		cy.cGet('#transitions_icons-scroll-up').should('exist').should('be.visible');
		cy.cGet('#transitions_icons-scroll-down').should('exist').should('be.visible');
		cy.cGet('#transitions_icons-iconview_0').should('exist').should('be.visible');

		cy.cGet('#transitions_icons-scroll-down').click();
		cy.cGet('#transitions_icons-iconview_0').should('exist').should('not.be.visible');
		cy.cGet('#transitions_icons-scroll-up').click();
		cy.cGet('#transitions_icons-iconview_0').should('exist').should('be.visible');
	});

	it('Expander Button', function() {
		openExpander();
		cy.cGet('#transitions_icons_28').should('exist').should('be.visible');
	});

	it('Resize', function() {
		// verify dropdown closes on width resize
		openExpander();
		cy.cGet('.jsdialog #transitions_icons').should('exist').should('be.visible');
		cy.viewport(650, 1080);
		cy.cGet('.jsdialog #transitions_icons').should('not.exist');

		// varying widths to make sure responsive nature exists
		// width 1: 1300px
		cy.viewport(1300, 1080);
		openExpander();
		cy.cGet('#transitions_icons_27').should('exist').should('be.visible');
		cy.cGet('#transitions_icons_28').should('exist').should('not.be.visible');

		// width 2: 1000px
		cy.viewport(1000, 1080);
		openExpander();
		cy.cGet('#transitions_icons_20').should('exist').should('be.visible');
		cy.cGet('#transitions_icons_21').should('exist').should('not.be.visible');

		// width 3: 650px
		cy.viewport(650, 1080);
		openExpander();
		cy.cGet('#transitions_icons_13').should('exist').should('be.visible');
		cy.cGet('#transitions_icons_14').should('exist').should('not.be.visible');

		// height only
		cy.viewport(650, 570);
		cy.cGet('#transitions_icons_9').should('exist').should('be.visible');
		cy.cGet('#transitions_icons_10').should('exist').should('not.be.visible');
	});
});
