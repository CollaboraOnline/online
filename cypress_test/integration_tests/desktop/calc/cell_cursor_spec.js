/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Scroll through document', function() {
	var testFileName = 'cell_cursor.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
		desktopHelper.switchUIToCompact();
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
		cy.cGet('#tb_editbar_item_sidebar').click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('No jump on long merged cell', function() {
		desktopHelper.assertScrollbarPosition('horizontal', 310, 315);
		calcHelper.clickOnFirstCell(true, false, false);
		cy.cGet('input#addressInput').should('have.prop', 'value', 'A1:Z1');
		desktopHelper.assertScrollbarPosition('horizontal', 310, 315);
	});
});
