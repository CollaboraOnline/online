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

		helper.typeIntoDocument('Hello World{enter}', frameId1);

		calcHelper.selectEntireSheet(frameId2);

		calcHelper.assertDataClipboardTable(['Hello World\n'], frameId2);

		calcHelper.selectEntireSheet(frameId1);

		calcHelper.assertDataClipboardTable(['Hello World\n'], frameId1);

		cy.customGet('#menu-editmenu', frameId2).click()
			.customGet('#menu-repair', frameId2).click();

		cy.customGet('#DocumentRepairDialog', frameId2).should('exist');
		cy.customGet('#versions', frameId2).should('exist');

		cy.iframe(frameId2).contains('#versions .ui-treeview-body .ui-listview-entry td','Input')
			.click();

		cy.customGet('#ok.ui-pushbutton.jsdialog', frameId2).should('exist');

		cy.customGet('#ok.ui-pushbutton.jsdialog', frameId2).click();

		cy.wait(500);

		calcHelper.selectEntireSheet(frameId2);

		helper.expectTextForClipboard('', frameId2);

		calcHelper.selectEntireSheet(frameId1);

		helper.expectTextForClipboard('', frameId1);
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
