/* global describe it cy beforeEach require afterEach */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('macro dialog tests', function() {
	var testFileName = 'macro.ods';

	function acceptMacroExecution() {
		cy.get('#MacroWarnMedium.jsdialog')
			.should('exist');

		cy.get('#MacroWarnMedium.jsdialog #ok')
			.click();
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

	it('Macro execution warning appears before loading the document.', function() {
		calcHelper.selectEntireSheet();

		cy.contains('#copy-paste-container table td', 'Macro Executed')
			.should('not.exist');

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

		cy.contains('#copy-paste-container table td', 'Macro Executed')
			.should('exist');
	});

});
