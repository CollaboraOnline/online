/* global describe it cy require beforeEach Cypress */

var desktopHelper = require('../../common/desktop_helper');
var helper = require('../../common/helper');
var { addSlide, changeSlide } = require('../../common/impress_helper');

describe(['tagdesktop'], 'Annotation Tests', function() {

	beforeEach(function() {
		// Give more horizontal room so that comments do not fall off the right
		// side of the screen, causing scrolling or hidden buttons
		cy.viewport(1500, 600);
		helper.setupAndLoadDocument('impress/comment_switching.odp');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	it('Insert', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		desktopHelper.insertComment();
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
	var newFileName;

	beforeEach(function() {
		newFileName = helper.setupAndLoadDocument('impress/comment_switching.odp');
		desktopHelper.switchUIToNotebookbar();

		if (Cypress.env('INTEGRATION') === 'nextcloud') {
			desktopHelper.hideSidebarIfVisible();
		}

		// TODO: skip sidebar detection on reload
		// cy.cGet('#options-modify-page').click();

		desktopHelper.selectZoomLevel('50');
	});

	it('Insert', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
	});

	it('Modify', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('contain','some text0');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('contain','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('Remove',function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Remove').click();
		cy.cGet('.leaflet-marker-icon').should('not.exist');
	});

	it('Reply',function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('contain','some text');
		cy.cGet('.cool-annotation-table .avatar-img').click();
		cy.cGet('.cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Reply').click();
		cy.cGet('#annotation-reply-textarea-1').type('some reply text');
		cy.cGet('#annotation-reply-1').click();
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Autosave Collapse', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		helper.typeIntoDocument('{home}');
		cy.cGet('.cool-annotation-info-collapsed').should('have.text','!');
		cy.cGet('.cool-annotation-info-collapsed').should('be.visible');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-info-collapsed').should('not.have.text','!');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-info-collapsed').should('be.not.visible');

		helper.reloadDocument(newFileName, 'impress');
		cy.cGet('.cool-annotation-img').click();
		cy.cGet('.cool-annotation-content-wrapper').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-info-collapsed').should('be.not.visible');
	})
});

describe(['tagdesktop'], 'Comment Scrolling',function() {

	beforeEach(function() {
		cy.viewport(1500, 600);
		helper.setupAndLoadDocument('impress/comment_switching.odp');
		desktopHelper.switchUIToNotebookbar();

		cy.cGet('#options-modify-page').click();
		desktopHelper.selectZoomLevel('50');
	});

	it('no comment or one comment', function() {
		cy.cGet('.leaflet-control-scroll-down').should('not.exist');
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
	});

	it('omit slides without comments', function() {
		//scroll up
		desktopHelper.insertComment();
		addSlide(2);
		desktopHelper.insertComment();
		helper.waitUntilIdle('.leaflet-control-scroll-up');
		cy.cGet('.leaflet-control-scroll-up').should('be.visible');
		cy.cGet('.leaflet-control-scroll-up').click().wait(300);
		cy.cGet('#SlideStatus').should('contain','Slide 1 of 3');

		//scroll down
		cy.cGet('.leaflet-control-scroll-down').should('exist');
		cy.cGet('.leaflet-control-scroll-down').click().wait(1000);
		cy.cGet('#SlideStatus').should('contain','Slide 3 of 3');
	});

	it('switch to previous or next slide',function() {
		addSlide(1);
		desktopHelper.insertComment();
		desktopHelper.insertComment();

		//scroll up
		addSlide(1);
		cy.cGet('.leaflet-control-scroll-up').should('exist');
		cy.cGet('.leaflet-control-scroll-up').click().wait(300);
		cy.cGet('#SlideStatus').should('contain','Slide 2 of 3');

		//scroll down
		changeSlide(1,'previous');
		cy.cGet('.leaflet-control-scroll-down').should('exist');
		cy.cGet('.leaflet-control-scroll-down').click().wait(300);
		cy.cGet('#SlideStatus').should('contain','Slide 2 of 3');
	});
});

describe(['tagdesktop'], 'Annotation Autosave Tests', function() {
	var newFileName;

	beforeEach(function() {
		cy.viewport(2400, 600);
		newFileName = helper.setupAndLoadDocument('impress/comment_switching.odp');
		desktopHelper.switchUIToNotebookbar();

		// TODO: skip sidebar detection on reload
		// if (Cypress.env('INTEGRATION') === 'nextcloud') {
			// desktopHelper.hideSidebarIfVisible();
		// }
		// cy.cGet('#options-modify-page').click();

		desktopHelper.selectZoomLevel('50');
	});

	it('Insert autosave', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Insert autosave save', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('be.not.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.not.visible');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Insert autosave cancel', function() {
		desktopHelper.insertComment(undefined, false);
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('.cool-annotation-autosavelabel').should('not.exist');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('not.exist');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('not.exist');
		cy.cGet('.cool-annotation-content > div').should('not.exist');
	});

	it('Modify autosave', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave save', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-save-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some other text, some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some other text, some text0');
	});

	it('Modify autosave cancel', function() {
		desktopHelper.insertComment();
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.cool-annotation-content-wrapper:visible .cool-annotation-menu').click();
		cy.cGet('body').contains('.context-menu-item','Modify').click();
		cy.cGet('#annotation-modify-textarea-1').type('some other text, ');
		cy.cGet('#map').focus();
		cy.cGet('.cool-annotation-autosavelabel').should('be.visible');
		cy.cGet('.cool-annotation-edit.modify-annotation').should('be.visible');
		cy.cGet('#annotation-cancel-1').click();
		cy.cGet('#annotation-content-area-1').should('have.text','some text0');
		cy.cGet('.leaflet-marker-icon').should('exist');

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.leaflet-marker-icon').should('exist');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});

	it('Reply autosave',function() {
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

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Reply autosave save',function() {
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

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('include.text','some reply text');
	});

	it('Reply autosave cancel',function() {
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

		helper.reloadDocument(newFileName,'impress');
		cy.cGet('.cool-annotation-edit.reply-annotation').should('be.not.visible');
		cy.cGet('.cool-annotation-content > div').should('have.text','some text0');
	});
});
