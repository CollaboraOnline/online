/* global describe it cy beforeEach require expect Cypress*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud'], 'Formula bar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/formulabar.ods');

		mobileHelper.enableEditingMobile();
	});

	it('Select a cell by address', function() {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		// Select a different cell using address input.
		helper.typeIntoInputField('input#addressInput-input', 'B2');

		helper.typeIntoInputField('input#addressInput-input', 'A1');

		cy.cGet('#test-div-cell_selection_handle_start').should('exist');
	});

	it('Select a cell range by address', function() {
		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		// Select a cell range using address input.
		helper.typeIntoInputField('input#addressInput-input', 'B2:B3');

		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		// Select a cell range again using address input.
		helper.typeIntoInputField('input#addressInput-input', 'B2:B3');

		cy.cGet('#test-div-cell_selection_handle_start').should('exist');
	});

	it.skip('Check input field content', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard('long line long line long line');

		// A2 cell is empty
		helper.typeIntoInputField('input#addressInput-input', 'A2');

		cy.cGet('[id="test-div-auto fill marker"]').should('exist');

		calcHelper.typeIntoFormulabar('{end}');

		cy.cGet('#formulabar .lokdialog-cursor')
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

		helper.moveCursor('end', undefined, true, '#formulabar .lokdialog-cursor');

		calcHelper.typeIntoFormulabar('{backspace}{backspace}{backspace}');

		cy.cGet('#toolbar-up #acceptformula')
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

		cy.cGet('#toolbar-up #cancelformula')
			.click();

		cy.wait(2000);

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');
	});

	it.skip('Switch oneline-multiline mode of input bar', function() {
		// Get the initial height of the input field.
		var inputOriginalHeight = 0;
		cy.cGet('#formulabar')
			.should(function(inputbar) {
				inputOriginalHeight = inputbar.height();
				expect(inputOriginalHeight).to.not.equal(0);
			});

		// Switch to multiline mode.
		var arrowPos = [255, 10];
		cy.cGet('#formulabar')
			.click(arrowPos[0], arrowPos[1]);

		cy.cGet('#formulabar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.greaterThan(inputOriginalHeight);
			});

		cy.cGet('#formulabar')
			.should(function(inputbar) {
				expect(inputbar.height()).to.be.equal(111);
			});

		// Switch back to one-line mode.
		cy.cGet('#formulabar')
			.click(arrowPos[0], arrowPos[1]);

		cy.cGet('#formulabar')
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
		cy.cGet('#formulabar .lokdialog-cursor').should('be.visible');

		// Add a range
		calcHelper.typeIntoFormulabar('B2:B4');
		cy.cGet('#acceptformula').click();

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
