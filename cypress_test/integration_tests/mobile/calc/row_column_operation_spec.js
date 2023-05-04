/* global describe it cy require afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
var mobileHelper = require('../../common/mobile_helper');

describe(['tagmobile', 'tagnextcloud', 'tagproxy'], 'Row Column Operation', function() {
	var testFileName = 'row_column_operation.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');

		mobileHelper.enableEditingMobile();

		calcHelper.selectEntireSheet();

		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		calcHelper.clickOnFirstCell(true,false);
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function selectOption(submenu, option) {
		cy.cGet('#toolbar-hamburger').click();
		cy.cGet('.menu-entry-icon.sheetmenu').parent().click();
		cy.cGet('body').contains('.menu-entry-with-icon', submenu).parent().click();

		if (typeof option !== 'undefined') {
			cy.cGet('body').contains('.menu-entry-with-icon', option).parent().click();
		}
	}

	it('Insert/Delete row' , function() {
		//Insert row above
		selectOption('Insert Rows', 'Rows Above');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['','','Hello','Hi','World','Bye']);
		//delete row
		calcHelper.clickOnFirstCell(true, false);

		selectOption('Delete Rows');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);

		//insert row below
		calcHelper.clickOnFirstCell(true, false);

		selectOption('Insert Rows', 'Rows Below');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Hello','Hi','','','World','Bye']);
	});

	it('Insert/Delete Column', function() {
		//insert column before
		selectOption('Insert Columns', 'Columns Before');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['','Hello','Hi','','World','Bye']);
		calcHelper.clickOnFirstCell(true, false);

		//delete column
		selectOption('Delete Columns');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Hello','Hi','World','Bye']);
		calcHelper.clickOnFirstCell(true,false);

		//insert column after
		selectOption('Insert Columns', 'Columns After');

		calcHelper.selectEntireSheet();
		calcHelper.assertDataClipboardTable(['Hello','','Hi','World','','Bye']);
	});
});
