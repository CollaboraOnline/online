/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Spell checking menu.', function() {
	var origTestFileName = 'spellchecking.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openContextMenu() {
		// Click on the center of the slide to step into text edit mode
		cy.cGet('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.cGet('body').dblclick(XPos, YPos);
			});

		helper.typeIntoDocument('{leftArrow}');

		helper.textSelectionShouldNotExist();

		// Open context menu
		cy.cGet('g path.leaflet-interactive')
			.then(function(shape) {
				expect(shape.length).to.be.equal(1);
				var XPos = (shape[0].getBoundingClientRect().left + shape[0].getBoundingClientRect().right) / 2;
				var YPos = (shape[0].getBoundingClientRect().top + shape[0].getBoundingClientRect().bottom) / 2;

				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.cGet('#mobile-wizard-content').should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		cy.cGet('body').contains('.context-menu-link', 'hello').click();

		impressHelper.selectTextOfShape();

		helper.expectTextForClipboard('hello');
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.cGet('body').contains('.context-menu-link', 'Ignore All').click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.cGet('body').contains('.context-menu-link', 'Paste').should('be.visible');
	});
});
