/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Calc focus tests', function() {
	var origTestFileName = 'focus.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it.skip('Formula-bar focus', function() {
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
		helper.expectTextForClipboard(text1+text2);
		calcHelper.typeIntoFormulabar('{enter}');
	});
});
