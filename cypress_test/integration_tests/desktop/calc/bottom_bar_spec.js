/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktophelper = require('../../common/desktop_helper');

describe('Calc bottom bar tests.', function() {
	var origTestFileName = 'BottomBar.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Bottom tool bar.', function() {
		cy.get('#map').focus();
		calcHelper.clickOnFirstCell();
		desktophelper.makeZoomItemsVisible();
		cy.get('#tb_actionbar_item_StateTableCellMenu .w2ui-button').click();
		// If it clicks, it passes.
		cy.contains('.w2ui-drop-menu .menu-text', 'CountA').click();
	});
});
