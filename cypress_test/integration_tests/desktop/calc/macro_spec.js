/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('macro dialog tests', function() {
	var testFileName = 'macro.ods';

	function acceptMacroExecution() {
		cy.get('#MacroWarnMedium.jsdialog')
			.should('exist');

		helper.clickOnIdle('#MacroWarnMedium.jsdialog #ok');
	}

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc', undefined, undefined, undefined, true);
		acceptMacroExecution();
		helper.checkIfDocIsLoaded();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function expandEntryInTreeView(entryText) {
		cy.contains('.jsdialog.ui-treeview-cell', entryText)
			.siblings('.ui-treeview-expander')
			.click();
	}

	it.skip('Macro execution warning appears before loading the document.', function() {
		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('not.have.text', 'Macro Executed');

		cy.get('#menu-tools > a')
			.click();

		cy.get('#menu-runmacro')
			.click();

		cy.get('#MacroSelectorDialog.jsdialog')
			.should('exist');

		expandEntryInTreeView('macro.ods');
		expandEntryInTreeView('VBAProject');

		cy.contains('.jsdialog.ui-treeview-cell', 'Module1')
			.click();

		cy.contains('#commands .ui-treeview-cell', 'test_macro')
			.click();

		cy.get('#MacroSelectorDialog.jsdialog #ok')
			.click();

		calcHelper.selectEntireSheet();

		cy.get('#copy-paste-container table td')
			.should('have.text', 'Macro Executed');
	});
});
