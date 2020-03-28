/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var calc = require('../../common/calc');
var calcHelper = require('./calc_helper');

var delayForEventsMs = 300; // The maximum roundrip time for an event to fire based on some action.

describe('Calc focus tests', function() {
	beforeEach(function() {
		mobileHelper.beforeAllMobile('focus.ods', 'calc');

		// Wait until the Formula-Bar is loaded.
		cy.get('.inputbar_container', {timeout : 10000});
	});

	afterEach(function() {
		helper.afterAll('focus.ods');
	});

	it('Basic document focus.', function() {
		// Click on edit button
		mobileHelper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// One tap on an other cell -> no focus on the document
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
		calc.clickOnFirstCell();

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Click in the formula-bar.
		calc.clickFormulaBar();
		cy.get('body').trigger('mouseover');
		helper.assertCursorAndFocus();

		// Type some text.
		var text1 = 'Hello from Calc';
		cy.get('textarea.clipboard').type(text1);
		cy.get('textarea.clipboard').type('{enter}').wait(delayForEventsMs);

		helper.assertNoKeyboardInput();

		// Select the first cell to edit the same one.
		calc.clickOnFirstCell();

		// Check the text we typed.
		calc.clickFormulaBar();
		cy.get('body').trigger('mouseover');
		helper.assertCursorAndFocus();
		cy.get('textarea.clipboard').type('{ctrl}a');
		helper.expectTextForClipboard(text1);

		// Accept changes.
		cy.get('textarea.clipboard').type('{enter}').wait(delayForEventsMs);

		// Type some more text, at the end.
		cy.log('Appending text at the end.');
		calc.clickOnFirstCell();
		calc.clickFormulaBar();
		cy.get('body').trigger('mouseover');
		helper.assertCursorAndFocus();
		var text2 = ', this is a test.';
		cy.get('textarea.clipboard').type(text2);
		// Validate.
		cy.get('textarea.clipboard').type('{ctrl}a').wait(delayForEventsMs);
		helper.expectTextForClipboard(text1 + text2);
		// End editing.
		cy.get('textarea.clipboard').type('{enter}').wait(delayForEventsMs);
		helper.assertNoKeyboardInput();

		// Type some more text, in the middle.
		cy.log('Inserting text in the middle.');
		calc.clickOnFirstCell();
		calc.clickFormulaBar();
		cy.get('body').trigger('mouseover');
		helper.assertCursorAndFocus();
		var text3 = ', BAZINGA';
		helper.typeText('textarea.clipboard', text3);
		// Validate.
		cy.get('textarea.clipboard').type('{ctrl}a').wait(delayForEventsMs);
		//NOTE: If this fails, it's probably because we clicked
		// at a different point in the text.
		helper.expectTextForClipboard(text1 + text3 + text2);
		// End editing.
		cy.get('textarea.clipboard').type('{enter}').wait(delayForEventsMs);
		helper.assertNoKeyboardInput();
	});
});
