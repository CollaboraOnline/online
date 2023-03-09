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
			cy.get('.unospan-optionstoolboxdown.unoModifyPage').click();
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
		cy.get('.leaflet-marker-icon').should('exist');
		cy.get('.cool-annotation-content > div')
			.should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress');

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');

		cy.get('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Modify').click();

		cy.get('#annotation-modify-textarea-1').type('some other text, ');

		cy.get('#annotation-save-1').click();

		cy.get('#annotation-content-area-1').should('contain','some other text, some text0');

		cy.get('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress');

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('.cool-annotation-content > div').should('contain','some text');

		cy.get('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress');

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('.cool-annotation-content > div').should('contain','some text');

		cy.get('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Reply').click();

		cy.get('#annotation-reply-textarea-1').type('some reply text');

		cy.get('#annotation-reply-1').click();

		cy.get('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe('Collapsed Annotation Tests', function() {
	var testFileName = 'comment_switching.odp';

	beforeEach(function() {
		helper.beforeAll(testFileName, 'impress');

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		} else if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			cy.get('.unospan-optionstoolboxdown.unoModifyPage').click();
		} else {
			desktopHelper.hideSidebar();
		}

		desktopHelper.selectZoomLevel('50');
	});

	afterEach(function() {
		helper.afterAll(testFileName, this.currentTest.state);
	});


	it('Insert', function() {
		insertMultipleComment('impress', 1, true);
		cy.get('.leaflet-marker-icon').should('exist');
		cy.get('.cool-annotation-content > div')
			.should('contain','some text');
	});

	it('Modify', function() {
		insertMultipleComment('impress', 1, true);

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('#annotation-content-area-1').should('contain','some text0');

		cy.get('#mobile-wizard-popup .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Modify').click();

		cy.get('#mobile-wizard-popup #annotation-modify-textarea-1').type('some other text, ');

		cy.get('#mobile-wizard-popup #annotation-save-1').click();

		cy.get('#mobile-wizard-popup #annotation-content-area-1').should('contain','some other text, some text0');

		cy.get('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		insertMultipleComment('impress', 1, true);

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('.cool-annotation-content > div').should('contain','some text');

		cy.get('#mobile-wizard-popup .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Remove')
			.click();

		cy.get('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		insertMultipleComment('impress', 1, true);

		cy.get('.leaflet-marker-icon').should('exist');

		cy.get('.cool-annotation-content > div').should('contain','some text');

		cy.get('#mobile-wizard-popup .cool-annotation-menu').click();

		cy.contains('.context-menu-item','Reply').click();

		cy.get('#mobile-wizard-popup #annotation-reply-textarea-1').type('some reply text');

		cy.get('#mobile-wizard-popup #annotation-reply-1').click();

		cy.get('.cool-annotation-content > div').should('include.text','some reply text');
	});
});

describe('Comment Scrolling',function() {
	var origTestFileName = 'comment_switching.odp';
	var testFileName;

	beforeEach(function() {
		testFileName = helper.beforeAll(origTestFileName, 'impress');

		if (Cypress.env('USER_INTERFACE') === 'notebookbar') {
			cy.get('.unospan-optionstoolboxdown.unoModifyPage').click();
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
		cy.get('.leaflet-control-scroll-down').should('not.exist');
		insertMultipleComment('impress', 1, true);
		cy.get('.leaflet-marker-icon').should('exist');
	});

	it('omit slides without comments', function() {
		cy.wait(1000);
		//scroll up
		insertMultipleComment('impress', 1, true);
		addSlide(2);
		insertMultipleComment('impress', 1, true);
		cy.get('.jsdialog-overlay').click({force: true}).should('not.exist');
		helper.waitUntilIdle('.leaflet-control-scroll-up');
		cy.get('.leaflet-control-scroll-up').should('be.visible');
		cy.get('.leaflet-control-scroll-up').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 1 of 3');

		//scroll down
		cy.get('.leaflet-control-scroll-down').should('exist');
		cy.get('.leaflet-control-scroll-down').click().wait(1000);
		cy.get('#PageStatus').should('contain','Slide 3 of 3');
	});


	it('switch to previous or next slide',function() {
		addSlide(1);
		insertMultipleComment('impress', 2, true);

		//scroll up
		addSlide(1);
		cy.get('.jsdialog-overlay').click({force: true});
		cy.get('.leaflet-control-scroll-up').should('exist');
		cy.get('.leaflet-control-scroll-up').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');

		//scroll down
		changeSlide(1,'previous');
		cy.get('.leaflet-control-scroll-down').should('exist');
		cy.get('.leaflet-control-scroll-down').click().wait(300);
		cy.get('#PageStatus').should('contain','Slide 2 of 3');
	});
});
