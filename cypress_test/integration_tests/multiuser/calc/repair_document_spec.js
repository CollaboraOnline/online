/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Repair Document', function() {
	var testFileName = 'repair_doc.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {
		cy.wait(1000);

		helper.typeIntoDocument('Hello World{enter}', frameId1);

		//wait for the popup to disappear
		cy.wait(5000);

		calcHelper.dblClickOnFirstCell(frameId2);

		helper.clearAllText(frameId2);

		helper.typeIntoDocument('Hello{enter}', frameId2);

		cy.customGet('#menu-editmenu', frameId2).click()
			.customGet('#menu-repair', frameId2).click();

		cy.customGet('.leaflet-popup-content table', frameId2).should('exist');

		cy.iframe(frameId2).contains('.leaflet-popup-content table tbody tr','Undo').eq(0)
			.click();

		cy.customGet('.leaflet-popup-content > input', frameId2).click();

		//assert data in iframe1
		cy.customGet('.leaflet-layer', frameId1).click();

		calcHelper.dblClickOnFirstCell(frameId1);

		helper.selectAllText(frameId1);

		helper.expectTextForClipboard('Hello World', frameId1);

		helper.typeIntoDocument('{end}{enter}', frameId1);

		//assert data in frame2
		cy.customGet('.leaflet-layer', frameId2).click();

		calcHelper.dblClickOnFirstCell(frameId2);

		helper.selectAllText(frameId2);

		helper.expectTextForClipboard('Hello World', frameId2);
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
