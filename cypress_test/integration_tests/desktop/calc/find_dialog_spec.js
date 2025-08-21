/* global describe it cy beforeEach expect require*/

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var findHelper = require('../../common/find_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Searching via find dialog.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/search_bar.ods');
		cy.wait(500);
		cy.cGet(helper.addressInputSelector).should('have.value', 'A2');
	});

	it('Search existing word.', function() {
		helper.setDummyClipboardForCopy();
		findHelper.openFindDialog();
		findHelper.typeIntoSearchField('a');

		findHelper.findNext();

		// First cell should be selected
		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		findHelper.findNext();
		cy.cGet(helper.addressInputSelector).should('have.value', 'B1');

		findHelper.typeIntoSearchField('c');
		findHelper.findNext();

		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'c');

		findHelper.findNext();
		cy.cGet(helper.addressInputSelector).should('have.value', 'A301');
	});

	it('Search existing word when not following own view', function() {
		desktopHelper.assertScrollbarPosition('vertical', 10, 30);

		cy.getFrameWindow().its('app').then((app) => {
			expect(app.isFollowingOff()).to.be.false;
		});

		desktopHelper.scrollViewDown();

		desktopHelper.assertScrollbarPosition('vertical', 175, 205);

		cy.getFrameWindow().its('app').then((app) => {
			expect(app.isFollowingOff()).to.be.true;
		});

		helper.setDummyClipboardForCopy();
		findHelper.openFindDialog();
		findHelper.typeIntoSearchField('a');

		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		desktopHelper.assertScrollbarPosition('vertical', 10, 30);

		desktopHelper.scrollViewDown();

		findHelper.typeIntoSearchField('c');
		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'C1');
		desktopHelper.assertScrollbarPosition('vertical', 10, 30);
	});

	it('Search not existing word.', function() {
		findHelper.openFindDialog();
		findHelper.typeIntoSearchField('q');

		// Should be no new selection
		cy.cGet(helper.addressInputSelector).should('have.value', 'A2');
	});

	it('Search next / prev instance.', function() {
		helper.setDummyClipboardForCopy();
		findHelper.openFindDialog();
		findHelper.typeIntoSearchField('d');
		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A472');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');

		// Search next instance
		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'D1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');

		// Search prev instance
		findHelper.findPrev();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A472');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'd');
	});

	it('Search wrap at document end', function() {
		helper.setDummyClipboardForCopy();
		findHelper.openFindDialog();
		findHelper.typeIntoSearchField('a');

		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		// Search next instance
		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'B1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');

		// Search next instance, which is in the beginning of the document.
		findHelper.findNext();

		cy.cGet(helper.addressInputSelector).should('have.value', 'A1');
		helper.copy();
		cy.cGet('#copy-paste-container table td').should('have.text', 'a');
	});
});
