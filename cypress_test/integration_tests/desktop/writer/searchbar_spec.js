/* global describe it cy beforeEach expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var searchHelper = require('../../common/search_helper');
var writerHelper = require('../../common/writer_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Searching via search bar' ,function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/search_bar.odt');
	});

	it('Search existing word.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.copy();
		helper.expectTextForClipboard('a');
	});

	it('Search existing word in table.', function() {
		helper.setDummyClipboardForCopy();
		cy.cGet('input#search-input').clear().type('b'); // check character inside table
		cy.wait(500);
		cy.cGet('input#search-input').should('have.focus');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.copy();
		helper.expectTextForClipboard('b');
	});

	it('Search not existing word.', function() {
		writerHelper.selectAllTextOfDoc();
		cy.cGet('input#search-input').clear().type('q');
		cy.cGet('input#search-input').should('have.prop', 'value', 'q');
		cy.cGet('#toolbar-down #searchprev').should('have.attr', 'disabled');
		cy.cGet('#toolbar-down #searchnext').should('have.attr', 'disabled');
		cy.cGet('#toolbar-down #cancelsearch').should('not.be.visible');
		helper.textSelectionShouldNotExist();
	});

	it('Search next / prev instance.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');
		helper.textSelectionShouldExist();
		helper.copy();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		//search next instance
		searchHelper.searchNext();
		helper.copy();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search prev instance
		searchHelper.searchPrev();
		helper.copy();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});
	it('Search wrap at document end.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');
		helper.textSelectionShouldExist();
		helper.copy();
		helper.expectTextForClipboard('a');
		cy.cGet('#copy-paste-container p b').should('not.exist');
		// Search next instance
		searchHelper.searchNext();
		helper.copy();
		cy.cGet('#copy-paste-container p b').should('exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
		// Search next instance, which is in the beginning of the document.
		searchHelper.searchNext();
		helper.copy();
		cy.cGet('#copy-paste-container p b').should('not.exist');
		helper.textSelectionShouldExist();
		helper.expectTextForClipboard('a');
	});

	it('Cancel search.', function() {
		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('a');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.copy();
		helper.expectTextForClipboard('a');

		// Cancel search -> selection removed
		searchHelper.cancelSearch();

		helper.textSelectionShouldNotExist();

		cy.cGet('input#search-input').should('be.visible');
	});

	it('Search when cursor not visible', function() {
		cy.wait(3000);

		desktopHelper.assertScrollbarPosition('vertical', 0, 10);

		cy.getFrameWindow().its('app').then((app) => {
			expect(app.isFollowingOff()).to.be.false;
		});

		helper.setDummyClipboardForCopy();
		searchHelper.typeIntoSearchField('sit');

		// Part of the text should be selected
		helper.textSelectionShouldExist();

		helper.copy();
		helper.expectTextForClipboard('sit');
		desktopHelper.assertScrollbarPosition('vertical', 55, 155);
		desktopHelper.assertVisiblePage(1, 2, 6);

		// Scroll document to the top so cursor is no longer visible, that turns following off
		desktopHelper.scrollWriterDocumentToTop();
		desktopHelper.updateFollowingUsers();

		cy.getFrameWindow().its('app').then((app) => {
			expect(app.isFollowingOff()).to.be.true;
		});

		desktopHelper.assertScrollbarPosition('vertical', 0, 30);

		cy.cGet('#searchnext').click();
		desktopHelper.assertScrollbarPosition('vertical', 130, 230);
		desktopHelper.assertVisiblePage(3, 4, 6);

		cy.cGet('#searchnext').click();
		desktopHelper.assertScrollbarPosition('vertical', 200, 300);
		desktopHelper.assertVisiblePage(3, 4, 6);
	});
});
