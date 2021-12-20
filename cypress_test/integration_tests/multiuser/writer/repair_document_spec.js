/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');

describe('Repair Document', function() {
	var testFileName = 'repair_doc.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.typeIntoDocument('Hello World', frameId1);

		cy.customGet('#menu-editmenu', frameId2).click()
			.customGet('#menu-repair', frameId2).click();

		cy.customGet('.leaflet-popup-content table', frameId2).should('exist');

		cy.iframe(frameId2).contains('.leaflet-popup-content table tbody tr','Typing: “World”')
			.dblclick();

		cy.customGet('.leaflet-layer', frameId2).click();

		cy.wait(500);

		helper.selectAllText(frameId2);

		helper.expectTextForClipboard('\nHello \n', frameId2);

		cy.customGet('.leaflet-layer', frameId1).click();

		helper.selectAllText(frameId1);

		helper.expectTextForClipboard('\nHello \n', frameId1);
	}

	it('Repair by user-2', { retries : 2 }, function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', { retries : 2 }, function() {
		repairDoc('#iframe2', '#iframe1');
	});

});
