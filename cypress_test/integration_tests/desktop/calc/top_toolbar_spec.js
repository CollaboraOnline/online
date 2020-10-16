/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Top toolbar tests.', function() {
	var testFileName = 'top_toolbar.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.clickOnFirstCell();
	});

	afterEach(function() {
		helper.afterAll(testFileName);
	});

	it('Apply bold font.', function() {
		cy.get('#tb_editbar_item_bold')
			.click();

		calcHelper.selectAllMobile();

		cy.get('#copy-paste-container table td b')
			.should('exist');
	});
});
