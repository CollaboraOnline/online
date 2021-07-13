/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe('Delete Objects', function() {
	var testFileName = 'delete_objects.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Delete Text', function() {
		cy.get('.leaflet-layer')
			.dblclick('center');

		cy.wait(1000);

		cy.get('.leaflet-pane.leaflet-overlay-pane svg g')
			.should('exist');

		helper.typeIntoDocument('text');

		helper.selectAllText();

		helper.expectTextForClipboard('text');

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

	it.skip('Delete Table',function() {
		desktopHelper.selectZoomLevel('50');

		cy.get('#menu-table')
			.click()
			.contains('Insert Table...')
			.click();

		cy.get('.lokdialog_canvas').click();

		helper.typeIntoDocument('{shift}{enter}');

		cy.wait(2000);

		// Table is inserted with the markers shown
		cy.get('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		cy.get('path.leaflet-interactive')
			.rightclick({force:true});

		cy.contains('.context-menu-item','Delete')
			.click();

		cy.wait(1000);

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
