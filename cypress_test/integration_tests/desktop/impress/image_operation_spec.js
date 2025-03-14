/* global describe it require cy beforeEach */

var helper = require('../../common/helper');
var { insertImage, insertVideo, deleteImage } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');
var { triggerNewSVGForShapeInTheCenter } = require('../../common/impress_helper');

describe(['tagdesktop'], 'Image Operation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/image_operation.odp');
	});

	it('Insert/Delete image',function() {
		desktopHelper.switchUIToNotebookbar();
		insertImage();

		//make sure that image is in focus
		cy.cGet('#document-container svg g')
			.should('exist');

		deleteImage();
	});

	it("Insert multimedia", function () {
		desktopHelper.switchUIToNotebookbar();
		insertVideo();
	});

	it('Crop Image', function () {
		// close sidebar
		cy.cGet('.unospan-options-modify-page.unoModifyPage').click();
		insertImage();
		helper.assertImageSize(438, 111);

		cy.cGet('#Crop').should('be.visible');
		cy.cGet('#Crop').click();

		cy.cGet('#test-div-shape-handle-3').then(($handle) => {
			const rect = $handle[0].getBoundingClientRect();
			const startX = rect.left + rect.width / 2;
			const startY = rect.top + rect.height / 2;
			const moveX = 20;

			cy.cGet('body').realMouseDown({ x: startX, y: startY });
			cy.cGet('body').realMouseMove(startX + moveX, startY);
			cy.cGet('body').realMouseUp();
		});

		cy.wait(1000);
		cy.cGet('#test-div-shape-handle-3').should('exist');
		cy.cGet('#canvas-container > svg').should('exist');
		helper.assertImageSize(418, 111);
	});


	it('Resize image when keep ratio option enabled and disabled', function() {
		desktopHelper.switchUIToNotebookbar();
		insertImage();
		//when Keep ratio is unchecked
		helper.assertImageSize(438, 111);

		//sidebar needs more time
		cy.cGet('#sidebar-panel').should('be.visible').wait(2000).scrollTo('bottom');

		cy.cGet('#PosSizePropertyPanelPanelExpander-label').should('be.visible').click();

		cy.cGet('#selectwidth input').clear({force:true})
			.type('10{enter}', {force:true});

		cy.cGet('#selectheight input').clear({force:true})
			.type('4{enter}', {force:true});

		triggerNewSVGForShapeInTheCenter();

		helper.assertImageSize(463, 185);

		//Keep ratio checked
		//sidebar needs more time
		cy.cGet('#sidebar-panel').should('be.visible').wait(2000).scrollTo('bottom');

		cy.cGet('#PosSizePropertyPanelPanelExpander-label').should('be.visible').click();

		helper.waitUntilIdle('#ratio input');

		cy.cGet('#ratio input').check();

		helper.waitUntilIdle('#selectheight');

		cy.cGet('#selectheight input').clear({force:true})
			.type('5{enter}', {force:true});

		triggerNewSVGForShapeInTheCenter();

		helper.assertImageSize(579, 232);
	});
});
