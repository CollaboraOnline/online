/* global describe it cy beforeEach require afterEach expect*/

var helper = require('../../common/helper');
var calcHelper = require('./calc_helper');

describe('Calc focus tests', function() {
	beforeEach(function() {
		helper.beforeAllMobile('focus.ods', 'calc');
	});

	afterEach(function() {
		helper.afterAll('focus.ods');
	});

	it('Basic document focus.', function() {
		// Click on edit button
		helper.enableEditingMobile();

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
		helper.enableEditingMobile();

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
		helper.enableEditingMobile();

		// Body has the focus -> can't type in the document
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		helper.assertNoKeyboardInput();

		// One tap on a cell -> no document focus
		calcHelper.clickOnFirstCell();

		cy.get('.leaflet-marker-icon')
			.should('be.visible');

		// No focus
		cy.document().its('activeElement.tagName')
			.should('be.eq', 'BODY');

		// Click in the formula-bar.
		cy.get('.inputbar_container')
			.click();

		helper.assertCursorAndFocus();

		// Type some text.
		cy.get('textarea.clipboard')
			.type('blah');
	});
});
