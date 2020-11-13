/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calcHelper = require('../../common/calc_helper');

describe('Calc focus tests', function() {
	var testFileName = 'focus.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		// Wait until the Formula-Bar is loaded.
		cy.get('.inputbar_container', {timeout : 10000});
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Basic document focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// One tap on another cell -> no focus on the document
		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Double tap on another cell gives the focus to the document
		cy.get('.spreadsheet-cell-resize-marker')
			.then(function(items) {
				expect(items).to.have.lengthOf(2);
				var XPos = Math.max(items[0].getBoundingClientRect().right, items[1].getBoundingClientRect().right) + 10;
				var YPos = Math.max(items[0].getBoundingClientRect().top, items[1].getBoundingClientRect().top) - 10;
				cy.get('body')
					.dblclick(XPos, YPos);
			});

		// Document has the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	});

	it('Focus on second tap.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// One tap on a cell -> no document focus
		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Second tap on the same cell
		calcHelper.clickOnFirstCell(false);

		// Document has the focus
		cy.document().its('activeElement.className')
			.should('be.eq', 'clipboard');
	});

	it('Formula-bar focus', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		helper.assertNoKeyboardInput();

		// Select the first cell to edit the same one.
		calcHelper.clickOnFirstCell();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Click in the formula-bar.
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		// Type some text.
		var text1 = 'Hello from Calc';
		calcHelper.typeIntoFormulabar(text1);
		calcHelper.typeIntoFormulabar('{enter}');
		helper.assertNoKeyboardInput();

		// Select the first cell to edit the same one.
		calcHelper.clickOnFirstCell();

		// Check the text we typed.
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard(text1);

		// Accept changes.
		calcHelper.typeIntoFormulabar('{enter}');
		helper.assertNoKeyboardInput();

		// Type some more text, at the end.
		cy.log('Appending text at the end.');
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();
		var text2 = ', this is a test.';
		calcHelper.typeIntoFormulabar(text2);
		// Validate.
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard(text1 + text2);
		// End editing.
		calcHelper.typeIntoFormulabar('{enter}');
		helper.assertNoKeyboardInput();

		// Type some more text, in the middle.
		cy.log('Inserting text in the middle.');
		calcHelper.clickOnFirstCell();
		calcHelper.clickFormulaBar();
		helper.assertCursorAndFocus();

		// Move cursor before text2
		calcHelper.typeIntoFormulabar('{end}');
		for (var i = 0; i < text2.length; i++)
			helper.moveCursor('left');

		var text3 = ', BAZINGA';
		calcHelper.typeIntoFormulabar(text3);
		// Validate.
		calcHelper.typeIntoFormulabar('{ctrl}a');
		helper.expectTextForClipboard(text1 + text3 + text2);
		// End editing.
		calcHelper.typeIntoFormulabar('{enter}');
		helper.assertNoKeyboardInput();
	});
});
