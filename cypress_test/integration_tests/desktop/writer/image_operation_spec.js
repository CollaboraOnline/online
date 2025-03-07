/* global describe it require cy beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Image Operation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('writer/image_operation.odt');
		desktopHelper.shouldHaveZoomLevel('70');
	});

	it('Insert Image',function() {
		insertImage();

		//make sure that image is in focus
		cy.cGet('#document-container svg g').should('exist');

		deleteImage();
	});

	it('Crop', function () {
		insertImage();
		helper.assertImageSize(248, 63);
		cy.cGet('#test-div-shape-handle-3').should('exist');
		cy.cGet('#Crop').should('be.visible');
		cy.cGet('#Crop').click();

		cy.cGet('#test-div-shape-handle-3').then(($handle) => {
			const rect = $handle[0].getBoundingClientRect();
			const startX = rect.left + rect.width / 2;
			const startY = rect.top + rect.height / 2;
			const moveX = 20;

			cy.cGet('body').realMouseDown({ x: startX, y: startY });

			cy.cGet('body').realMouseMove(startX + moveX, startY);

			// for some reason even after moving the crop marker 20 px, on realMouseUp crop marker moves a lot more than expected
			// but it seems to related to how realMouseUp is implemented
			cy.cGet('body').realMouseUp();
		});

		cy.wait(1000);
		helper.assertImageSize(43, 63);
	});

	it('Resize image when keep ratio option enabled and disabled', function() {
		cy.viewport(1000, 660);

		insertImage();
		//when Keep ratio is unchecked
		helper.assertImageSize(248, 63);
		// if window is too small sidebar won't popup

		helper.waitUntilIdle('#selectwidth input');

		cy.cGet('#selectwidth input').clear({force:true})
			.type('3{enter}', {force:true});

		helper.waitUntilIdle('#selectheight input');

		cy.cGet('#selectheight input').clear({force:true})
			.type('2{enter}', {force:true});

		cy.wait(1000);

		helper.assertImageSize(139, 93);

		//Keep ratio checked
		cy.cGet('#ratio input').check();

		helper.waitUntilIdle('#selectheight input');

		cy.cGet('#selectheight input').clear({force:true})
			.type('5{enter}', {force:true});

		cy.wait(1000);

		helper.assertImageSize(347, 232);
	});
});
