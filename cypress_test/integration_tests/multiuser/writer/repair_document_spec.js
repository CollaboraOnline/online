/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var repairHelper = require('../../common/repair_document_helper');

describe('Repair Document', function() {
	var origTestFileName = 'repair_doc.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.typeIntoDocument('Hello World', frameId1);

		cy.wait(2000);

		repairHelper.rollbackPastChange('Typing: “World”', frameId2);

		cy.customGet('.leaflet-layer', frameId2).click();

		cy.wait(500);

		helper.selectAllText(frameId2);

		helper.expectTextForClipboard('Hello \n', frameId2);

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.selectAllText(frameId1);

		helper.expectTextForClipboard('Hello \n', frameId1);
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
