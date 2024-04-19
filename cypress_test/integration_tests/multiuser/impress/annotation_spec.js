/* global describe it cy require beforeEach Cypress */

var desktopHelper = require('../../common/desktop_helper');
var helper = require('../../common/helper');

describe(['tagmultiuser'], 'Multiuser Annotation Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {

		testFileName = helper.beforeAll(origTestFileName, 'impress', undefined, true);
		cy.viewport(2600, 800);
		desktopHelper.switchUIToNotebookbar();

		cy.cSetActiveFrame('#iframe1');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');

		cy.cSetActiveFrame('#iframe2');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	it('Insert', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe(['tagmultiuser'], 'Multiuser Collapsed Annotation Tests', function() {
	var testFileName = 'comment_switching.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress', undefined, true);
		cy.viewport(2400, 800);
		desktopHelper.switchUIToNotebookbar();

		cy.cSetActiveFrame('#iframe1');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');

		cy.cSetActiveFrame('#iframe2');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	it('Insert', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe(['tagmultiuser'], 'Multiuser Annotation Autosave Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress', undefined, true);
		cy.viewport(2600, 800);
		desktopHelper.switchUIToNotebookbar();

		cy.cSetActiveFrame('#iframe1');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');

		cy.cSetActiveFrame('#iframe2');
		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}
		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	it('Insert autosave', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Insert autosave save', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.not.visible');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Insert autosave cancel', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('not.exist');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');
	});

	it('Modify autosave', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave save', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave cancel', function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Reply autosave',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some text0');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Reply autosave save',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some text0');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some reply text');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some text0');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Reply autosave cancel',function() {
		cy.cSetActiveFrame('#iframe1');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('be.visible');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some text0');
		cy.cGet('#annotation-modify-textarea-1').should('include.text', 'some reply text');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});
});
