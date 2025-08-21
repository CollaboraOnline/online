/* global cy require */

// Find dialog related helper methods
var helper = require('./helper');

// Open the find dialog
function openFindDialog() {
    cy.log('>> openFindDialog - start');

    cy.cGet('.jsdialog-window').should('not.exist');

    helper.typeIntoDocument('{ctrl}f');

    cy.cGet('.jsdialog-window').should('exist');
    cy.cGet('#FindReplaceDialog').should('exist');

    cy.log('<< openFindDialog - end');
}

// Type some text into the search field, which will
// trigger searching automatically.
// Parameters:
// text - the text to type in
function typeIntoSearchField(text) {
    cy.log('>> typeIntoSearchField - start');

    cy.cGet('input#searchterm-input-dialog').clear().type(text);
    cy.cGet('input#searchterm-input-dialog').should('have.prop', 'value', text);

    cy.cGet('#search').should('not.be.disabled');
    cy.cGet('#searchall').should('not.be.disabled'); //doesnt seem to exist in impress
    cy.cGet('#backsearch').should('not.be.disabled');

    cy.log('<< typeIntoSearchField - end');
}

// Move to the next search result in the document.
function findNext() {
    cy.log('>> findNext - start');

    cy.cGet('#search').should('not.have.attr', 'disabled');
    cy.cGet('#search').click();

    cy.log('<< findNext - end');
}

// Move to the previous search result in the document.
function findPrev() {
    cy.log('>> findPrev - start');

    cy.cGet('#backsearch').should('not.have.attr', 'disabled');
    cy.cGet('#backsearch').click();

    cy.log('<< findPrev - end');
}

function closeFindDialog() {
    cy.log('>> closeFindDialog - start');

    cy.cGet('.jsdialog-window').should('exist');
    cy.cGet('#FindReplaceDialog').should('exist');

    cy.cGet('.ui-dialog-titlebar-close').click();

    cy.cGet('.jsdialog-window').should('not.exist');
    cy.cGet('#FindReplaceDialog').should('not.exist');

    cy.log('<< closeFindDialog - end');
}

module.exports.openFindDialog = openFindDialog;
module.exports.typeIntoSearchField = typeIntoSearchField;
module.exports.findNext = findNext;
module.exports.findPrev = findPrev;
module.exports.closeFindDialog = closeFindDialog;
