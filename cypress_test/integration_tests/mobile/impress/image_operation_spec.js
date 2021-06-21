/* global describe it beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Image Operation Tests', function() {
	var testFileName = 'image_operation.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image', function() {
		mobileHelper.insertImage();
	});

	it('Delete Image', function() {
		mobileHelper.deleteImage();
	});
});
