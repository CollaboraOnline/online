/* global describe it require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage } = require('../../common/desktop_helper');

describe('Image Operation Tests', function() {
	var testFileName = 'image_operation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image',function() {
		insertImage();
	});

	it('Delete Image', function() {
		deleteImage();
	});
});
