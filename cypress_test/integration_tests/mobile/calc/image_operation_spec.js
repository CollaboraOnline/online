/* global describe cy it beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe('Image Operation Tests', function() {
	var testFileName = 'image_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

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
		mobileHelper.insertImage();
		var eventOptions = {
			force: true,
			button: 0,
			pointerType: 'mouse'
		};

		cy.get('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('not.exist');
	});
});
