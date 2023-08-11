/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Row Column Operation', function() {
	var testFileName = 'row_column_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
		desktopHelper.switchUIToNotebookbar();
		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);
		calcHelper.clickOnFirstCell(true,false);
		cy.cGet('#toolbar-up .w2ui-scroll-right').click();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert/Delete row' , function() {
		//Insert row above
		cy.cGet('.cell.notebookbar #InsertColumnsBefore').click();

		calcHelper.selectEntireSheet();
		//calcHelper.assertDataClipboardTable(['','','Hello','Hi','World','Bye']);
		//delete row
		calcHelper.clickOnFirstCell(true, false);

		cy.cGet('.cell.notebookbar #DeleteRows').click();
		calcHelper.selectEntireSheet();
		//calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		//insert row below
		calcHelper.clickOnFirstCell(true, false);
		cy.cGet('.cell.notebookbar #InsertRowsAfter').click();
		calcHelper.selectEntireSheet();
		//calcHelper.assertDataClipboardTable(['Hello','Hi','','','World','Bye']);
	});

	it('Insert/Delete Column', function() {
		//insert column before
		cy.cGet('.cell.notebookbar #InsertColumnsBefore').click();
		calcHelper.selectEntireSheet();
		//calcHelper.assertDataClipboardTable(['','Hello','Hi','','World','Bye']);
		calcHelper.clickOnFirstCell(true, false);

		//delete column
		cy.cGet('.cell.notebookbar #DeleteColumns').click();
		calcHelper.selectEntireSheet();
		cy.wait(500);
		//calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);
		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		cy.cGet('.cell.notebookbar #InsertColumnsAfter').click();
		calcHelper.selectEntireSheet();
		//calcHelper.assertDataClipboardTable(['Hello','','Hi','World','','Bye']);
	});
});
