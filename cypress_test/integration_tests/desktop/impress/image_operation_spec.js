/* global describe it require cy afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage, assertImageSize } = require('../../common/desktop_helper');
var { triggerNewSVGForShapeInTheCenter } = require('../../common/impress_helper');

describe(['tagnotebookbar'], 'Image Operation Tests', function() {
	var origTestFileName = 'image_operation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert/Delete image',function() {
		insertImage();

		//make sure that image is in focus
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.leaflet-control-buttons-disabled')
			.should('exist');

		deleteImage();
	});

	it('Resize image when keep ratio option enabled and disabled', function() {
		insertImage();
		//when Keep ratio is unchecked
		assertImageSize(438, 111);

		//sidebar needs more time
		cy.cGet('#sidebar-panel').should('be.visible').wait(2000).scrollTo('bottom');

		cy.cGet('#PosSizePropertyPanelPanelExpander-label').should('be.visible').click();

		cy.cGet('#selectwidth input').clear({force:true})
			.type('10{enter}', {force:true});

		cy.cGet('#selectheight input').clear({force:true})
			.type('4{enter}', {force:true});

		triggerNewSVGForShapeInTheCenter();

		assertImageSize(463, 185);

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

		assertImageSize(579, 232);
	});
});
