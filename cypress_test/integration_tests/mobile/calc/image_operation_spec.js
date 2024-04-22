/* global describe cy it beforeEach require */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Image Operation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/image_operation.ods');

		// Click on edit button
		mobileHelper.enableEditingMobile();
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

		cy.cGet('.bottomright-svg-pane > .leaflet-control-buttons-disabled > .leaflet-interactive')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('not.exist');
	});
});
