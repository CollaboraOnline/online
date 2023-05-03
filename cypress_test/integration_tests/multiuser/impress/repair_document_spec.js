/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
describe.skip('Repair Document', function() {
	var origTestFileName = 'repair_doc.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress', undefined, true);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function repairDoc(frameId1, frameId2) {
		cy.wait(1000);
		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click('center', {force:true});
		cy.cGet('g.leaflet-control-buttons-disabled svg').dblclick({force:true});

		helper.typeIntoDocument('Hello');
		helper.typeIntoDocument('{esc}');

		cy.cGet('.leaflet-layer').click('center', {force:true});
		cy.cGet('g.leaflet-control-buttons-disabled svg').dblclick({force:true});
		cy.cSetActiveFrame(frameId2);
		helper.typeIntoDocument('{ctrl}{a}');
		cy.cSetActiveFrame(frameId1);
		helper.typeIntoDocument('Hello World');

		//to exit from editing mode from frameId1
		helper.typeIntoDocument('{esc}');

		cy.cSetActiveFrame(frameId2);
		cy.cGet('#menu-editmenu').click().cGet('#menu-repair').click();

		cy.cGet('#DocumentRepairDialog').should('exist');
		cy.cGet('#versions').should('exist');

		cy.cGet('body').contains('#versions .ui-treeview-body .ui-listview-entry td','Typing: “World”').click();
		cy.cGet('#ok.ui-pushbutton.jsdialog').should('exist');
		cy.cGet('#ok.ui-pushbutton.jsdialog').click();
		helper.typeIntoDocument('{ctrl}{a}');
		helper.expectTextForClipboard('Hello');

		//assert for frameId1
		//to exit from editing mode from frameId2
		helper.typeIntoDocument('{esc}');

		cy.cSetActiveFrame(frameId1);
		cy.cGet('.leaflet-layer').click('center', {force:true});
		cy.cGet('g.leaflet-control-buttons-disabled svg').dblclick({force:true});

		cy.wait(1000);

		helper.selectAllText();
		helper.expectTextForClipboard('Hello');
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
