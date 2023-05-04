/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');


describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {
	var origTestFileName = 'delete_objects.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Delete Text', function() {

		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.expectTextForClipboard('text');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();

		cy.cGet('#tb_editbar_item_insertshapes')
			.click()
			.cGet('.col.w2ui-icon.symbolshapes')
			.click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it.skip('Delete Chart' , function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertobjectchart')
			.click();

		helper.clickOnIdle('.ui-pushbutton.jsdialog.button-primary');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.wait(2000);

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});
});
