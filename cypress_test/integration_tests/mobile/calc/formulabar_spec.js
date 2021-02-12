/* global describe it cy beforeEach require afterEach expect Cypress*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Change alignment settings.', function() {
	var testFileName = 'formulabar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Select a cell by address', function() {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		// Select a different cell using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2');

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');

		cy.get('input#addressInput')
			.clear()
			.type('A1{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('exist');
	});

	it('Select a cell range by address', function() {
		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		// Select a cell range using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2:B3{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2:B3');

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');

		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('exist');

		// Select a cell range again using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2:B3{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2:B3');

		cy.get('.spreadsheet-cell-resize-marker[style=\'transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');
	});

	it('Check input field content', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard('long line long line long line');

		// A2 cell is empty
		cy.get('input#addressInput')
			.clear()
			.type('A2{enter}');

		cy.get('.spreadsheet-cell-autofill-marker')
			.should('be.visible');

		calcHelper.typeIntoFormulabar('{end}');

		cy.get('#calc-inputbar .lokdialog-cursor')
			.should(function(cursor) {
				expect(cursor.offset().left).to.be.equal(103);
			});
	});

	it('Edit cell via formula bar', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}xxxxxxx{enter}');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long linexxxxxxx');
	});

	it('Accept formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		helper.moveCursor('end', undefined, true, '#calc-inputbar .lokdialog-cursor');

		calcHelper.typeIntoFormulabar('{backspace}{backspace}{backspace}');

		cy.get('#tb_actionbar_item_acceptformula')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long l');
	});

	it('Reject formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}{backspace}{backspace}{backspace}');

		cy.get('#tb_actionbar_item_cancelformula')
			.click();

		cy.wait(2000);

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');
	});

	it('Switch oneline-multiline mode of input bar', function() {
		helper.initAliasToNegative('inputOriginalHeight');

		cy.get('#calc-inputbar')
			.invoke('height')
			.as('inputOriginalHeight');

		cy.get('@inputOriginalHeight')
			.should('be.greaterThan', 0);

		// Switch to multiline mode.
		var arrowPos = [250, 10];
		cy.get('#calc-inputbar')
			.click(arrowPos[0], arrowPos[1]);

		cy.get('@inputOriginalHeight')
			.then(function(inputOriginalHeight) {
				cy.get('#calc-inputbar')
					.should(function(inputbar) {
						expect(inputbar.height()).to.be.greaterThan(inputOriginalHeight);
					});
			});

		cy.get('#calc-inputbar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.equal(111);
			});

		// Switch back to one-line mode.
		cy.get('#calc-inputbar')
			.click(arrowPos[0], arrowPos[1]);

		cy.get('@inputOriginalHeight')
			.then(function(inputOriginalHeight) {
				cy.get('#calc-inputbar')
					.should(function(inputbar) {
						expect(inputbar.height()).to.be.equal(inputOriginalHeight);
					});
			});
	});

	it('Check formula help', function() {
		cy.get('#tb_formulabar_item_functiondialog')
			.click();

		cy.get('#mobile-wizard-content')
			.should('be.visible');

		cy.contains('.ui-header.level-0.mobile-wizard', 'Logical')
			.click();

		cy.contains('.func-entry', 'AND')
			.find('.func-info-icon')
			.click();

		cy.get('#mobile-wizard-title')
			.should('be.visible')
			.should('have.text', 'AND');

		cy.get('.ui-content.level-1.mobile-wizard[title=\'AND\'] .func-info-sig')
			.should('be.visible')
			.should('contain.text', 'AND( Logical value 1, Logical value 2, ...');

		cy.get('.ui-content.level-1.mobile-wizard[title=\'AND\'] .func-info-desc')
			.should('be.visible')
			.should('have.text', 'Returns TRUE if all arguments are TRUE.');
	});

	it('Add formula to cell', function() {
		calcHelper.clickOnFirstCell();

		cy.get('#tb_formulabar_item_functiondialog')
			.click();

		cy.get('#mobile-wizard-content')
			.should('be.visible');

		// Select average
		cy.contains('.ui-header.level-0.mobile-wizard', 'Statistical')
			.click();

		cy.contains('.ui-content.level-0.mobile-wizard[title=\'Statistical\'] .func-entry', 'AVERAGE')
			.find('.ui-header-left')
			.click();

		cy.get('#mobile-wizard-content')
			.should('not.be.visible');

		cy.get('#calc-inputbar .lokdialog-cursor')
			.should('be.visible');

		// Add a range
		calcHelper.typeIntoFormulabar('B2:B4');
		cy.get('#tb_actionbar_item_acceptformula')
			.click();

		// Close mobile wizard with formulas.
		cy.waitUntil(function() {
			cy.get('#mobile-wizard-back')
				.click();

			return cy.get('#mobile-wizard-content')
				.then(function(wizardContent) {
					return !Cypress.dom.isVisible(wizardContent[0]);
				});
		});

		cy.get('#mobile-wizard-content')
			.should('not.be.visible');

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', '5');
	});
});
