/* global describe it require cy beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');
var calcHelper = require('../../common/calc_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {

	beforeEach(function() {
		helper.setupAndLoadDocument('calc/annotation.ods');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Insert',function() {
		desktopHelper.insertComment();

		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
	});

	it('Modify',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text0, some other text');
		cy.cGet('#comment-container-1').should('exist');
	});

	it('Modify and Save using shortcut Ctrl+Enter', function() {
		// Given an open comment edit dialog
		desktopHelper.insertComment();
		cy.cGet('#comment-container-1').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');

		// When Ctrl+Enter is hit
		cy.cGet('annotation-modify-textarea-1').type('{ctrl}{enter}');

		// Then, the dialog is closed and the comment content should be updated
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Reply should not be possible', function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('.context-menu-list:visible .context-menu-item').should('not.have.text', 'Reply');
	});

	it('Remove',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Delete then Create Sheet should not retain comment',function() {
		calcHelper.assertNumberofSheets(1);

		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);

		desktopHelper.insertComment();
		cy.cGet('.cool-annotation').should('exist');

		calcHelper.selectOptionFromContextMenu('Delete Sheet...');
		cy.cGet('#delete-sheet-modal-response').click();
		calcHelper.assertNumberofSheets(1);

		cy.cGet('#spreadsheet-toolbar #insertsheet').click();
		calcHelper.assertNumberofSheets(2);
		cy.cGet('#comment-container-1').should('not.exist');
	});
});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var newFilePath;

	beforeEach(function() {
		newFilePath = helper.setupAndLoadDocument('calc/annotation.ods');
		desktopHelper.switchUIToNotebookbar();
	});

	it('Insert autosave',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave save',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Insert autosave cancel',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation').should('not.exist');
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('not.exist');
	});

	it('Modify autosave',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
	});

	it('Modify autosave save',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type(', some other text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
		cy.cGet('#comment-container-1').should('exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0, some other text');
	});

	it('Modify autosave cancel',function() {
		desktopHelper.insertComment();

		cy.cGet('#comment-container-1').should('exist');

		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-container-1').should('exist');

		helper.reloadDocument(newFilePath);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});
});
