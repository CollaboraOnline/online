/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Calc spell checking menu.', function() {
	var origTestFileName = 'spellchecking.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openContextMenu() {
		// Click and then long press on first cell
		cy.cGet('#map')
			.then(function(items) {
				expect(items).to.have.lengthOf(1);
				var XPos = items[0].getBoundingClientRect().left + 10;
				var YPos = items[0].getBoundingClientRect().top + 10;
				cy.cGet('body').click(XPos, YPos);
				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.cGet('#mobile-wizard-content').should('be.visible');
	}

	it('Apply suggestion.', function() {
		helper.setDummyClipboardForCopy();
		openContextMenu();
		cy.cGet('body').contains('.context-menu-link', 'hello').click();

		calcHelper.assertSheetContents(['hello'], true);

		// We don't get the spell check context menu any more
		openContextMenu();
		cy.cGet('body').contains('.context-menu-link', 'Paste').should('be.visible');
	});

	it('Ignore all.', function() {
		helper.setDummyClipboardForCopy();
		openContextMenu();
		cy.cGet('body').contains('.context-menu-link', 'Ignore All').click();

		calcHelper.assertSheetContents(['helljo'], true);

		// We don't get the spell check context menu any more
		openContextMenu();
		cy.cGet('body').contains('.context-menu-link', 'Paste').should('be.visible');
	});
});
