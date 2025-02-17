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

		cy.cGet('.leaflet-layer')
			.trigger('pointerdown', eventOptions)
			.wait(1000)
			.trigger('pointerup', eventOptions);

		cy.cGet('body').contains('.menu-entry-with-icon', 'Delete')
			.should('be.visible').click();

		cy.cGet('#document-container svg g').should('not.exist');
	});

	it('Crop Image', function () {
		mobileHelper.insertImage();

		cy.cGet('.mobile-wizard-back.close-button').click();

		helper.assertImageSize(514, 130);

		cy.cGet('#test-div-shape-handle-3').should('exist');
		cy.cGet('#toolbar-down .ui-scroll-right').click({ force: true });
		cy.cGet('#toolbar-down .ui-scroll-right').click({ force: true });
		cy.cGet('#crop-button').click({ force: true });

		cy.cGet('#test-div-shape-handle-3').then(($handle) => {
			const rect = $handle[0].getBoundingClientRect();
			const startX = rect.left + rect.width / 2;
			const startY = rect.top + rect.height / 2;
			const moveX = 20;

			cy.cGet('body').realSwipe("toRight", { x: startX, y: startY, length: moveX });
		});

		cy.wait(1000);
		helper.assertImageSize(494, 130);
	});
});
