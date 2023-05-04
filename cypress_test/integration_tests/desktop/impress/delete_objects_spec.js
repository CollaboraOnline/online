/* global describe it cy require afterEach beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Delete Objects', function() {
	var origTestFileName = 'delete_objects.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Delete Text', function() {
		cy.cGet('.leaflet-layer').dblclick('center');
		cy.wait(1000);
		cy.cGet('.leaflet-pane.leaflet-overlay-pane svg g').should('exist');
		helper.typeIntoDocument('text');
		helper.selectAllText();
		helper.expectTextForClipboard('text');
		helper.typeIntoDocument('{del}');
		helper.typeIntoDocument('{ctrl}a');
		helper.textSelectionShouldNotExist();
	});


	it('Delete Shapes', function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertshapes').click();
		cy.cGet('.col.w2ui-icon.symbolshapes').click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});


	it('Delete Chart' , function() {
		cy.cGet('#toolbar-up > .w2ui-scroll-right').click();
		//insert
		cy.cGet('#tb_editbar_item_insertobjectchart')
			.click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});

	it.skip('Delete Table',function() {
		desktopHelper.selectZoomLevel('50');

		cy.cGet('#menu-table')
			.click()
			.contains('Insert Table...')
			.click();

		cy.cGet('.lokdialog_canvas').click();

		helper.typeIntoDocument('{shift}{enter}');

		cy.wait(2000);

		// Table is inserted with the markers shown
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('exist');

		cy.cGet('path.leaflet-interactive')
			.rightclick({force:true});

		cy.contains('.context-menu-item','Delete')
			.click();

		cy.wait(1000);

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');
	});

	it('Delete Fontwork', function() {
		cy.cGet('#menu-insert')
			.click()
			.contains('a','Fontwork...')
			.click();

		cy.cGet('#ok')
			.click();

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('exist');

		//delete
		helper.typeIntoDocument('{del}');

		cy.cGet('.leaflet-control-buttons-disabled path.leaflet-interactive')
			.should('not.exist');
	});
});
