/* global describe it require cy afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage, assertImageSize } = require('../../common/desktop_helper');
var { triggerNewSVGForShapeInTheCenter } = require('../../common/impress_helper');

describe('Image Operation Tests', function() {
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
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.leaflet-control-buttons-disabled')
			.should('exist');

		deleteImage();
	});

	it('Resize image when keep ratio option enabled and disabled', function() {
		insertImage();
		//when Keep ratio is unchecked
		assertImageSize(438, 111);

		//sidebar needs more time
		cy.get('#sidebar-panel')
			.should('be.visible')
			.wait(2000)
			.scrollTo('bottom');

		cy.contains('.ui-expander-label', 'Position and Size')
			.should('be.visible').click();

		cy.get('#selectwidth input').clear({force:true})
			.type('10{enter}', {force:true});

		cy.get('#selectheight input').clear({force:true})
			.type('4{enter}', {force:true});

		triggerNewSVGForShapeInTheCenter();

		assertImageSize(463, 185);

		//Keep ratio checked
		//sidebar needs more time
		cy.get('#sidebar-panel')
			.should('be.visible')
			.wait(2000)
			.scrollTo('bottom');

		cy.contains('.ui-expander-label', 'Position and Size')
			.should('be.visible').click();

		helper.waitUntilIdle('#ratio input');

		cy.get('#ratio input').check();

		helper.waitUntilIdle('#selectheight');

		cy.get('#selectheight input').clear({force:true})
			.type('5{enter}', {force:true});

		triggerNewSVGForShapeInTheCenter();

		assertImageSize(579, 232);
	});
});
