/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var mobileHelper = require('../../common/mobile_helper');
var repairHelper = require('../../common/repair_document_helper');

describe.skip(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Editing Operations', function() {
	var testFileName = 'undo_redo.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer');
		// Click on edit button
		mobileHelper.enableEditingMobile();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function undo() {
		helper.typeIntoDocument('Hello World');
		//if we don't wait tests in CI is failing
		cy.wait(1000);
		cy.cGet('#tb_actionbar_item_undo').click();
		helper.selectAllText();
		helper.expectTextForClipboard('Hello \n');
	}

	it('Undo', function() {
		undo();
	});

	it('Redo',function() {
		undo();
		cy.cGet('#tb_actionbar_item_redo').click();
		helper.selectAllText();
		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		helper.typeIntoDocument('Hello World');
		repairHelper.rollbackPastChange('Typing: “World”', undefined, true);
		helper.selectAllText();
		helper.expectTextForClipboard('Hello \n');
	});
});
