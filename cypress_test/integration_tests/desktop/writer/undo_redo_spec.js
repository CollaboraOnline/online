/* global cy describe it beforeEach require */

var helper = require('../../common/helper');
var repairHelper = require('../../common/repair_document_helper');
const desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop', 'tagnextcloud', 'tagproxy'], 'Editing Operations', function() {
	var testFileName = 'undo_redo.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
		desktopHelper.switchUIToCompact();
	});

	function undo() {
		helper.typeIntoDocument('Hello World');

		helper.typeIntoDocument('{ctrl}z');

		helper.selectAllText();

		helper.copy();
		helper.expectTextForClipboard('Hello ');
	}

	it('Undo', function() {
		helper.setDummyClipboardForCopy();
		undo();
	});


	it('Redo', function() {
		helper.setDummyClipboardForCopy();
		undo();
		helper.typeIntoDocument('{ctrl}y');

		helper.selectAllText();
		cy.wait(500);
		helper.copy();
		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('Hello World');

		repairHelper.rollbackPastChange('Typing: “World”');

		helper.selectAllText();

		helper.copy();
		helper.expectTextForClipboard('Hello ');
	});
});
