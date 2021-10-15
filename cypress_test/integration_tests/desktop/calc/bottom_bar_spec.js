/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Calc bottom bar tests.', function() {
	var testFileName = 'BottomBar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		cy.wait(1000);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Bottom tool bar.', function() {
		cy.get('#map').focus();
		calcHelper.clickOnFirstCell();

		cy.get('#toolbar-down .w2ui-scroll-right')
			.click();

		cy.get('#tb_actionbar_item_StateTableCellMenu .w2ui-button').click();
		// If it clicks, it passes.
		cy.contains('.w2ui-drop-menu .menu-text', 'CountA').click();
	});
});
