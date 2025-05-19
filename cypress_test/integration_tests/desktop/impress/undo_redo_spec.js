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

	function expectInitialText() {
		impressHelper.dblclickOnSelectedShape();
		helper.copy();
		helper.clipboardTextShouldBeDifferentThan('Hello World');
	}

	function expectTypedText() {
		cy.log('expectTypedText - START');

		impressHelper.dblclickOnSelectedShape();
		helper.copy();
		helper.expectTextForClipboard('Hello World');

		cy.log('expectTypedText - END');
	}

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/undo_redo.odp');
		desktopHelper.switchUIToCompact();
		// close the default slide-sorter navigation sidebar
		desktopHelper.closeNavigatorSidebar();
		desktopHelper.selectZoomLevel('30', false);
		impressHelper.selectTextShapeInTheCenter();
		skipMessage();
		expectInitialText();
	});

	function undo() {
		helper.typeIntoDocument('Hello World');
		skipMessage();
		expectTypedText();
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('{ctrl}z');
		expectInitialText();
	}

	it('Undo', function() {
		helper.setDummyClipboardForCopy();
		undo();
	});

	it('Redo', function() {
		helper.setDummyClipboardForCopy();
		undo();
		helper.typeIntoDocument('{ctrl}y');
		expectTypedText();
	});

	it('Repair Document', function() {
		helper.setDummyClipboardForCopy();
		helper.typeIntoDocument('Hello World');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('Overwrite Text');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		repairHelper.rollbackPastChange('Undo');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		expectTypedText();
	});
});
