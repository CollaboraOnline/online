/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Searching via quickfind in navigation panel' ,function() {

    beforeEach(function() {
        helper.setupAndLoadDocument('writer/search_bar.odt');
    });

    it('Search existing word.', function() {
        writerHelper.openQuickFind();
        writerHelper.searchInQuickFind('a');

        // Highlight the first hit
        helper.textSelectionShouldExist();

        writerHelper.assertQuickFindMatches(2);
    });

    it('Search not existing word.', function() {
        writerHelper.selectAllTextOfDoc();
        writerHelper.openQuickFind();
        writerHelper.searchInQuickFind('q');
        helper.textSelectionShouldNotExist();
    });

    it('Search existing word in table.', function() {
        writerHelper.openQuickFind();
        writerHelper.searchInQuickFind('b'); // check character inside table

        // Part of the text should be selected
        helper.textSelectionShouldExist();

        writerHelper.assertQuickFindMatches(5);

    });

    it('Search input should keep the focus after a part change', function() {
        helper.typeIntoDocument('{ctrl}f');

        cy.cGet('body').type('Off');
        cy.wait(1000);
        helper.assertFocus('id', 'navigator-search-input');

        cy.cGet('body').type('i');
        cy.wait(1000);
        helper.assertFocus('id', 'navigator-search-input');
    });

    it('Ctrl F should open and focus quickfind', function() {
        helper.typeIntoDocument('{ctrl}f');
        cy.cGet('#quickfind-dock-wrapper').should('be.visible');
        helper.assertFocus('id', 'navigator-search-input');
    });
});
