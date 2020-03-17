/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('./calc_helper');

describe('Calc spell checking menu.', function() {
	beforeEach(function() {
		helper.beforeAllMobile('spellchecking.ods', 'calc');

		// Click on edit button
		cy.get('#mobile-edit-button')
			.click();
	});

	afterEach(function() {
		helper.afterAll('spellchecking.ods');
	});

	function openContextMenu() {
		// Step into edit mode
		calcHelper.clickOnFirstCell();
		calcHelper.clickOnFirstCell();

		// Select text content
		cy.get('textarea.clipboard')
			.type('{ctrl}a');

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
				cy.get('textarea.clipboard')
					.type('{leftarrow}');
				cy.get('.leaflet-marker-icon')
					.should('not.exist');

				var XPos = startPos.right + 10;
				var YPos = endPos.top - 10;
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

		// Click outside of the cell
		cy.get('.leaflet-marker-icon')
			.then(function(items) {
				expect(items).to.have.length(2);
				var XPos = items[0].getBoundingClientRect().right;
				var YPos = items[0].getBoundingClientRect().bottom + 10;
				cy.get('body')
					.click(XPos, YPos);
			});

		calcHelper.copyContentToClipboard();

		cy.get('#copy-paste-container table td')
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

		// Click outside of the cell
		cy.get('.leaflet-marker-icon')
			.then(function(items) {
				expect(items).to.have.length(2);
				var XPos = items[0].getBoundingClientRect().right;
				var YPos = items[0].getBoundingClientRect().bottom + 10;
				cy.get('body')
					.click(XPos, YPos);
			});

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

		// Click outside of the cell
		cy.get('.leaflet-marker-icon')
			.then(function(items) {
				expect(items).to.have.length(2);
				var XPos = items[0].getBoundingClientRect().right;
				var YPos = items[0].getBoundingClientRect().bottom + 10;
				cy.get('body')
					.click(XPos, YPos);
			});

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

		// Click outside of the cell
		cy.get('.leaflet-marker-icon')
			.then(function(items) {
				expect(items).to.have.length(2);
				var XPos = items[0].getBoundingClientRect().right;
				var YPos = items[0].getBoundingClientRect().bottom + 10;
				cy.get('body')
					.click(XPos, YPos);
			});

		openContextMenu();

		// We don't get the spell check context menu any more
		cy.get('.context-menu-link')
			.contains('Paste');
	});
});
