/* global describe it cy require beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Row Column Operation', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/row_column_operation.ods');
		desktopHelper.switchUIToNotebookbar();
		helper.setDummyClipboardForCopy();
		calcHelper.assertSheetContents(['Hello','Hi','World','Bye'], true);
		calcHelper.clickOnFirstCell(true,false);
		cy.cGet('#toolbar-up .ui-scroll-right').click();
	});

	it('Insert/Delete row' , function() {
		//Insert row above
		cy.cGet('#home-insert-columns-before').click();

		//calcHelper.assertSheetContents(['','','Hello','Hi','World','Bye']);
		//delete row
		calcHelper.clickOnFirstCell(true, false);

		cy.cGet('#home-delete-rows').click();
		//calcHelper.assertSheetContents(['Hello','Hi','World','Bye']);

		//insert row below
		calcHelper.clickOnFirstCell(true, false);
		cy.cGet('#home-insert-rows-after').click();
		//calcHelper.assertSheetContents(['Hello','Hi','','','World','Bye']);
	});

	it('Insert/Delete Column', function() {
		//insert column before
		cy.cGet('#home-insert-columns-before').click();
		//calcHelper.assertSheetContents(['','Hello','Hi','','World','Bye']);
		calcHelper.clickOnFirstCell(true, false);

		//delete column
		cy.cGet('#home-delete-columns').click();
		cy.wait(500);
		//calcHelper.assertSheetContents(['Hello','Hi','World','Bye']);
		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		cy.cGet('#home-insert-columns-after').click();
		//calcHelper.assertSheetContents(['Hello','','Hi','World','','Bye']);
	});
});
