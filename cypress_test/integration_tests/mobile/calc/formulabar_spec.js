/* global describe it cy beforeEach require afterEach expect Cypress*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud'], 'Formula bar tests.', function() {
	var origTestFileName = 'formulabar.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Select a cell by address', function() {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		// Select a different cell using address input.
		helper.typeIntoInputField('input#addressInput', 'B2');

		cy.cGet('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');

		helper.typeIntoInputField('input#addressInput', 'A1');

		cy.cGet('.spreadsheet-cell-resize-marker').should('exist');
	});

	it('Select a cell range by address', function() {
		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		// Select a cell range using address input.
		helper.typeIntoInputField('input#addressInput', 'B2:B3');

		cy.cGet('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');

		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		cy.cGet('.spreadsheet-cell-resize-marker').should('exist');

		// Select a cell range again using address input.
		helper.typeIntoInputField('input#addressInput', 'B2:B3');

		cy.cGet('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;\']')
			.should('not.exist');
	});

	it.skip('Check input field content', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard('long line long line long line');

		// A2 cell is empty
		helper.typeIntoInputField('input#addressInput', 'A2');

		cy.cGet('[id="test-div-auto fill marker"]').should('exist');

		calcHelper.typeIntoFormulabar('{end}');

		cy.cGet('#calc-inputbar .lokdialog-cursor')
			.should(function(cursor) {
				expect(cursor.offset().left).to.be.equal(93);
			});
	});

	it.skip('Edit cell via formula bar', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}xxxxxxx{enter}');

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long linexxxxxxx');
	});

	it.skip('Accept formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		helper.moveCursor('end', undefined, true, '#calc-inputbar .lokdialog-cursor');

		calcHelper.typeIntoFormulabar('{backspace}{backspace}{backspace}');

		cy.cGet('#tb_actionbar_item_acceptformula')
			.click();

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long l');
	});

	it.skip('Reject formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}{backspace}{backspace}{backspace}');

		cy.cGet('#tb_actionbar_item_cancelformula')
			.click();

		cy.wait(2000);

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');
	});

	it.skip('Switch oneline-multiline mode of input bar', function() {
		// Get the initial height of the input field.
		var inputOriginalHeight = 0;
		cy.cGet('#calc-inputbar')
			.should(function(inputbar) {
				inputOriginalHeight = inputbar.height();
				expect(inputOriginalHeight).to.not.equal(0);
			});

		// Switch to multiline mode.
		var arrowPos = [255, 10];
		cy.cGet('#calc-inputbar')
			.click(arrowPos[0], arrowPos[1]);

		cy.cGet('#calc-inputbar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.greaterThan(inputOriginalHeight);
			});

		cy.cGet('#calc-inputbar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.equal(111);
			});

		// Switch back to one-line mode.
		cy.cGet('#calc-inputbar')
			.click(arrowPos[0], arrowPos[1]);

		cy.cGet('#calc-inputbar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.equal(inputOriginalHeight);
			});
	});

	it.skip('Check formula help', function() {
		cy.cGet('.unoFunctionDialog').click();
		cy.cGet('#mobile-wizard-content').should('be.visible');
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard', 'Logical').click();

		cy.cGet('body').contains('.func-entry', 'AND').find('.func-info-icon').click();

		cy.cGet('#mobile-wizard-title').should('be.visible').should('have.text', 'AND');
		cy.cGet('.ui-content.level-1.mobile-wizard[title=\'AND\'] .func-info-sig').should('be.visible')
			.should('contain.text', 'AND( Logical value 1, Logical value 2, ...');

		cy.cGet('.ui-content.level-1.mobile-wizard[title=\'AND\'] .func-info-desc')
			.should('be.visible')
			.should('have.text', 'Returns TRUE if all arguments are TRUE.');
	});

	it.skip('Add formula to cell', function() {
		calcHelper.clickOnFirstCell();

		cy.cGet('.unoFunctionDialog').click();
		cy.cGet('#mobile-wizard-content').should('be.visible');

		// Select average
		cy.cGet('body').contains('.ui-header.level-0.mobile-wizard', 'Statistical').click();

		cy.cGet('body').contains('.ui-content.level-0.mobile-wizard[title=\'Statistical\'] .func-entry', 'AVERAGE')
			.find('.ui-header-left')
			.click();

		cy.cGet('#mobile-wizard-content').should('not.be.visible');
		cy.cGet('#calc-inputbar .lokdialog-cursor').should('be.visible');

		// Add a range
		calcHelper.typeIntoFormulabar('B2:B4');
		cy.cGet('#tb_actionbar_item_acceptformula').click();

		// Close mobile wizard with formulas.
		cy.waitUntil(function() {
			cy.cGet('#mobile-wizard-back').click();

			return cy.cGet('#mobile-wizard-content')
				.then(function(wizardContent) {
					return !Cypress.dom.isVisible(wizardContent[0]);
				});
		});

		cy.cGet('#mobile-wizard-content').should('not.be.visible');
		calcHelper.selectEntireSheet();
		cy.cGet('#copy-paste-container table td:nth-of-type(1)').should('have.text', '5');
	});
});
