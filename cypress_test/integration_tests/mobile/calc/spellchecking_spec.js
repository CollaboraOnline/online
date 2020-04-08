/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('./calc_helper');

describe('Calc spell checking menu.', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('spellchecking.ods', 'calc');

		// Click on edit button
		cy.get('#mobile-edit-button')
			.click();
	});

	afterEach(function() {
		helper.afterAll('spellchecking.ods');
	});

	function openContextMenu() {
		// Step into edit mode
		calcHelper.dblClickOnFirstCell();

		// Select text content
		cy.get('textarea.clipboard')
			.type('{ctrl}a', {force: true});

		// Open context menu
		cy.get('.leaflet-selection-marker-start,.leaflet-selection-marker-end')
			.then(function(markers) {
				expect(markers.length).to.be.equal(2);
				for (var i = 0; i < markers.length; i++) {
					if (markers[i].classList.contains('leaflet-selection-marker-start')) {
						cy.log('Found start marker at pos: ' + markers[i].getBoundingClientRect().right);
						var XPos = markers[i].getBoundingClientRect().right + 10;
					} else if (markers[i].classList.contains('leaflet-selection-marker-end')) {
						cy.log('Found end marker at pos: ' + markers[i].getBoundingClientRect().top);
						var YPos = markers[i].getBoundingClientRect().top - 10;
					}
				}

				// Remove selection
				calcHelper.removeTextSelection();

				// Step into edit mode again
				calcHelper.dblClickOnFirstCell();

				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.get('#mobile-wizard-content')
			.should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		helper.selectItemByContent('.context-menu-link', 'hello')
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

		helper.selectItemByContent('.context-menu-link', 'Ignore\u00a0All')
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
		helper.selectItemByContent('.context-menu-link', 'Paste')
			.should('be.visible');
	});

	it('Apply language for word.', function() {
		openContextMenu();

		helper.selectItemByContent('.context-menu-link', 'Word\u00a0is Finnish')
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
		helper.selectItemByContent('.context-menu-link', 'Paste')
			.should('be.visible');
	});

	it('Apply language for paragraph.', function() {
		openContextMenu();

		helper.selectItemByContent('.context-menu-link', 'Paragraph\u00a0is Finnish')
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
		helper.selectItemByContent('.context-menu-link', 'Paste')
			.should('be.visible');
	});
});
