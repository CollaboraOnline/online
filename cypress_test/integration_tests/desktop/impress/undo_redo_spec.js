/* global describe it beforeEach require cy */

var helper = require('../../common/helper');
var impressHelper = require('../../common/impress_helper');
var desktopHelper = require('../../common/desktop_helper');
var repairHelper = require('../../common/repair_document_helper');

describe(['tagdesktop'], 'Editing Operations', function() {

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

		cy.log('expectTypedText - END');
	}

	beforeEach(function() {
		helper.setupAndLoadDocument('impress/undo_redo.odp');
		// close the default slide-sorter navigation sidebar
		desktopHelper.closeNavigatorSidebar();
		desktopHelper.selectZoomLevel('30', false);

		impressHelper.selectTextShapeInTheCenter();
		impressHelper.dblclickOnSelectedShape();
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
		impressHelper.dblclickOnSelectedShape();
		helper.typeIntoDocument('Overwrite Text');
		impressHelper.triggerNewSVGForShapeInTheCenter();
		repairHelper.rollbackPastChange('Undo', false, true);
		impressHelper.triggerNewSVGForShapeInTheCenter();
		expectTypedText();
	});
});
