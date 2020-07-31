/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Calc focus tests', function() {
	var testFileName = 'focus.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Wait until the Formula-Bar is loaded.
		cy.get('.inputbar_container', {timeout : 10000});
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Formula-bar focus', function() {

		// Select the first cell to edit the same one.
		// Use the tile's edge to find the first cell's position
		calcHelper.clickOnFirstCell();

		// Click in the formula-bar.
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		// Type some text.
		var text1 = 'Hello from Calc';
		helper.typeText('textarea.clipboard', text1);
		cy.get('textarea.clipboard').type('{enter}');

		// Select the first cell to edit the same one.
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();
		// Validate.
		cy.get('textarea.clipboard').type('{ctrl}a');
		helper.expectTextForClipboard(text1);
		// End editing.
		cy.get('textarea.clipboard').type('{enter}');

		// Type some more text, at the end.
		cy.log('Appending text at the end.');
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();
		var text2 = ', this is a test.';
		helper.typeText('textarea.clipboard', text2);
		// Validate.
		cy.get('textarea.clipboard').type('{ctrl}a');
		helper.expectTextForClipboard(text1 + text2);
		// End editing.
		cy.get('textarea.clipboard').type('{enter}');

		// Type some more text, in the middle.
		cy.log('Inserting text in the middle.');
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		// Move cursor before text2
		cy.get('textarea.clipboard').type('{end}');
		for (var i = 0; i < 6; i++)
			cy.get('textarea.clipboard').type('{leftarrow}');

		var text3 = ' BAZINGA';
		helper.typeText('textarea.clipboard', text3);
		// Validate.
		cy.get('textarea.clipboard').type('{ctrl}a');
		//NOTE: If this fails, it's probably because we clicked
		// at a different point in the text.
		helper.expectTextForClipboard(text1 + ', this is a' + text3 + ' test.');
	});
});
