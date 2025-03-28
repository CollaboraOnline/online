/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Calc bottom bar tests.', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/BottomBar.ods');
	});

	it('Bottom tool bar.', function() {
		cy.cGet('#map').focus();
		calcHelper.clickOnFirstCell();
		cy.cGet('#StateTableCellMenu:visible')
		.should('exist')
		.then(() => {
			cy.log('StateTableCellMenu is visible, for test interaction');
			cy.cGet('#StateTableCellMenu').click();
			cy.cGet('body').contains('.ui-combobox-entry', 'CountA').click();
		});
	});
});
