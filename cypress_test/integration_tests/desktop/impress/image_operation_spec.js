/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage } = require('../../common/desktop_helper');

describe('Image Operation Tests', function() {
	var origTestFileName = 'image_operation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image',function() {
		insertImage();
	});

	it('Delete Image', function() {
		//close sidebar because it is covering other elements
		cy.get('#toolbar-up > .w2ui-scroll-right').click();

		cy.get('#tb_editbar_item_modifypage').click();

		deleteImage();
	});
});
