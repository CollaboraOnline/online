/* global describe it cy require afterEach beforeEach Cypress */

var desktopHelper = require('../../common/desktop_helper');
var helper = require('../../common/helper');
var { addSlide, changeSlide } = require('../../common/impress_helper');
var { insertMultipleComment, setupUIforCommentInsert, createComment } = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		cy.viewport(1500, 600);
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe(['tagdesktop'], 'Collapsed Annotation Tests', function() {
	var testFileName = 'comment_switching.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe(['tagdesktop'], 'Comment Scrolling',function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('no comment or one comment', function() {
		cy.cGet('.leaflet-control-scroll-down').should('not.exist');
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('omit slides without comments', function() {
		//scroll up
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		addSlide(2);
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		helper.waitUntilIdle('.leaflet-control-scroll-up');
		cy.cGet('.leaflet-control-scroll-up').should('be.visible');
		cy.cGet('.leaflet-control-scroll-up').click().wait(300);
		cy.cGet('#PageStatus').should('contain','Slide 1 of 3');

		//scroll down
		cy.cGet('.leaflet-control-scroll-down').should('exist');
		cy.cGet('.leaflet-control-scroll-down').click().wait(1000);
		cy.cGet('#PageStatus').should('contain','Slide 3 of 3');
	});

	it('switch to previous or next slide',function() {
		addSlide(1);
		insertMultipleComment('impress', 2, false, '#insert-insert-annotation-button');

		//scroll up
		addSlide(1);
		cy.cGet('.leaflet-control-scroll-up').should('exist');
		cy.cGet('.leaflet-control-scroll-up').click().wait(300);
		cy.cGet('#PageStatus').should('contain','Slide 2 of 3');

		//scroll down
		changeSlide(1,'previous');
		cy.cGet('.leaflet-control-scroll-down').should('exist');
		cy.cGet('.leaflet-control-scroll-down').click().wait(300);
		cy.cGet('#PageStatus').should('contain','Slide 2 of 3');
	});
});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		cy.viewport(1500, 600);
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert autosave', function() {
		setupUIforCommentInsert('impress');
		createComment('impress', 'Test Comment', false, '#insert-insert-annotation-button');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','Test Comment');
	});

	it('Insert autosave save', function() {
		setupUIforCommentInsert('impress');
		createComment('impress', 'Test Comment', false, '#insert-insert-annotation-button');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-new').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.not.visible');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','Test Comment');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','Test Comment');
	});

	it('Insert autosave cancel', function() {
		setupUIforCommentInsert('impress');
		createComment('impress', 'Test Comment', false, '#insert-insert-annotation-button');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-new').click();
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('not.exist');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');
	});

	it('Modify autosave', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('{home}');
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave save', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
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

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave cancel', function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
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

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Reply autosave',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.visible');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Reply autosave save',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.visible');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it.skip('Reply autosave cancel',function() {
		insertMultipleComment('impress', 1, false, '#insert-insert-annotation-button');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-reply-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');

		helper.closeDocument(testFileName, '');
		helper.beforeAll(testFileName, 'impress', true, false, false, true);
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});
});
