/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Editing Operations', function() {
	var testFileName = 'undo_redo.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		cy.wait(1000);

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

		helper.typeIntoDocument('{enter}');

		calcHelper.dblClickOnFirstCell();

		helper.clearAllText();

		helper.typeIntoDocument('Hello');

		helper.typeIntoDocument('{enter}');

		cy.get('#menu-editmenu').click()
			.get('#menu-repair').click();

		cy.get('.leaflet-popup-content table').should('exist');

		cy.contains('.leaflet-popup-content table tbody tr','Undo').eq(0)
			.click();

		cy.get('.leaflet-popup-content > input').click();

		calcHelper.dblClickOnFirstCell();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});
});
