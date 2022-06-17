// This spec file doesnot test anything and it is use to update
// help dialog screenshots. You can run this spec using:
// make UPDATE_SCREENSHOT=true check-desktop spec=calc/help_dialog_update_spec.js
// UPDATE_SCREENSHOT needs to be true otherwise cypress will not run the spec file and
// update the screenshot

/* global describe it cy require Cypress afterEach beforeEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');

describe('Help dialog update', function() {
	var testFileName = 'help_dialog.ods';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'calc');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Chart selected sidebar open', function() {
		calcHelper.selectFirstColumn();

		cy.get('#menu-insert')
			.click()
			.contains('Chart...')
			.click();

		helper.waitUntilIdle('.lokdialog_container');

		cy.get('.lokdialog_container')
			.click();

		helper.typeIntoDocument('{shift}{enter}');

		cy.get('#btnEditChart').click();

		cy.wait(1000);

		cy.get('#main-document-content').screenshot('chart-wizard');

		cy.task('copyFile', {
			sourceDir: Cypress.env('SCREENSHOT_FOLDER')+ '/calc/help_dialog_update_spec.js/',
			destDir: Cypress.env('IMAGES_FOLDER'),
			fileName: 'chart-wizard.png',
		});
	});

});
