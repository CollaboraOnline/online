/* global describe it cy require afterEach beforeEach Cypress */

var desktopHelper = require('../../common/desktop_helper');
var helper = require('../../common/helper');
var { addSlide, changeSlide } = require('../../common/impress_helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		cy.viewport(1500, 600);
		testFileName = helper.beforeAll(origTestFileName, 'impress');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			cy.cGet('.unospan-optionstoolboxdown.unoModifyPage').click();
		} else {
			desktopHelper.hideSidebar();
		}

		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		insertMultipleComment('impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress');
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
		insertMultipleComment('impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress');
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
		} else if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			cy.cGet('.unospan-optionstoolboxdown.unoModifyPage').click();
		} else {
			desktopHelper.hideSidebar();
		}

		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('Insert', function() {
		insertMultipleComment('impress', 1, false);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress', 1, false);
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
		insertMultipleComment('impress', 1, false);
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress', 1, false);
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

		if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			cy.cGet('.unospan-optionstoolboxdown.unoModifyPage').click();
		} else {
			desktopHelper.hideSidebar();
		}
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('no comment or one comment', function() {
		cy.cGet('.leaflet-control-scroll-down').should('not.exist');
		insertMultipleComment('impress', 1, false);
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('omit slides without comments', function() {
		//scroll up
		insertMultipleComment('impress', 1, false);
		addSlide(2);
		insertMultipleComment('impress', 1, false);
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
		insertMultipleComment('impress', 2, false);

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
