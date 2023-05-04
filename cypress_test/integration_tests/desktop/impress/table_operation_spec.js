/* global describe  cy beforeEach it Cypress expect require afterEach  */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var impressHelper = require('../../common/impress_helper');
var mode = Cypress.env('USER_INTERFACE');

describe(['tagnotebookbar'], 'Table operations', function() {
	var origTestFileName = 'table_operation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectOptionClassic(mainMenuId,hasSubMenu,subMenu1,subOption) {
		cy.cGet(mainMenuId).click();

		if (hasSubMenu) {
			cy.cGet('body').contains(mainMenuId + ' li .has-submenu', subMenu1).trigger('click');
		} else {
			subOption = subMenu1;
		}
		cy.cGet('body').contains(mainMenuId + ' li', subOption).click();
	}

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#InsertRowsBefore') : selectOptionClassic('#menu-table', true, 'Insert', 'Insert Row Above');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#InsertRowsAfter') : selectOptionClassic('#menu-table', true, 'Insert', 'Insert Row Below');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#InsertColumnsBefore') : selectOptionClassic('#menu-table', true, 'Insert', 'Insert Column Before');

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#InsertColumnsAfter') : selectOptionClassic('#menu-table', true, 'Insert', 'Insert Column After');

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#DeleteRows') : selectOptionClassic('#menu-table', true, 'Delete', 'Delete Row');

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
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('#InsertColumnsBefore') : selectOptionClassic('#menu-table', true, 'Insert', 'Insert Column Before');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		mode === 'notebookbar' ? selectOptionNotebookbar('#DeleteColumns') : selectOptionClassic('#menu-table', true, 'Delete', 'Delete Column');

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

	it.skip('Delete Table', function() {
		selectFullTable();

		mode === 'notebookbar' ? selectOptionNotebookbar('.unospan-Table.unoDeleteTable') : selectOptionClassic('#menu-table', true, 'Delete', 'Delete Table');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('not.exist');
	});

	it('Merge Row', function() {
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		mode === 'notebookbar' ? selectOptionNotebookbar('#EntireRow') : selectOptionClassic('#menu-table', true, 'Select', 'Select Row');

		cy.wait(1000);

		mode === 'notebookbar' ? selectOptionNotebookbar('#MergeCells') : selectOptionClassic('#menu-table', false, 'Merge Cells');

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
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		mode === 'notebookbar' ? selectOptionNotebookbar('#EntireColumn') : selectOptionClassic('#menu-table', true, 'Select', 'Select Column');

		cy.wait(1000);

		mode === 'notebookbar' ? selectOptionNotebookbar('#MergeCells') : selectOptionClassic('#menu-table', false, 'Merge Cells');

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
		//FIXME: https://github.com/CollaboraOnline/online/issues/3964
		if (mode !== 'notebookbar') {
			return;
		}

		impressHelper.selectTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		helper.waitUntilIdle('.unospan-Table.unoSplitCell');

		selectOptionNotebookbar('.unospan-Table.unoSplitCell');

		cy.cGet('#SplitCellsDialog').should('be.visible');

		cy.cGet('#SplitCellsDialog .ui-pushbutton.jsdialog.button-primary')
			.click();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 4);
	});
});
