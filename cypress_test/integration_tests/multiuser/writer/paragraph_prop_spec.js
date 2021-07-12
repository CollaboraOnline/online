/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Change paragraph properties', function() {
	var testFileName = 'paragraph_prop.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Change paragraph alignment.', function() {

		//user 1 change the paragraph alignment
		cy.customGet('.leaflet-layer', '#iframe1')
			.click();

		cy.customGet('#tb_editbar_item_rightpara', '#iframe1')
			.click();

		helper.selectAllText('#iframe1');

		//assert for user-1
		cy.customGet('#copy-paste-container p', '#iframe1')
			.should('have.attr', 'align', 'right');

		//assert for user-2
		cy.customGet('.leaflet-layer', '#iframe2')
			.click();

		helper.selectAllText('#iframe2');

		cy.customGet('#copy-paste-container p', '#iframe2')
			.should('have.attr', 'align', 'right');

		//user-2 changes alignment to left
		cy.customGet('.leaflet-layer', '#iframe2')
			.click();

		cy.customGet('#tb_editbar_item_leftpara', '#iframe2')
			.click();

		helper.selectAllText('#iframe2');

		//assert for user-2
		cy.customGet('#copy-paste-container p', '#iframe2')
			.should('have.attr', 'align', 'left');

		//assert for user-1
		cy.customGet('#copy-paste-container p', '#iframe1')
			.should('have.attr', 'align', 'left');
	});
});
