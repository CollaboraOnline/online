/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');
var repairHelper = require('../../common/repair_document_helper');

describe('Editing Operations', function() {
	var testFileName = 'undo_redo.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		desktopHelper.selectZoomLevel('30');

		impressHelper.selectTextShapeInTheCenter();

		cy.get('g.leaflet-control-buttons-disabled svg').dblclick({force:true});
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		helper.typeIntoDocument('Hello World');

		helper.typeIntoDocument('{ctrl}z');

		helper.selectAllText();

		helper.expectTextForClipboard('Hello Worl');
	}

	it('Undo', function() {
		undo();
	});

	it('Redo', function() {
		undo();
		helper.typeIntoDocument('{ctrl}y');

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		helper.typeIntoDocument('Hello World');

		helper.typeIntoDocument('{esc}');

		cy.wait(1000);

		impressHelper.selectTextShapeInTheCenter();

		impressHelper.selectTextOfShape();

		cy.wait(1000);

		helper.typeIntoDocument('Overwrite Text');

		helper.typeIntoDocument('{esc}');

		cy.wait(1000);

		repairHelper.rollbackPastChange('Undo');

		impressHelper.selectTextShapeInTheCenter();

		impressHelper.selectTextOfShape();

		cy.wait(1000);

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});
});
