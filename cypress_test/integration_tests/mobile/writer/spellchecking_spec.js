/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var writerHelper = require('../../common/writer_helper');

describe('Spell checking menu.', function() {
	var testFileName = 'spellchecking.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openContextMenu() {
		// Do a new selection
		writerHelper.selectAllTextOfDoc();

		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(markers) {
				expect(markers.length).to.have.greaterThan(1);
				for (var i = 0; i < markers.length; i++) {
					if (markers[i].classList.contains('leaflet-selection-marker-start')) {
						var startPos = markers[i].getBoundingClientRect();
					} else if (markers[i].classList.contains('leaflet-selection-marker-end')) {
						var endPos = markers[i].getBoundingClientRect();
					}
				}

				// Remove selection
				helper.typeIntoDocument('{downarrow}');

				helper.textSelectionShouldNotExist();

				var XPos = startPos.right + 10;
				var YPos = endPos.top - 10;
				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.get('#mobile-wizard-content')
			.should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'hello')
			.click();

		writerHelper.selectAllTextOfDoc();

		helper.expectTextForClipboard('hello');
	});

	it('Ignore one.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'Ignore')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste');
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

	it.skip('Check language status for selection.', function() {
		openContextMenu();

		cy.contains('.menu-entry-with-icon', 'Set Language for Selection')
			.click();

		// English is selected
		cy.contains('.ui-content[title="Set Language for Selection"] .menu-entry-checked', 'English (USA)')
			.should('be.visible');
	});

	it.skip('Set None Language for selection.', function() {
		openContextMenu();

		cy.contains('.menu-entry-with-icon', 'Set Language for Selection')
			.click();

		cy.contains('.ui-content[title="Set Language for Selection"] .menu-entry-with-icon', 'None (Do not check spelling)')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});

	it.skip('Check language status for paragraph.', function() {
		openContextMenu();

		cy.contains('.menu-entry-with-icon', 'Set Language for Paragraph')
			.click();

		// English is selected
		cy.contains('.ui-content[title="Set Language for Paragraph"] .menu-entry-checked', 'English (USA)')
			.should('be.visible');
	});

	it.skip('Set None Language for paragraph.', function() {
		openContextMenu();

		cy.contains('.menu-entry-with-icon', 'Set Language for Paragraph')
			.click();

		cy.contains('.ui-content[title="Set Language for Paragraph"] .menu-entry-with-icon', 'None (Do not check spelling)')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});
});
