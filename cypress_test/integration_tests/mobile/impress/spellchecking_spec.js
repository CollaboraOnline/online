/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var impress = require('../../common/impress');

describe('Spell checking menu.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('spellchecking.odp', 'impress');

		// Click on edit button
		helper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll('spellchecking.odp');
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

		cy.get('.leaflet-cursor.blinking-cursor')
			.should('exist');

		helper.selectAllText(false);

		// Open context menu
		cy.get('.leaflet-marker-icon')
			.then(function(markers) {
				expect(markers.length).to.have.greaterThan(1);
				for (var i = 0; i < markers.length; i++) {
					if (markers[i].classList.contains('leaflet-selection-marker-start')) {
						var XPos = markers[i].getBoundingClientRect().right + 10;
					} else if (markers[i].classList.contains('leaflet-selection-marker-end')) {
						var YPos = markers[i].getBoundingClientRect().top - 10;
					}
				}

				cy.get('.leaflet-cursor.blinking-cursor')
					.should('exist');

				// Remove selection
				cy.get('body')
					.type('{leftarrow}');
				cy.get('.leaflet-marker-icon')
					.should('not.exist');

				helper.longPressOnDocument(XPos, YPos);
			});

		cy.get('#mobile-wizard-content')
			.should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		cy.get('.context-menu-link')
			.contains('hello')
			.click();

		impress.copyShapeContentToClipboard();

		cy.get('#copy-paste-container pre')
			.then(function(item) {
				expect(item).to.have.lengthOf(1);
				expect(item[0].innerText).to.have.string('hello');
			});
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.get('.context-menu-link')
			.contains('Ignore All')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.get('.context-menu-link')
			.contains('Paste');
	});

	it('Apply language for word.', function() {
		openContextMenu();

		cy.get('.context-menu-link')
			.contains('Word is Finnish')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.get('.context-menu-link')
			.contains('Paste');
	});

	it('Apply language for paragraph.', function() {
		openContextMenu();

		cy.get('.context-menu-link')
			.contains('Paragraph is Finnish')
			.click();

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.get('.context-menu-link')
			.contains('Paste');
	});
});
