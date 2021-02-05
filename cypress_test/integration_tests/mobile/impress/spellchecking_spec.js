/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Spell checking menu.', function() {
	var testFileName = 'spellchecking.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openContextMenu() {
		// Click on the center of the slide to step into text edit mode
		cy.get('#document-container')
			.then(function(items) {
				expect(items).to.have.length(1);
				var XPos = (items[0].getBoundingClientRect().left + items[0].getBoundingClientRect().right) / 2;
				var YPos = (items[0].getBoundingClientRect().top + items[0].getBoundingClientRect().bottom) / 2;
				cy.get('body')
					.dblclick(XPos, YPos);
			});

		helper.typeIntoDocument('{leftArrow}');

		helper.textSelectionShouldNotExist();

		// Open context menu
		cy.get('g path.leaflet-interactive')
			.then(function(shape) {
				expect(shape.length).to.be.equal(1);
				var XPos = (shape[0].getBoundingClientRect().left + shape[0].getBoundingClientRect().right) / 2;
				var YPos = (shape[0].getBoundingClientRect().top + shape[0].getBoundingClientRect().bottom) / 2;

				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.get('#mobile-wizard-content')
			.should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'hello')
			.click();

		helper.selectAllText();

		helper.expectTextForClipboard('hello');
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'Ignore All')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});

	it.skip('Apply language for word.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'Word is Finnish')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});

	it.skip('Apply language for paragraph.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'Paragraph is Finnish')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});
});
