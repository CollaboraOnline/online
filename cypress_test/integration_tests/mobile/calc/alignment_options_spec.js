/* global describe it cy beforeEach Cypress require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Change alignment settings.', function() {
	var origTestFileName = 'alignment_options.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function getTextEndPosForFirstCell() {
		calcHelper.dblClickOnFirstCell();

		helper.getCursorPos('left', 'currentTextEndPos');

		//remove text selection
		cy.get('#tb_actionbar_item_acceptformula').should('be.visible')
			.then($ele =>{
				if (Cypress.dom.isVisible($ele)) {
					cy.wrap($ele).click();
				}
			});

		cy.get('.cursor-overlay .blinking-cursor')
			.should('not.exist');
	}

	function openAlignmentPaneForFirstCell() {
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		cy.get('.unoAlignLeft')
			.should('be.visible');
	}

	it('Apply left/right alignment', function() {
		openAlignmentPaneForFirstCell();

		// Set right aligment first
		helper.clickOnIdle('.unoAlignRight');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		helper.clickOnIdle('.unoAlignLeft');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

	it('Align to center horizontally.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignHorizontalCenter');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'center');
	});

	it('Change to block alignment.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignBlock');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'align', 'justify');
	});

	it('Right-to-left and left-to-right writing mode.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoParaRightToLeft');

		// TODO: we don't have a way of testing this
		// copy container doesn't have info about this
		cy.wait(500);

		helper.clickOnIdle('.unoParaLeftToRight');

		cy.wait(500);
	});

	it('Align to the top and to bottom.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignTop');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'top');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		helper.clickOnIdle('.unoAlignBottom');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'bottom');
	});

	it('Align to center vertically.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignVCenter');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'valign', 'middle');
	});

	it('Increment / decrement text indent.', function() {
		helper.initAliasToNegative('originalTextEndPos');

		// Get text position first
		getTextEndPosForFirstCell();
		cy.get('@currentTextEndPos')
			.as('originalTextEndPos');

		cy.get('@originalTextEndPos')
			.should('be.greaterThan', 0);

		openAlignmentPaneForFirstCell();

		// Increase indent
		helper.clickOnIdle('#IncrementIndent');

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextEndPosForFirstCell();

				cy.get('@currentTextEndPos')
					.then(function(currentTextEndPos) {
						cy.get('@originalTextEndPos')
							.then(function(originalTextEndPos) {
								expect(originalTextEndPos).to.be.lessThan(currentTextEndPos);
							});
					});
			});

		helper.initAliasToNegative('originalTextEndPos');

		cy.get('@currentTextEndPos')
			.as('originalTextEndPos');

		cy.get('@currentTextEndPos')
			.should('be.greaterThan', 0);

		// Decrease indent
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('#DecrementIndent');

		// We use the text position as indicator
		cy.get('body')
			.should(function() {
				getTextEndPosForFirstCell();

				cy.get('@currentTextEndPos')
					.then(function(currentTextEndPos) {
						cy.get('@originalTextEndPos')
							.then(function(originalTextEndPos) {
								expect(originalTextEndPos).to.be.greaterThan(currentTextEndPos);
							});
					});
			});
	});

	it('Enable text wrapping.', function() {
		helper.initAliasToNegative('originalTextEndPos');

		getTextEndPosForFirstCell();
		cy.get('@currentTextEndPos')
			.as('originalTextEndPos');

		cy.get('@currentTextEndPos')
			.should('be.greaterThan', 0);

		openAlignmentPaneForFirstCell();

		cy.get('input#wraptext')
			.should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#wraptext');

		cy.get('input#wraptext')
			.should('have.prop', 'checked', true);

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

	it('Apply stacked option.', function() {
		openAlignmentPaneForFirstCell();

		cy.get('input#stacked')
			.should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#stacked');

		cy.get('input#stacked')
			.should('have.prop', 'checked', true);

		cy.wait(500);

		// TODO: we don't have a good indicator here
		// neither the text position nor the clipboard container helps here.
	});

	it('Merge cells.', function() {
		// Select the 100 cells in 1st row
		calcHelper.selectCellsInRange('A1:CV1');

		// Despite the selection is there, merge cells needs more time here.
		cy.wait(1000);

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		cy.get('.unoAlignLeft')
			.should('be.visible');

		cy.get('input#mergecells')
			.should('not.have.attr', 'disabled');

		// Click merge cells
		cy.get('input#mergecells')
			.should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#mergecells');

		cy.get('input#mergecells')
			.should('have.prop', 'checked', true);

		// Check content
		calcHelper.selectCellsInRange('A1:CV1');

		cy.get('#copy-paste-container table td')
			.should('have.attr', 'colspan', '100');
	});
});
