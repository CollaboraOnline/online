/* -*- js-indent-level: 8 -*- */

/* global describe it cy require beforeEach */
var helper = require('../../common/helper');

describe(['tagdesktop'], 'Formula dialog tests', function() {

	beforeEach(function() {
		//cy.viewport(1920,1080);
		helper.setupAndLoadDocument('calc/formula_dialog.ods');
	});

	it('Formula dialog visual regression test', function() {
		cy.wait(1000);

		cy.cGet('#functiondialog-button').click();
		cy.cGet('#FormulaDialog').should('be.visible');

		cy.cGet('#FormulaDialog #function .ui-treeview-expander:nth(2)').click();
		cy.cGet('#FormulaDialog #function span').contains('ACCRINTM').dblclick();
		cy.cGet('#FormulaDialog #function .ui-treeview-entry.selected span').contains('ACCRINTM').should('exist');

		cy.wait(500); /* wait for position changes */

		cy.cGet('.ui-dialog').compareSnapshot('formula_dialog_accrintm', 0.1);
	});
});
