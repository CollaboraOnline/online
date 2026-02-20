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

		cy.getFrameWindow().then((win) => {
			this.win = win;
			helper.processToIdle(win);
		});

		impressHelper.selectTextShapeInTheCenter();

		cy.getFrameWindow().then(function(win) {
			helper.processToIdle(win);
		});

		impressHelper.dblclickOnSelectedShape();
	});

	function undo(win) {
		helper.processToIdle(win);
		helper.typeIntoDocument('Hello World');
		expectTypedText();
		helper.typeIntoDocument('{ctrl+z}');
		expectInitialText();
	}

	it('Undo', function() {
		helper.setDummyClipboardForCopy();
		undo(this.win);
	});

	it('Redo', function() {
		helper.setDummyClipboardForCopy();
		undo(this.win);
		helper.typeIntoDocument('{ctrl+y}');
		helper.processToIdle(this.win);
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
