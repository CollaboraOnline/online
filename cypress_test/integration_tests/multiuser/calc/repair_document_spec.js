/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe.skip('Repair Document', function() {
	var origTestFileName = 'repair_doc.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {
		cy.wait(1000);

		helper.typeIntoDocument('Hello World{enter}', frameId1);

		//wait for the popup to disappear
		cy.wait(5000);

		cy.customGet('.leaflet-layer', frameId2)
			.click('center', {force:true})
			.wait(500);

		calcHelper.dblClickOnFirstCell(frameId2);

		helper.clearAllText(frameId2);

		helper.typeIntoDocument('Hello{enter}', frameId2);

		cy.wait(1000);

		cy.customGet('#menu-editmenu', frameId2).click()
			.customGet('#menu-repair', frameId2).click();

		cy.customGet('.leaflet-popup-content table', frameId2).should('exist');

		cy.iframe(frameId2).contains('.leaflet-popup-content table tbody tr','Undo').eq(0)
			.click();

		cy.customGet('.leaflet-popup-content > input', frameId2)
			.click()
			.wait(1000);

		calcHelper.dblClickOnFirstCell(frameId2);

		helper.selectAllText(frameId2);

		helper.expectTextForClipboard('Hello World', frameId2);

		cy.customGet('.leaflet-layer', frameId1)
			.click('center', {force:true})
			.wait(500);

		helper.typeIntoDocument('{end}{enter}', frameId1);

		calcHelper.dblClickOnFirstCell(frameId1);

		helper.selectAllText(frameId1);

		helper.expectTextForClipboard('Hello World', frameId1);
	}

	it('Repair by user-2', { retries : 2 }, function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', { retries : 2 }, function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
