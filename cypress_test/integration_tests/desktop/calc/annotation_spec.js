/* global describe it require cy afterEach beforeEach */

var helper = require('../../common/helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {
	var origTestFileName = 'annotation.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
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
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text');
		cy.cGet('#comment-container-1').should('exist');
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
});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var origTestFileName = 'annotation.ods';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'calc');
		desktopHelper.switchUIToNotebookbar();
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert autosave',function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
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

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
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

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
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
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
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
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#annotation-content-area-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
		cy.cGet('#comment-container-1').should('exist');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
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

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'calc', true, false, false, true);
		cy.cGet('.cool-annotation').should('exist');
		cy.cGet('#comment-container-1').then(function (element) {
			element[0].style.visibility = '';
			element[0].style.display = '';
		});
		cy.cGet('#comment-container-1').trigger('mouseover');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});
});
