/* global describe it beforeEach require cy */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');
var repairHelper = require('../../common/repair_document_helper');

describe(['tagdesktop'], 'Editing Operations', function() {

	function skipMessage() {
		// FIXME: receiveMessage: {"MessageId":"Doc_ModifiedStatus","SendTime":1741357902023,"Values":{"Modified":true}}
		// FIXME: that message seems to close blinking cursor
		cy.wait(1500);
	}

	function expectInitialText() {
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('{ctrl+a}');
		helper.copy();
		impressHelper.dblclickOnSelectedShape();
		helper.clipboardTextShouldBeDifferentThan('Hello World');
	}

	function expectTypedText() {
		cy.log('expectTypedText - START');

		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('{ctrl+a}');
		helper.copy();

		impressHelper.dblclickOnSelectedShape();
		helper.expectTextForClipboard('Hello World');
		cy.wait(1000);

		cy.log('expectTypedText - END');
	}

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/undo_redo.odp');
		desktopHelper.switchUIToCompact();
		desktopHelper.selectZoomLevel('30', false);

		skipMessage();
		impressHelper.selectTextShapeInTheCenter();
		impressHelper.dblclickOnSelectedShape();
		skipMessage();
	});

	function undo() {
		helper.typeIntoDocument('Hello World');
		expectTypedText();
		helper.typeIntoDocument('{ctrl+z}');
		expectInitialText();
	}

	it('Undo', function() {
		helper.setDummyClipboardForCopy();
		undo();
	});

	it('Redo', function() {
		helper.setDummyClipboardForCopy();
		undo();
		helper.typeIntoDocument('{ctrl+y}');
		expectTypedText();
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
		expectTypedText();
	});
});
