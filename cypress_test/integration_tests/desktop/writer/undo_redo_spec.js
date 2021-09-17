/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');

describe('Editing Operations', function() {
	var testFileName = 'undo_redo.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		helper.typeIntoDocument('Hello World');

		helper.typeIntoDocument('{ctrl}z');

		helper.selectAllText();

		helper.expectTextForClipboard('\nHello Worl');
	}

	it('Undo', function() {
		undo();
	});


	it('Redo', function() {
		undo();
		helper.typeIntoDocument('{ctrl}y');

		helper.selectAllText();

		helper.expectTextForClipboard('\nHello World');
	});

	it('Repair Document', function() {
		helper.typeIntoDocument('Hello');

		cy.get('#menu-editmenu').click()
			.get('#menu-repair').click();

		cy.get('.leaflet-popup-content table').should('exist');

		cy.contains('.leaflet-popup-content table tbody tr','Typing: “e”')
			.dblclick();

		helper.expectTextForClipboard('\nH');
	});
});
