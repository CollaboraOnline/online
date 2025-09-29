/* global describe it cy beforeEach require */  
  
var helper = require('../../common/helper');  
  
describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Replace Dialog Tests', function() {  
    beforeEach(function() {  
        helper.setupAndLoadDocument('writer/search_bar.odt');  
    });  
      
    it('Ctrl H should open search dialog with replace tab active', function() {
        helper.typeIntoDocument('{ctrl}h');
        cy.cGet('#FindReplaceDialog').should('be.visible');

        // Verify that the replace tab is active
        cy.cGet('#replace_tab_btn').should('have.class', 'checked');
        // Verify that the replace input field is visible
        cy.cGet('#FindReplaceDialog.jsdialog input#replaceterm-input-dialog').should('be.visible');
        // Verify that the focus is on find input field
        cy.cGet('#FindReplaceDialog.jsdialog input#searchterm-input-dialog').should('be.focused');
    });

    it('Replace button should open search dialog with replace tab active', function() {
        cy.viewport(1920,1080);
        // Click the Replace button from the notebookbar
        cy.cGet('#home-search-dialog-button').click();
        cy.cGet('#FindReplaceDialog').should('be.visible');

        // Verify that the replace tab is active
        cy.cGet('#replace_tab_btn').should('have.class', 'checked');
        // Verify that the replace input field is visible
        cy.cGet('#FindReplaceDialog.jsdialog input#replaceterm-input-dialog').should('be.visible');
        // Verify that the focus is on find input field
        cy.cGet('#FindReplaceDialog.jsdialog input#searchterm-input-dialog').should('be.focused');
    });
});