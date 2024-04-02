/* global cy */

// Search bar related helper methods for mobile.

// Make the searchbar visible on the bottom toolbar.
function showSearchBar() {
	cy.log('>> showSearchBar - start');

	cy.cGet('#showsearchbar').click();
	cy.cGet('input#search-input').should('be.visible');
	cy.cGet('#bold').should('not.be.visible');
	cy.cGet('#searchprev').should('have.attr', 'disabled');
	cy.cGet('#searchnext').should('have.attr', 'disabled');
	cy.cGet('#cancelsearch').should('not.be.visible');

	cy.log('<< showSearchBar - end');
}

// Type some text into the search field, which will
// trigger searching automatically.
// Parameters:
// text - the text to type in
function typeIntoSearchField(text) {
	cy.log('>> typeIntoSearchField - start');

	cy.cGet('input#search-input').clear().type(text);
	cy.cGet('input#search-input').should('have.prop', 'value', text);
	cy.cGet('#searchprev').should('not.have.attr', 'disabled');
	cy.cGet('#searchnext').should('not.have.attr', 'disabled');
	cy.cGet('#cancelsearch').should('be.visible');

	cy.log('<< typeIntoSearchField - end');
}

// Move to the next search result in the document.
function searchNext() {
	cy.log('>> searchNext - start');

	cy.cGet('#searchnext').click();

	cy.log('<< searchNext - end');
}

// Move to the previous search result in the document.
function searchPrev() {
	cy.log('>> searchPrev - start');

	cy.cGet('#searchprev').click();

	cy.log('<< searchPrev - end');
}

// Cancel search with the specified text.
// This will remove the search string from the input field.
function cancelSearch() {
	cy.log('>> cancelSearch - start');

	cy.cGet('#cancelsearch').click();
	cy.cGet('input#search-input').should('have.prop', 'value', '');
	cy.cGet('#searchprev').should('have.attr', 'disabled');
	cy.cGet('#searchnext').should('have.attr', 'disabled');
	cy.cGet('#cancelsearch').should('not.be.visible');

	cy.log('<< cancelSearch - end');
}

// Hide the searchbar from the bottom toolbar.
function closeSearchBar() {
	cy.log('>> closeSearchBar - start');

	cy.cGet('#hidesearchbar').click();
	cy.cGet('input#search-input').should('not.be.visible');
	cy.cGet('#bold').should('be.visible');

	cy.log('<< closeSearchBar - end');
}

module.exports.showSearchBar = showSearchBar;
module.exports.typeIntoSearchField = typeIntoSearchField;
module.exports.searchNext = searchNext;
module.exports.searchPrev = searchPrev;
module.exports.cancelSearch = cancelSearch;
module.exports.closeSearchBar = closeSearchBar;
