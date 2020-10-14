/* global describe it cy beforeEach require afterEach expect */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');
var calcMobileHelper = require('./calc_mobile_helper');

require('cypress-wait-until');

describe('Change alignment settings.', function() {
	var testFileName = 'formulabar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Select a cell by address', function() {
		// Select first cell by clicking on it
		calcHelper.clickOnFirstCell();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('be.visible');

		// Select a different cell using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('not.exist');

		cy.get('input#addressInput')
			.clear()
			.type('A1{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('exist');
	});

	it('Select a cell range by address', function() {
		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('be.visible');

		// Select a cell range using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2:B3{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2:B3');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('not.exist');

		cy.get('#tb_editbar_item_togglemergecells')
			.should('not.have.class', 'disabled');

		// Select first cell by clicking on it.
		calcHelper.clickOnFirstCell();

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'A1');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('be.visible');

		cy.get('#tb_editbar_item_togglemergecells')
			.should('have.class', 'disabled');

		// Select a cell range again using address input.
		cy.get('input#addressInput')
			.clear()
			.type('B2:B3{enter}');

		cy.get('input#addressInput')
			.should('have.prop', 'value', 'B2:B3');

		cy.get('.spreadsheet-cell-resize-marker[style=\'visibility: visible; transform: translate3d(-8px, -8px, 0px); z-index: -8;')
			.should('not.exist');

		cy.get('#tb_editbar_item_togglemergecells')
			.should('not.have.class', 'disabled');
	});

	it('Check input field content', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}');

		cy.get('#calc-inputbar .lokdialog-cursor')
			.should(function(cursor) {
				expect(cursor.offset().left).to.be.equal(294);
			});

		// A2 cell is empty
		cy.get('input#addressInput')
			.clear()
			.type('A2{enter}');

		calcHelper.typeIntoFormulabar('{end}');

		cy.get('#calc-inputbar .lokdialog-cursor')
			.should(function(cursor) {
				expect(cursor.offset().left).to.be.equal(103);
			});

		// Change first cell content
		calcHelper.dblClickOnFirstCell();
		
		helper.typeIntoDocument('xxx');

		calcHelper.typeIntoFormulabar('{end}');

		cy.get('#calc-inputbar .lokdialog-cursor')
			.should(function(cursor) {
				expect(cursor.offset().left).to.be.equal(318);
			});
	});

	it('Edit cell via formula bar', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}xxxxxxx{enter}');

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long linexxxxxxx');
	});

	it('Accept formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}{backspace}{backspace}{backspace}');

		cy.get('#tb_actionbar_item_acceptformula')
			.click();

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long l');
	});

	it('Reject formula bar change', function() {
		// First cell has some long content
		calcHelper.clickOnFirstCell();

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');

		// Change first cell content via formula bar
		calcHelper.clickOnFirstCell();

		calcHelper.typeIntoFormulabar('{end}{backspace}{backspace}{backspace}');

		cy.get('#tb_actionbar_item_cancelformula')
			.click();

		cy.wait(2000);

		calcMobileHelper.selectAllMobile();

		cy.get('#copy-paste-container table td:nth-of-type(1)')
			.should('have.text', 'long line long line long line');
	});
});
