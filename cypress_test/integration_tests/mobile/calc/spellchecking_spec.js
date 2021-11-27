/* global describe it cy Cypress beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Calc spell checking menu.', function() {
	var testFileName = 'spellchecking.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function openContextMenu() {
		// Step into edit mode
		calcHelper.dblClickOnFirstCell();

		// Select text content
		helper.typeIntoDocument('{ctrl}a');

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
				cy.get('#tb_actionbar_item_acceptformula').then($ele =>{
					cy.wait(1000);
					if (Cypress.dom.isVisible($ele)) {
						cy.wrap($ele).click();
					}
				});

				cy.get('.cursor-overlay .blinking-cursor')
					.should('not.exist');

				// Step into edit mode again
				calcHelper.dblClickOnFirstCell();

				mobileHelper.longPressOnDocument(XPos, YPos);
			});

		cy.get('#mobile-wizard-content')
			.should('be.visible');
	}

	it('Apply suggestion.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'hello')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('contain.text', 'hello');
	});

	it('Ignore all.', function() {
		openContextMenu();

		cy.contains('.context-menu-link', 'Ignore All')
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
		cy.contains('.context-menu-link', 'Paste')
			.should('be.visible');
	});
});
