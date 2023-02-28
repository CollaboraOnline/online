/* global describe it require cy afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage, assertImageSize } = require('../../common/desktop_helper');

describe('Image Operation Tests', function() {
	var origTestFileName = 'image_operation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image',function() {
		insertImage();

		//make sure that image is in focus
		cy.get('.leaflet-pane.leaflet-overlay-pane svg g.leaflet-control-buttons-disabled')
			.should('exist');

		deleteImage();
	});

	it('Resize image when keep ratio option enabled and disabled', function() {
		insertImage();
		//when Keep ratio is unchecked
		assertImageSize(248, 63);
		// if window is too small sidebar won't popup
		cy.viewport(1000, 660);

		cy.get('#selectwidth input').clear({force:true})
			.type('3{enter}', {force:true});

		cy.get('#selectheight input').clear({force:true})
			.type('2{enter}', {force:true});

		assertImageSize(139, 93);

		//Keep ratio checked
		cy.get('#ratio input').check();

		cy.get('#selectheight input').clear({force:true})
			.type('5{enter}', {force:true});

		assertImageSize(347, 232);
	});
});
