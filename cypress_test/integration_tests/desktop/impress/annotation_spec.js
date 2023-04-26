/* global describe it cy require afterEach beforeEach Cypress */

var desktopHelper = require('../../common/desktop_helper');
var helper = require('../../common/helper');
var { addSlide, changeSlide } = require('../../common/impress_helper');
var { insertMultipleComment } = require('../../common/desktop_helper');

describe('Annotation Tests', function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		cy.viewport(1500, 600);
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			helper.cFrame().find('.unospan-optionstoolboxdown.unoModifyPage').click();
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
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress');

		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');
		helper.cFrame().find('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Modify').click();
		helper.cFrame().find('#annotation-modify-textarea-1').type('{home}');
		helper.cFrame().find('#annotation-modify-textarea-1').type('some other text, ');
		helper.cFrame().find('#annotation-save-1').click();
		helper.cFrame().find('#annotation-content-area-1').should('contain','some other text, some text0');
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress');

		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
		helper.cFrame().find('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Remove').click();
		helper.cFrame().find('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress');
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
		helper.cFrame().find('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Reply').click();
		helper.cFrame().find('#annotation-reply-textarea-1').type('some reply text');
		helper.cFrame().find('#annotation-reply-1').click();
		helper.cFrame().find('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe('Collapsed Annotation Tests', function() {
	var testFileName = 'comment_switching.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			helper.cFrame().find('.unospan-optionstoolboxdown.unoModifyPage').click();
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
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress', 1, false);

		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('#annotation-content-area-1').should('contain','some text0');
		helper.cFrame().find('.avatar-img').click();
		helper.cFrame().find('.cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Modify').click();
		helper.cFrame().find('#annotation-modify-textarea-1').type('{home}');
		helper.cFrame().find('#annotation-modify-textarea-1').type('some other text, ');
		helper.cFrame().find('#annotation-save-1').click();
		helper.cFrame().find('#annotation-content-area-1').should('contain','some other text, some text0');
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress', 1, false);

		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
		helper.cFrame().find('.avatar-img').click();
		helper.cFrame().find('.cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Remove').click();
		helper.cFrame().find('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress', 1, false);

		helper.cFrame().find('.leaflet-marker-icon').should('exist');
		helper.cFrame().find('.cool-annotation-content > div').should('contain','some text');
		helper.cFrame().find('.avatar-img').click();
		helper.cFrame().find('.cool-annotation-menu').click();
		helper.cFrame().find('body').contains('.context-menu-item','Reply').click();
		helper.cFrame().find('#annotation-reply-textarea-1').type('some reply text');
		helper.cFrame().find('#annotation-reply-1').click();
		helper.cFrame().find('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe('Comment Scrolling',function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			helper.cFrame().find('.unospan-optionstoolboxdown.unoModifyPage').click();
		} else {
			desktopHelper.hideSidebar();
		}
		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});

	it('no comment or one comment', function() {
		cy.wait(1000);
		helper.cFrame().find('.leaflet-control-scroll-down').should('not.exist');
		insertMultipleComment('impress', 1, false);
		helper.cFrame().find('.leaflet-marker-icon').should('exist');
	});

	it('omit slides without comments', function() {
		cy.wait(1000);
		//scroll up
		insertMultipleComment('impress', 1, false);
		addSlide(2);
		insertMultipleComment('impress', 1, false);
		helper.waitUntilIdle('.leaflet-control-scroll-up');
		helper.cFrame().find('.leaflet-control-scroll-up').should('be.visible');
		helper.cFrame().find('.leaflet-control-scroll-up').click().wait(300);
		helper.cFrame().find('#PageStatus').should('contain','Slide 1 of 3');

		//scroll down
		helper.cFrame().find('.leaflet-control-scroll-down').should('exist');
		helper.cFrame().find('.leaflet-control-scroll-down').click().wait(1000);
		helper.cFrame().find('#PageStatus').should('contain','Slide 3 of 3');
	});


	it('switch to previous or next slide',function() {
		addSlide(1);
		insertMultipleComment('impress', 2, false);

		//scroll up
		addSlide(1);
		helper.cFrame().find('.leaflet-control-scroll-up').should('exist');
		helper.cFrame().find('.leaflet-control-scroll-up').click().wait(300);
		helper.cFrame().find('#PageStatus').should('contain','Slide 2 of 3');

		//scroll down
		changeSlide(1,'previous');
		helper.cFrame().find('.leaflet-control-scroll-down').should('exist');
		helper.cFrame().find('.leaflet-control-scroll-down').click().wait(300);
		helper.cFrame().find('#PageStatus').should('contain','Slide 2 of 3');
	});
});
