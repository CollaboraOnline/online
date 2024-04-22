/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktophelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Calc bottom bar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/BottomBar.ods');
	});

	it('Bottom tool bar.', function() {
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		desktophelper.makeZoomItemsVisible();
		cy.cGet('#StateTableCellMenu').click();
		// If it clicks, it passes.
		cy.cGet('body').contains('.ui-combobox-entry', 'CountA').click();
	});
});
