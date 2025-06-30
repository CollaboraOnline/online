/* global describe it require cy beforeEach */

var helper = require('../../common/helper');
var { insertImage, insertVideo, deleteImage } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');
var { triggerNewSVGForShapeInTheCenter } = require('../../common/impress_helper');

describe(['tagdesktop'], 'Image Operation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/image_operation.odp');
		cy.cGet('#optionstoolboxdown .unoModifyPage button').click();
		cy.cGet('#sidebar-panel').should('not.be.visible');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Insert/Delete image',function() {
		insertImage();

		//make sure that image is in focus
		cy.cGet('#document-container svg g')
			.should('exist');

		deleteImage();
	});

	it("Insert multimedia", function () {
		insertVideo();
	});

	it.skip('Crop Image', function () {
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

		cy.cGet('#canvas-container > svg').should('exist');
		cy.cGet('#test-div-shape-handle-3').should('exist');
		helper.assertImageSize(418, 111);
	});


	it('Resize image when keep ratio option enabled and disabled', function() {
		insertImage();
		//when Keep ratio is unchecked
		helper.assertImageSize(438, 111);

		cy.cGet('#optionstoolboxdown .unoModifyPage button').click();
		cy.cGet('#sidebar-panel').should('be.visible');

		//sidebar needs more time
		cy.cGet('#sidebar-dock-wrapper').should('be.visible').wait(2000).scrollTo('bottom');

		cy.cGet('.ui-expander-label').contains('Position and Size').should('be.visible').click();

		cy.cGet('#selectwidth input').type('{selectAll}{backspace}10{enter}');

		cy.cGet('#selectheight input').type('{selectAll}{backspace}4{enter}');

		triggerNewSVGForShapeInTheCenter();

		helper.assertImageSize(463, 185);

		//Keep ratio checked
		//sidebar needs more time
		cy.cGet('#sidebar-dock-wrapper').should('be.visible').wait(2000).scrollTo('bottom');

		cy.cGet('.ui-expander-label').contains('Position and Size').should('be.visible').click();

		cy.cGet('#ratio input').check();

		cy.cGet('#selectheight input').type('{selectAll}{backspace}5{enter}');

		triggerNewSVGForShapeInTheCenter();

		helper.assertImageSize(579, 232);
	});
});
