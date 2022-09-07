/* global describe it beforeEach require afterEach*/

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var repairHelper = require('../../common/repair_document_helper');

describe('Editing Operations', function() {
	var testFileName = 'undo_redo.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		helper.typeText('textarea.clipboard', 'Hello World');

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

		repairHelper.rollbackPastChange('Undo');

		calcHelper.dblClickOnFirstCell();

		helper.selectAllText();

		helper.expectTextForClipboard('Hello World');
	});
});
