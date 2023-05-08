/* global describe it cy beforeEach Cypress require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe.skip(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Change alignment settings.', function() {
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
		cy.cGet('#tb_actionbar_item_acceptformula').should('be.visible')
			.then($ele =>{
				if (Cypress.dom.isVisible($ele)) {
					cy.wrap($ele).click();
				}
			});

		cy.cGet('.cursor-overlay .blinking-cursor')
			.should('not.exist');
	}

	function openAlignmentPaneForFirstCell() {
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		cy.cGet('.unoAlignLeft').should('be.visible');
	}

	it('Apply left/right alignment', function() {
		openAlignmentPaneForFirstCell();

		// Set right aligment first
		helper.clickOnIdle('.unoAlignRight');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'align', 'right');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		helper.clickOnIdle('.unoAlignLeft');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'align', 'left');
	});

	it('Align to center horizontally.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignHorizontalCenter');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'align', 'center');
	});

	it('Change to block alignment.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignBlock');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
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

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'valign', 'top');

		// Change alignment back
		calcHelper.clickOnFirstCell();

		mobileHelper.openMobileWizard();

		helper.clickOnIdle('#ScAlignmentPropertyPanel');

		helper.clickOnIdle('.unoAlignBottom');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'valign', 'bottom');
	});

	it('Align to center vertically.', function() {
		openAlignmentPaneForFirstCell();

		helper.clickOnIdle('.unoAlignVCenter');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.attr', 'valign', 'middle');
	});

	it('Increment / decrement text indent.', function() {
		getTextEndPosForFirstCell();

		cy.get('@currentTextEndPos').then(function(currentTextEndPos) {
			var originalPos = currentTextEndPos;

			openAlignmentPaneForFirstCell();
			// Increase indent
			helper.clickOnIdle('#IncrementIndent');
			getTextEndPosForFirstCell();

			cy.get('@currentTextEndPos')
				.then(function(currentTextEndPos) {
					expect(originalPos).to.be.lessThan(currentTextEndPos);
				});

			// Decrease indent
			openAlignmentPaneForFirstCell();
			helper.clickOnIdle('#DecrementIndent');
			getTextEndPosForFirstCell();

			// We use the text position as indicator
			cy.get('@currentTextEndPos')
				.then(function(currentTextEndPos) {
					expect(originalPos).to.equal(currentTextEndPos);
				});
		});
	});

	it('Enable text wrapping.', function() {
		helper.initAliasToNegative('originalTextEndPos');

		getTextEndPosForFirstCell();

		cy.get('@currentTextEndPos').then(originalPos => {
			cy.get('@currentTextEndPos').should('be.greaterThan', 0);

			openAlignmentPaneForFirstCell();
			cy.cGet('input#wraptext').should('not.have.prop', 'checked', true);
			helper.clickOnIdle('input#wraptext');
			cy.cGet('input#wraptext').should('have.prop', 'checked', true);

			// We use the text position as indicator
			getTextEndPosForFirstCell();
			cy.get('@currentTextEndPos')
				.then(function(currentTextEndPos) {
					expect(currentTextEndPos).to.be.lessThan(originalPos);
				});
		});
	});

	it('Apply stacked option.', function() {
		openAlignmentPaneForFirstCell();

		cy.cGet('input#stacked').should('not.have.prop', 'checked', true);

		helper.clickOnIdle('input#stacked');

		cy.cGet('input#stacked').should('have.prop', 'checked', true);

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

		cy.cGet('.unoAlignLeft').should('be.visible');
		cy.cGet('input#mergecells').should('not.have.attr', 'disabled');
		// Click merge cells
		cy.cGet('input#mergecells').should('not.have.prop', 'checked', true);
		helper.clickOnIdle('input#mergecells');
		cy.cGet('input#mergecells').should('have.prop', 'checked', true);
		// Check content
		calcHelper.selectCellsInRange('A1:CV1');
		cy.cGet('#copy-paste-container table td').should('have.attr', 'colspan', '100');
	});
});
