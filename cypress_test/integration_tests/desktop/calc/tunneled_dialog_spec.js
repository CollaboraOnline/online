/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('LOK tunnelled dialog tests', function() {
	var origTestFileName = 'tunneled_dialog.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Keep LOK dialog open during closing document.', function() {
		cy.get('#tb_editbar_item_setborderstyle')
			.click();

		cy.get('.w2ui-tb-image.w2ui-icon.frame13')
		    .click();

		cy.get('.lokdialog')
			.should('exist');
	});

});
