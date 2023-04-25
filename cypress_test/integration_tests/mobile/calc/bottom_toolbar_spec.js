/* global describe it cy Cypress require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Interact with bottom toolbar.', function() {
	var testFileName;

	function before(fileName) {
		testFileName = helper.beforeAll(fileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();

		helper.waitUntilIdle('#toolbar-down');

		calcHelper.clickOnFirstCell();
	}

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function getTextEndPosForFirstCell() {
		calcHelper.dblClickOnFirstCell();

		helper.getCursorPos('left', 'currentTextEndPos');

		cy.cGet('#tb_actionbar_item_acceptformula').should('be.visible')
			.then($ele =>{
				if (Cypress.dom.isVisible($ele)) {
					cy.wrap($ele).click();
				}
			});

		cy.cGet('.cursor-overlay .blinking-cursor').should('not.exist');
	}

	it('Apply bold.', function() {
		before('bottom_toolbar.ods');
		cy.cGet('.w2ui-tb-image.w2ui-icon.bold').click();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td b').should('exist');
	});

	it('Apply italic.', function() {
		before('bottom_toolbar.ods');

		cy.cGet('.w2ui-tb-image.w2ui-icon.italic').click();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td i').should('exist');
	});

	it('Apply underline.', function() {
		before('bottom_toolbar.ods');
		cy.cGet('.w2ui-tb-image.w2ui-icon.underline').click();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td u').should('exist');
	});

	it.skip('Apply strikeout.', function() {
		before('bottom_toolbar.ods');
		cy.cGet('.w2ui-tb-image.w2ui-icon.strikeout').click();
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td s').should('exist');
	});

	it('Apply font color.', function() {
		before('bottom_toolbar.ods');
		cy.cGet('.w2ui-tb-image.w2ui-icon.textcolor').click();
		mobileHelper.selectFromColorPalette(0, 5);
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td font').should('have.attr', 'color', '#00FF00');
	});

	it('Apply highlight color.', function() {
		before('bottom_toolbar.ods');
		cy.cGet('.w2ui-tb-image.w2ui-icon.backcolor').click();
		mobileHelper.selectFromColorPalette(0, 5);
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td').should('have.attr', 'bgcolor', '#00FF00');
	});

	it('Merge cells', function() {
		before('bottom_toolbar.ods');
		// Select 100 cells in first row
		calcHelper.selectCellsInRange('A1:CV1');
		// Despite the selection is there, merge cells needs more time here.
		cy.wait(1000);
		cy.cGet('.w2ui-tb-image.w2ui-icon.togglemergecells').click();
		calcHelper.selectCellsInRange('A1:CV1');
		cy.cGet('#copy-paste-container table td').should('have.attr', 'colspan', '100');
	});

	it.skip('Enable text wrapping.', function() {
		before('bottom_toolbar.ods');
		helper.initAliasToNegative('originalTextEndPos');
		getTextEndPosForFirstCell();
		cy.get('@currentTextEndPos').as('originalTextEndPos');
		cy.get('@currentTextEndPos').should('be.greaterThan', 0);
		calcHelper.clickOnFirstCell();
		cy.cGet('.w2ui-tb-image.w2ui-icon.wraptext').click();

		// We use the text position as indicator
		cy.waitUntil(function() {
			getTextEndPosForFirstCell();

			return cy.get('@currentTextEndPos')
				.then(function(currentTextEndPos) {
					return cy.get('@originalTextEndPos')
						.then(function(originalTextEndPos) {
							return originalTextEndPos > currentTextEndPos;
						});
				});
		});
	});
});
