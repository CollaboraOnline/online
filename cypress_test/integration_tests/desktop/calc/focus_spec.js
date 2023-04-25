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

	it('Formula-bar focus', function() {

		// Select the first cell to edit the same one.
		// Use the tile's edge to find the first cell's position
		calcHelper.clickOnFirstCell();

		// Click in the formula-bar.
		calcHelper.clickFormulaBar();
		//helper.assertCursorAndFocus();

		// Type some text.
		var text1 = 'Hello from Calc';
		calcHelper.typeIntoFormulabar(text1);
		calcHelper.typeIntoFormulabar('{enter}');

		// Select the first cell to edit the same one.
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		// Validate.
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard(text1);
		// End editing.
		calcHelper.typeIntoFormulabar('{enter}');

		// Type some more text, at the end.
		cy.log('Appending text at the end.');
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		//var text2 = ', this is a test.';
		//helper.typeText('textarea.clipboard', text2);
		// Validate.
		//calcHelper.typeIntoFormulabar('{ctrl}a');
		//helper.expectTextForClipboard(text1 + text2);
		// End editing.
		//calcHelper.typeIntoFormulabar('{enter}');
	});
});
