/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe(['tagmultiuser'], 'Change paragraph properties', function() {
	var origTestFileName = 'paragraph_prop.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Change paragraph alignment.', function() {
		cy.cSetActiveFrame('#iframe1');
		//user 1 change the paragraph alignment
		cy.cGet('.leaflet-layer').click();
		cy.cGet('#tb_editbar_item_rightpara').click();

		helper.selectAllText();

		//assert for user-1
		cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'right');

		//assert for user-2
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-layer').click();

		helper.selectAllText();

		cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'right');

		//user-2 changes alignment to left
		cy.cGet('.leaflet-layer').click();
		cy.cGet('#tb_editbar_item_leftpara').click();

		helper.selectAllText();

		//assert for user-2
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'left');
		//assert for user-1
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#copy-paste-container p').should('have.attr', 'align', 'left');
	});
});
