/* global describe it cy beforeEach require */

var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop', 'tagproxy'], 'macro dialog tests', function() {
	var testFileName = 'macro.ods';

	function acceptMacroExecution() {
		cy.get('#MacroWarnMedium.jsdialog')
			.should('exist');

		cy.cGet('#MacroWarnMedium.jsdialog #ok').click();
	}

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc', undefined, undefined, undefined, true);
		acceptMacroExecution();
		helper.checkIfDocIsLoaded();
	});

	function expandEntryInTreeView(entryText) {
		cy.cGet().contains('.jsdialog.ui-treeview-cell', entryText)
			.siblings('.ui-treeview-expander')
			.click();
	}

	it.skip('Macro execution warning appears before loading the document.', function() {
		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('not.have.text', 'Macro Executed');

		cy.cGet('#menu-tools > a')
			.click();

		cy.cGet('#menu-runmacro')
			.click();

		cy.cGet('#MacroSelectorDialog.jsdialog')
			.should('exist');

		expandEntryInTreeView('macro.ods');
		expandEntryInTreeView('VBAProject');

		cy.cGet().contains('.jsdialog.ui-treeview-cell', 'Module1')
			.click();

		cy.cGet().contains('#commands .ui-treeview-cell', 'test_macro')
			.click();

		cy.cGet('#MacroSelectorDialog.jsdialog #ok')
			.click();

		calcHelper.selectEntireSheet();

		cy.cGet('#copy-paste-container table td')
			.should('have.text', 'Macro Executed');
	});
});
