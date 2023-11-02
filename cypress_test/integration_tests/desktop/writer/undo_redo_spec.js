/* global cy describe it beforeEach require afterEach*/

var helper = require('../../common/helper');
var repairHelper = require('../../common/repair_document_helper');
const desktopHelper = require('../../common/desktop_helper');

describe.skip(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Editing Operations', function() {
	var testFileName = 'undo_redo.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
		desktopHelper.switchUIToCompact();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		helper.typeIntoDocument('Hello World');

		helper.typeIntoDocument('{ctrl}z');

		helper.selectAllText();

		helper.expectTextForClipboard('Hello ');
	}

	it('Undo', function() {
		undo();
	});


	it('Redo', function() {
		undo();
		helper.typeIntoDocument('{ctrl}y');

		helper.selectAllText();
		cy.wait(500);
		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		helper.typeIntoDocument('Hello World');

		repairHelper.rollbackPastChange('Typing: “World”');

		helper.selectAllText();

		helper.expectTextForClipboard('Hello ');
	});
});
