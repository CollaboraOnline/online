/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');


describe('Delete Objects', function() {
	var testFileName = 'delete_objects.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
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
		cy.get('#toolbar-up > .w2ui-scroll-right').click();

		cy.get('#tb_editbar_item_insertshapes')
			.click()
			.get('.col.w2ui-icon.symbolshapes')
			.click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Delete Chart' , function() {
		cy.get('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.get('#tb_editbar_item_insertobjectchart')
			.click();

		cy.get('.lokdialog_canvas').click();

		helper.typeIntoDocument('{shift}{enter}');

		cy.wait(2000);

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.wait(2000);

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});
});
