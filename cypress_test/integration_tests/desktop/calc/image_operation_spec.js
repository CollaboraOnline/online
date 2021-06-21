/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var { insertImage } = require('../../common/desktop_helper');

describe('Image Operation Tests', function() {
	var testFileName = 'image_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert Image',function() {
		insertImage();
	});

	it('Delete Image', function() {
		//close sidebar because it is covering other elements
		cy.get('#toolbar-up > .w2ui-scroll-right').click();

		cy.get('#tb_editbar_item_sidebar').click();

		insertImage();

		helper.typeIntoDocument('{del}');

	    cy.wait(1000);

	    cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
		    .should('not.exist');
	});
});
