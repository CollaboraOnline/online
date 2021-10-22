/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
describe('Repair Document', function() {
	var testFileName = 'repair_doc.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {
		cy.wait(1000);

		cy.customGet('.leaflet-layer', frameId1).click('center', {force:true});
		cy.customGet('g.leaflet-control-buttons-disabled svg', frameId1).dblclick({force:true});

		helper.typeIntoDocument('Hello', frameId1);
		helper.typeIntoDocument('{esc}', frameId1);

		cy.customGet('.leaflet-layer', frameId1).click('center', {force:true});
		cy.customGet('g.leaflet-control-buttons-disabled svg', frameId1).dblclick({force:true});
		helper.typeIntoDocument('{ctrl}{a}', frameId2);
		helper.typeIntoDocument('Hello World', frameId1);

		//to exit from editing mode from frameId1
		helper.typeIntoDocument('{esc}', frameId1);

		cy.customGet('#menu-editmenu', frameId2).click()
			.customGet('#menu-repair', frameId2).click();
		cy.customGet('.leaflet-popup-content table', frameId2).should('exist');

		cy.iframe(frameId2).contains('.leaflet-popup-content table tbody tr','Undo').eq(0).click();

		cy.customGet('.leaflet-popup-content > input', frameId2).click();

		cy.customGet('.leaflet-layer', frameId2).click('center', {force:true});

		cy.customGet('g.leaflet-control-buttons-disabled svg', frameId2).dblclick({force:true});

		cy.wait(1000);

		helper.typeIntoDocument('{ctrl}{a}', frameId2);

		helper.expectTextForClipboard('Hello', frameId2);

		//assert for frameId1
		//to exit from editing mode from frameId2
		helper.typeIntoDocument('{esc}', frameId2);

		cy.customGet('.leaflet-layer', frameId1).click('center', {force:true});
		cy.customGet('g.leaflet-control-buttons-disabled svg', frameId1).dblclick({force:true});

		cy.wait(1000);

		helper.selectAllText(frameId1);

		helper.expectTextForClipboard('Hello', frameId1);
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
