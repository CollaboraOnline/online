/* global describe it cy Cypress require afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mode = Cypress.env('USER_INTERFACE');

describe('Row Column Operation', function() {
	var testFileName = 'row_column_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		calcHelper.clickOnFirstCell(true,false);

		mode === 'notebookbar' ? cy.get('#toolbar-up .w2ui-scroll-right').click() : '';
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
			cy.get('#Home-Section-Cell1 #InsertRowsBefore').click() :
			selectOption('Insert Rows', 'Rows Above');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['','','Hello','Hi','World','Bye']);

		//delete row
		calcHelper.clickOnFirstCell(true, false);

		mode === 'notebookbar' ?
			cy.get('#Home-Section-Cell1 #DeleteRows').click() :
			selectOption('Delete Rows');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		//insert row below
		calcHelper.clickOnFirstCell(true, false);

		mode === 'notebookbar' ?
			cy.get('#Home-Section-Cell1 #InsertRowsAfter').click() :
			selectOption('Insert Rows', 'Rows Below');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Hello','Hi','','','World','Bye']);
	});

	it('Insert/Delete Column', function() {
		//insert column before
		mode === 'notebookbar' ?
			cy.get('#Home-Section-Cell1 #InsertColumnsBefore').click() :
			selectOption('Insert Columns', 'Columns Before');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['','Hello','Hi','','World','Bye']);

		calcHelper.clickOnFirstCell(true, false);

		//delete column
		mode === 'notebookbar' ?
			cy.get('#Home-Section-Cell1 #DeleteColumns').click() :
			selectOption('Delete Columns');

		calcHelper.selectEntireSheet();

		cy.wait(500);

		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		mode === 'notebookbar' ?
			cy.get('#Home-Section-Cell1 #InsertColumnsAfter').click() :
			selectOption('Insert Columns', 'Columns After');

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Hello','','Hi','World','','Bye']);
	});
});
