/* global cy */

// Search bar related helper methods for mobile.

// Make the searchbar visible on the bottom toolbar.
function showSearchBar() {
	cy.cGet('#tb_editbar_item_showsearchbar').click();
	cy.cGet('input#search-input').should('be.visible');
	cy.cGet('#tb_editbar_item_bold').should('not.be.visible');
	cy.cGet('#tb_searchbar_item_searchprev').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('not.be.visible');
}

// Type some text into the search field, which will
// trigger searching automatically.
// Parameters:
// text - the text to type in
function tpyeIntoSearchField(text) {
	cy.cGet('input#search-input').clear().type(text);
	cy.cGet('input#search-input').should('have.prop', 'value', text);
	cy.cGet('#tb_searchbar_item_searchprev').should('not.have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('not.have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('be.visible');
}

function typeIntoSearchFieldDesktop(text) {
	cy.cGet('input#search-input').clear().type(text);
	cy.cGet('input#search-input').should('have.prop', 'value', text);
	cy.cGet('#tb_actionbar_item_searchprev').should('not.have.class', 'disabled');
	cy.cGet('#tb_actionbar_item_searchnext').should('not.have.class', 'disabled');
	cy.cGet('#tb_actionbar_item_cancelsearch').should('be.visible');
}

// Move to the next search result in the document.
function searchNext() {
	cy.cGet('#tb_searchbar_item_searchnext').click();
}

function searchNextDesktop() {
	cy.cGet('#tb_actionbar_item_searchnext').click();
}

// Move to the previous search result in the document.
function searchPrev() {
	cy.cGet('#tb_searchbar_item_searchnext').click();
}

function searchPrevDesktop() {
	cy.cGet('#tb_actionbar_item_searchprev').click();
}

// Cancel search with the specified text.
// This will remove the search string from the input field.
function cancelSearch() {
	cy.cGet('#tb_searchbar_item_cancelsearch').click();
	cy.cGet('input#search-input').should('have.prop', 'value', '');
	cy.cGet('#tb_searchbar_item_searchprev').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_searchnext').should('have.class', 'disabled');
	cy.cGet('#tb_searchbar_item_cancelsearch').should('not.be.visible');
}

function cancelSearchDesktop() {
	cy.cGet('#tb_actionbar_item_cancelsearch').click();
	cy.cGet('input#search-input').should('have.prop', 'value', '');
	cy.cGet('#tb_actionbar_item_searchprev').should('have.class', 'disabled');
	cy.cGet('#tb_actionbar_item_searchnext').should('have.class', 'disabled');
	cy.cGet('#tb_actionbar_item_cancelsearch').should('not.be.visible');
}

// Hide the searchbar from the bottom toolbar.
function closeSearchBar() {
	cy.cGet('#tb_searchbar_item_hidesearchbar').click();
	cy.cGet('input#search-input').should('not.be.visible');
	cy.cGet('#tb_editbar_item_bold').should('be.visible');
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
