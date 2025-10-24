/* global describe it cy beforeEach require*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Spell checking menu.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/spellchecking.odp');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	function openContextMenu() {
		cy.cGet('#document-canvas').click('center');
		cy.wait(500);
		cy.cGet('#document-canvas').dblclick('center');
		cy.wait(500);

		helper.typeIntoDocument('{leftArrow}');

		helper.textSelectionShouldNotExist();

		// Open context menu
		cy.cGet('#document-canvas').trigger('contextmenu', 'center');

		cy.cGet('#mobile-wizard-content').should('be.visible');
	}

	it('Apply suggestion.', function() {
		helper.setDummyClipboardForCopy();
		openContextMenu();

		cy.cGet('body').contains('.context-menu-link', 'hello').click();
		impressHelper.selectTextOfShape();
		helper.copy();

		helper.expectTextForClipboard('hello');
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.cGet('.context-menu-link').should('exist'); // Try to wait for it.
		cy.cGet('body').contains('.context-menu-link', 'Ignore All').click(); // Click now.

		openContextMenu();

		cy.cGet('.context-menu-link').should('exist');
		// We don't get the spell check context menu any more
		cy.cGet('body').contains('.context-menu-link', 'Paste').should('be.visible');
	});
});
