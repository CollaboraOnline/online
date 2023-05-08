/* global describe it cy beforeEach expect require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var impressHelper = require('../../common/impress_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Table Operation', function() {
	var origTestFileName = 'table_operation.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function retriggerNewSvgForTableInTheCenter() {
		impressHelper.removeShapeSelection();

		helper.typeIntoDocument('{ctrl}{a}');
	}

	function selectFullTable() {
		helper.typeIntoDocument('{ctrl}{a}');

		impressHelper.selectTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 3);
		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 2);
		cy.cGet('text.SVGTextShape').click({force: true});
		cy.wait(1000);
	}

	function clickOnTableOperation(operation) {
		mobileHelper.openHamburgerMenu();
		cy.cGet('.menu-entry-icon.tablemenu').parent().click();
		cy.cGet('.menu-entry-icon.' + operation).parent().click();
	}

	it('Insert Before', function() {
		selectFullTable();

		clickOnTableOperation('insertrowsbefore');

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

		clickOnTableOperation('insertrowsafter');

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

	it.skip('Insert column before.', function() {
		selectFullTable();

		helper.typeIntoDocument('{downarrow}');

		clickOnTableOperation('deleterows');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 2);

		clickOnTableOperation('insertcolumnsbefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('have.class', 'com.sun.star.drawing.TableShape');

		//assert the number of cells
		cy.cGet('g.Page path[fill^="rgb"]')
			.should(function(cells) {
				expect(cells).to.have.lengthOf(6);
			});

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'x', '14339');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page .TextParagraph .TextPosition')
			.should('have.attr', 'y', '5644');
	});

	it('Insert column after.', function() {
		selectFullTable();

		helper.typeIntoDocument('{downarrow}');

		clickOnTableOperation('deleterows');

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker').should('have.length', 2);

		clickOnTableOperation('insertcolumnsafter');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker').should('have.length', 3);

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

	it('Delete row.', function() {
		selectFullTable();

		clickOnTableOperation('deleterows');

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

		clickOnTableOperation('insertcolumnsbefore');

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('have.length', 3);

		clickOnTableOperation('deletecolumns');

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

	it('Merge Row', function() {
		selectFullTable();

		cy.cGet('.leaflet-marker-icon.table-row-resize-marker')
			.should('have.length', 3);

		clickOnTableOperation('entirerow');

		helper.waitUntilIdle('.leaflet-control-buttons-disabled svg');

		clickOnTableOperation('mergecells');

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

		clickOnTableOperation('entirecolumn');

		helper.waitUntilIdle('.leaflet-control-buttons-disabled svg');

		clickOnTableOperation('mergecells');

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

	it('Delete Table', function() {
		selectFullTable();

		clickOnTableOperation('deletetable');

		retriggerNewSvgForTableInTheCenter();

		cy.cGet('.leaflet-marker-icon.table-column-resize-marker')
			.should('not.exist');

		cy.cGet('.leaflet-pane.leaflet-overlay-pane g.Page g')
			.should('not.exist');
	});
	//TODO: add split cells tests
	//bug: https://github.com/CollaboraOnline/online/issues/3962
});
