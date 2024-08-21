/* global describe  cy beforeEach it expect require */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagdesktop'], 'Table operations', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/table_operation.odp');
		desktopHelper.selectZoomLevel('50', false);
	});

	function selectOptionNotebookbar(optionId) {
		var optionButton = cy.cGet(optionId);
		// It takes time for the ui to enable the various table toolbar buttons after
		// the table gets focus, but we can continue as soon as:
		optionButton.should('not.have.class', 'disabled');
		optionButton.click();
	}

	function retriggerNewSvgForTableInTheCenter() {
		impressHelper.removeShapeSelection();

		helper.typeIntoDocument('{ctrl}{a}');
	}

	function selectFullTable() {
		helper.typeIntoDocument('{ctrl}{a}');

		impressHelper.selectTableInTheCenter();
		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length.above', 2);
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 2);

		// Click doesn't work without wait
		cy.wait(500);
		cy.cGet('text.SVGTextShape').click({force: true});

	}

	it('Insert Row Before', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-insert-rows-before');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);
		retriggerNewSvgForTableInTheCenter();
		cy.cGet('#document-container g.Page g').should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(8);
			});

		//assert the text position
		cy.cGet('#document-container g.Page .TextParagraph .TextPosition').should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition').should('have.attr', 'y', '5644');
	});

	it('Insert Row After', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-insert-rows-after');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 4);
		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(8);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Insert column before.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-insert-columns-before');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(9);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '14339');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Insert column after.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-insert-columns-after');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(9);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Delete row.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-delete-rows');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
			});

		//cy.cGet('#document-container g.Page .TextParagraph .TextPosition').should('not.exist');
	});

	it('Delete Column.', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		helper.listenProtocol('shapeselectioncontent:');
		selectOptionNotebookbar('#table-insert-columns-before');
		cy.cGet('#listener-protocol').should('exist');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#table-delete-columns');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 2);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(6);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Delete Table', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();
		selectOptionNotebookbar('#table-delete-table');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		cy.cGet('#document-container g.Page g')
			.should('not.exist');
	});

	it('Merge Row', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#table-entire-row');
		cy.wait(1000);
		selectOptionNotebookbar('#table-merge-cells');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(5);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Merge Column', function() {
		desktopHelper.switchUIToNotebookbar();
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('#table-entire-column');
		cy.wait(1000);
		selectOptionNotebookbar('#table-merge-cells');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('#document-container g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(4);
			});

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '7290');

		cy.cGet('#document-container g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it.skip('Split Cells', function() {
		// ToDo: Merge cells before calling split cells function.
		desktopHelper.switchUIToNotebookbar();
		impressHelper.selectTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		selectOptionNotebookbar('.notebookbar #SplitCell');

		cy.cGet('#SplitCellsDialog').should('be.visible');

		cy.cGet('#SplitCellsDialog .ui-pushbutton.jsdialog.button-primary')
			.click();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);
	});
});
