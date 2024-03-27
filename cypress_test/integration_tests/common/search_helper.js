/* global cy */

// Search bar related helper methods for mobile.

// Make the searchbar visible on the bottom toolbar.
function showSearchBar() {
	cy.log('>> showSearchBar - start');

	cy.cGet('#tb_editbar_item_showsearchbar .w2ui-button').click();
	cy.cGet('input#search-input').should('be.visible');
	cy.cGet('#tb_editbar_item_bold .w2ui-button').should('not.be.visible');
	cy.cGet('#tb_searchbar_item_searchprev').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('not.be.visible');

	cy.log('<< showSearchBar - end');
}

// Type some text into the search field, which will
// trigger searching automatically.
// Parameters:
// text - the text to type in
function tpyeIntoSearchField(text) {
	cy.log('>> tpyeIntoSearchField - start');

	cy.cGet('input#search-input').clear().type(text);
	cy.cGet('input#search-input').should('have.prop', 'value', text);
	cy.cGet('#tb_searchbar_item_searchprev').should('not.have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('not.have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('be.visible');

	cy.log('<< tpyeIntoSearchField - end');
}

function typeIntoSearchFieldDesktop(text) {
	cy.log('>> typeIntoSearchFieldDesktop - start');

	cy.cGet('input#search-input').clear().type(text);
	cy.cGet('input#search-input').should('have.prop', 'value', text);
	cy.cGet('#searchprev').should('not.have.attr', 'disabled');
	cy.cGet('#searchnext').should('not.have.attr', 'disabled');
	cy.cGet('#cancelsearch').should('be.visible');

	cy.log('<< typeIntoSearchFieldDesktop - end');
}

// Move to the next search result in the document.
function searchNext() {
	cy.log('>> searchNext - start');

	cy.cGet('#tb_searchbar_item_searchnext').click();

	cy.log('<< searchNext - end');
}

function searchNextDesktop() {
	cy.log('>> searchNextDesktop - start');

	cy.cGet('#searchnext').click();

	cy.log('<< searchNextDesktop - end');
}

// Move to the previous search result in the document.
function searchPrev() {
	cy.log('>> searchPrev - start');

	cy.cGet('#tb_searchbar_item_searchprev').click();

	cy.log('<< searchPrev - end');
}

function searchPrevDesktop() {
	cy.log('>> searchPrevDesktop - start');

	cy.cGet('#searchprev').click();

	cy.log('<< searchPrevDesktop - end');
}

// Cancel search with the specified text.
// This will remove the search string from the input field.
function cancelSearch() {
	cy.log('>> cancelSearch - start');

	cy.cGet('#tb_searchbar_item_cancelsearch').click();
	cy.cGet('input#search-input').should('have.prop', 'value', '');
	cy.cGet('#tb_searchbar_item_searchprev').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('not.be.visible');

	cy.log('<< cancelSearch - end');
}

function cancelSearchDesktop() {
	cy.log('>> cancelSearchDesktop - start');

	cy.cGet('#toolbar-down #cancelsearch').click();
	cy.cGet('input#search-input').should('have.prop', 'value', '');
	cy.cGet('#toolbar-down #searchprev').should('have.attr', 'disabled');
	cy.cGet('#toolbar-down #searchnext').should('have.attr', 'disabled');
	cy.cGet('#toolbar-down #cancelsearch').should('not.be.visible');

	cy.log('<< cancelSearchDesktop - end');
}

// Hide the searchbar from the bottom toolbar.
function closeSearchBar() {
	cy.log('>> closeSearchBar - start');

	cy.cGet('#tb_searchbar_item_hidesearchbar').click();
	cy.cGet('input#search-input').should('not.be.visible');
	cy.cGet('#tb_editbar_item_bold .w2ui-button').should('be.visible');

	cy.log('<< closeSearchBar - end');
}

module.exports.showSearchBar = showSearchBar;
module.exports.tpyeIntoSearchField = tpyeIntoSearchField;
module.exports.typeIntoSearchFieldDesktop = typeIntoSearchFieldDesktop;
module.exports.searchNext = searchNext;
module.exports.searchNextDesktop = searchNextDesktop;
module.exports.searchPrev = searchPrev;
module.exports.searchPrevDesktop = searchPrevDesktop;
module.exports.cancelSearch = cancelSearch;
module.exports.cancelSearchDesktop = cancelSearchDesktop;
module.exports.closeSearchBar = closeSearchBar;
