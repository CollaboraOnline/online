/* global describe it cy beforeEach require afterEach*/

var helper = require('../../common/helper');
var { insertMultipleComment, selectZoomLevel, setupUIforCommentInsert, createComment } = require('../../common/desktop_helper');
var desktopHelper = require('../../common/desktop_helper');

describe(['tagmultiuser'], 'Multiuser Annotation Test', function () {
	var origTestFileName = 'annotation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
		cy.viewport(2400,800);
		desktopHelper.switchUIToNotebookbar();
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');
	});

	it('Remove', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item', 'Remove').click();
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
	});
});

describe(['tagmultiuser'], 'Multiuser Collapsed Annotation Tests', function() {
	var testFileName = 'annotation.odt';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'writer', undefined, true);
		desktopHelper.switchUIToNotebookbar();
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('Hello World');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
	});

	it('Modify', function() {
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('Hello World');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
	});

	it('Reply', function() {
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('Hello World');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');
		cy.cGet('#comment-container-1 .cool-annotation-reply-count-collapsed').should('have.text', '1');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#annotation-content-area-2').should('contain','some reply text');
		cy.cGet('#comment-container-1 .cool-annotation-reply-count-collapsed').should('have.text', '1');
	});

	it('Remove', function() {
		cy.cSetActiveFrame('#iframe1');
		helper.typeIntoDocument('Hello World');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
	});

});

describe(['tagmultiuser'], 'Multiuser Annotation Autosave Tests', function() {
	var origTestFileName = 'annotation.odt';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'writer', undefined, true);
		cy.viewport(2400,800);
		desktopHelper.switchUIToNotebookbar();
		cy.cSetActiveFrame('#iframe1');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');
		cy.cSetActiveFrame('#iframe2');
		cy.cGet('#optionscontainer div[id$="SidebarDeck.PropertyDeck"]').click(); // Hide sidebar.
		selectZoomLevel('50');

	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert autosave', function() {
		cy.cSetActiveFrame('#iframe1');
		setupUIforCommentInsert('writer');
		createComment('writer', 'Test Comment', false, '[id=insert-insert-annotation]');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','Test Comment');
	});

	it('Insert autosave save', function() {
		cy.cSetActiveFrame('#iframe1');
		setupUIforCommentInsert('writer');
		createComment('writer', 'Test Comment', false, '[id=insert-insert-annotation]');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','Test Comment');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','Test Comment');
	});

	it('Insert autosave cancel', function() {
		cy.cSetActiveFrame('#iframe1');
		setupUIforCommentInsert('writer');
		createComment('writer', 'Test Comment', false, '[id=insert-insert-annotation]');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#comment-container-1').should('not.exist');
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('not.exist');
		cy.cGet('#comment-container-1').should('not.exist');
	});

	it('Modify autosave', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
	});

	it('Modify autosave save', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
	});

	it('Modify autosave cancel', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
	});

	it('Reply autosave', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');
	});

	it('Reply autosave save', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('have.text','some reply text');
		cy.cGet('#annotation-save-2').click();
		cy.cGet('#annotation-modify-textarea-2').should('be.not.visible');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-2').should('have.text','some reply text');
	});

	it('Reply autosave cancel', function() {
		cy.cSetActiveFrame('#iframe1');
		insertMultipleComment('writer', 1, false, '[id=insert-insert-annotation]');

		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#comment-annotation-menu-1').click();
		cy.cGet('body').contains('.context-menu-item', 'Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('be.visible');
		cy.cGet('#annotation-modify-textarea-2').should('have.text','some reply text');
		cy.cGet('#annotation-cancel-2').click();
		cy.cGet('#annotation-modify-textarea-2').should('not.exist');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('not.exist');
		cy.cGet('#comment-container-1 .cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('#comment-container-2 .cool-annotation-autosavelabel').should('not.exist');

		cy.cSetActiveFrame('#iframe2');
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('#annotation-content-area-2').should('not.exist');
	});

});
