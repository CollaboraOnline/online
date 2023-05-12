/* global describe it require cy afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage, deleteImage, assertImageSize } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Image Operation Tests', function() {
	var origTestFileName = 'image_operation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer');
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image',function() {
		insertImage();

		//make sure that image is in focus
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g.leaflet-control-buttons-disabled')
			.should('exist');

		deleteImage();
	});

	it('Resize image when keep ratio option enabled and disabled', function() {
		insertImage();
		//when Keep ratio is unchecked
		assertImageSize(248, 63);
		// if window is too small sidebar won't popup
		cy.viewport(1000, 660);

		helper.waitUntilIdle('#selectwidth input');

		cy.cGet('#selectwidth input').clear({force:true})
			.type('3{enter}', {force:true});

		helper.waitUntilIdle('#selectheight input');

		cy.cGet('#selectheight input').clear({force:true})
			.type('2{enter}', {force:true});

		cy.wait(1000);

		assertImageSize(139, 93);

		//Keep ratio checked
		cy.cGet('#ratio input').check();

		helper.waitUntilIdle('#selectheight input');

		cy.cGet('#selectheight input').clear({force:true})
			.type('5{enter}', {force:true});

		cy.wait(1000);

		assertImageSize(347, 232);
	});
});
