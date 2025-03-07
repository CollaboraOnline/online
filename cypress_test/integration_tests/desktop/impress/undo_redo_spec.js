/* global describe it beforeEach require cy */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');
var repairHelper = require('../../common/repair_document_helper');

describe(['tagdesktop'], 'Editing Operations', function() {

	function skipMessage() {
		// FIXME: receiveMessage: {"MessageId":"Doc_ModifiedStatus","SendTime":1741357902023,"Values":{"Modified":true}}
		// FIXME: that message seems to close blinking cursor
		cy.wait(500);
	}

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/undo_redo.odp');
		desktopHelper.switchUIToCompact();
		desktopHelper.selectZoomLevel('30', false);
		impressHelper.selectTextShapeInTheCenter();
		skipMessage();
		impressHelper.dblclickOnSelectedShape();
	});

	function undo() {
		helper.typeIntoDocument('Hello World');
		skipMessage();
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('{ctrl}z');
		impressHelper.dblclickOnSelectedShape();
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
