/* global cy */

function showSearchBar() {
	cy.get('#tb_editbar_item_showsearchbar')
		.click();

	cy.get('input#search-input')
		.should('be.visible');

	cy.get('#tb_editbar_item_bold')
		.should('not.be.visible');

	cy.get('#tb_searchbar_item_searchprev')
		.should('have.class', 'disabled');

	cy.get('#tb_searchbar_item_searchnext')
		.should('have.class', 'disabled');

	cy.get('#tb_searchbar_item_cancelsearch')
		.should('not.be.visible');
}

function tpyeIntoSearchField(text) {
	cy.get('input#search-input')
		.clear()
		.type(text);

	cy.get('input#search-input')
		.should('have.prop', 'value', text);

	cy.get('#tb_searchbar_item_searchprev')
		.should('not.have.class', 'disabled');

	cy.get('#tb_searchbar_item_searchnext')
		.should('not.have.class', 'disabled');

	cy.get('#tb_searchbar_item_cancelsearch')
		.should('be.visible');
}

function searchNext() {
	cy.get('#tb_searchbar_item_searchnext')
		.click();
}

function searchPrev() {
	cy.get('#tb_searchbar_item_searchnext')
		.click();
}

function cancelSearch() {
	cy.get('#tb_searchbar_item_cancelsearch')
		.click();

	cy.get('input#search-input')
		.should('have.prop', 'value', '');

	cy.get('#tb_searchbar_item_searchprev')
		.should('have.class', 'disabled');

	cy.get('#tb_searchbar_item_searchnext')
		.should('have.class', 'disabled');

	cy.get('#tb_searchbar_item_cancelsearch')
		.should('not.be.visible');
}

function closeSearchBar() {
	cy.get('#tb_searchbar_item_hidesearchbar')
		.click();

	cy.get('input#search-input')
		.should('not.be.visible');

	cy.get('#tb_editbar_item_bold')
		.should('be.visible');
}

module.exports.showSearchBar = showSearchBar;
module.exports.tpyeIntoSearchField = tpyeIntoSearchField;
module.exports.searchNext = searchNext;
module.exports.searchPrev = searchPrev;
module.exports.cancelSearch = cancelSearch;
module.exports.closeSearchBar = closeSearchBar;
