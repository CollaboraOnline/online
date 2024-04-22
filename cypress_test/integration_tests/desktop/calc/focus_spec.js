/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Calc focus tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/focus.ods');
	});

	it('Formula-bar focus', function() {
		helper.setDummyClipboardForCopy();
		// Select first cell
		calcHelper.clickOnFirstCell();
		cy.wait(200);

		// Type some text.
		var text1 = 'Hello from Calc';
		calcHelper.typeIntoFormulabar(text1);
		calcHelper.typeIntoFormulabar('{enter}');

		// Unselect formulabar and reselect cell
		calcHelper.clickOnFirstCell();
		cy.wait(200);

		// Check text in formulabar
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.copy();
		helper.expectTextForClipboard(text1);
		// Clear selection
		calcHelper.typeIntoFormulabar('{enter}');


		// Type some more text, at the end.
		calcHelper.clickOnFirstCell();
		cy.wait(200);
		var text2 = ', this is a test.';
		calcHelper.typeIntoFormulabar('{end}'+text2);
		calcHelper.typeIntoFormulabar('{enter}');

		// Check text in formulabar
		calcHelper.clickOnFirstCell();
		cy.wait(200);
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.copy();
		helper.expectTextForClipboard(text1+text2);
		calcHelper.typeIntoFormulabar('{enter}');
	});
});
