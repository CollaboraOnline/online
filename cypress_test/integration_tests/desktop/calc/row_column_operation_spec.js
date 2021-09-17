/* global describe it cy Cypress require afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mode = Cypress.env('USER_INTERFACE');

describe('Row Column Operation', function() {
	var testFileName = 'row_column_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true,false);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectOption(submenu, option) {
		cy.get('#menu-sheet').click();

		cy.contains('#menu-sheet li', submenu)
			.click();

		if (typeof option !== 'undefined') {
			cy.contains('#menu-sheet li li', option)
				.click();
		}
	}

	it('Insert/Delete row' , function() {
		//Insert row above
		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #InsertRowsBefore').click() :
			selectOption('Insert Rows', 'Rows Above');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('not.have.text');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(2).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		//delete row
		calcHelper.clickOnFirstCell(true, false);

		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #DeleteRows').click() :
			selectOption('Delete Rows');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		//insert row below
		calcHelper.clickOnFirstCell(true, false);

		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #InsertRowsAfter').click() :
			selectOption('Insert Rows', 'Rows Below');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('not.have.text');
			});

			cy.get('tr').eq(2).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});
	});

	it('Insert/Delete Column', function() {
		//insert column before
		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #InsertColumnsBefore').click() :
			selectOption('Insert Columns', 'Columns Before');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('have.text', 'Hello');
				cy.get('td').eq(2).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('not.have.text');
				cy.get('td').eq(1).should('have.text', 'World');
				cy.get('td').eq(2).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true, false);

		//delete column
		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #DeleteColumns').click() :
			selectOption('Delete Columns');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('have.text', 'Bye');
			});
		});

		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		mode === 'notebookbar' ?
			cy.get('#table-Home-Section-Cell1 #InsertColumnsAfter').click() :
			selectOption('Insert Columns', 'Columns After');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		cy.get('#copy-paste-container tbody').within(() => {
			cy.get('tr').eq(0).within(() => {
				cy.get('td').eq(0).should('have.text', 'Hello');
				cy.get('td').eq(1).should('not.have.text');
				cy.get('td').eq(2).should('have.text', 'Hi');
			});

			cy.get('tr').eq(1).within(() => {
				cy.get('td').eq(0).should('have.text', 'World');
				cy.get('td').eq(1).should('not.have.text');
				cy.get('td').eq(2).should('have.text', 'Bye');
			});
		});
	});
});
