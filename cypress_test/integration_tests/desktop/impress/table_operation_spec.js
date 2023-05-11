/* global describe  cy beforeEach it expect require afterEach  */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagdesktop'], 'Table operations', function() {
	var origTestFileName = 'table_operation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectOptionNotebookbar(optionId) {
		cy.cGet(optionId).click();
	}

	function retriggerNewSvgForTableInTheCenter() {
		impressHelper.removeShapeSelection();

		helper.typeIntoDocument('{ctrl}{a}');
	}

	function selectFullTable() {
		helper.typeIntoDocument('{ctrl}{a}');

		impressHelper.selectTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 2);

		cy.cGet('text.SVGTextShape').click({force: true});

		cy.wait(1000);
	}

	it('Insert Row Before', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#InsertRowsBefore');
		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);
		retriggerNewSvgForTableInTheCenter();
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g').should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(8);
			});

		//assert the text position
		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '6643');
	});

	it('Insert Row After', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#InsertRowsAfter');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);
		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(8);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Insert column before.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#InsertColumnsBefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(9);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '14339');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Insert column after.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#InsertColumnsAfter');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(9);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Delete row.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#DeleteRows');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('not.exist');
	});

	it('Delete Column.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#InsertColumnsBefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#DeleteColumns');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 2);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(6);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Delete Table', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('.cell.notebookbar #DeleteTable');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('not.exist');
	});

	it('Merge Row', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#EntireRow');
		cy.wait(1000);
		selectOptionNotebookbar('#MergeCells');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(5);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Merge Column', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#EntireColumn');
		cy.wait(1000);
		selectOptionNotebookbar('#MergeCells');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it.skip('Split Cells', function() {
		// ToDo: Merge cells before calling split cells function.
		desktopHelper.switchUIToNotebookbar();
		impressHelper.selectTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('.cell.notebookbar #SplitCell');

		cy.cGet('#SplitCellsDialog').should('be.visible');

		cy.cGet('#SplitCellsDialog .ui-pushbutton.jsdialog.button-primary')
			.click();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);
	});
});
