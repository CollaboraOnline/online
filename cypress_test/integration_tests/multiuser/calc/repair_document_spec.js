/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe.skip('Repair Document', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/repair_doc.ods',true);
	});

	function repairDoc(frameId1, frameId2) {
		cy.cSetActiveFrame(frameId1);
		helper.typeIntoDocument('Hello World{enter}');
		cy.cSetActiveFrame(frameId2);
		calcHelper.assertSheetContents(['Hello World\n']);
		cy.cSetActiveFrame(frameId1);
		calcHelper.assertSheetContents(['Hello World\n']);
		cy.cSetActiveFrame(frameId2);
		cy.cGet('#menu-editmenu').click().cGet('#menu-repair').click();
		cy.cGet('#DocumentRepairDialog').should('exist');
		cy.cGet('#versions').should('exist');
		cy.cGet('body').contains('#versions .ui-treeview-body .ui-listview-entry td','Input').click();
		cy.cGet('#ok.ui-pushbutton.jsdialog').should('exist');
		cy.cGet('#ok.ui-pushbutton.jsdialog').click();
		cy.wait(500);
		calcHelper.selectEntireSheet();
		helper.expectTextForClipboard('');
		cy.cSetActiveFrame(frameId1);
		calcHelper.selectEntireSheet();
		helper.expectTextForClipboard('');
	}

	it('Repair by user-2', function() {
		repairDoc('#iframe1', '#iframe2');
	});

	it('Repair by user-1', function() {
		repairDoc('#iframe2', '#iframe1');
	});
});
