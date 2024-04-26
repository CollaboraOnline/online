/* global describe it beforeEach require */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');
var repairHelper = require('../../common/repair_document_helper');

describe(['tagdesktop'], 'Editing Operations', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/undo_redo.odp');
		desktopHelper.switchUIToCompact();
		desktopHelper.selectZoomLevel('30');
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.editTextInShape();
	});

	function undo() {
		helper.typeIntoDocument('Hello World');
		impressHelper.selectTextOfShape();
		helper.typeIntoDocument('{ctrl}z');
		impressHelper.selectTextOfShape();
		helper.copy();
		helper.clipboardTextShouldBeDifferentThan('Hello World');
	}

	it('Undo', function() {
		helper.setDummyClipboardForCopy();
		undo();
	});

	it('Redo', function() {
		helper.setDummyClipboardForCopy();
		undo();
		helper.typeIntoDocument('{ctrl}y');
		impressHelper.selectTextOfShape();
		helper.copy();
		helper.expectTextForClipboard('Hello World');
	});

	it('Repair Document', function() {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('Hello World');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.selectTextOfShape();
		helper.typeIntoDocument('Overwrite Text');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		repairHelper.rollbackPastChange('Undo');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.selectTextOfShape();
		helper.copy();
		helper.expectTextForClipboard('Hello World');
	});
});
