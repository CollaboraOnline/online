/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var repairHelper = require('../../common/repair_document_helper');

describe.skip(['tagmultiuser'], 'Repair Document', function() {
	var origTestFileName = 'repair_doc.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click();

		helper.typeIntoDocument('Hello World');

		cy.wait(2000);

		cy.cSetActiveFrame(frameId2);
		repairHelper.rollbackPastChange('Typing: “World”');
		cy.cGet('.leaflet-layer').click();
		cy.wait(500);
		helper.selectAllText();
		helper.expectTextForClipboard('Hello \n');

		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click();
		helper.selectAllText();
		helper.expectTextForClipboard('Hello \n');
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
