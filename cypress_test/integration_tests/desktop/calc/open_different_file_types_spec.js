/* global describe it cy require Cypress afterEach */
var helper = require('../../common/helper');
var calcHelper = require('../../common/calc_helper');
const { insertImage } = require('../../common/desktop_helper');

describe('Open different file types', function () {

	var testFileName = '';

	function before(filename) {
		var origTestFileName = filename;

		testFileName = helper.beforeAll(origTestFileName, 'calc');
	}

	function openReadOnlyFile(filename) {
		testFileName = helper.loadTestDocNoIntegration(filename, 'calc', false, false, false);

		//check doc is loaded
		cy.get('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

		helper.canvasShouldNotBeFullWhite('.leaflet-canvas-container canvas');

		cy.get('#PermissionMode').should('be.visible')
			.should('have.text', ' Read-only ');
	}

	afterEach(function () {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	function assertData() {
		//select all the content of doc
		calcHelper.selectEntireSheet();

		helper.waitUntilIdle('#copy-paste-container');

		var expectedData = [
			'0', 'First Name', 'Last Name', 'Gender', 'Country', 'Age', 'Date', 'Id',
			'1', 'Dulce', 'Abril', 'Female', 'United States', '32', '15/10/2017', '1562',
			'2', 'Mara', 'Hashimoto', 'Female', 'Great Britain', '25', '16/08/2016', '1582',
			'3', 'Philip', 'Gent', 'Male', 'France', '36', '21/05/2015', '2587',
			'4', 'Kathleen', 'Hanner', 'Female', 'United States', '25', '15/10/2017', '3549',
		];

		calcHelper.assertDataClipboardTable(expectedData);
	}

	it('Open xls file', function () {
		before('testfile.xls');

		assertData();

		insertImage();
	});

	it('Open xlsx file', function () {
		before('testfile.xlsx');

		assertData();
	});

	//we are not using before because it loads the document and directly asserts if document is loaded but in
	//case of csv file 1st when you try to load the doc it opens up jsdialog to import csv which requires user
	//input and after click ok the doc starts to load
	it('Open csv file', function() {
		//to fit csv jsdialog in window
		cy.viewport(1280, 960);

		testFileName = helper.loadTestDocNoIntegration('testfile.csv', 'calc', false, false, false);

		cy.get('form.jsdialog-container.lokdialog_container')
			.should('exist');

		helper.clickOnIdle('.ui-pushbutton', 'OK');

		//check doc is loaded
		cy.get('.leaflet-canvas-container canvas', {timeout : Cypress.config('defaultCommandTimeout') * 2.0});

		helper.canvasShouldNotBeFullWhite('.leaflet-canvas-container canvas');

		cy.get('#mobile-edit-button')
			.should('be.visible')
			.click();

		cy.get('#modal-dialog-switch-to-edit-mode-modal-yesbutton').click();

		assertData();
	});

	it('Open xlsb file' ,function() {
		openReadOnlyFile('testfile.xlsb');

		cy.get('#mobile-edit-button').should('be.visible')
			.click();

		cy.get('#modal-dialog-switch-to-edit-mode-modal-overlay').should('be.visible');

		cy.get('#modal-dialog-switch-to-edit-mode-modal-label')
			.should('have.text', 'This document may contain formatting or content that cannot be saved in the current file format.');

		cy.get('#modal-dialog-switch-to-edit-mode-modal-yesbutton')
			.should('have.text', 'Continue read only')
			.click();

		cy.get('#PermissionMode').should('be.visible')
			.should('have.text', ' Read-only ');
	});

	it('Open xlsm file' ,function() {
		before('testfile.xlsm');

		assertData();

		insertImage();
	});

	it('Open xltm file' ,function() {
		openReadOnlyFile('testfile.xltm');

		cy.get('#mobile-edit-button').should('not.be.visible');
	});

	it('Open xltx file' ,function() {
		openReadOnlyFile('testfile.xltm');

		cy.get('#mobile-edit-button').should('not.be.visible');
	});

	it('Open fods file', function() {
		before('testfile.fods');

		//select all the content of doc
		assertData();

		insertImage();
	});
});
