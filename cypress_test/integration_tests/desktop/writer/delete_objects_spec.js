/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');

describe('Delete Objects', function() {
	var testFileName = 'delete_objects.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Delete Text', function() {
		helper.typeIntoDocument('text');

		helper.selectAllText();

		helper.expectTextForClipboard('\ntext');

		helper.typeIntoDocument('{del}');

		helper.typeIntoDocument('{ctrl}a');

		helper.textSelectionShouldNotExist();
	});

	it('Delete Shapes', function() {
		cy.get('#toolbar-up > .w2ui-scroll-right').click();
		//insert
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

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it('Delete Table', function() {
		cy.get('#menu-table')
			.click()
			.contains('Insert Table...')
			.click();

		helper.typeIntoDocument('{shift}{enter}');

		cy.wait(2000);

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		helper.typeIntoDocument('{ctrl}a');

		// Two rows
		cy.get('#copy-paste-container tr')
			.should('have.length', 2);
		// Four cells
		cy.get('#copy-paste-container td')
			.should('have.length', 4);

		helper.typeIntoDocument('{ctrl}a');

		helper.typeIntoDocument('{shift}{del}');

		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');
	});

	it('Delete Fontwork', function() {
		cy.get('#menu-insert')
			.click()
			.contains('a','Fontwork...')
			.click();

		cy.get('#ok')
			.click();

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.get('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});
});
