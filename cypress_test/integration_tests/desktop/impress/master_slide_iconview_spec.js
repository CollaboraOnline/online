/* global describe it cy require beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Master Slide Iconview Tests', function() {
    const openExpander = () => {
        cy.cGet('#masterpageall_icons-expand-button').should('be.visible');
        cy.cGet('#masterpageall_icons-expand-button').click();
        desktopHelper.getDropdown('masterpageall_icons').should('exist');
        cy.cGet('.jsdialog #masterpageall_icons').should('be.visible');
    }

    beforeEach(function() {
        cy.viewport(1920, 1080);
        helper.setupAndLoadDocument('impress/masterpagepreview.odp');
        desktopHelper.switchUIToNotebookbar();
        cy.cGet('#Design-tab-label').click();
        cy.cGet('#masterpageall_icons').should('be.visible');
    });

    it('Scroll Up/Down Buttons', function() {
        cy.cGet('#masterpageall_icons-scroll-up').should('be.visible');
        cy.cGet('#masterpageall_icons-scroll-down').should('be.visible');

        cy.cGet('.notebookbar #masterpageall_icons-iconview .ui-iconview-entry')
            .first().should('be.visible');
    });

    it('Expander Button', function() {
        openExpander();
        cy.cGet('.jsdialog #masterpageall_icons .ui-iconview-entry')
            .first().should('be.visible');
    });

    it('Resize', function() {
        // verify dropdown closes on width resize
        openExpander();
        cy.cGet('.jsdialog #masterpageall_icons').should('be.visible');
        cy.viewport(650, 1080);
        cy.cGet('.jsdialog #masterpageall_icons').should('not.exist');

        // making sure the dialog opens at multiple widths
        // width: 1920px
        cy.viewport(1920, 1080);
        openExpander();
        cy.cGet('.jsdialog #masterpageall_icons .ui-iconview-entry')
            .first().should('be.visible');

        // width: 900px
        cy.viewport(900, 1080);
        openExpander();
        cy.cGet('.jsdialog #masterpageall_icons .ui-iconview-entry')
            .first().should('be.visible');

        // NOTE: only 2 master slides in this document — too few for row overflow,
        // so height-based visibility testing wont fire.
    });
});